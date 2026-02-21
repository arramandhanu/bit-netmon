import { Injectable, Logger } from '@nestjs/common';
import {
    HealthIndicator,
    HealthIndicatorResult,
    HealthCheckError,
} from '@nestjs/terminus';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Health indicator for database connectivity.
 *
 * Runs a lightweight `SELECT 1` query against PostgreSQL.
 */
@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
    private readonly logger = new Logger(PrismaHealthIndicator.name);

    constructor(private readonly prisma: PrismaService) {
        super();
    }

    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return this.getStatus(key, true);
        } catch (error) {
            this.logger.error('Database health check failed', error);
            const result = this.getStatus(key, false, {
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new HealthCheckError('Database check failed', result);
        }
    }
}
