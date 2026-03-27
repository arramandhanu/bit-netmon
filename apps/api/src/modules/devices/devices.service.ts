import {
    Injectable,
    NotFoundException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { SnmpService, SnmpTarget } from '../snmp/snmp.service';
import { CreateDeviceDto, UpdateDeviceDto, DeviceQueryDto, TestSnmpDto } from './devices.dto';
import { TenantUser, tenantWhere, isSuperAdmin } from '../../common/guards/tenant.guard';

@Injectable()
export class DevicesService {
    private readonly logger = new Logger(DevicesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly encryption: EncryptionService,
        private readonly snmp: SnmpService,
    ) { }

    async findAll(query: DeviceQueryDto, user?: TenantUser) {
        const { page = 1, limit = 25, status, type, locationId, search } = query;
        const skip = (page - 1) * limit;

        const where: any = { ...(user ? tenantWhere(user) : {}) };

        if (status) where.status = status;
        if (type) where.deviceType = type;
        if (locationId) where.locationId = locationId;
        if (search) {
            where.OR = [
                { hostname: { contains: search, mode: 'insensitive' } },
                { ipAddress: { contains: search } },
                { displayName: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await Promise.all([
            this.prisma.device.findMany({
                where,
                skip,
                take: limit,
                orderBy: { hostname: 'asc' },
                include: {
                    location: { select: { id: true, name: true, code: true } },
                    _count: { select: { interfaces: true } },
                },
            }),
            this.prisma.device.count({ where }),
        ]);

        // Strip encrypted SNMP credentials from list view
        const sanitized = items.map((device) => ({
            ...device,
            snmpCommunity: device.snmpCommunity ? '••••••' : null,
            snmpV3AuthPass: device.snmpV3AuthPass ? '••••••' : null,
            snmpV3PrivPass: device.snmpV3PrivPass ? '••••••' : null,
        }));

        return {
            items: sanitized,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        };
    }

    async findOne(id: number, user?: TenantUser) {
        const device = await this.prisma.device.findUnique({
            where: { id },
            include: {
                location: true,
                interfaces: {
                    orderBy: { ifIndex: 'asc' },
                },
            },
        });

        if (!device || (user && !isSuperAdmin(user) && device.tenantId !== user.tenantId)) {
            throw new NotFoundException(`Device #${id} not found`);
        }

        // Mask credentials
        return {
            ...device,
            snmpCommunity: device.snmpCommunity ? '••••••' : null,
            snmpV3AuthPass: device.snmpV3AuthPass ? '••••••' : null,
            snmpV3PrivPass: device.snmpV3PrivPass ? '••••••' : null,
        };
    }

    async create(dto: CreateDeviceDto, user?: TenantUser) {
        // Check hostname uniqueness
        const existing = await this.prisma.device.findUnique({
            where: { hostname: dto.hostname },
        });

        if (existing) {
            throw new ConflictException(`Device with hostname "${dto.hostname}" already exists`);
        }

        // Encrypt SNMP credentials
        const data: any = {
            hostname: dto.hostname,
            ipAddress: dto.ipAddress,
            displayName: dto.displayName,
            deviceType: dto.deviceType || 'unknown',
            locationId: dto.locationId,
            snmpVersion: dto.snmpVersion || 'v2c',
            snmpPort: dto.snmpPort || 161,
            pollingEnabled: dto.pollingEnabled ?? true,
            pollingInterval: dto.pollingInterval || 300,
            ...(user ? { tenantId: user.tenantId } : {}),
        };

        if (dto.snmpCommunity) {
            data.snmpCommunity = this.encryption.encrypt(dto.snmpCommunity);
        }
        if (dto.snmpV3User) data.snmpV3User = dto.snmpV3User;
        if (dto.snmpV3AuthProto) data.snmpV3AuthProto = dto.snmpV3AuthProto;
        if (dto.snmpV3AuthPass) {
            data.snmpV3AuthPass = this.encryption.encrypt(dto.snmpV3AuthPass);
        }
        if (dto.snmpV3PrivProto) data.snmpV3PrivProto = dto.snmpV3PrivProto;
        if (dto.snmpV3PrivPass) {
            data.snmpV3PrivPass = this.encryption.encrypt(dto.snmpV3PrivPass);
        }

        const device = await this.prisma.device.create({
            data,
            include: {
                location: { select: { id: true, name: true, code: true } },
            },
        });

        this.logger.log(`Device created: ${device.hostname} (${device.ipAddress})`);

        return {
            ...device,
            snmpCommunity: device.snmpCommunity ? '••••••' : null,
            snmpV3AuthPass: device.snmpV3AuthPass ? '••••••' : null,
            snmpV3PrivPass: device.snmpV3PrivPass ? '••••••' : null,
        };
    }

    async update(id: number, dto: UpdateDeviceDto, user?: TenantUser) {
        const existing = await this.prisma.device.findUnique({ where: { id } });
        if (!existing || (user && !isSuperAdmin(user) && existing.tenantId !== user.tenantId)) {
            throw new NotFoundException(`Device #${id} not found`);
        }

        // Check hostname uniqueness if changing
        if (dto.hostname && dto.hostname !== existing.hostname) {
            const conflict = await this.prisma.device.findUnique({
                where: { hostname: dto.hostname },
            });
            if (conflict) {
                throw new ConflictException(`Device with hostname "${dto.hostname}" already exists`);
            }
        }

        const data: any = { ...dto };

        // Re-encrypt if credentials changed
        if (dto.snmpCommunity) {
            data.snmpCommunity = this.encryption.encrypt(dto.snmpCommunity);
        }
        if (dto.snmpV3AuthPass) {
            data.snmpV3AuthPass = this.encryption.encrypt(dto.snmpV3AuthPass);
        }
        if (dto.snmpV3PrivPass) {
            data.snmpV3PrivPass = this.encryption.encrypt(dto.snmpV3PrivPass);
        }

        const device = await this.prisma.device.update({
            where: { id },
            data,
            include: {
                location: { select: { id: true, name: true, code: true } },
            },
        });

        this.logger.log(`Device updated: ${device.hostname}`);

        return {
            ...device,
            snmpCommunity: device.snmpCommunity ? '••••••' : null,
            snmpV3AuthPass: device.snmpV3AuthPass ? '••••••' : null,
            snmpV3PrivPass: device.snmpV3PrivPass ? '••••••' : null,
        };
    }

    async remove(id: number, user?: TenantUser) {
        const existing = await this.prisma.device.findUnique({ where: { id } });
        if (!existing || (user && !isSuperAdmin(user) && existing.tenantId !== user.tenantId)) {
            throw new NotFoundException(`Device #${id} not found`);
        }

        await this.prisma.device.delete({ where: { id } });
        this.logger.log(`Device deleted: ${existing.hostname}`);

        return { message: `Device "${existing.hostname}" deleted` };
    }

    async bulkRemove(ids: number[], user?: TenantUser) {
        const tenantFilter = user ? tenantWhere(user) : {};
        const result = await this.prisma.$transaction(async (tx) => {
            // Delete related interfaces first
            await tx.interface.deleteMany({ where: { deviceId: { in: ids } } });
            // Delete devices
            const deleted = await tx.device.deleteMany({ where: { id: { in: ids }, ...tenantFilter } });
            return deleted;
        });

        this.logger.log(`Bulk deleted ${result.count} devices (ids: ${ids.join(', ')})`);
        return { deleted: result.count, message: `${result.count} device(s) deleted` };
    }

    async bulkUpdate(ids: number[], dto: UpdateDeviceDto, user?: TenantUser) {
        if (!ids.length || Object.keys(dto).length === 0) {
            return { updated: 0, message: 'No updates provided' };
        }

        const tenantFilter = user ? tenantWhere(user) : {};
        const data: any = { ...dto };

        // Ensure we encrypt credentials if they are part of the mass update
        if (dto.snmpCommunity) {
            data.snmpCommunity = this.encryption.encrypt(dto.snmpCommunity);
        }
        if (dto.snmpV3AuthPass) {
            data.snmpV3AuthPass = this.encryption.encrypt(dto.snmpV3AuthPass);
        }
        if (dto.snmpV3PrivPass) {
            data.snmpV3PrivPass = this.encryption.encrypt(dto.snmpV3PrivPass);
        }

        // We can't bulk-update hostname safely because it must be unique. Let's explicitly strip it.
        delete data.hostname;
        delete data.ipAddress; // Also probably bad to mass-update IP

        const result = await this.prisma.device.updateMany({
            where: { id: { in: ids }, ...tenantFilter },
            data,
        });

        this.logger.log(`Bulk updated ${result.count} devices (ids: ${ids.join(', ')})`);
        return { updated: result.count, message: `${result.count} device(s) updated` };
    }

    /**
     * Internal method — returns decrypted credentials for SNMP operations.
     * Should NEVER be exposed via API response.
     */
    async getDeviceWithCredentials(id: number) {
        const device = await this.prisma.device.findUnique({ where: { id } });
        if (!device) {
            throw new NotFoundException(`Device #${id} not found`);
        }

        return {
            ...device,
            snmpCommunity: device.snmpCommunity
                ? this.encryption.decrypt(device.snmpCommunity)
                : null,
            snmpV3AuthPass: device.snmpV3AuthPass
                ? this.encryption.decrypt(device.snmpV3AuthPass)
                : null,
            snmpV3PrivPass: device.snmpV3PrivPass
                ? this.encryption.decrypt(device.snmpV3PrivPass)
                : null,
        };
    }

    /**
     * Test SNMP connectivity without saving the device.
     * Returns system info and discovered interfaces on success.
     */
    async testSnmp(dto: TestSnmpDto) {
        const target: SnmpTarget = {
            host: dto.ipAddress,
            port: dto.snmpPort || 161,
            version: (dto.snmpVersion || 'v2c') as 'v1' | 'v2c' | 'v3',
        };

        if (target.version === 'v3') {
            target.v3User = dto.snmpV3User || '';
            target.v3AuthProto = dto.snmpV3AuthProto || 'SHA';
            target.v3AuthPass = dto.snmpV3AuthPass;
            target.v3PrivProto = dto.snmpV3PrivProto || 'AES';
            target.v3PrivPass = dto.snmpV3PrivPass;
        } else {
            target.community = dto.snmpCommunity || 'public';
        }

        const startTime = Date.now();

        // Test basic connectivity
        const reachable = await this.snmp.testConnectivity(target);
        const responseTime = Date.now() - startTime;

        if (!reachable) {
            return {
                success: false,
                responseTime,
                error: 'Device is not reachable via SNMP. Check IP address, port, and community string.',
            };
        }

        // Fetch system info
        try {
            const sysInfo = await this.snmp.getSystemInfo(target);
            const interfaces = await this.snmp.getInterfaces(target);

            return {
                success: true,
                responseTime,
                system: {
                    sysName: sysInfo.sysName,
                    sysDescr: sysInfo.sysDescr,
                    sysUpTime: sysInfo.sysUpTime,
                    sysLocation: sysInfo.sysLocation,
                    sysContact: sysInfo.sysContact,
                    sysObjectID: sysInfo.sysObjectID,
                },
                interfaces: interfaces.map(i => ({
                    ifIndex: i.ifIndex,
                    ifName: i.ifName || i.ifDescr,
                    ifType: i.ifType,
                    ifSpeed: i.ifSpeed || i.ifHighSpeed * 1_000_000,
                    ifAdminStatus: i.ifAdminStatus === 1 ? 'up' : 'down',
                    ifOperStatus: i.ifOperStatus === 1 ? 'up' : 'down',
                    ifAlias: i.ifAlias,
                })),
                interfaceCount: interfaces.length,
            };
        } catch (err: any) {
            return {
                success: true,
                responseTime,
                warning: 'Device is reachable but could not fetch full system info: ' + err.message,
            };
        }
    }

    // ─── Maintenance Windows ────────────────────────────

    async startMaintenance(id: number, reason?: string, endsAt?: Date) {
        const device = await this.prisma.device.findUnique({ where: { id } });
        if (!device) throw new NotFoundException(`Device #${id} not found`);

        const updated = await this.prisma.device.update({
            where: { id },
            data: { status: 'maintenance' },
        });

        this.logger.log(`Device #${id} placed in maintenance mode${reason ? ': ' + reason : ''}`);
        return { ...updated, maintenanceReason: reason, maintenanceEndsAt: endsAt?.toISOString() };
    }

    async endMaintenance(id: number) {
        const device = await this.prisma.device.findUnique({ where: { id } });
        if (!device) throw new NotFoundException(`Device #${id} not found`);

        const updated = await this.prisma.device.update({
            where: { id },
            data: { status: 'unknown' }, // will be corrected on next poll cycle
        });

        this.logger.log(`Device #${id} removed from maintenance mode`);
        return updated;
    }
}
