import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
    CreateTicketDto, UpdateTicketDto, TicketQueryDto,
    CreateTicketCommentDto, AssignTicketDto,
    TicketPriorityEnum, TicketCategoryEnum,
} from './tickets.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TicketsService {
    constructor(private readonly prisma: PrismaService) { }

    // ─── Ticket Number Generator ────────────────────────

    private async generateTicketNumber(): Promise<string> {
        const count = await this.prisma.ticket.count();
        return `TK-${String(count + 1).padStart(4, '0')}`;
    }

    // ─── Create ─────────────────────────────────────────

    async create(dto: CreateTicketDto, creatorId: number) {
        const ticketNumber = await this.generateTicketNumber();

        // Validate foreign keys to avoid FK constraint violations
        let deviceId: number | undefined = dto.deviceId || undefined;
        let alertId: number | undefined = dto.alertId || undefined;
        let assigneeId: number | undefined = dto.assigneeId || undefined;

        if (deviceId) {
            const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
            if (!device) deviceId = undefined;
        }
        if (alertId) {
            const alert = await this.prisma.alertHistory.findUnique({ where: { id: alertId } });
            if (!alert) alertId = undefined;
        }
        if (assigneeId) {
            const user = await this.prisma.user.findUnique({ where: { id: assigneeId } });
            if (!user) assigneeId = undefined;
        }

        return this.prisma.ticket.create({
            data: {
                ticketNumber,
                title: dto.title,
                description: dto.description,
                priority: dto.priority as any,
                category: dto.category as any,
                deviceId,
                alertId,
                creatorId,
                assigneeId,
                dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
                tags: dto.tags || [],
            },
            include: {
                device: { select: { id: true, hostname: true, displayName: true, status: true } },
                creator: { select: { id: true, username: true, displayName: true } },
                assignee: { select: { id: true, username: true, displayName: true } },
                alert: { select: { id: true, message: true, severity: true } },
                _count: { select: { comments: true, attachments: true } },
            },
        });
    }

    // ─── List with Filters ──────────────────────────────

    async findAll(query: TicketQueryDto) {
        const page = query.page || 1;
        const limit = Math.min(query.limit || 20, 100);
        const skip = (page - 1) * limit;

        const where: Prisma.TicketWhereInput = {};

        if (query.status) where.status = query.status as any;
        if (query.priority) where.priority = query.priority as any;
        if (query.category) where.category = query.category as any;
        if (query.assigneeId) where.assigneeId = query.assigneeId;
        if (query.deviceId) where.deviceId = query.deviceId;

        if (query.search) {
            where.OR = [
                { title: { contains: query.search, mode: 'insensitive' } },
                { ticketNumber: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        // Dynamic sorting
        const allowedSorts = ['createdAt', 'updatedAt', 'priority', 'status', 'ticketNumber', 'title'];
        const sortField = allowedSorts.includes(query.sortBy || '') ? query.sortBy! : 'createdAt';
        const sortDir = query.sortOrder === 'asc' ? 'asc' : 'desc';

        const [data, total] = await Promise.all([
            this.prisma.ticket.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sortField]: sortDir },
                include: {
                    device: { select: { id: true, hostname: true, displayName: true, status: true } },
                    creator: { select: { id: true, username: true, displayName: true } },
                    assignee: { select: { id: true, username: true, displayName: true } },
                    _count: { select: { comments: true, attachments: true } },
                },
            }),
            this.prisma.ticket.count({ where }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // ─── Get One ────────────────────────────────────────

    async findOne(id: number) {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id },
            include: {
                device: { select: { id: true, hostname: true, displayName: true, ipAddress: true, status: true, deviceType: true } },
                creator: { select: { id: true, username: true, displayName: true } },
                assignee: { select: { id: true, username: true, displayName: true } },
                alert: { select: { id: true, message: true, severity: true, state: true, triggeredAt: true } },
                comments: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        user: { select: { id: true, username: true, displayName: true } },
                        parent: {
                            select: {
                                id: true,
                                content: true,
                                user: { select: { id: true, username: true, displayName: true } },
                            },
                        },
                    },
                },
                attachments: {
                    orderBy: { createdAt: 'desc' },
                },
                _count: { select: { comments: true, attachments: true } },
            },
        });

        if (!ticket) throw new NotFoundException(`Ticket #${id} not found`);
        return ticket;
    }

    // ─── Update ─────────────────────────────────────────

    async update(id: number, dto: UpdateTicketDto, userId: number) {
        const existing = await this.prisma.ticket.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Ticket #${id} not found`);

        const data: any = {};
        const changes: string[] = [];

        if (dto.title !== undefined) { data.title = dto.title; changes.push(`title updated`); }
        if (dto.description !== undefined) { data.description = dto.description; changes.push(`description updated`); }
        if (dto.priority !== undefined) { data.priority = dto.priority; changes.push(`priority → ${dto.priority}`); }
        if (dto.category !== undefined) { data.category = dto.category; changes.push(`category → ${dto.category}`); }
        if (dto.tags !== undefined) { data.tags = dto.tags; changes.push(`tags updated`); }
        if (dto.assigneeId !== undefined) { data.assigneeId = dto.assigneeId; changes.push(`reassigned`); }
        if (dto.dueDate !== undefined) { data.dueDate = new Date(dto.dueDate); changes.push(`due date updated`); }

        if (dto.status !== undefined) {
            data.status = dto.status;
            changes.push(`status → ${dto.status}`);
            if (dto.status === 'resolved') data.resolvedAt = new Date();
            if (dto.status === 'closed') data.closedAt = new Date();
        }

        const updated = await this.prisma.ticket.update({
            where: { id },
            data,
            include: {
                device: { select: { id: true, hostname: true, displayName: true, status: true } },
                creator: { select: { id: true, username: true, displayName: true } },
                assignee: { select: { id: true, username: true, displayName: true } },
                _count: { select: { comments: true, attachments: true } },
            },
        });

        // Add system comment for tracking changes
        if (changes.length > 0) {
            await this.prisma.ticketComment.create({
                data: {
                    ticketId: id,
                    userId,
                    content: changes.join(', '),
                    isSystem: true,
                },
            });
        }

        return updated;
    }

    // ─── Delete ─────────────────────────────────────────

    async delete(id: number) {
        const existing = await this.prisma.ticket.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Ticket #${id} not found`);

        await this.prisma.ticket.delete({ where: { id } });
        return { message: `Ticket ${existing.ticketNumber} deleted` };
    }

    // ─── Add Comment ────────────────────────────────────

    async addComment(ticketId: number, dto: CreateTicketCommentDto, userId: number) {
        const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) throw new NotFoundException(`Ticket #${ticketId} not found`);

        return this.prisma.ticketComment.create({
            data: {
                ticketId,
                userId,
                content: dto.content,
                isSystem: false,
                ...(dto.parentId ? { parentId: dto.parentId } : {}),
            },
            include: {
                user: { select: { id: true, username: true, displayName: true } },
            },
        });
    }

    // ─── Assign ─────────────────────────────────────────

    async assign(ticketId: number, dto: AssignTicketDto, userId: number) {
        const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) throw new NotFoundException(`Ticket #${ticketId} not found`);

        const assignee = await this.prisma.user.findUnique({ where: { id: dto.assigneeId } });
        if (!assignee) throw new BadRequestException(`User #${dto.assigneeId} not found`);

        const updated = await this.prisma.ticket.update({
            where: { id: ticketId },
            data: { assigneeId: dto.assigneeId },
            include: {
                assignee: { select: { id: true, username: true, displayName: true } },
            },
        });

        // System comment
        await this.prisma.ticketComment.create({
            data: {
                ticketId,
                userId,
                content: `Assigned to ${assignee.displayName || assignee.username}`,
                isSystem: true,
            },
        });

        return updated;
    }

    // ─── Create from Alert ──────────────────────────────

    async createFromAlert(alertId: number, creatorId: number) {
        const alert = await this.prisma.alertHistory.findUnique({
            where: { id: alertId },
            include: { device: true, rule: true },
        });

        if (!alert) throw new NotFoundException(`Alert #${alertId} not found`);

        const priorityMap: Record<string, TicketPriorityEnum> = {
            critical: TicketPriorityEnum.critical,
            warning: TicketPriorityEnum.high,
            info: TicketPriorityEnum.medium,
        };

        return this.create({
            title: `[Alert] ${alert.rule.name} on ${alert.device.displayName || alert.device.hostname}`,
            description: alert.message,
            priority: priorityMap[alert.severity] || TicketPriorityEnum.medium,
            category: TicketCategoryEnum.incident,
            deviceId: alert.deviceId,
            alertId: alert.id,
            tags: ['auto-generated', 'alert'],
        }, creatorId);
    }

    // ─── Dashboard Stats ────────────────────────────────

    async getStats() {
        const [open, inProgress, waiting, escalated, onHold, resolved, closed, overdue, byPriority] = await Promise.all([
            this.prisma.ticket.count({ where: { status: 'open' } }),
            this.prisma.ticket.count({ where: { status: 'in_progress' } }),
            this.prisma.ticket.count({ where: { status: 'waiting' } }),
            this.prisma.ticket.count({ where: { status: 'escalated' } }),
            this.prisma.ticket.count({ where: { status: 'on_hold' } }),
            this.prisma.ticket.count({ where: { status: 'resolved' } }),
            this.prisma.ticket.count({ where: { status: 'closed' } }),
            this.prisma.ticket.count({
                where: {
                    dueDate: { lt: new Date() },
                    status: { notIn: ['resolved', 'closed'] },
                },
            }),
            this.prisma.ticket.groupBy({
                by: ['priority'],
                _count: true,
                where: { status: { notIn: ['resolved', 'closed'] } },
            }),
        ]);

        return {
            open,
            inProgress,
            waiting,
            escalated,
            onHold,
            resolved,
            closed,
            overdue,
            total: open + inProgress + waiting + escalated + onHold + resolved + closed,
            byPriority: byPriority.reduce((acc, item) => {
                acc[item.priority] = item._count;
                return acc;
            }, {} as Record<string, number>),
        };
    }
}
