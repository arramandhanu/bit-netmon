import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SnmpService, SnmpTarget } from '../snmp/snmp.service';
import { DeviceClassifierService } from '../snmp/device-classifier.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { DiscoveryScanOptions } from './discovery.service';

interface DiscoveredDevice {
    ip: string;
    hostname: string;
    vendor: string;
    model: string;
    deviceType: string;
    interfaceCount: number;
    isNew: boolean;
}

@Processor('discovery')
export class DiscoveryProcessor extends WorkerHost {
    private readonly logger = new Logger(DiscoveryProcessor.name);

    constructor(
        private readonly snmp: SnmpService,
        private readonly classifier: DeviceClassifierService,
        private readonly prisma: PrismaService,
        private readonly encryption: EncryptionService,
    ) {
        super();
    }

    async process(job: Job<DiscoveryScanOptions>): Promise<any> {
        const { subnets, snmpCommunities, concurrency, timeout } = job.data;
        this.logger.log(`Starting discovery scan: ${subnets.join(', ')}`);

        // Expand all CIDRs into individual IPs
        const allIps: string[] = [];
        for (const subnet of subnets) {
            const ips = this.expandCidr(subnet);
            allIps.push(...ips);
        }

        this.logger.log(`Expanded ${subnets.length} subnet(s) to ${allIps.length} IPs`);

        const discovered: DiscoveredDevice[] = [];
        let scanned = 0;

        // Process in batches
        for (let i = 0; i < allIps.length; i += concurrency) {
            const batch = allIps.slice(i, i + concurrency);

            const results = await Promise.allSettled(
                batch.map((ip) =>
                    this.scanSingleIp(ip, snmpCommunities, timeout),
                ),
            );

            for (const result of results) {
                if (result.status === 'fulfilled' && result.value) {
                    discovered.push(result.value);
                }
            }

            scanned += batch.length;
            await job.updateProgress(Math.round((scanned / allIps.length) * 100));
        }

        this.logger.log(
            `Discovery complete: scanned=${allIps.length} found=${discovered.length}`,
        );

        return {
            totalScanned: allIps.length,
            totalDiscovered: discovered.length,
            devices: discovered,
        };
    }

    /**
     * Try SNMP against a single IP with each community string.
     * On first success: fetch system info, classify, discover interfaces, save to DB.
     */
    private async scanSingleIp(
        ip: string,
        communities: string[],
        timeout: number,
    ): Promise<DiscoveredDevice | null> {
        for (const community of communities) {
            const target: SnmpTarget = {
                host: ip,
                version: 'v2c',
                community,
                timeout,
                retries: 0,
            };

            try {
                const reachable = await this.snmp.testConnectivity(target);
                if (!reachable) continue;

                // Fetch system info
                const sysInfo = await this.snmp.getSystemInfo(target);

                // Classify device
                const classification = this.classifier.classify(
                    sysInfo.sysObjectID,
                    sysInfo.sysDescr,
                );

                // Discover interfaces
                let interfaces: any[] = [];
                try {
                    interfaces = await this.snmp.getInterfaces(target);
                } catch (err) {
                    this.logger.warn(`Interface discovery failed for ${ip}: ${err}`);
                }

                // Save or update device in DB
                const hostname = sysInfo.sysName || ip;
                const isNew = await this.upsertDevice(
                    ip,
                    hostname,
                    community,
                    sysInfo,
                    classification,
                    interfaces,
                );

                return {
                    ip,
                    hostname,
                    vendor: classification.vendor,
                    model: classification.model,
                    deviceType: classification.deviceType,
                    interfaceCount: interfaces.length,
                    isNew,
                };
            } catch {
                // This community didn't work, try next
                continue;
            }
        }

        return null;
    }

