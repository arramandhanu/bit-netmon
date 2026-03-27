import {
    Injectable,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface InterfaceQueryDto {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    adminStatus?: string;
    type?: string;
    deviceId?: number;
    pollingEnabled?: boolean;
}

export interface UpdateInterfaceDto {
    ifAdminStatus?: string;
    ifAlias?: string;
    pollingEnabled?: boolean;
}

@Injectable()
export class InterfacesService {
    private readonly logger = new Logger(InterfacesService.name);

    constructor(private readonly prisma: PrismaService) { }

    async findByDeviceId(deviceId: number) {
        return this.prisma.interface.findMany({
            where: { deviceId },
            orderBy: { ifIndex: 'asc' },
        });
    }

    async findAll(query: InterfaceQueryDto) {
        const { page = 1, limit = 25, search, status, adminStatus, type, deviceId, pollingEnabled } = query;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (search) {
            where.OR = [
                { ifName: { contains: search, mode: 'insensitive' } },
                { ifAlias: { contains: search, mode: 'insensitive' } },
                { ifDescr: { contains: search, mode: 'insensitive' } },
                { device: { hostname: { contains: search, mode: 'insensitive' } } },
            ];
        }

        if (status) where.ifOperStatus = status;
        if (adminStatus) where.ifAdminStatus = adminStatus;
        if (type) where.ifType = type;
        if (deviceId) where.deviceId = Number(deviceId);
        if (pollingEnabled !== undefined) where.pollingEnabled = pollingEnabled;

        const [items, total] = await Promise.all([
            this.prisma.interface.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: [
                    { device: { hostname: 'asc' } },
                    { ifIndex: 'asc' },
                ],
                include: {
                    device: {
                        select: {
                            id: true,
                            hostname: true,
                            ipAddress: true,
                            status: true,
                            locationId: true,
                        },
                    },
                },
            }),
            this.prisma.interface.count({ where }),
        ]);

        // Compute summary stats
        const [totalUp, totalDown, totalInterfaces] = await Promise.all([
            this.prisma.interface.count({ where: { ...where, ifOperStatus: 'up' } }),
            this.prisma.interface.count({ where: { ...where, ifOperStatus: 'down' } }),
            this.prisma.interface.count({}),
        ]);

        // Get distinct types for filter options
        const typeOptions = await this.prisma.interface.findMany({
            select: { ifType: true },
            distinct: ['ifType'],
            where: { ifType: { not: null } },
            orderBy: { ifType: 'asc' },
        });

        return {
            items,
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit)),
            stats: {
                totalInterfaces,
                totalUp,
                totalDown,
            },
            filterOptions: {
                types: typeOptions.map(t => t.ifType).filter(Boolean),
            },
        };
    }

    async findOne(id: number) {
        const iface = await this.prisma.interface.findUnique({
            where: { id },
            include: {
                device: {
                    select: {
                        id: true,
                        hostname: true,
                        ipAddress: true,
                        status: true,
                        deviceType: true,
                        vendor: true,
                        location: { select: { id: true, name: true } },
                    },
                },
            },
        });

        if (!iface) {
            throw new NotFoundException(`Interface #${id} not found`);
        }

        return iface;
    }

    async update(id: number, dto: UpdateInterfaceDto) {
        const existing = await this.prisma.interface.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException(`Interface #${id} not found`);
        }

        const updated = await this.prisma.interface.update({
            where: { id },
            data: dto,
            include: {
                device: {
                    select: { id: true, hostname: true, ipAddress: true },
                },
            },
        });

        this.logger.log(`Interface #${id} updated: ${JSON.stringify(dto)}`);
        return updated;
    }

    async bulkUpdate(ids: number[], dto: UpdateInterfaceDto) {
        await this.prisma.interface.updateMany({
            where: { id: { in: ids } },
            data: dto,
        });

        this.logger.log(`Bulk updated ${ids.length} interfaces: ${JSON.stringify(dto)}`);
        return { updated: ids.length };
    }
}
