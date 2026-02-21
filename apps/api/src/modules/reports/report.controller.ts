import {
    Controller,
    Get,
    Query,
    Res,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, RequirePermission } from '../../common/guards/roles.guard';
import { ReportService } from './report.service';
import { ExportService } from './export.service';

@ApiTags('Reports & Export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ReportController {
    constructor(
        private readonly reportService: ReportService,
        private readonly exportService: ExportService,
    ) { }

    // ─── Reports ────────────────────────────────────────

    @Get('reports/network-health')
    @RequirePermission('reports:generate')
    @ApiOperation({ summary: 'Generate a network health report (JSON)' })
    async getReport(
        @Query('type') type: 'daily' | 'weekly' | 'monthly' = 'daily',
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        const now = new Date();
        const fromDate = from ? new Date(from) : new Date(now.getTime() - 86400000);
        const toDate = to ? new Date(to) : now;
        return this.reportService.generateNetworkHealthReport({ type, from: fromDate, to: toDate });
    }

    // ─── CSV Export ─────────────────────────────────────

    @Get('export/devices')
    @RequirePermission('devices:read')
    @ApiOperation({ summary: 'Export all devices as CSV' })
    async exportDevices(@Res() res: Response) {
        const csv = await this.exportService.exportDevices();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=devices.csv');
        res.send(csv);
    }

    @Get('export/alerts')
    @RequirePermission('alerts:read')
    @ApiOperation({ summary: 'Export alert history as CSV' })
    async exportAlerts(
        @Res() res: Response,
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        const csv = await this.exportService.exportAlerts({
            from: from ? new Date(from) : undefined,
            to: to ? new Date(to) : undefined,
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=alerts.csv');
        res.send(csv);
    }

    @Get('export/audit-logs')
    @RequirePermission('audit:read')
    @ApiOperation({ summary: 'Export audit logs as CSV' })
    async exportAuditLogs(
        @Res() res: Response,
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        const csv = await this.exportService.exportAuditLogs({
            from: from ? new Date(from) : undefined,
            to: to ? new Date(to) : undefined,
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
        res.send(csv);
    }
}
