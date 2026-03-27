import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface UptimeSLA {
    deviceId: number;
    hostname?: string;
    ipAddress?: string;
    totalChecks: number;
    upChecks: number;
    downChecks: number;
    uptimePercent: number;
    downtimePercent: number;
    avgResponseMs: number;
    lastStatus: string;
    lastCheckedAt: string | null;
}

export interface UptimeRecord {
    time: string;
    device_id: number;
    status: string;
    response_time_ms: number | null;
    check_type: string;
}

@Injectable()
export class UptimeService {
    private readonly logger = new Logger(UptimeService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Record an uptime check result.
     */
    async recordCheck(
        deviceId: number,
        status: 'up' | 'down',
        responseTimeMs: number | null,
        checkType: string = 'snmp',
    ): Promise<void> {
        try {
            await this.prisma.$executeRawUnsafe(
                `INSERT INTO uptime_records (time, device_id, status, response_time_ms, check_type)
                 VALUES (NOW(), $1, $2, $3, $4)`,
                deviceId,
                status,
                responseTimeMs,
                checkType,
            );
        } catch (err: any) {
            this.logger.warn(`Failed to record uptime check: ${err.message}`);
        }
    }

    /**
     * Get uptime history for a specific device, bucketed by time.
     */
    async getUptimeHistory(
        deviceId: number,
        from?: string,
        to?: string,
        bucket: string = '5 minutes',
    ): Promise<any[]> {
        const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const toDate = to ? new Date(to) : new Date();

        try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT
                    time_bucket($1::interval, time) AS bucket,
                    device_id,
                    mode() WITHIN GROUP (ORDER BY status) AS status,
                    AVG(response_time_ms)::int AS avg_response_ms,
                    COUNT(*) AS total_checks,
                    COUNT(*) FILTER (WHERE status = 'up') AS up_checks,
                    COUNT(*) FILTER (WHERE status = 'down') AS down_checks
                 FROM uptime_records
                 WHERE device_id = $2
                   AND time >= $3
                   AND time <= $4
                 GROUP BY bucket, device_id
                 ORDER BY bucket DESC
                 LIMIT 500`,
                bucket,
                deviceId,
                fromDate,
                toDate,
            );

            return rows.map(this.serializeRow);
        } catch (err: any) {
            this.logger.warn(`Uptime history query failed: ${err.message}`);
            return [];
        }
    }

    /**
     * Calculate SLA for a specific device over a time period.
     */
    async calculateSLA(
        deviceId: number,
        from?: string,
        to?: string,
    ): Promise<UptimeSLA> {
        const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const toDate = to ? new Date(to) : new Date();

        // Get device info
        const device = await this.prisma.device.findUnique({
            where: { id: deviceId },
            select: { id: true, hostname: true, ipAddress: true },
        });

        try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT
                    COUNT(*) AS total_checks,
                    COUNT(*) FILTER (WHERE status = 'up') AS up_checks,
                    COUNT(*) FILTER (WHERE status = 'down') AS down_checks,
                    COALESCE(AVG(response_time_ms) FILTER (WHERE status = 'up'), 0)::int AS avg_response_ms
                 FROM uptime_records
                 WHERE device_id = $1
                   AND time >= $2
                   AND time <= $3`,
                deviceId,
                fromDate,
                toDate,
            );

            const row = rows[0] || { total_checks: 0, up_checks: 0, down_checks: 0, avg_response_ms: 0 };
            const total = Number(row.total_checks);
            const up = Number(row.up_checks);
            const down = Number(row.down_checks);

            // Get last check
            const lastRows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT status, time FROM uptime_records
                 WHERE device_id = $1
                 ORDER BY time DESC LIMIT 1`,
                deviceId,
            );

            const lastRecord = lastRows[0];

            return {
                deviceId,
                hostname: device?.hostname,
                ipAddress: device?.ipAddress,
                totalChecks: total,
                upChecks: up,
                downChecks: down,
                uptimePercent: total > 0 ? Math.round((up / total) * 10000) / 100 : 0,
                downtimePercent: total > 0 ? Math.round((down / total) * 10000) / 100 : 0,
                avgResponseMs: Number(row.avg_response_ms) || 0,
                lastStatus: lastRecord?.status || 'unknown',
                lastCheckedAt: lastRecord?.time ? new Date(lastRecord.time).toISOString() : null,
            };
        } catch (err: any) {
            this.logger.warn(`SLA calculation failed: ${err.message}`);
            return {
                deviceId,
                hostname: device?.hostname,
                ipAddress: device?.ipAddress,
                totalChecks: 0,
                upChecks: 0,
                downChecks: 0,
                uptimePercent: 0,
                downtimePercent: 0,
                avgResponseMs: 0,
                lastStatus: 'unknown',
                lastCheckedAt: null,
            };
        }
    }

    /**
     * Get fleet-wide uptime summary with per-device SLA.
     * Filters by tenantId for tenant users; admin (tenantId=null) sees all.
     */
    async getSummary(
        from?: string,
        to?: string,
        tenantId?: number | null,
    ): Promise<{
        fleetUptimePercent: number;
        fleetAvgResponseMs: number;
        totalDevices: number;
        devicesUp: number;
        devicesDown: number;
        devices: UptimeSLA[];
    }> {
        const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const toDate = to ? new Date(to) : new Date();

        try {
            // Build tenant-aware query
            const tenantFilter = tenantId != null ? `AND d.tenant_id = ${tenantId}` : '';

            // Per-device SLA summary
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT
                    ur.device_id,
                    d.hostname,
                    d.ip_address,
                    COUNT(*) AS total_checks,
                    COUNT(*) FILTER (WHERE ur.status = 'up') AS up_checks,
                    COUNT(*) FILTER (WHERE ur.status = 'down') AS down_checks,
                    COALESCE(AVG(ur.response_time_ms) FILTER (WHERE ur.status = 'up'), 0)::int AS avg_response_ms
                 FROM uptime_records ur
                 JOIN devices d ON d.device_id = ur.device_id
                 WHERE ur.time >= $1
                   AND ur.time <= $2
                   ${tenantFilter}
                 GROUP BY ur.device_id, d.hostname, d.ip_address
                 ORDER BY d.hostname`,
                fromDate,
                toDate,
            );

