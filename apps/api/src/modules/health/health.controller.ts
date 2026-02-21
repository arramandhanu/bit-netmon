import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

@ApiTags('System')
@Controller('health')
export class HealthController {
    constructor(
        private readonly health: HealthCheckService,
        private readonly prisma: PrismaHealthIndicator,
        private readonly redis: RedisHealthIndicator,
    ) { }

    @Get()
    @HealthCheck()
    @ApiOperation({ summary: 'Application health check — verifies database and Redis connectivity' })
    check() {
        return this.health.check([
            () => this.prisma.isHealthy('database'),
            () => this.redis.isHealthy('redis'),
        ]);
    }
}
