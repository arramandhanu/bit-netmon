import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/* ─── Types ──────────────────────────────────────────────── */

export interface ServiceInfo {
    name: string;
    description: string;
    loadState: string;
    activeState: string;
    subState: string;
    unitFileState: string;
}

export interface ServiceActionDto {
    action: 'start' | 'stop' | 'restart' | 'enable' | 'disable';
}

export interface ServiceStatusPayload {
    services: ServiceInfo[];
    timestamp?: string;
}

/* ─── Service ────────────────────────────────────────────── */

@Injectable()
export class DevopsService implements OnModuleInit {
    private readonly logger = new Logger(DevopsService.name);

    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit() {
        try {
            await this.ensureServicesTable();
            await this.ensureCommandsTable();
            this.logger.log('DevOps tables ensured');
        } catch (err: any) {
            this.logger.warn(`Failed to ensure DevOps tables: ${err.message}`);
        }
    }

    /**
     * Get all servers with their latest service status from the devops_services table.
     */
    async getServersWithServices(): Promise<any[]> {
        const servers = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT sm.server_id, sm.name, sm.server_type, sm.ip_address, sm.hostname,
                    sm.status, sm.os_info, sm.last_reported_at,
                    l.name AS location_name
             FROM server_monitors sm
             LEFT JOIN locations l ON sm.location_id = l.location_id
             ORDER BY sm.name`,
        );
        return servers.map(this.serializeRow);
    }

    /**
     * Get services for a specific server.
     */
    async getServerServices(serverId: number): Promise<any> {
        // Check server exists
        const servers = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM server_monitors WHERE server_id = $1`,
            serverId,
        );
        if (servers.length === 0) throw new NotFoundException(`Server #${serverId} not found`);
        const server = this.serializeRow(servers[0]);