            // Get latest status for each device (tenant-filtered)
            const latestRows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT DISTINCT ON (ur.device_id)
                    ur.device_id, ur.status, ur.time
                 FROM uptime_records ur
                 JOIN devices d ON d.device_id = ur.device_id
                 WHERE 1=1 ${tenantFilter}
                 ORDER BY ur.device_id, ur.time DESC`,
            );
            const latestMap = new Map(latestRows.map(r => [Number(r.device_id), r]));

            const devices: UptimeSLA[] = rows.map(row => {
                const total = Number(row.total_checks);
                const up = Number(row.up_checks);
                const down = Number(row.down_checks);
                const latest = latestMap.get(Number(row.device_id));
                return {
                    deviceId: Number(row.device_id),
                    hostname: row.hostname,
                    ipAddress: row.ip_address,
                    totalChecks: total,
                    upChecks: up,
                    downChecks: down,
                    uptimePercent: total > 0 ? Math.round((up / total) * 10000) / 100 : 0,
                    downtimePercent: total > 0 ? Math.round((down / total) * 10000) / 100 : 0,
                    avgResponseMs: Number(row.avg_response_ms) || 0,
                    lastStatus: latest?.status || 'unknown',
                    lastCheckedAt: latest?.time ? new Date(latest.time).toISOString() : null,
                };
            });

            const totalChecks = devices.reduce((s, d) => s + d.totalChecks, 0);
            const totalUp = devices.reduce((s, d) => s + d.upChecks, 0);
            const fleetUptimePercent = totalChecks > 0
                ? Math.round((totalUp / totalChecks) * 10000) / 100
                : 0;
            const fleetAvgResponseMs = devices.length > 0
                ? Math.round(devices.reduce((s, d) => s + d.avgResponseMs, 0) / devices.length)
                : 0;
            const devicesUp = devices.filter(d => d.lastStatus === 'up').length;
            const devicesDown = devices.filter(d => d.lastStatus === 'down').length;

            return {
                fleetUptimePercent,
                fleetAvgResponseMs,
                totalDevices: devices.length,
                devicesUp,
                devicesDown,
                devices,
            };
        } catch (err: any) {
            this.logger.warn(`Uptime summary failed: ${err.message}`);
            return {
                fleetUptimePercent: 0,
                fleetAvgResponseMs: 0,
                totalDevices: 0,
                devicesUp: 0,
                devicesDown: 0,
                devices: [],
            };
        }
    }

    private serializeRow(row: any): any {
        const out: any = {};
        for (const [key, value] of Object.entries(row)) {
            if (typeof value === 'bigint') {
                out[key] = Number(value);
            } else if (value instanceof Date) {
                out[key] = value.toISOString();
            } else {
                out[key] = value;
            }
        }
        return out;
    }
}