    /**
     * Create or update device in the database.
     * Returns true if the device was newly created.
     */
    private async upsertDevice(
        ip: string,
        hostname: string,
        community: string,
        sysInfo: any,
        classification: any,
        interfaces: any[],
    ): Promise<boolean> {
        const existing = await this.prisma.device.findFirst({
            where: { OR: [{ ipAddress: ip }, { hostname }] },
        });

        const encryptedCommunity = this.encryption.encrypt(community);

        if (existing) {
            // Update existing device
            await this.prisma.device.update({
                where: { id: existing.id },
                data: {
                    status: 'up',
                    sysObjectId: sysInfo.sysObjectID,
                    deviceType: classification.deviceType as any,
                    lastDiscoveredAt: new Date(),
                },
            });

            // Upsert interfaces
            await this.upsertInterfaces(existing.id, interfaces);
            return false;
        }

        // Create new device
        const device = await this.prisma.device.create({
            data: {
                hostname: this.sanitizeHostname(hostname, ip),
                ipAddress: ip,
                displayName: `${classification.vendor} ${classification.model}`.trim().substring(0, 255),
                deviceType: classification.deviceType as any,
                status: 'up',
                snmpVersion: 'v2c',
                snmpCommunity: encryptedCommunity,
                snmpPort: 161,
                sysObjectId: sysInfo.sysObjectID,
                lastDiscoveredAt: new Date(),
            },
        });

        // Create interfaces
        await this.upsertInterfaces(device.id, interfaces);

        this.logger.log(
            `New device discovered: ${hostname} (${ip}) — ${classification.vendor} ${classification.deviceType}`,
        );

        return true;
    }

    private async upsertInterfaces(deviceId: number, interfaces: any[]) {
        for (const iface of interfaces) {
            await this.prisma.interface.upsert({
                where: {
                    deviceId_ifIndex: { deviceId, ifIndex: iface.ifIndex },
                },
                update: {
                    ifDescr: iface.ifDescr || '',
                    ifName: iface.ifName || iface.ifDescr || '',
                    ifAlias: iface.ifAlias || '',
                    ifType: String(iface.ifType || ''),
                    ifSpeed: BigInt(iface.ifHighSpeed ? iface.ifHighSpeed * 1_000_000 : iface.ifSpeed || 0),
                    ifPhysAddress: iface.ifPhysAddress || '',
                    ifAdminStatus: iface.ifAdminStatus === 1 ? 'up' : 'down',
                    ifOperStatus: iface.ifOperStatus === 1 ? 'up' : 'down',
                },
                create: {
                    deviceId,
                    ifIndex: iface.ifIndex,
                    ifDescr: iface.ifDescr || '',
                    ifName: iface.ifName || iface.ifDescr || '',
                    ifAlias: iface.ifAlias || '',
                    ifType: String(iface.ifType || ''),
                    ifSpeed: BigInt(iface.ifHighSpeed ? iface.ifHighSpeed * 1_000_000 : iface.ifSpeed || 0),
                    ifPhysAddress: iface.ifPhysAddress || '',
                    ifAdminStatus: iface.ifAdminStatus === 1 ? 'up' : 'down',
                    ifOperStatus: iface.ifOperStatus === 1 ? 'up' : 'down',
                },
            });
        }
    }

    /**
     * Ensure hostname is unique by appending IP if needed
     */
    private sanitizeHostname(hostname: string, ip: string): string {
        // Remove invalid chars, trim
        const clean = hostname.replace(/[^a-zA-Z0-9._-]/g, '-').substring(0, 200);
        return clean || ip;
    }

    /**
     * Expand a CIDR notation (e.g., "10.0.1.0/24") into an array of IPs.
     * Excludes network and broadcast addresses.
     */
    private expandCidr(cidr: string): string[] {
        const [network, maskStr] = cidr.split('/');
        const mask = parseInt(maskStr, 10);

        if (mask < 16 || mask > 30) {
            this.logger.warn(`Skipping CIDR ${cidr}: mask must be /16-/30`);
            return [];
        }

        const parts = network.split('.').map(Number);
        const ipNum = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
        const hostBits = 32 - mask;
        const networkAddr = ipNum & (~0 << hostBits);
        const broadcastAddr = networkAddr | ((1 << hostBits) - 1);

        const ips: string[] = [];
        for (let i = networkAddr + 1; i < broadcastAddr; i++) {
            ips.push(
                `${(i >> 24) & 0xff}.${(i >> 16) & 0xff}.${(i >> 8) & 0xff}.${i & 0xff}`,
            );
        }

        return ips;
    }
}
