import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { SnmpService, SnmpTarget } from '../snmp/snmp.service';
import { AlertEvaluatorService } from '../alerting/alert-evaluator.service';
import { MetricsGateway } from '../metrics/metrics.gateway';
import {
    HOST_RESOURCES_OIDS,
    CISCO_OIDS,
    MIKROTIK_OIDS,
} from '@netmon/shared';

interface PollJobData {
    deviceId: number;
}

@Processor('polling', { concurrency: 10 })
export class PollingProcessor extends WorkerHost {
    private readonly logger = new Logger(PollingProcessor.name);

    // In-memory store for previous counter values (for delta calculations)
    private previousCounters = new Map<string, { time: number; value: number }>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly encryption: EncryptionService,
        private readonly snmp: SnmpService,
        private readonly alertEvaluator: AlertEvaluatorService,
        private readonly metricsGateway: MetricsGateway,
    ) {
        super();
    }

    async process(job: Job<PollJobData>): Promise<any> {
        const { deviceId } = job.data;
        const startTime = Date.now();

        // Fetch device with credentials
        const device = await this.prisma.device.findUnique({
            where: { id: deviceId },
            include: {
                interfaces: {
                    where: { pollingEnabled: true },
                    select: { id: true, ifIndex: true, ifSpeed: true },
                },
            },
        });

        if (!device || !device.pollingEnabled) {
            return { skipped: true, reason: 'Device not found or polling disabled' };
        }

        // Build SNMP target with decrypted credentials
        const target = this.buildSnmpTarget(device);

        try {
            // 1. Test connectivity
            const isReachable = await this.snmp.testConnectivity(target);
            const responseTime = Date.now() - startTime;

            if (!isReachable) {
                await this.markDeviceDown(device.id, responseTime);
                this.metricsGateway.broadcastDeviceDown(device.id, responseTime);
                return { deviceId, status: 'down', responseTime };
            }

            // 2. Fetch system info
            const sysInfo = await this.snmp.getSystemInfo(target);

            // 3. Fetch device-level metrics (CPU, memory)
            const deviceMetrics = await this.fetchDeviceMetrics(target, device);

            // 4. Write device metrics
            await this.writeDeviceMetrics(device.id, {
                cpuUtilization: deviceMetrics.cpu,
                memoryUsed: deviceMetrics.memoryUsed,
                memoryTotal: deviceMetrics.memoryTotal,
                memoryPercent: deviceMetrics.memoryPercent,
                uptime: sysInfo.sysUpTime,
                responseTimeMs: responseTime,
            });

            // 5. Auto-discover interfaces via SNMP and write metrics
            await this.discoverAndPollInterfaces(target, device);

            // 6. Update device status
            await this.prisma.device.update({
                where: { id: device.id },
                data: {
                    status: 'up',
                    uptime: BigInt(sysInfo.sysUpTime),
                    lastPolledAt: new Date(),
                },
            });

            // 7. Evaluate alert rules against collected metrics
            await this.alertEvaluator.evaluate(device.id, {
                cpu_utilization: deviceMetrics.cpu,
                memory_percent: deviceMetrics.memoryPercent,
                response_time_ms: responseTime,
                device_status: 'up',
            });

            // 8. Broadcast real-time update via WebSocket
            this.metricsGateway.broadcastDeviceUpdate(device.id, {
                status: 'up',
                cpu: deviceMetrics.cpu,
                memoryPercent: deviceMetrics.memoryPercent,
                responseTime,
                interfacesPolled: device.interfaces.length,
            });

            return {
                deviceId,
                status: 'up',
                responseTime,
                cpu: deviceMetrics.cpu,
                memoryPercent: deviceMetrics.memoryPercent,
                interfacesPolled: device.interfaces.length,
            };
        } catch (err) {
            this.logger.warn(`Poll failed for device ${device.hostname}: ${err}`);
            const responseTime = Date.now() - startTime;
            await this.markDeviceDown(device.id, responseTime);
            return { deviceId, status: 'error', error: String(err) };
        }
    }

    /**
     * Fetch CPU and memory metrics using vendor-specific OIDs with fallbacks.
     */
    private async fetchDeviceMetrics(
        target: SnmpTarget,
        device: any,
    ): Promise<{
        cpu: number | null;
        memoryUsed: number | null;
        memoryTotal: number | null;
        memoryPercent: number | null;
    }> {
        const sysObjectId = device.sysObjectId || '';
        let cpu: number | null = null;
        let memoryUsed: number | null = null;
        let memoryTotal: number | null = null;

        try {
            // Try Cisco OIDs
            if (sysObjectId.startsWith('1.3.6.1.4.1.9.')) {
                const result = await this.snmp.get(target, [
                    CISCO_OIDS.cpu.cpmCPUTotal5minRev,
                    CISCO_OIDS.memory.ciscoMemoryPoolUsed,
                    CISCO_OIDS.memory.ciscoMemoryPoolFree,
                ]);
                cpu = result.get(CISCO_OIDS.cpu.cpmCPUTotal5minRev);
                memoryUsed = result.get(CISCO_OIDS.memory.ciscoMemoryPoolUsed);
                const memFree = result.get(CISCO_OIDS.memory.ciscoMemoryPoolFree);
                if (memoryUsed && memFree) {
                    memoryTotal = memoryUsed + memFree;
                }
            }
            // Try MikroTik OIDs
            else if (sysObjectId.startsWith('1.3.6.1.4.1.14988.')) {
                const result = await this.snmp.get(target, [
                    MIKROTIK_OIDS.cpu.mtxrHlProcessorLoad,
                    MIKROTIK_OIDS.memory.mtxrHlTotalMemory,
                    MIKROTIK_OIDS.memory.mtxrHlTotalUsedMemory,
                ]);
                cpu = result.get(MIKROTIK_OIDS.cpu.mtxrHlProcessorLoad);
                memoryTotal = result.get(MIKROTIK_OIDS.memory.mtxrHlTotalMemory);
                memoryUsed = result.get(MIKROTIK_OIDS.memory.mtxrHlTotalUsedMemory);
            }
            // Fallback: HOST-RESOURCES-MIB
            else {
                const cpuData = await this.snmp.walk(target, HOST_RESOURCES_OIDS.hrProcessorLoad);
                if (cpuData.size > 0) {
                    const values = Array.from(cpuData.values()) as number[];
                    cpu = values.reduce((a, b) => a + b, 0) / values.length;
                }

                const storageData = await this.snmp.walk(target, '1.3.6.1.2.1.25.2.3');
                // Parse hrStorage for physical memory
                if (storageData.size > 0) {
                    const parsed = this.parseHostResourcesMemory(storageData);
                    memoryUsed = parsed.used;
                    memoryTotal = parsed.total;
                }
            }
        } catch (err) {
            this.logger.debug(`Device metrics fetch partial failure for ${device.hostname}: ${err}`);
        }

        const memoryPercent = memoryTotal && memoryUsed
            ? Math.round((memoryUsed / memoryTotal) * 10000) / 100
            : null;

        return { cpu, memoryUsed, memoryTotal, memoryPercent };
    }

    /**
     * Parse hrStorage table data to extract physical memory usage.
     */
    private parseHostResourcesMemory(data: Map<string, any>): { used: number | null; total: number | null } {
        // hrStorageType OID for RAM = 1.3.6.1.2.1.25.2.1.2
        const descrOid = HOST_RESOURCES_OIDS.hrStorageDescr;
        const sizeOid = HOST_RESOURCES_OIDS.hrStorageSize;
        const usedOid = HOST_RESOURCES_OIDS.hrStorageUsed;
        const unitsOid = HOST_RESOURCES_OIDS.hrStorageAllocationUnits;

        // Find memory storage entries by description
        for (const [oid, value] of data) {
            if (oid.startsWith(descrOid)) {
                const descr = String(value).toLowerCase();
                if (descr.includes('physical memory') || descr.includes('ram') || descr.includes('real memory')) {
                    const idx = oid.split('.').pop();
                    const units = data.get(`${unitsOid}.${idx}`) || 1;
                    const size = data.get(`${sizeOid}.${idx}`) || 0;
                    const used = data.get(`${usedOid}.${idx}`) || 0;
                    return {
                        total: size * units,
                        used: used * units,
                    };
                }
            }
        }
        return { used: null, total: null };
    }

    /**
     * Discover interfaces via SNMP, upsert into DB, and poll traffic metrics.
     * This replaces the old pollInterfaces — no more chicken-and-egg problem.
     */
    private async discoverAndPollInterfaces(target: SnmpTarget, device: any) {
        try {
            const snmpInterfaces = await this.snmp.getInterfaces(target);
            const now = new Date();

            for (const iface of snmpInterfaces) {
                // Upsert interface into DB (auto-discovery)
                const dbIface = await this.prisma.interface.upsert({
                    where: {
                        deviceId_ifIndex: {
                            deviceId: device.id,
                            ifIndex: iface.ifIndex,
                        },
                    },
                    update: {
                        ifName: iface.ifName || iface.ifDescr || `if${iface.ifIndex}`,
                        ifDescr: iface.ifDescr,
                        ifAlias: iface.ifAlias || null,
                        ifType: String(iface.ifType || ''),
                        ifSpeed: BigInt(iface.ifSpeed || 0),
                        ifHighSpeed: BigInt(iface.ifHighSpeed || 0),
                        ifAdminStatus: iface.ifAdminStatus === 1 ? 'up' : 'down',
                        ifOperStatus: iface.ifOperStatus === 1 ? 'up' : 'down',
                    },
                    create: {
                        deviceId: device.id,
                        ifIndex: iface.ifIndex,
                        ifName: iface.ifName || iface.ifDescr || `if${iface.ifIndex}`,
                        ifDescr: iface.ifDescr,
                        ifAlias: iface.ifAlias || null,
                        ifType: String(iface.ifType || ''),
                        ifSpeed: BigInt(iface.ifSpeed || 0),
                        ifHighSpeed: BigInt(iface.ifHighSpeed || 0),
                        ifAdminStatus: iface.ifAdminStatus === 1 ? 'up' : 'down',
                        ifOperStatus: iface.ifOperStatus === 1 ? 'up' : 'down',
                        pollingEnabled: true,
                    },
                });

                // Skip metrics for disabled interfaces
                if (!dbIface.pollingEnabled) continue;

                // Calculate bps from counter deltas
                const inBps = this.calculateBps(device.id, dbIface.ifIndex, 'in', iface.ifInOctets);
                const outBps = this.calculateBps(device.id, dbIface.ifIndex, 'out', iface.ifOutOctets);

                // Calculate utilization
                const speed = Number(dbIface.ifSpeed) || 0;
                const inUtil = speed > 0 ? Math.min((inBps / speed) * 100, 100) : 0;
                const outUtil = speed > 0 ? Math.min((outBps / speed) * 100, 100) : 0;

                await this.writeInterfaceMetrics({
                    time: now,
                    deviceId: device.id,
                    interfaceId: dbIface.id,
                    ifIndex: iface.ifIndex,
                    inOctets: iface.ifInOctets,
                    outOctets: iface.ifOutOctets,
                    inErrors: iface.ifInErrors,
                    outErrors: iface.ifOutErrors,
                    inBps,
                    outBps,
                    inUtilization: Math.round(inUtil * 100) / 100,
                    outUtilization: Math.round(outUtil * 100) / 100,
                    operStatus: iface.ifOperStatus === 1 ? 'up' : 'down',
                });
            }

            this.logger.log(`Discovered ${snmpInterfaces.length} interfaces for ${device.hostname}`);
        } catch (err) {
            this.logger.warn(`Interface discovery/polling failed for ${device.hostname}: ${err}`);
        }
    }

    /**
     * Calculate bits per second from counter deltas.
     * Stores previous counter values in memory for delta calculation.
     */
    private calculateBps(deviceId: number, ifIndex: number, direction: string, currentOctets: number): number {
        const key = `${deviceId}-${ifIndex}-${direction}`;
        const now = Date.now();
        const prev = this.previousCounters.get(key);

        this.previousCounters.set(key, { time: now, value: currentOctets });

        if (!prev) return 0;

        const timeDelta = (now - prev.time) / 1000; // seconds
        if (timeDelta <= 0) return 0;

        let octetDelta = currentOctets - prev.value;
        // Handle counter wrap (32-bit or 64-bit)
        if (octetDelta < 0) {
            octetDelta += 2 ** 32; // Assume 32-bit wrap
        }

        return Math.round((octetDelta * 8) / timeDelta); // bits per second
    }

    /**
     * Write device metrics to TimescaleDB via raw SQL.
     */
    private async writeDeviceMetrics(deviceId: number, metrics: any) {
        await this.prisma.$executeRawUnsafe(
            `INSERT INTO device_metrics (time, device_id, cpu_utilization, memory_used, memory_total, memory_percent, uptime, response_time_ms, device_status)
             VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7, 'up')`,
            deviceId,
            metrics.cpuUtilization,
            metrics.memoryUsed,
            metrics.memoryTotal,
            metrics.memoryPercent,
            metrics.uptime,
            metrics.responseTimeMs,
        );
    }

    /**
     * Write interface metrics to TimescaleDB via raw SQL.
     */
    private async writeInterfaceMetrics(m: any) {
        await this.prisma.$executeRawUnsafe(
            `INSERT INTO interface_metrics (time, device_id, interface_id, if_index, in_octets, out_octets, in_errors, out_errors, in_bps, out_bps, in_utilization, out_utilization, oper_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            m.time,
            m.deviceId,
            m.interfaceId,
            m.ifIndex,
            m.inOctets,
            m.outOctets,
            m.inErrors,
            m.outErrors,
            m.inBps,
            m.outBps,
            m.inUtilization,
            m.outUtilization,
            m.operStatus,
        );
    }

    /**
     * Build SnmpTarget from device record with decrypted credentials.
     */
    private buildSnmpTarget(device: any): SnmpTarget {
        const target: SnmpTarget = {
            host: device.ipAddress,
            port: device.snmpPort || 161,
            version: device.snmpVersion as 'v1' | 'v2c' | 'v3',
        };

        if (device.snmpVersion === 'v3') {
            target.v3User = device.snmpV3User || '';
            target.v3AuthProto = device.snmpV3AuthProto || 'SHA';
            target.v3AuthPass = device.snmpV3AuthPass
                ? this.encryption.decrypt(device.snmpV3AuthPass)
                : undefined;
            target.v3PrivProto = device.snmpV3PrivProto || 'AES';
            target.v3PrivPass = device.snmpV3PrivPass
                ? this.encryption.decrypt(device.snmpV3PrivPass)
                : undefined;
        } else {
            target.community = device.snmpCommunity
                ? this.encryption.decrypt(device.snmpCommunity)
                : 'public';
        }

        return target;
    }

    /**
     * Mark a device as down and write a "down" metric row.
     */
    private async markDeviceDown(deviceId: number, responseTime: number) {
        await Promise.all([
            this.prisma.device.update({
                where: { id: deviceId },
                data: { status: 'down', lastPolledAt: new Date() },
            }),
            this.prisma.$executeRawUnsafe(
                `INSERT INTO device_metrics (time, device_id, response_time_ms, device_status)
                 VALUES (NOW(), $1, $2, 'down')`,
                deviceId,
                responseTime,
            ),
        ]);
    }
}
