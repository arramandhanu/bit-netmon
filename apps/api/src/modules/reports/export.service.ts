import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface ExportOptions {
    from?: Date;
    to?: Date;
    deviceId?: number;
}

@Injectable()
export class ExportService {
    constructor(private prisma: PrismaService) { }

    /**
     * Export devices as CSV.
     */
    async exportDevices(): Promise<string> {
        const devices = await this.prisma.device.findMany({
            include: { location: { select: { name: true } } },
            orderBy: { id: 'asc' },
        });

        const headers = ['ID', 'Hostname', 'IP Address', 'Type', 'Vendor', 'Model', 'Status', 'Location', 'Polling Enabled', 'Last Polled'];
        const rows = devices.map((d) => [
            d.id,
            d.hostname,
            d.ipAddress,
            d.deviceType,
            d.vendor || '',
            d.model || '',
            d.status,
            d.location?.name || '',
            d.pollingEnabled ? 'Yes' : 'No',
            d.lastPolledAt?.toISOString() || '',
        ]);

        return this.toCsv(headers, rows);
    }

    /**
     * Export alert history as CSV.
     */
    async exportAlerts(options: ExportOptions): Promise<string> {
        const where: any = {};
        if (options.from || options.to) {
            where.triggeredAt = {};
            if (options.from) where.triggeredAt.gte = options.from;
            if (options.to) where.triggeredAt.lte = options.to;
        }

        const alerts = await this.prisma.alertHistory.findMany({
            where,
            include: {
                device: { select: { hostname: true } },
                rule: { select: { name: true } },
            },
            orderBy: { triggeredAt: 'desc' },
            take: 10000,
        });

        const headers = ['ID', 'Device', 'Rule', 'Severity', 'State', 'Message', 'Metric Value', 'Triggered At', 'Resolved At'];
        const rows = alerts.map((a) => [
            a.id,
            a.device?.hostname || '',
            a.rule?.name || '',
            a.severity,
            a.state,
            `"${(a.message || '').replace(/"/g, '""')}"`,
            a.metricValue?.toString() || '',
            a.triggeredAt?.toISOString() || '',
            a.resolvedAt?.toISOString() || '',
        ]);

        return this.toCsv(headers, rows);
    }

    /**
     * Export audit logs as CSV.
     */
    async exportAuditLogs(options: ExportOptions): Promise<string> {
        const where: any = {};
        if (options.from || options.to) {
            where.createdAt = {};
            if (options.from) where.createdAt.gte = options.from;
            if (options.to) where.createdAt.lte = options.to;
        }

        const logs = await this.prisma.auditLog.findMany({
            where,
            include: { user: { select: { username: true } } },
            orderBy: { createdAt: 'desc' },
            take: 10000,
        });

        const headers = ['ID', 'User', 'Action', 'Entity', 'IP Address', 'Details', 'Created At'];
        const rows = logs.map((l) => [
            l.id,
            l.user?.username || '',
            l.action,
            l.entity,
            l.ipAddress || '',
            `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`,
            l.createdAt.toISOString(),
        ]);

        return this.toCsv(headers, rows);
    }

    private toCsv(headers: string[], rows: any[][]): string {
        const lines = [headers.join(',')];
        for (const row of rows) {
            lines.push(row.map((v: any) => (typeof v === 'string' && v.startsWith('"') ? v : String(v))).join(','));
        }
        return lines.join('\n');
    }
}
