import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Wraps PrismaClient as a NestJS injectable service.
 *
 * Handles connection lifecycle:
 * - Connects lazily on first query (Prisma default)
 * - Disconnects cleanly on app shutdown
 * - Logs slow queries in development
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    constructor() {
        super({
            log:
                process.env.NODE_ENV === 'development'
                    ? [
                        { emit: 'event', level: 'query' },
                        { emit: 'stdout', level: 'info' },
                        { emit: 'stdout', level: 'warn' },
                        { emit: 'stdout', level: 'error' },
                    ]
                    : [
                        { emit: 'stdout', level: 'warn' },
                        { emit: 'stdout', level: 'error' },
                    ],
        });
    }

    async onModuleInit() {
        await this.$connect();
        this.logger.log('Database connection established');

        // Log slow queries in development (>200ms)
        if (process.env.NODE_ENV === 'development') {
            (this as any).$on('query', (event: any) => {
                if (event.duration > 200) {
                    this.logger.warn(`Slow query (${event.duration}ms): ${event.query}`);
                }
            });
        }
    }

    async onModuleDestroy() {
        await this.$disconnect();
        this.logger.log('Database connection closed');
    }
}
