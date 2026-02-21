import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogQueryDto } from './audit.dto';

@Injectable()
export class AuditService {

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Write an audit log entry.
     */
    async log(params: {
        userId?: number;
        action: string;
        entity: string;
        entityId?: number;
        details?: any;
        ipAddress?: string;
    }) {
        return this.prisma.auditLog.create({
            data: {
                userId: params.userId ?? null,
                action: params.action,
                entity: params.entity,
                entityId: params.entityId ?? null,
                details: params.details ?? null,
                ipAddress: params.ipAddress ?? null,
            },
        });
    }

    /**
     * Get paginated audit logs.
     */
    async findAll(query: AuditLogQueryDto) {
        const page = query.page || 1;
        const limit = query.limit || 25;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (query.action) where.action = query.action;
        if (query.userId) where.userId = query.userId;
        if (query.entity) where.entity = query.entity;

        const [data, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: { user: { select: { username: true, displayName: true } } },
            }),
            this.prisma.auditLog.count({ where }),
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

    /**
     * Get security overview stats.
     */
    async getStats() {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 86400000);

        const [failedLogins24h, totalLogs, recentActivity] = await Promise.all([
            this.prisma.auditLog.count({
                where: { action: 'login_failed', createdAt: { gte: oneDayAgo } },
            }),
            this.prisma.auditLog.count(),
            this.prisma.auditLog.findMany({
                where: { action: { in: ['login_success', 'login_failed'] } },
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: { user: { select: { username: true } } },
            }),
        ]);

        // Count active sessions (successful logins in last 24h without corresponding logout)
        const activeSessions = await this.prisma.auditLog.count({
            where: { action: 'login_success', createdAt: { gte: oneDayAgo } },
        });

        return {
            failedLogins24h,
            activeSessions,
            totalLogs,
            recentActivity,
        };
    }
}
