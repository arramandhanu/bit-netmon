import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface ReportOptions {
    type: 'daily' | 'weekly' | 'monthly';
    from: Date;
    to: Date;
}

@Injectable()
export class ReportService {
    constructor(private prisma: PrismaService) { }

    /**
     * Generate a network health report as JSON.
     *
     * For PDF generation, install `pdfkit` and render this data.
     * This JSON structure can also be used by the frontend for
     * on-screen report display.
     */
    async generateNetworkHealthReport(options: ReportOptions) {
        const [deviceStats, alertSummary, topDevices] = await Promise.all([
            this.getDeviceStats(),
            this.getAlertSummary(options.from, options.to),
            this.getTopDevicesByAlerts(options.from, options.to),
        ]);

        return {
            reportType: options.type,
            period: { from: options.from, to: options.to },
            generatedAt: new Date(),
            deviceSummary: deviceStats,
            alertSummary,
            topDevicesByAlerts: topDevices,
        };
    }

    private async getDeviceStats() {
        const counts = await this.prisma.device.groupBy({
            by: ['status'],
            _count: true,
        });
        const total = counts.reduce((s, c) => s + c._count, 0);
        const up = counts.find((c) => c.status === 'up')?._count || 0;
        const down = counts.find((c) => c.status === 'down')?._count || 0;
        const warning = counts.find((c) => c.status === 'warning')?._count || 0;
        return { total, up, down, warning, uptime: total > 0 ? ((up / total) * 100).toFixed(1) : '0' };
    }

    private async getAlertSummary(from: Date, to: Date) {
        const alerts = await this.prisma.alertHistory.groupBy({
            by: ['severity', 'state'],
            _count: true,
            where: { triggeredAt: { gte: from, lte: to } },
        });
        return {
            total: alerts.reduce((s, a) => s + a._count, 0),
            critical: alerts.filter((a) => a.severity === 'critical').reduce((s, a) => s + a._count, 0),
            warning: alerts.filter((a) => a.severity === 'warning').reduce((s, a) => s + a._count, 0),
            info: alerts.filter((a) => a.severity === 'info').reduce((s, a) => s + a._count, 0),
            resolved: alerts.filter((a) => a.state === 'resolved').reduce((s, a) => s + a._count, 0),
            pending: alerts.filter((a) => a.state === 'triggered').reduce((s, a) => s + a._count, 0),
        };
    }

    private async getTopDevicesByAlerts(from: Date, to: Date) {
        const results = await this.prisma.alertHistory.groupBy({
            by: ['deviceId'],
            _count: true,
            where: { triggeredAt: { gte: from, lte: to } },
            orderBy: { _count: { deviceId: 'desc' } },
            take: 10,
        });

        const deviceIds = results.map((r) => r.deviceId);
        const devices = await this.prisma.device.findMany({
            where: { id: { in: deviceIds } },
            select: { id: true, hostname: true, ipAddress: true },
        });

        return results.map((r) => ({
            device: devices.find((d) => d.id === r.deviceId),
            alertCount: r._count,
        }));
    }
}
