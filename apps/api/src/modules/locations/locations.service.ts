import {
    Injectable,
    NotFoundException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLocationDto, UpdateLocationDto, LocationQueryDto } from './locations.dto';

@Injectable()
export class LocationsService {
    private readonly logger = new Logger(LocationsService.name);

    constructor(private readonly prisma: PrismaService) { }

    async findAll(query: LocationQueryDto) {
        const { page = 1, limit = 25, search } = query;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await Promise.all([
            this.prisma.location.findMany({
                where,
                skip,
                take: limit,
                orderBy: { code: 'asc' },
                include: {
                    _count: { select: { devices: true } },
                },
            }),
            this.prisma.location.count({ where }),
        ]);

        return {
            items,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        };
    }

    async findOne(id: number) {
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
                _count: { select: { devices: true } },
            },
        });

        if (!location) {
            throw new NotFoundException(`Location #${id} not found`);
        }

        return location;
    }

    async create(dto: CreateLocationDto) {
        const existing = await this.prisma.location.findUnique({
            where: { code: dto.code },
        });

        if (existing) {
            throw new ConflictException(`Location with code "${dto.code}" already exists`);
        }

        const location = await this.prisma.location.create({
            data: dto,
            include: { _count: { select: { devices: true } } },
        });

        this.logger.log(`Location created: ${location.code} — ${location.name}`);
        return location;
    }

    async update(id: number, dto: UpdateLocationDto) {
        const existing = await this.prisma.location.findUnique({ where: { id } });
        if (!existing) {
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
            include: { _count: { select: { devices: true } } },
        });

        this.logger.log(`Location updated: ${location.code}`);
        return location;
    }

    async remove(id: number) {
        const existing = await this.prisma.location.findUnique({
            where: { id },
            include: { _count: { select: { devices: true } } },
        });

        if (!existing) {
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
