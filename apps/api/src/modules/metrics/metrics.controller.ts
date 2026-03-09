import {
    Controller,
    Get,
    Post,
    Param,
    Query,
    UseGuards,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MetricsService } from './metrics.service';
import { MetricsQueryDto } from './metrics.dto';
import { PollingService } from '../polling/polling.service';

@ApiTags('Metrics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class MetricsController {
    constructor(
        private readonly metricsService: MetricsService,
        private readonly pollingService: PollingService,
    ) { }

    // ─── Device Metrics ─────────────────────────────────

    @Get('metrics/device/:id')
    @ApiOperation({ summary: 'Get device metrics over time' })
    getDeviceMetrics(
        @Param('id', ParseIntPipe) id: number,
        @Query() query: MetricsQueryDto,
    ) {
        return this.metricsService.getDeviceMetrics(id, query);
    }

    @Get('metrics/device/:id/latest')
    @ApiOperation({ summary: 'Get latest device metrics snapshot' })
    getLatestDeviceMetrics(@Param('id', ParseIntPipe) id: number) {
        return this.metricsService.getLatestDeviceMetrics(id);
    }

    // ─── Interface Metrics ──────────────────────────────

    @Get('metrics/interface/:deviceId/:ifIndex')
    @ApiOperation({ summary: 'Get interface bandwidth/error metrics over time' })
    getInterfaceMetrics(
        @Param('deviceId', ParseIntPipe) deviceId: number,
        @Param('ifIndex', ParseIntPipe) ifIndex: number,
        @Query() query: MetricsQueryDto,
    ) {
        return this.metricsService.getInterfaceMetrics(deviceId, ifIndex, query);
    }

    // ─── Dashboard ──────────────────────────────────────

    @Get('metrics/dashboard')
    @ApiOperation({ summary: 'Get dashboard overview — latest metrics for all devices' })
    getDashboard() {
        return this.metricsService.getExtendedDashboardOverview();
    }

    // ─── Polling Controls ───────────────────────────────

    @Post('polling/trigger/:deviceId')
    @ApiOperation({ summary: 'Trigger immediate SNMP poll for a device' })
    triggerPoll(@Param('deviceId', ParseIntPipe) deviceId: number) {
        return this.pollingService.triggerPoll(deviceId);
    }

    @Get('polling/status')
    @ApiOperation({ summary: 'Get polling engine status overview' })
    getPollingStatus() {
        return this.pollingService.getStatus();
    }

    @Post('polling/sync')
    @ApiOperation({ summary: 'Resync polling jobs with current devices' })
    syncPolling() {
        return this.pollingService.syncPollingJobs();
    }
}
