import {
    Injectable,
    NotFoundException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLocationDto, UpdateLocationDto, LocationQueryDto } from './locations.dto';
import { TenantUser, isSuperAdmin } from '../../common/guards/tenant.guard';

@Injectable()
export class LocationsService {
    private readonly logger = new Logger(LocationsService.name);

    constructor(private readonly prisma: PrismaService) { }

    async findAll(query: LocationQueryDto, user?: TenantUser) {
        const { page = 1, limit = 25, search } = query;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (user && !isSuperAdmin(user) && user.tenantId) {
            where.OR = [
                { tenantId: user.tenantId },
                { tenantId: null },
            ];
        }
        if (search) {
            // Wrap search in AND to avoid overwriting tenant OR
            where.AND = [
                {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { code: { contains: search, mode: 'insensitive' } },
                        { address: { contains: search, mode: 'insensitive' } },
                        { city: { contains: search, mode: 'insensitive' } },
                    ],
                },
            ];
        }

        this.logger.log(`findAll called by user=${user?.id} role=${user?.role} tenant=${user?.tenantId} where=${JSON.stringify(where)}`);

        try {
            const [items, total] = await Promise.all([
                this.prisma.location.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { code: 'asc' },
                    include: {
                        _count: { select: { devices: true, serverMonitors: true, urlMonitors: true } },
                        devices: {
                            select: { id: true, status: true, hostname: true },
                        },
                    },
                }),
                this.prisma.location.count({ where }),
            ]);

            // Compute status summary per location
            const enriched = items.map((loc: any) => {
                const statusSummary: Record<string, number> = {};
                (loc.devices || []).forEach((d: any) => {
                    statusSummary[d.status] = (statusSummary[d.status] || 0) + 1;
                });
                return { ...loc, statusSummary };
            });

            return {
                items: enriched,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            };
        } catch (err) {
            this.logger.error(`findAll error: ${err}`);
            throw err;
        }
    }


    async findOne(id: number, user?: TenantUser) {
        const location = await this.prisma.location.findUnique({
            where: { id },
            include: {
                devices: {
                    select: {
                        id: true,
                        hostname: true,
                        ipAddress: true,
                        status: true,
                        deviceType: true,
                    },
                    orderBy: { hostname: 'asc' },
                },
                serverMonitors: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        serverType: true,
                        ipAddress: true,
                    },
                    orderBy: { name: 'asc' },
                },
                urlMonitors: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        url: true,
                    },
                    orderBy: { name: 'asc' },
                },
                _count: { select: { devices: true, serverMonitors: true, urlMonitors: true } },
            },
        });

        if (!location || (user && !isSuperAdmin(user) && location.tenantId !== user.tenantId)) {
            throw new NotFoundException(`Location #${id} not found`);
        }

        return location;
    }

    async create(dto: CreateLocationDto, user?: TenantUser) {
        const existing = await this.prisma.location.findUnique({
            where: { code: dto.code },
        });

        if (existing) {
            throw new ConflictException(`Location with code "${dto.code}" already exists`);
        }

        const location = await this.prisma.location.create({
            data: {
                ...dto,
                ...(user ? { tenantId: user.tenantId } : {}),
            },
            include: { _count: { select: { devices: true, serverMonitors: true, urlMonitors: true } } },
        });

        this.logger.log(`Location created: ${location.code} — ${location.name}`);
        return location;
    }

    async update(id: number, dto: UpdateLocationDto, user?: TenantUser) {
        const existing = await this.prisma.location.findUnique({ where: { id } });
        if (!existing || (user && !isSuperAdmin(user) && existing.tenantId !== user.tenantId)) {
            throw new NotFoundException(`Location #${id} not found`);
        }

        if (dto.code && dto.code !== existing.code) {
            const conflict = await this.prisma.location.findUnique({
                where: { code: dto.code },
            });
            if (conflict) {
                throw new ConflictException(`Location with code "${dto.code}" already exists`);
            }
        }

        const location = await this.prisma.location.update({
            where: { id },
            data: dto,
            include: { _count: { select: { devices: true, serverMonitors: true, urlMonitors: true } } },
        });

        this.logger.log(`Location updated: ${location.code}`);
        return location;
    }

    async remove(id: number, user?: TenantUser) {
        const existing = await this.prisma.location.findUnique({
            where: { id },
            include: { _count: { select: { devices: true, serverMonitors: true, urlMonitors: true } } },
        });

        if (!existing || (user && !isSuperAdmin(user) && existing.tenantId !== user.tenantId)) {
            throw new NotFoundException(`Location #${id} not found`);
        }

        if (existing._count.devices > 0) {
            throw new ConflictException(
                `Cannot delete location "${existing.code}" — it has ${existing._count.devices} device(s). Reassign them first.`,
            );
        }

        await this.prisma.location.delete({ where: { id } });
        this.logger.log(`Location deleted: ${existing.code}`);

        return { message: `Location "${existing.code}" deleted` };
    }
}
