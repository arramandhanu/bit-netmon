import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    UseGuards,
    ParseIntPipe,
    Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles, RequirePermission } from '../../common/guards/roles.guard';
import { CurrentUser, TenantUser } from '../../common/guards/tenant.guard';
import { AlertingService } from './alerting.service';
import { CreateAlertRuleDto, UpdateAlertRuleDto, AlertHistoryQueryDto } from './alerting.dto';

@ApiTags('Alerting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class AlertingController {
    constructor(private readonly alertingService: AlertingService) { }

    // ─── Alert Rules ────────────────────────────────────

    @Post('alerts/rules')
    @RequirePermission('alerts:write')
    @ApiOperation({ summary: 'Create a new alert rule' })
    createRule(@Body() dto: CreateAlertRuleDto, @CurrentUser() user: TenantUser) {
        return this.alertingService.createRule(dto, user);
    }

    @Get('alerts/rules')
    @RequirePermission('alerts:read')
    @ApiOperation({ summary: 'List all alert rules' })
    listRules(@CurrentUser() user: TenantUser) {
        return this.alertingService.listRules(user);
    }

    @Get('alerts/rules/:id')
    @RequirePermission('alerts:read')
    @ApiOperation({ summary: 'Get alert rule with recent alerts' })
    getRule(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: TenantUser) {
        return this.alertingService.getRule(id, user);
    }

    @Patch('alerts/rules/:id')
    @RequirePermission('alerts:write')
    @ApiOperation({ summary: 'Update alert rule' })
    updateRule(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateAlertRuleDto,
        @CurrentUser() user: TenantUser,
    ) {
        return this.alertingService.updateRule(id, dto, user);
    }

    @Delete('alerts/rules/:id')
    @Roles('admin')
    @ApiOperation({ summary: 'Delete alert rule' })
    deleteRule(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: TenantUser) {
        return this.alertingService.deleteRule(id, user);
    }

    // ─── Alert History ──────────────────────────────────

    @Get('alerts/history')
    @RequirePermission('alerts:read')
    @ApiOperation({ summary: 'Query alert history with filters' })
    getHistory(@Query() query: AlertHistoryQueryDto) {
        return this.alertingService.getHistory(query);
    }

    @Get('alerts/active')
    @RequirePermission('alerts:read')
    @ApiOperation({ summary: 'List all active (unresolved) alerts' })
    getActiveAlerts() {
        return this.alertingService.getActiveAlerts();
    }

    @Get('alerts/stats')
    @RequirePermission('alerts:read')
    @ApiOperation({ summary: 'Get alert statistics for dashboard' })
    getStats() {
        return this.alertingService.getAlertStats();
    }

    // ─── Alert Actions ──────────────────────────────────

    @Post('alerts/:id/acknowledge')
    @RequirePermission('alerts:acknowledge')
    @ApiOperation({ summary: 'Acknowledge an alert' })
    acknowledgeAlert(
        @Param('id', ParseIntPipe) id: number,
        @Req() req: any,
    ) {
        return this.alertingService.acknowledgeAlert(id, req.user?.id || 0);
    }

    @Post('alerts/:id/resolve')
    @RequirePermission('alerts:acknowledge')
    @ApiOperation({ summary: 'Manually resolve an alert' })
    resolveAlert(@Param('id', ParseIntPipe) id: number) {
        return this.alertingService.resolveAlert(id);
    }
}
