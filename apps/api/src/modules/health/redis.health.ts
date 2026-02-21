import { Injectable, Inject, Logger } from '@nestjs/common';
import {
    HealthIndicator,
    HealthIndicatorResult,
    HealthCheckError,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.module';

/**
 * Health indicator for Redis connectivity.
 *
 * Executes a PING command and reports the result.
 * Used by the /health endpoint.
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
    private readonly logger = new Logger(RedisHealthIndicator.name);

    constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
        super();
    }

    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        try {
            const response = await this.redis.ping();
            const isHealthy = response === 'PONG';

            const result = this.getStatus(key, isHealthy, {
                responseTime: 'ok',
            });

            if (!isHealthy) {
                throw new HealthCheckError('Redis check failed', result);
            }

            return result;
        } catch (error) {
            this.logger.error('Redis health check failed', error);
            const result = this.getStatus(key, false, {
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new HealthCheckError('Redis check failed', result);
        }
    }
}
