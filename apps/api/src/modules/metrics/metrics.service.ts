import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MetricsQueryDto, MetricInterval } from './metrics.dto';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class MetricsService {

    private readonly logger = new Logger(MetricsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly settings: SettingsService,
    ) { }

    /**
     * Map interval enum to TimescaleDB time_bucket() interval string
     */
    private toTimeBucket(interval: MetricInterval): string {
        const map: Record<MetricInterval, string> = {
            [MetricInterval.ONE_MIN]: '1 minute',
            [MetricInterval.FIVE_MIN]: '5 minutes',
            [MetricInterval.FIFTEEN_MIN]: '15 minutes',
            [MetricInterval.ONE_HOUR]: '1 hour',
            [MetricInterval.SIX_HOURS]: '6 hours',
            [MetricInterval.ONE_DAY]: '1 day',
        };
        return map[interval] || '5 minutes';
    }

    /**
     * Get device metrics over time, aggregated by time_bucket.
     */
    async getDeviceMetrics(deviceId: number, query: MetricsQueryDto) {
        const bucket = this.toTimeBucket(query.interval || MetricInterval.FIVE_MIN);
        const limit = query.limit || 100;
        const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const to = query.to ? new Date(query.to) : new Date();

        try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT
                    time_bucket($1::interval, time) AS bucket,
                    AVG(cpu_utilization)             AS avg_cpu,
                    MAX(cpu_utilization)             AS max_cpu,
                    AVG(memory_percent)              AS avg_memory,
                    MAX(memory_percent)              AS max_memory,
                    AVG(response_time_ms)            AS avg_response_time,
                    MAX(response_time_ms)            AS max_response_time,
                    MAX(uptime)                      AS uptime,
                    COUNT(*)                         AS samples
                 FROM device_metrics
                 WHERE device_id = $2
                   AND time >= $3
                   AND time <= $4
                 GROUP BY bucket
                 ORDER BY bucket DESC
                 LIMIT $5`,
                bucket,
                deviceId,
                from,
                to,
                limit,
            );

            return {
                deviceId,
                from: from.toISOString(),
                to: to.toISOString(),
                interval: query.interval || MetricInterval.FIVE_MIN,
                data: rows.map(this.serializeRow),
            };
        } catch (err: any) {
            this.logger.warn('device_metrics table not available: ' + err.message);
            return {
                deviceId,
                from: from.toISOString(),
                to: to.toISOString(),
                interval: query.interval || MetricInterval.FIVE_MIN,
                data: [],
            };
        }
    }

    /**
     * Get the latest device metrics snapshot.
     */
    async getLatestDeviceMetrics(deviceId: number) {
        try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT *
                 FROM device_metrics
                 WHERE device_id = $1
                 ORDER BY time DESC
                 LIMIT 1`,
                deviceId,
            );

            if (rows.length === 0) {
                return { deviceId, data: null };
            }

            return { deviceId, data: this.serializeRow(rows[0]) };
        } catch {
            return { deviceId, data: null };
        }
    }

    /**
     * Get interface metrics over time, aggregated by time_bucket.
     */
    async getInterfaceMetrics(deviceId: number, ifIndex: number, query: MetricsQueryDto) {
        const bucket = this.toTimeBucket(query.interval || MetricInterval.FIVE_MIN);
        const limit = query.limit || 100;
        const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const to = query.to ? new Date(query.to) : new Date();

        try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT
                    time_bucket($1::interval, time) AS bucket,
                    AVG(in_bps)                     AS avg_in_bps,
                    MAX(in_bps)                     AS max_in_bps,
                    AVG(out_bps)                    AS avg_out_bps,
                    MAX(out_bps)                    AS max_out_bps,
                    AVG(in_utilization)             AS avg_in_util,
                    MAX(in_utilization)             AS max_in_util,
                    AVG(out_utilization)            AS avg_out_util,
                    MAX(out_utilization)            AS max_out_util,
                    SUM(in_errors)                  AS total_in_errors,
                    SUM(out_errors)                 AS total_out_errors,
                    COUNT(*)                        AS samples
                 FROM interface_metrics
                 WHERE device_id = $2
                   AND if_index = $3
                   AND time >= $4
                   AND time <= $5
                 GROUP BY bucket
                 ORDER BY bucket DESC
                 LIMIT $6`,
                bucket,
                deviceId,
                ifIndex,
                from,
                to,
                limit,
            );

            return {
                deviceId,
                ifIndex,
                from: from.toISOString(),
                to: to.toISOString(),
                interval: query.interval || MetricInterval.FIVE_MIN,
                data: rows.map(this.serializeRow),
            };
        } catch (err: any) {
            this.logger.warn('interface_metrics table not available: ' + err.message);
            return {
                deviceId,
                ifIndex,
                from: from.toISOString(),
                to: to.toISOString(),
                interval: query.interval || MetricInterval.FIVE_MIN,
                data: [],
            };
        }
    }

    /**
     * Get dashboard overview — latest status for all devices.
     */
    async getDashboardOverview() {
        try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT DISTINCT ON (device_id)
                    device_id,
                    time,
                    cpu_utilization,
                    memory_percent,
                    response_time_ms,
                    device_status,
                    uptime
                 FROM device_metrics
                 ORDER BY device_id, time DESC`,
            );

            return rows.map(this.serializeRow);
        } catch {
            // device_metrics table doesn't exist yet (no TimescaleDB or no data)
            return [];
        }
    }

    /**
     * Get extended dashboard overview for widgets
     */
    async getExtendedDashboardOverview() {
        // 1. Get base device metrics
        const metrics = await this.getDashboardOverview();

        // 2. Fetch additional data concurrently
        const [
            totalLocations,
            totalInterfaces,
            interfacesDown,
            openTickets,
            recentTickets,
        ] = await Promise.all([
            this.prisma.location.count(),
            this.prisma.interface.count(),
            this.prisma.interface.count({ where: { ifOperStatus: 'down' } }),
            this.prisma.ticket.count({ where: { status: { notIn: ['resolved', 'closed'] } } }),
            this.prisma.ticket.findMany({
                where: { status: { notIn: ['resolved', 'closed'] } },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: {
                    device: { select: { hostname: true } },
                }
            }),
        ]);

        return {
            metrics,
            totalLocations,
            activeLocations: totalLocations, // Assumption: all existing locations are active
            totalInterfaces,
            interfacesDown,
            totalAps: 0, // Mock for now
            clientsConnected: 0, // Mock for now
            openTickets,
            recentTickets,
            recentDiscovery: [], // Mock for now
            recentSecurityEvents: [] // Mock for now
        };
    }

    /**
     * Purge old metrics/alerts/audit logs based on configured retention periods.
     * Call this from a cron job (e.g., nightly).
     */
    async purgeOldData() {
        const metricsDays = await this.settings.getNumber('retention.metricsDays', 90);
        const alertDays = await this.settings.getNumber('retention.alertHistoryDays', 365);
        const auditDays = await this.settings.getNumber('retention.auditLogDays', 180);

        const metricsCutoff = new Date(Date.now() - metricsDays * 86_400_000);
        const alertCutoff = new Date(Date.now() - alertDays * 86_400_000);
        const auditCutoff = new Date(Date.now() - auditDays * 86_400_000);

        // Purge TimescaleDB hypertables via raw SQL for efficiency
        try {
            await this.prisma.$executeRawUnsafe(
                `DELETE FROM device_metrics WHERE time < $1`,
                metricsCutoff,
            );
            await this.prisma.$executeRawUnsafe(
                `DELETE FROM interface_metrics WHERE time < $1`,
                metricsCutoff,
            );
            this.logger.log(
                `Data retention: purged metrics older than ${metricsDays} days (cutoff: ${metricsCutoff.toISOString()})`,
            );
        } catch (err) {
            this.logger.warn(`Metrics purge failed (table may not exist): ${err}`);
        }

        // Purge alert history via Prisma
        const deletedAlerts = await this.prisma.alertHistory.deleteMany({
            where: { triggeredAt: { lt: alertCutoff } },
        });
        this.logger.log(
            `Data retention: purged ${deletedAlerts.count} alert records older than ${alertDays} days`,
        );

        // Purge audit logs
        const deletedAudit = await this.prisma.auditLog.deleteMany({
            where: { createdAt: { lt: auditCutoff } },
        });
        this.logger.log(
            `Data retention: purged ${deletedAudit.count} audit log records older than ${auditDays} days`,
        );

        return {
            metricsCutoff: metricsCutoff.toISOString(),
            alertsCutoff: alertCutoff.toISOString(),
            auditCutoff: auditCutoff.toISOString(),
        };
    }

    // ─── Bandwidth Monitoring ───────────────────────────

    /**
     * Get aggregate bandwidth overview for a device (all interfaces combined).
     */
    async getBandwidthOverview(deviceId: number, query: MetricsQueryDto) {
        const bucket = this.toTimeBucket(query.interval || MetricInterval.FIVE_MIN);
        const limit = query.limit || 200;
        const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const to = query.to ? new Date(query.to) : new Date();

        try {
            // Time-series: aggregate all interfaces per bucket
            const timeSeries = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT
                    time_bucket($1::interval, time) AS bucket,
                    SUM(in_bps)                     AS total_in_bps,
                    SUM(out_bps)                    AS total_out_bps,
                    MAX(in_bps)                     AS peak_in_bps,
                    MAX(out_bps)                    AS peak_out_bps,
                    AVG(in_utilization)             AS avg_in_util,
                    AVG(out_utilization)            AS avg_out_util,
                    COUNT(DISTINCT if_index)        AS interfaces_count,
                    COUNT(*)                        AS samples
                 FROM interface_metrics
                 WHERE device_id = $2
                   AND time >= $3
                   AND time <= $4
                 GROUP BY bucket
                 ORDER BY bucket ASC
                 LIMIT $5`,
                bucket, deviceId, from, to, limit,
            );

            // Summary stats
            const summary = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT
                    AVG(in_bps)                 AS avg_in_bps,
                    AVG(out_bps)                AS avg_out_bps,
                    MAX(in_bps)                 AS peak_in_bps,
                    MAX(out_bps)                AS peak_out_bps,
                    SUM(in_octets)              AS total_in_bytes,
                    SUM(out_octets)             AS total_out_bytes,
                    AVG(in_utilization)         AS avg_in_util,
                    AVG(out_utilization)        AS avg_out_util,
                    COUNT(DISTINCT if_index)    AS interfaces_count
                 FROM interface_metrics
                 WHERE device_id = $1
                   AND time >= $2
                   AND time <= $3`,
                deviceId, from, to,
            );

            // Per-interface breakdown
            const perInterface = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT
                    im.if_index,
                    i.if_name,
                    i.if_descr,
                    i.if_alias,
                    i.if_speed,
                    AVG(im.in_bps)              AS avg_in_bps,
                    AVG(im.out_bps)             AS avg_out_bps,
                    MAX(im.in_bps)              AS peak_in_bps,
                    MAX(im.out_bps)             AS peak_out_bps,
                    AVG(im.in_utilization)      AS avg_in_util,
                    AVG(im.out_utilization)     AS avg_out_util,
                    SUM(im.in_errors)           AS total_in_errors,
                    SUM(im.out_errors)          AS total_out_errors,
                    MAX(im.oper_status)         AS oper_status
                 FROM interface_metrics im
                 JOIN interfaces i ON i.device_id = im.device_id AND i.if_index = im.if_index
                 WHERE im.device_id = $1
                   AND im.time >= $2
                   AND im.time <= $3
                 GROUP BY im.if_index, i.if_name, i.if_descr, i.if_alias, i.if_speed
                 ORDER BY (AVG(im.in_bps) + AVG(im.out_bps)) DESC`,
                deviceId, from, to,
            );

            return {
                deviceId,
                from: from.toISOString(),
                to: to.toISOString(),
                interval: query.interval || MetricInterval.FIVE_MIN,
                summary: summary[0] ? this.serializeRow(summary[0]) : null,
                timeSeries: timeSeries.map(this.serializeRow),
                interfaces: perInterface.map(this.serializeRow),
            };
        } catch (err: any) {
            this.logger.warn('Bandwidth overview query failed: ' + err.message);
            return {
                deviceId,
                from: from.toISOString(),
                to: to.toISOString(),
                interval: query.interval || MetricInterval.FIVE_MIN,
                summary: null,
                timeSeries: [],
                interfaces: [],
            };
        }
    }

    /**
     * Get top N interfaces by bandwidth across all devices.
     */
    async getTopInterfaces(query: MetricsQueryDto & { topN?: number; sortBy?: string }) {
        const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const to = query.to ? new Date(query.to) : new Date();
        const topN = query.topN || 20;
        const orderCol = query.sortBy === 'peak' ? 'peak_total_bps' : 'avg_total_bps';

        try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT
                    im.device_id,
                    d.hostname        AS device_name,
                    d.ip_address      AS device_ip,
                    im.if_index,
                    i.if_name,
                    i.if_descr,
                    i.if_alias,
                    i.if_speed,
                    AVG(im.in_bps)                          AS avg_in_bps,
                    AVG(im.out_bps)                         AS avg_out_bps,
                    AVG(im.in_bps) + AVG(im.out_bps)        AS avg_total_bps,
                    MAX(im.in_bps)                          AS peak_in_bps,
                    MAX(im.out_bps)                         AS peak_out_bps,
                    MAX(im.in_bps) + MAX(im.out_bps)        AS peak_total_bps,
                    AVG(im.in_utilization)                  AS avg_in_util,
                    AVG(im.out_utilization)                 AS avg_out_util,
                    SUM(im.in_errors)                       AS total_in_errors,
                    SUM(im.out_errors)                      AS total_out_errors,
                    MAX(im.oper_status)                     AS oper_status
                 FROM interface_metrics im
                 JOIN interfaces i ON i.device_id = im.device_id AND i.if_index = im.if_index
                 JOIN devices d ON d.device_id = im.device_id
                 WHERE im.time >= $1
                   AND im.time <= $2
                 GROUP BY im.device_id, d.hostname, d.ip_address, im.if_index, i.if_name, i.if_descr, i.if_alias, i.if_speed
                 ORDER BY ${orderCol} DESC
                 LIMIT $3`,
                from, to, topN,
            );

            return {
                from: from.toISOString(),
                to: to.toISOString(),
                topN,
                data: rows.map(this.serializeRow),
            };
        } catch (err: any) {
            this.logger.warn('Top interfaces query failed: ' + err.message);
            return { from: from.toISOString(), to: to.toISOString(), topN, data: [] };
        }
    }

    /**
     * Get bandwidth report data for CSV export.
     */
    async getBandwidthReport(query: MetricsQueryDto & { deviceId?: number }) {
        const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const to = query.to ? new Date(query.to) : new Date();

        const deviceFilter = query.deviceId ? 'AND im.device_id = $3' : '';
        const params: any[] = [from, to];
        if (query.deviceId) params.push(query.deviceId);

        try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT
                    d.hostname                              AS device,
                    d.ip_address                            AS ip_address,
                    i.if_name                               AS interface,
                    i.if_descr                              AS description,
                    i.if_alias                              AS alias,
                    i.if_speed                              AS speed_bps,
                    ROUND(AVG(im.in_bps))                   AS avg_in_bps,
                    ROUND(AVG(im.out_bps))                  AS avg_out_bps,
                    ROUND(MAX(im.in_bps))                   AS max_in_bps,
                    ROUND(MAX(im.out_bps))                  AS max_out_bps,
                    ROUND(AVG(im.in_utilization)::numeric, 2) AS avg_in_util,
                    ROUND(AVG(im.out_utilization)::numeric, 2) AS avg_out_util,
                    ROUND(MAX(im.in_utilization)::numeric, 2) AS max_in_util,
                    ROUND(MAX(im.out_utilization)::numeric, 2) AS max_out_util,
                    SUM(im.in_errors)                       AS total_in_errors,
                    SUM(im.out_errors)                      AS total_out_errors,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY im.in_bps)  AS p95_in_bps,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY im.out_bps) AS p95_out_bps,
                    COUNT(*)                                AS samples
                 FROM interface_metrics im
                 JOIN interfaces i ON i.device_id = im.device_id AND i.if_index = im.if_index
                 JOIN devices d ON d.device_id = im.device_id
                 WHERE im.time >= $1 AND im.time <= $2 ${deviceFilter}
                 GROUP BY d.hostname, d.ip_address, i.if_name, i.if_descr, i.if_alias, i.if_speed
                 ORDER BY d.hostname, i.if_name`,
                ...params,
            );

            return {
                from: from.toISOString(),
                to: to.toISOString(),
                data: rows.map(this.serializeRow),
            };
        } catch (err: any) {
            this.logger.warn('Bandwidth report query failed: ' + err.message);
            return { from: from.toISOString(), to: to.toISOString(), data: [] };
        }
    }

    /**
     * Serialize BigInt/Decimal values to JSON-safe numbers.
     */
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
