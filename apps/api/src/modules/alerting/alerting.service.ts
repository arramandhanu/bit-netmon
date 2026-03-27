import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAlertRuleDto, UpdateAlertRuleDto, AlertHistoryQueryDto } from './alerting.dto';
import { TenantUser, tenantWhere, isSuperAdmin } from '../../common/guards/tenant.guard';

@Injectable()
export class AlertingService {
    constructor(private readonly prisma: PrismaService) { }

    // ─── Alert Rules CRUD ───────────────────────────────

    async createRule(dto: CreateAlertRuleDto, user?: TenantUser) {
        return this.prisma.alertRule.create({
            data: {
                name: dto.name,
                description: dto.description,
                metricName: dto.metricName,
                condition: dto.condition,
                threshold: dto.threshold,
                duration: dto.duration || 0,
                severity: (dto.severity as any) || 'warning',
                notifyChannels: dto.notifyChannels || [],
                deviceGroupId: dto.deviceGroupId,
                ...(user ? { tenantId: user.tenantId } : {}),
            },
            include: { deviceGroup: true },
        });
    }

    async listRules(user?: TenantUser) {
        return this.prisma.alertRule.findMany({
            where: user ? tenantWhere(user) : {},
            include: {
                deviceGroup: true,
                _count: { select: { alerts: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getRule(id: number, user?: TenantUser) {
        const rule = await this.prisma.alertRule.findUnique({
            where: { id },
            include: {
                deviceGroup: true,
                alerts: {
                    take: 10,
                    orderBy: { triggeredAt: 'desc' },
                    include: { device: { select: { hostname: true, ipAddress: true } } },
                },
            },
        });

        if (!rule || (user && !isSuperAdmin(user) && rule.tenantId !== user.tenantId)) {
            throw new NotFoundException(`Alert rule #${id} not found`);
        }
        return rule;
    }

    async updateRule(id: number, dto: UpdateAlertRuleDto, user?: TenantUser) {
        await this.getRule(id, user); // Ensure exists + tenant check

        return this.prisma.alertRule.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.metricName !== undefined && { metricName: dto.metricName }),
                ...(dto.condition !== undefined && { condition: dto.condition }),
                ...(dto.threshold !== undefined && { threshold: dto.threshold }),
                ...(dto.duration !== undefined && { duration: dto.duration }),
                ...(dto.severity !== undefined && { severity: dto.severity as any }),
                ...(dto.enabled !== undefined && { enabled: dto.enabled }),
                ...(dto.notifyChannels !== undefined && { notifyChannels: dto.notifyChannels }),
                ...(dto.deviceGroupId !== undefined && { deviceGroupId: dto.deviceGroupId }),
            },
            include: { deviceGroup: true },
        });
    }

    async deleteRule(id: number, user?: TenantUser) {
        await this.getRule(id, user);
        await this.prisma.alertRule.delete({ where: { id } });
        return { deleted: true };
    }

    // ─── Alert History ──────────────────────────────────

    async getHistory(query: AlertHistoryQueryDto) {
        const page = query.page || 1;
        const limit = query.limit || 50;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (query.deviceId) where.deviceId = query.deviceId;
        if (query.severity) where.severity = query.severity;
        if (query.state) where.state = query.state;

        const [data, total] = await Promise.all([
            this.prisma.alertHistory.findMany({
                where,
                include: {
                    device: { select: { hostname: true, ipAddress: true, deviceType: true } },
                    rule: { select: { name: true, metricName: true, condition: true, threshold: true } },
                },
                orderBy: { triggeredAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.alertHistory.count({ where }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getActiveAlerts() {
        return this.prisma.alertHistory.findMany({
            where: {
                state: { in: ['triggered', 'acknowledged'] },
            },
            include: {
                device: { select: { hostname: true, ipAddress: true, deviceType: true, status: true } },
                rule: { select: { name: true, metricName: true, severity: true } },
            },
            orderBy: { triggeredAt: 'desc' },
        });
    }

    async acknowledgeAlert(alertId: number, userId: number) {
        const alert = await this.prisma.alertHistory.findUnique({ where: { id: alertId } });
        if (!alert) throw new NotFoundException(`Alert #${alertId} not found`);

        if (alert.state !== 'triggered') {
            return { message: `Alert is already ${alert.state}` };
        }

        return this.prisma.alertHistory.update({
            where: { id: alertId },
            data: {
                state: 'acknowledged',
                acknowledgedAt: new Date(),
                acknowledgedBy: userId,
            },
        });
    }

    async resolveAlert(alertId: number) {
        const alert = await this.prisma.alertHistory.findUnique({ where: { id: alertId } });
        if (!alert) throw new NotFoundException(`Alert #${alertId} not found`);

        if (alert.state === 'resolved') {
            return { message: 'Alert is already resolved' };
        }

        return this.prisma.alertHistory.update({
            where: { id: alertId },
            data: {
                state: 'resolved',
                resolvedAt: new Date(),
            },
        });
    }

    // ─── Dashboard Stats ────────────────────────────────

    async getAlertStats() {
        const [triggered, acknowledged, total24h, bySeverity] = await Promise.all([
            this.prisma.alertHistory.count({ where: { state: 'triggered' } }),
            this.prisma.alertHistory.count({ where: { state: 'acknowledged' } }),
            this.prisma.alertHistory.count({
                where: { triggeredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
            }),
            this.prisma.alertHistory.groupBy({
                by: ['severity'],
                where: { state: { in: ['triggered', 'acknowledged'] } },
                _count: true,
            }),
        ]);

        return {
            activeAlerts: triggered + acknowledged,
            triggered,
            acknowledged,
            last24Hours: total24h,
            bySeverity: bySeverity.reduce(
                (acc, item) => ({ ...acc, [item.severity]: item._count }),
                {} as Record<string, number>,
            ),
        };
    }
}
