import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Global Redis module.
 *
 * Provides a single ioredis instance for health checks,
 * caching, and any direct Redis operations outside BullMQ.
 */
@Global()
@Module({
    providers: [
        {
            provide: REDIS_CLIENT,
            useFactory: (config: ConfigService) => {
                const client = new Redis({
                    host: config.get('redis.host'),
                    port: config.get('redis.port'),
                    password: config.get('redis.password'),
                    maxRetriesPerRequest: null,
                    enableReadyCheck: true,
                    retryStrategy: (times: number) => {
                        if (times > 10) return null;
                        return Math.min(times * 200, 5000);
                    },
                });

                client.on('error', (err) => {
                    console.error('[Redis] Connection error:', err.message);
                });

                return client;
            },
            inject: [ConfigService],
        },
    ],
    exports: [REDIS_CLIENT],
})
export class RedisModule { }
