import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
    CreateTicketDto, UpdateTicketDto, TicketQueryDto,
    CreateTicketCommentDto, AssignTicketDto,
    TicketPriorityEnum, TicketCategoryEnum,
} from './tickets.dto';
import { Prisma } from '@prisma/client';
import { TenantUser, isSuperAdmin } from '../../common/guards/tenant.guard';

@Injectable()
export class TicketsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly settings: SettingsService,
    ) { }

    // ─── Helpers ────────────────────────────────────────

    private async generateTicketNumber(): Promise<string> {
        const last = await this.prisma.ticket.findFirst({
            orderBy: { id: 'desc' },
            select: { id: true },
        });
        const nextSeq = (last?.id ?? 0) + 1;
        const prefix = await this.settings.getString('ticket.prefix', 'TKT-');
        const normalizedPrefix = prefix.endsWith('-') ? prefix : `${prefix}-`;
        return `${normalizedPrefix}${String(nextSeq).padStart(4, '0')}`;
    }

    /**
     * Verify the ticket belongs to the user's tenant.
     * Returns the ticket if access is granted; throws otherwise.
     */
    private async verifyTicketAccess(ticketId: number, user: TenantUser) {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
                creator: { select: { id: true, tenantId: true } },
            },
        });
        if (!ticket) throw new NotFoundException(`Ticket #${ticketId} not found`);
        if (!isSuperAdmin(user) && user.tenantId && ticket.creator?.tenantId !== user.tenantId) {
            throw new ForbiddenException('Access denied — ticket belongs to another tenant');
        }
        return ticket;
    }

    // ─── Create ─────────────────────────────────────────

    async create(dto: CreateTicketDto, user: TenantUser) {
        const ticketNumber = await this.generateTicketNumber();

        // Validate foreign keys
        let deviceId: number | undefined = dto.deviceId || undefined;
        let alertId: number | undefined = dto.alertId || undefined;
        let assigneeId: number | undefined = dto.assigneeId || undefined;

        if (deviceId) {
            const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
            if (!device) deviceId = undefined;
            // Tenant isolation: verify device belongs to same tenant
            if (device && !isSuperAdmin(user) && user.tenantId && device.tenantId !== user.tenantId) {
                deviceId = undefined;
            }
        }
        if (alertId) {
            const alert = await this.prisma.alertHistory.findUnique({ where: { id: alertId } });
            if (!alert) alertId = undefined;
        }

        // If no assignee specified, auto-assign to team head (admin of the tenant)
        if (!assigneeId && user.tenantId) {
            const teamHead = await this.prisma.user.findFirst({
                where: {
                    tenantId: user.tenantId,
                    role: 'admin',
                    isActive: true,
                },
                orderBy: { createdAt: 'asc' },
            });
            if (teamHead) assigneeId = teamHead.id;
        }

        if (assigneeId) {
            const assignee = await this.prisma.user.findUnique({ where: { id: assigneeId } });
            if (!assignee) assigneeId = undefined;
            // Tenant isolation: verify assignee belongs to same tenant
            if (assignee && !isSuperAdmin(user) && user.tenantId && assignee.tenantId !== user.tenantId) {
                assigneeId = undefined;
            }
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
                creatorId: user.id,
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

    async findAll(query: TicketQueryDto, user?: TenantUser) {
        const page = query.page || 1;
        const limit = Math.min(query.limit || 20, 100);
        const skip = (page - 1) * limit;

        const where: Prisma.TicketWhereInput = {};

        // Tenant isolation: filter tickets by creator's tenant
        if (user && !isSuperAdmin(user) && user.tenantId) {
            where.creator = { tenantId: user.tenantId };
        }

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

    async findOne(id: number, user?: TenantUser) {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id },
            include: {
                device: { select: { id: true, hostname: true, displayName: true, ipAddress: true, status: true, deviceType: true } },
                creator: { select: { id: true, username: true, displayName: true, tenantId: true } },
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

        // Tenant isolation check
        if (user && !isSuperAdmin(user) && user.tenantId && (ticket.creator as any)?.tenantId !== user.tenantId) {
            throw new ForbiddenException('Access denied — ticket belongs to another tenant');
        }

        return ticket;
    }

    // ─── Update ─────────────────────────────────────────

    async update(id: number, dto: UpdateTicketDto, user: TenantUser) {
        await this.verifyTicketAccess(id, user);

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

        if (changes.length > 0) {
            await this.prisma.ticketComment.create({
                data: {
                    ticketId: id,
                    userId: user.id,
                    content: changes.join(', '),
                    isSystem: true,
                },
            });
        }

        return updated;
    }

    // ─── Delete ─────────────────────────────────────────

    async delete(id: number, user?: TenantUser) {
        const existing = await this.prisma.ticket.findUnique({
            where: { id },
            include: { creator: { select: { tenantId: true } } },
        });
        if (!existing) throw new NotFoundException(`Ticket #${id} not found`);

        // Tenant isolation
        if (user && !isSuperAdmin(user) && user.tenantId && (existing.creator as any)?.tenantId !== user.tenantId) {
            throw new ForbiddenException('Access denied — ticket belongs to another tenant');
        }

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

    async assign(ticketId: number, dto: AssignTicketDto, user: TenantUser) {
        await this.verifyTicketAccess(ticketId, user);

        const assignee = await this.prisma.user.findUnique({ where: { id: dto.assigneeId } });
        if (!assignee) throw new BadRequestException(`User #${dto.assigneeId} not found`);

        // Tenant isolation: ensure assignee is in same tenant
        if (!isSuperAdmin(user) && user.tenantId && assignee.tenantId !== user.tenantId) {
            throw new ForbiddenException('Cannot assign ticket to a user from another tenant');
        }

        const updated = await this.prisma.ticket.update({
            where: { id: ticketId },
            data: { assigneeId: dto.assigneeId },
            include: {
                assignee: { select: { id: true, username: true, displayName: true } },
            },
        });

        await this.prisma.ticketComment.create({
            data: {
                ticketId,
                userId: user.id,
                content: `Assigned to ${assignee.displayName || assignee.username}`,
                isSystem: true,
            },
        });

        return updated;
    }

    // ─── Create from Alert ──────────────────────────────

    async createFromAlert(alertId: number, user: TenantUser) {
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
        }, user);
    }

    // ─── Team Members (for assignment dropdown) ─────────

    async getTeamMembers(user: TenantUser) {
        const where: Prisma.UserWhereInput = { isActive: true };

        // Non-superadmin: only show users from the same tenant
        if (!isSuperAdmin(user) && user.tenantId) {
            where.tenantId = user.tenantId;
        }

        const members = await this.prisma.user.findMany({
            where,
            select: {
                id: true,
                username: true,
                displayName: true,
                role: true,
                email: true,
            },
            orderBy: [
                { role: 'asc' },  // admin first
                { displayName: 'asc' },
            ],
        });

        return members;
    }

    // ─── Dashboard Stats ────────────────────────────────

    async getStats(user?: TenantUser) {
        const tenantFilter: Prisma.TicketWhereInput = {};
        if (user && !isSuperAdmin(user) && user.tenantId) {
            tenantFilter.creator = { tenantId: user.tenantId };
        }

        const [open, inProgress, waiting, escalated, onHold, resolved, closed, overdue, byPriority] = await Promise.all([
            this.prisma.ticket.count({ where: { status: 'open', ...tenantFilter } }),
            this.prisma.ticket.count({ where: { status: 'in_progress', ...tenantFilter } }),
            this.prisma.ticket.count({ where: { status: 'waiting', ...tenantFilter } }),
            this.prisma.ticket.count({ where: { status: 'escalated', ...tenantFilter } }),
            this.prisma.ticket.count({ where: { status: 'on_hold', ...tenantFilter } }),
            this.prisma.ticket.count({ where: { status: 'resolved', ...tenantFilter } }),
            this.prisma.ticket.count({ where: { status: 'closed', ...tenantFilter } }),
            this.prisma.ticket.count({
                where: {
                    dueDate: { lt: new Date() },
                    status: { notIn: ['resolved', 'closed'] },
                    ...tenantFilter,
                },
            }),
            this.prisma.ticket.groupBy({
                by: ['priority'],
                _count: true,
                where: { status: { notIn: ['resolved', 'closed'] }, ...tenantFilter },
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