        // Get persisted services from the devops_services table
        try {
            const services = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT * FROM devops_services
                 WHERE server_id = $1
                 ORDER BY name`,
                serverId,
            );
            return {
                server,
                services: services.map(this.serializeRow),
            };
        } catch {
            // Table might not exist yet — return empty
            return { server, services: [] };
        }
    }

    /**
     * Ingest service status from the agent.
     * Called via the agent endpoint POST /devops/servers/:id/services
     */
    async ingestServices(serverId: number, payload: ServiceStatusPayload): Promise<void> {
        try {
            // Ensure the devops_services table exists
            await this.ensureServicesTable();

            // Clear old services for this server and insert fresh data
            await this.prisma.$executeRawUnsafe(
                `DELETE FROM devops_services WHERE server_id = $1`,
                serverId,
            );

            for (const svc of payload.services) {
                await this.prisma.$executeRawUnsafe(
                    `INSERT INTO devops_services (server_id, name, description, load_state, active_state, sub_state, unit_file_state, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                    serverId,
                    svc.name,
                    svc.description || '',
                    svc.loadState || 'unknown',
                    svc.activeState || 'unknown',
                    svc.subState || 'unknown',
                    svc.unitFileState || 'unknown',
                );
            }
        } catch (err: any) {
            this.logger.warn(`Failed to ingest services for server #${serverId}: ${err.message}`);
            throw err;
        }
    }

    /**
     * Execute a service action on a server via the pending_commands mechanism.
     * The agent polls for pending commands and executes them.
     */
    async executeServiceAction(serverId: number, serviceName: string, dto: ServiceActionDto): Promise<any> {
        const validActions = ['start', 'stop', 'restart', 'enable', 'disable'];
        if (!validActions.includes(dto.action)) {
            throw new BadRequestException(`Invalid action: ${dto.action}. Must be one of: ${validActions.join(', ')}`);
        }

        // Check server exists
        const servers = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM server_monitors WHERE server_id = $1`,
            serverId,
        );
        if (servers.length === 0) throw new NotFoundException(`Server #${serverId} not found`);

        // Ensure commands table exists
        await this.ensureCommandsTable();

        // Insert a pending command for the agent to pick up
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `INSERT INTO devops_commands (server_id, command_type, service_name, action, status, created_at, updated_at)
             VALUES ($1, 'systemctl', $2, $3, 'pending', NOW(), NOW())
             RETURNING *`,
            serverId,
            serviceName,
            dto.action,
        );

        return this.serializeRow(rows[0]);
    }

    /**
     * Get pending commands for a server (agent polls this).
     */
    async getPendingCommands(serverId: number): Promise<any[]> {
        try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT * FROM devops_commands
                 WHERE server_id = $1 AND status = 'pending'
                 ORDER BY created_at ASC`,
                serverId,
            );
            return rows.map(this.serializeRow);
        } catch {
            return [];
        }
    }

    /**
     * Update command status (agent reports back).
     */
    async updateCommandStatus(commandId: number, status: string, output?: string): Promise<void> {
        try {
            await this.prisma.$executeRawUnsafe(
                `UPDATE devops_commands SET status = $2, output = $3, updated_at = NOW() WHERE id = $1`,
                commandId,
                status,
                output || null,
            );
        } catch (err: any) {
            this.logger.warn(`Failed to update command #${commandId}: ${err.message}`);
        }
    }

    /**
     * Get command history for a server
     */
    async getCommandHistory(serverId: number, limit: number = 50): Promise<any[]> {
        try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT * FROM devops_commands
                 WHERE server_id = $1
                 ORDER BY created_at DESC
                 LIMIT $2`,
                serverId,
                limit,
            );
            return rows.map(this.serializeRow);
        } catch {
            return [];
        }
    }

    /**
     * DevOps overview dashboard
     */
    async getOverview(): Promise<any> {
        const servers = await this.getServersWithServices();
        let totalServices = 0;
        let activeServices = 0;
        let failedServices = 0;

        try {
            const stats = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE active_state = 'active')::int AS active,
                    COUNT(*) FILTER (WHERE active_state = 'failed')::int AS failed
                 FROM devops_services`,
            );
            if (stats.length > 0) {
                totalServices = Number(stats[0].total);
                activeServices = Number(stats[0].active);
                failedServices = Number(stats[0].failed);
            }
        } catch {
            // Table might not exist
        }

        return {
            totalServers: servers.length,
            serversUp: servers.filter(s => s.status === 'up').length,
            serversDown: servers.filter(s => s.status === 'down').length,
            totalServices,
            activeServices,
            failedServices,
            servers,
        };
    }

    /* ─── Table creation helpers ──────────────────────────── */

    private async ensureServicesTable(): Promise<void> {
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS devops_services (
                id SERIAL PRIMARY KEY,
                server_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT DEFAULT '',
                load_state VARCHAR(50) DEFAULT 'unknown',
                active_state VARCHAR(50) DEFAULT 'unknown',
                sub_state VARCHAR(50) DEFAULT 'unknown',
                unit_file_state VARCHAR(50) DEFAULT 'unknown',
                updated_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT fk_devops_services_server FOREIGN KEY (server_id)
                    REFERENCES server_monitors(server_id) ON DELETE CASCADE
            )
        `);
        await this.prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS idx_devops_services_server ON devops_services(server_id)`,
        );
    }

    private async ensureCommandsTable(): Promise<void> {
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS devops_commands (
                id SERIAL PRIMARY KEY,
                server_id INT NOT NULL,
                command_type VARCHAR(50) NOT NULL DEFAULT 'systemctl',
                service_name VARCHAR(255),
                action VARCHAR(50) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                output TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT fk_devops_commands_server FOREIGN KEY (server_id)
                    REFERENCES server_monitors(server_id) ON DELETE CASCADE
            )
        `);
        await this.prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS idx_devops_commands_server ON devops_commands(server_id)`,
        );
    }

    /* ─── Helpers ────────────────────────────────────────── */

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
