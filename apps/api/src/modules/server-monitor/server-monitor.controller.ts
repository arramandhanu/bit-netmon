import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    Headers,
    Res,
    Header,
    ParseIntPipe,
    UseGuards,
    UnauthorizedException,
    Version,
} from '@nestjs/common';
import { VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, RequirePermission } from '../../common/guards/roles.guard';
import { CurrentUser, TenantUser } from '../../common/guards/tenant.guard';
import { ServerMonitorService, CreateServerDto, ServerMetricsPayload } from './server-monitor.service';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

@ApiTags('Server Monitoring')
@Controller('server-monitors')
export class ServerMonitorController {
    constructor(
        private readonly service: ServerMonitorService,
        private readonly config: ConfigService,
    ) {}

    // ─── Dashboard endpoints (JWT-authenticated) ────────

    @Get('overview')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'Get server monitoring dashboard overview' })
    async getOverview(@CurrentUser() user: TenantUser) {
        return this.service.getOverview(user);
    }

    @Get()
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'List all monitored servers' })
    async findAll(@CurrentUser() user: TenantUser) {
        return this.service.findAll(user);
    }

    @Post()
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Register a new server for monitoring' })
    async create(@Body() dto: CreateServerDto, @CurrentUser() user: TenantUser) {
        return this.service.create(dto, user);
    }

    // ─── Specific :id sub-routes MUST come before the generic @Get(':id') ───

    @Get(':id/install-script/raw')
    @Version([VERSION_NEUTRAL, '1'])
    @Header('Content-Type', 'text/plain')
    @ApiOperation({ summary: 'Public raw install script (token-authenticated)' })
    async getRawInstallScript(
        @Param('id', ParseIntPipe) id: number,
        @Query('token') token: string,
        @Res() res: Response,
    ) {
        if (!token) throw new UnauthorizedException('Missing token query parameter');
        const server = await this.service.authenticateAgent(token);
        if (!server || server.server_id !== id) throw new UnauthorizedException('Invalid token');
        const apiBaseUrl = this.config.get<string>('app.apiBaseUrl') || this.config.get<string>('API_BASE_URL') || 'http://localhost:3001';
        const script = this.service.generateInstallScript(server, apiBaseUrl);
        res.setHeader('Content-Type', 'text/plain');
        res.send(script);
    }

    @Get(':id/install-script/download')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'Download agent install script as a file' })
    async downloadInstallScript(
        @Param('id', ParseIntPipe) id: number,
        @Res() res: Response,
    ) {
        const server = await this.service.findOne(id);
        const apiBaseUrl = this.config.get<string>('app.apiBaseUrl') || this.config.get<string>('API_BASE_URL') || 'http://localhost:3001';
        const script = this.service.generateInstallScript(server, apiBaseUrl);
        const ext = server.server_type === 'linux' ? 'sh' : 'ps1';
        const filename = `install-agent.${ext}`;
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(script);
    }

    // Endpoint removed; moved to ServerMonitorLegacyController

    @Get(':id/install-script')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'Generate agent install script for a server' })
    async getInstallScript(@Param('id', ParseIntPipe) id: number) {
        const server = await this.service.findOne(id);
        const apiBaseUrl = this.config.get<string>('app.apiBaseUrl') || this.config.get<string>('API_BASE_URL') || 'http://localhost:3001';
        const script = this.service.generateInstallScript(server, apiBaseUrl);
        return {
            serverType: server.server_type,
            script,
        };
    }

    @Get(':id/metrics')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'Get server metrics history' })
    async getMetrics(
        @Param('id', ParseIntPipe) id: number,
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('bucket') bucket?: string,
    ) {
        return this.service.getMetricsHistory(id, from, to, bucket || '5 minutes');
    }

    // ─── Generic :id route (catch-all, must come AFTER specific sub-routes) ───

    @Get(':id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'Get server detail with latest metrics' })
    async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: TenantUser) {
        const [server, latestMetrics] = await Promise.all([
            this.service.findOne(id, user),
            this.service.getLatestMetrics(id),
        ]);
        return { ...server, latestMetrics };
    }

    @Patch(':id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Update server configuration' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: Partial<CreateServerDto>,
        @CurrentUser() user: TenantUser,
    ) {
        return this.service.update(id, dto, user);
    }

    @Delete(':id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Delete a monitored server' })
    async delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: TenantUser) {
        await this.service.delete(id, user);
        return { success: true };
    }

    // ─── Agent endpoint (token-authenticated, no JWT) ───

    @Post(':id/metrics')
    @Version([VERSION_NEUTRAL, '1'])
    @ApiOperation({ summary: 'Agent endpoint: ingest server metrics' })
    async ingestMetrics(
        @Param('id', ParseIntPipe) id: number,
        @Headers('x-agent-token') agentToken: string,
        @Body() payload: ServerMetricsPayload,
    ) {
        if (!agentToken) {
            throw new UnauthorizedException('Missing X-Agent-Token header');
        }

        const server = await this.service.authenticateAgent(agentToken);
        if (!server || server.server_id !== id) {
            throw new UnauthorizedException('Invalid agent token');
        }

        await this.service.ingestMetrics(id, payload);
        return { success: true, serverId: id };
    }
}
