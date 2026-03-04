import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import appConfig from './config/app.config';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { LoggerModule } from './common/logger/logger.module';
import { WebSocketModule } from './modules/metrics/websocket.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { DevicesModule } from './modules/devices/devices.module';
import { LocationsModule } from './modules/locations/locations.module';
import { SnmpModule } from './modules/snmp/snmp.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { PollingModule } from './modules/polling/polling.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { AlertingModule } from './modules/alerting/alerting.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AuditModule } from './modules/audit/audit.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TicketsModule } from './modules/tickets/tickets.module';

@Module({
    imports: [
        // ─── Configuration ──────────────────────────────
        ConfigModule.forRoot({
            isGlobal: true,
            load: [appConfig],
            cache: true,
        }),

        // ─── Infrastructure ─────────────────────────────
        PrismaModule,
        RedisModule,
        CryptoModule,
        LoggerModule,
        WebSocketModule,

        // ─── Job Queue ──────────────────────────────────
        BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                connection: {
                    host: config.get('redis.host'),
                    port: config.get('redis.port'),
                    password: config.get('redis.password'),
                    maxRetriesPerRequest: null,
                },
                defaultJobOptions: {
                    removeOnComplete: { count: 100 },
                    removeOnFail: { count: 500 },
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 5000 },
                },
            }),
        }),

        // ─── Feature Modules ────────────────────────────
        HealthModule,
        AuthModule,
        DevicesModule,
        LocationsModule,
        SnmpModule,
        DiscoveryModule,
        PollingModule,
        MetricsModule,
        AlertingModule,
        SettingsModule,
        AuditModule,
        ReportsModule,
        TicketsModule,

        // ─── Rate Limiting ─────────────────────────────
        ThrottlerModule.forRoot([{
            ttl: 60000,   // 1 minute window
            limit: 100,   // 100 requests per minute
        }]),
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class AppModule { }

