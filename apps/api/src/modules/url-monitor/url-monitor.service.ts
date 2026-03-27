import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantUser, isSuperAdmin } from '../../common/guards/tenant.guard';

export interface UrlMonitorDto {
    name: string;
    url: string;
    method?: string;
    expectedStatus?: number;
    checkInterval?: number;
    timeout?: number;
    headers?: Record<string, string>;
    body?: string;
    enabled?: boolean;
    locationId?: number;
}

export interface UrlMonitorOverview {
    totalMonitors: number;
    monitorsUp: number;
    monitorsDown: number;
    monitorsUnknown: number;
    avgResponseMs: number;
    monitors: any[];
}

@Injectable()
export class UrlMonitorService {
    private readonly logger = new Logger(UrlMonitorService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * List all URL monitors with latest status.
     */
    async findAll(user?: TenantUser): Promise<any[]> {
        try {
            const tenantFilter = user && !isSuperAdmin(user) ? `WHERE um.tenant_id = ${user.tenantId}` : '';
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT um.*, l.name AS location_name, l.latitude, l.longitude
                 FROM url_monitors um
                 LEFT JOIN locations l ON um.location_id = l.location_id
                 ${tenantFilter}
                 ORDER BY um.name`,
            );
            return rows.map(this.serializeRow);
        } catch (err: any) {
            this.logger.warn(`Failed to list URL monitors: ${err.message}`);
            return [];
        }
    }

    /**
     * Get a single URL monitor by ID.
     */
    async findOne(id: number, user?: TenantUser): Promise<any> {
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM url_monitors WHERE url_monitor_id = $1`,
            id,
        );
        if (rows.length === 0) throw new NotFoundException(`URL Monitor #${id} not found`);
        const monitor = this.serializeRow(rows[0]);
        if (user && !isSuperAdmin(user) && monitor.tenant_id !== user.tenantId) {
            throw new NotFoundException(`URL Monitor #${id} not found`);
        }
        return monitor;
    }

    /**
     * Create a new URL monitor.
     */
    async create(dto: UrlMonitorDto, user?: TenantUser): Promise<any> {
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `INSERT INTO url_monitors (name, url, method, expected_status, check_interval, timeout, headers, body, enabled, location_id, tenant_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)
             RETURNING *`,
            dto.name,
            dto.url,
            dto.method || 'GET',
            dto.expectedStatus || 200,
            dto.checkInterval || 300,
            dto.timeout || 30000,
            dto.headers ? JSON.stringify(dto.headers) : null,
            dto.body || null,
            dto.enabled !== false,
            dto.locationId || null,
            user?.tenantId || null,
        );
        return this.serializeRow(rows[0]);
    }

