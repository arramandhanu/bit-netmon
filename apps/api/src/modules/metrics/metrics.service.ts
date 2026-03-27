import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { MetricsQueryDto, MetricInterval } from "./metrics.dto";
import { SettingsService } from "../settings/settings.service";

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Map interval enum to TimescaleDB time_bucket() interval string
   */
  private toTimeBucket(interval: MetricInterval): string {
    const map: Record<MetricInterval, string> = {
      [MetricInterval.ONE_MIN]: "1 minute",
      [MetricInterval.FIVE_MIN]: "5 minutes",
      [MetricInterval.FIFTEEN_MIN]: "15 minutes",
      [MetricInterval.ONE_HOUR]: "1 hour",
      [MetricInterval.SIX_HOURS]: "6 hours",
      [MetricInterval.ONE_DAY]: "1 day",
    };
    return map[interval] || "5 minutes";
  }

  /**
   * Get device metrics over time, aggregated by time_bucket.
   */
  async getDeviceMetrics(deviceId: number, query: MetricsQueryDto) {
    const bucket = this.toTimeBucket(query.interval || MetricInterval.FIVE_MIN);
    const limit = query.limit || 100;
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
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
      this.logger.warn("device_metrics table not available: " + err.message);
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
  async getInterfaceMetrics(
    deviceId: number,
    ifIndex: number,
    query: MetricsQueryDto,
  ) {
    const bucket = this.toTimeBucket(query.interval || MetricInterval.FIVE_MIN);
    const limit = query.limit || 100;
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
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
      this.logger.warn("interface_metrics table not available: " + err.message);
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
        `SELECT DISTINCT ON (dm.device_id)
                    dm.device_id,
                    dm.time,
                    dm.cpu_utilization,
                    dm.memory_percent,
                    dm.response_time_ms,
                    dm.device_status,
                    dm.uptime
                 FROM device_metrics dm
                 INNER JOIN devices d ON d.device_id = dm.device_id
                 ORDER BY dm.device_id, dm.time DESC`,
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
      this.prisma.interface.count({ where: { ifOperStatus: "down" } }),
      this.prisma.ticket.count({
        where: { status: { notIn: ["resolved", "closed"] } },
      }),
      this.prisma.ticket.findMany({
        where: { status: { notIn: ["resolved", "closed"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          device: { select: { hostname: true } },
        },
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
      recentSecurityEvents: [], // Mock for now
    };
  }

  /**
   * Purge old metrics/alerts/audit logs based on configured retention periods.
   * Call this from a cron job (e.g., nightly).
   */
  async purgeOldData() {
    const metricsDays = await this.settings.getNumber(
      "retention.metricsDays",
      90,
    );
    const alertDays = await this.settings.getNumber(
      "retention.alertHistoryDays",
      365,
    );
    const auditDays = await this.settings.getNumber(
      "retention.auditLogDays",
      180,
    );

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

  /**
   * Serialize BigInt/Decimal values to JSON-safe numbers.
   */
  private serializeRow(row: any): any {
    const out: any = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "bigint") {
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
