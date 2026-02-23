import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class DeviceGroupsService {
    private readonly logger = new Logger(DeviceGroupsService.name);

    constructor(private readonly prisma: PrismaService) { }

    async findAll() {
        return this.prisma.deviceGroup.findMany({
            include: { _count: { select: { members: true } } },
            orderBy: { name: 'asc' },
        });
    }

    async findOne(id: number) {
        const group = await this.prisma.deviceGroup.findUnique({
            where: { id },
            include: {
                members: {
                    include: {
                        device: {
                            select: { id: true, hostname: true, ipAddress: true, status: true, deviceType: true },
                        },
                    },
                },
            },
        });
        if (!group) throw new NotFoundException(`Group #${id} not found`);
        return group;
    }

    async create(name: string, description?: string) {
        const group = await this.prisma.deviceGroup.create({
            data: { name, description },
        });
        this.logger.log(`Created group "${name}" (id: ${group.id})`);
        return group;
    }

    async remove(id: number) {
        await this.prisma.deviceGroup.delete({ where: { id } });
        this.logger.log(`Deleted group #${id}`);
        return { deleted: true };
    }

    async addMembers(groupId: number, deviceIds: number[]) {
        const data = deviceIds.map(deviceId => ({ groupId, deviceId }));
        const result = await this.prisma.deviceGroupMember.createMany({
            data,
            skipDuplicates: true,
        });
        this.logger.log(`Added ${result.count} members to group #${groupId}`);
        return { added: result.count };
    }

    async removeMembers(groupId: number, deviceIds: number[]) {
        const result = await this.prisma.deviceGroupMember.deleteMany({
            where: { groupId, deviceId: { in: deviceIds } },
        });
        this.logger.log(`Removed ${result.count} members from group #${groupId}`);
        return { removed: result.count };
    }
}
