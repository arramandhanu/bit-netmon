import {
    Controller,
    Get,
    Param,
    Query,
    ParseIntPipe,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UptimeService } from './uptime.service';
import { CurrentUser, TenantUser, isSuperAdmin } from '../../common/guards/tenant.guard';

@ApiTags('Uptime / SLA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uptime')
export class UptimeController {
    constructor(private readonly uptimeService: UptimeService) {}

    @Get('summary')
    @ApiOperation({ summary: 'Get fleet-wide uptime summary with per-device SLA' })
    async getSummary(
        @Query('from') from?: string,
        @Query('to') to?: string,
        @CurrentUser() user?: TenantUser,
    ) {
        // Admin sees all, tenant users see only their own devices
        const tenantId = user && !isSuperAdmin(user) ? user.tenantId : null;
        return this.uptimeService.getSummary(from, to, tenantId);
    }

    @Get(':deviceId')
    @ApiOperation({ summary: 'Get uptime history for a specific device' })
    async getHistory(
        @Param('deviceId', ParseIntPipe) deviceId: number,
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('bucket') bucket?: string,
    ) {
        return this.uptimeService.getUptimeHistory(
            deviceId,
            from,
            to,
            bucket || '5 minutes',
        );
    }

    @Get(':deviceId/sla')
    @ApiOperation({ summary: 'Calculate SLA for a specific device' })
    async getSLA(
        @Param('deviceId', ParseIntPipe) deviceId: number,
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        return this.uptimeService.calculateSLA(deviceId, from, to);
    }
}