    /**
     * Update a URL monitor.
     */
    async update(id: number, dto: Partial<UrlMonitorDto>, user?: TenantUser): Promise<any> {
        await this.findOne(id, user); // ensure exists + tenant check

        const sets: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (dto.name !== undefined) { sets.push(`name = $${idx++}`); values.push(dto.name); }
        if (dto.url !== undefined) { sets.push(`url = $${idx++}`); values.push(dto.url); }
        if (dto.method !== undefined) { sets.push(`method = $${idx++}`); values.push(dto.method); }
        if (dto.expectedStatus !== undefined) { sets.push(`expected_status = $${idx++}`); values.push(dto.expectedStatus); }
        if (dto.checkInterval !== undefined) { sets.push(`check_interval = $${idx++}`); values.push(dto.checkInterval); }
        if (dto.timeout !== undefined) { sets.push(`timeout = $${idx++}`); values.push(dto.timeout); }
        if (dto.headers !== undefined) { sets.push(`headers = $${idx++}::jsonb`); values.push(JSON.stringify(dto.headers)); }
        if (dto.body !== undefined) { sets.push(`body = $${idx++}`); values.push(dto.body); }
        if (dto.enabled !== undefined) { sets.push(`enabled = $${idx++}`); values.push(dto.enabled); }
        if (dto.locationId !== undefined) { sets.push(`location_id = $${idx++}`); values.push(dto.locationId || null); }

        sets.push(`updated_at = NOW()`);

        if (sets.length <= 1) return this.findOne(id);

        values.push(id);
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `UPDATE url_monitors SET ${sets.join(', ')} WHERE url_monitor_id = $${idx} RETURNING *`,
            ...values,
        );
        return this.serializeRow(rows[0]);
    }

    /**
     * Delete a URL monitor.
     */
    async delete(id: number, user?: TenantUser): Promise<void> {
        await this.findOne(id, user);
        await this.prisma.$executeRawUnsafe(
            `DELETE FROM url_monitors WHERE url_monitor_id = $1`,
            id,
        );
    }

    /**
     * Perform an HTTP check on a URL monitor.
     */
    async performCheck(monitor: any): Promise<{
        statusCode: number | null;
        responseMs: number;
        isUp: boolean;
        errorMessage: string | null;
    }> {
        const startTime = Date.now();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), monitor.timeout || 30000);

            const fetchOptions: RequestInit = {
                method: monitor.method || 'GET',
                signal: controller.signal,
                headers: monitor.headers || {},
            };

            if (monitor.body && ['POST', 'PUT', 'PATCH'].includes(monitor.method || '')) {
                fetchOptions.body = monitor.body;
            }

            const response = await fetch(monitor.url, fetchOptions);
            clearTimeout(timeoutId);

            const responseMs = Date.now() - startTime;
            const statusCode = response.status;
            const isUp = statusCode === (monitor.expected_status || monitor.expectedStatus || 200);

            return { statusCode, responseMs, isUp, errorMessage: isUp ? null : `Status ${statusCode}` };
        } catch (err: any) {
            const responseMs = Date.now() - startTime;
            return {
                statusCode: null,
                responseMs,
                isUp: false,
                errorMessage: err.name === 'AbortError' ? 'Timeout' : err.message,
            };
        }
    }

    /**
     * Record a check result.
     */
    async recordCheckResult(
        monitorId: number,
        result: { statusCode: number | null; responseMs: number; isUp: boolean; errorMessage: string | null },
    ): Promise<void> {
        await Promise.all([
            this.prisma.$executeRawUnsafe(
                `INSERT INTO url_check_results (time, monitor_id, status_code, response_ms, is_up, error_message)
                 VALUES (NOW(), $1, $2, $3, $4, $5)`,
                monitorId,
                result.statusCode,
                result.responseMs,
                result.isUp,
                result.errorMessage,
            ),
            this.prisma.$executeRawUnsafe(
                `UPDATE url_monitors SET status = $1, last_checked_at = NOW(), last_response_ms = $2, updated_at = NOW()
                 WHERE url_monitor_id = $3`,
                result.isUp ? 'up' : 'down',
                result.responseMs,
                monitorId,
            ),
        ]);
    }

    /**
     * Get check history for a monitor.
     */
    async getHistory(
        monitorId: number,
        from?: string,
        to?: string,
        limit: number = 100,
    ): Promise<any[]> {
        const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const toDate = to ? new Date(to) : new Date();

        try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT time, monitor_id, status_code, response_ms, is_up, error_message
                 FROM url_check_results
                 WHERE monitor_id = $1 AND time >= $2 AND time <= $3
                 ORDER BY time DESC
                 LIMIT $4`,
                monitorId,
                fromDate,
                toDate,
                limit,
            );
            return rows.map(this.serializeRow);
        } catch {
            return [];
        }
    }

    /**
     * Get overview dashboard data.
     */
    async getOverview(user?: TenantUser): Promise<UrlMonitorOverview> {
        const monitors = await this.findAll(user);
        const up = monitors.filter(m => m.status === 'up').length;
        const down = monitors.filter(m => m.status === 'down').length;
        const unknown = monitors.filter(m => m.status === 'unknown').length;
        const withResponse = monitors.filter(m => m.last_response_ms != null);
        const avgResponse = withResponse.length > 0
            ? Math.round(withResponse.reduce((s, m) => s + (m.last_response_ms || 0), 0) / withResponse.length)
            : 0;

        // Calculate uptime % for each monitor from last 24h
        for (const monitor of monitors) {
            try {
                const rows = await this.prisma.$queryRawUnsafe<any[]>(
                    `SELECT
                        COUNT(*) AS total,
                        COUNT(*) FILTER (WHERE is_up = true) AS up_count
                     FROM url_check_results
                     WHERE monitor_id = $1 AND time >= NOW() - INTERVAL '24 hours'`,
                    monitor.url_monitor_id,
                );
                const r = rows[0];
                const total = Number(r?.total || 0);
                const upCount = Number(r?.up_count || 0);
                monitor.uptimePercent24h = total > 0 ? Math.round((upCount / total) * 10000) / 100 : null;
            } catch {
                monitor.uptimePercent24h = null;
            }
        }

        return {
            totalMonitors: monitors.length,
            monitorsUp: up,
            monitorsDown: down,
            monitorsUnknown: unknown,
            avgResponseMs: avgResponse,
            monitors,
        };
    }

    /**
     * Get all enabled monitors for the processor to check.
     */
    async getEnabledMonitors(): Promise<any[]> {
        try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT * FROM url_monitors WHERE enabled = true`,
            );
            return rows.map(this.serializeRow);
        } catch {
            return [];
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
