import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    Query,
    Headers,
    ParseIntPipe,
    UseGuards,
    UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, RequirePermission } from '../../common/guards/roles.guard';
import { DevopsService, ServiceActionDto, ServiceStatusPayload } from './devops.service';
import { ServerMonitorService } from '../server-monitor/server-monitor.service';

@ApiTags('DevOps')
@Controller('devops')
export class DevopsController {
    constructor(
        private readonly devopsService: DevopsService,
        private readonly serverMonitorService: ServerMonitorService,
    ) {}

    // ─── Dashboard (JWT-authenticated) ──────────────────

    @Get('overview')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'Get DevOps dashboard overview' })
    async getOverview() {
        return this.devopsService.getOverview();
    }

    @Get('servers')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'List all servers for DevOps management' })
    async getServers() {
        return this.devopsService.getServersWithServices();
    }

    @Get('servers/:id/services')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'Get systemd services for a server' })
    async getServerServices(@Param('id', ParseIntPipe) id: number) {
        return this.devopsService.getServerServices(id);
    }

    @Post('servers/:id/services/:serviceName/action')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Execute action on a systemd service' })
    async executeServiceAction(
        @Param('id', ParseIntPipe) id: number,
        @Param('serviceName') serviceName: string,
        @Body() dto: ServiceActionDto,
    ) {
        return this.devopsService.executeServiceAction(id, serviceName, dto);
    }

    @Get('servers/:id/commands')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'Get command history for a server' })
    async getCommandHistory(
        @Param('id', ParseIntPipe) id: number,
        @Query('limit') limit?: string,
    ) {
        return this.devopsService.getCommandHistory(id, limit ? parseInt(limit) : 50);
    }

    // ─── Agent endpoints (token-authenticated) ──────────

    @Post('agent/:id/services')
    @ApiOperation({ summary: 'Agent: report systemd services status' })
    async ingestServices(
        @Param('id', ParseIntPipe) id: number,
        @Headers('x-agent-token') agentToken: string,
        @Body() payload: ServiceStatusPayload,
    ) {
        if (!agentToken) throw new UnauthorizedException('Missing X-Agent-Token header');
        const server = await this.serverMonitorService.authenticateAgent(agentToken);
        if (!server || server.server_id !== id) throw new UnauthorizedException('Invalid agent token');
        await this.devopsService.ingestServices(id, payload);
        return { success: true };
    }

    @Get('agent/:id/commands')
    @ApiOperation({ summary: 'Agent: poll for pending commands' })
    async getAgentCommands(
        @Param('id', ParseIntPipe) id: number,
        @Headers('x-agent-token') agentToken: string,
    ) {
        if (!agentToken) throw new UnauthorizedException('Missing X-Agent-Token header');
        const server = await this.serverMonitorService.authenticateAgent(agentToken);
        if (!server || server.server_id !== id) throw new UnauthorizedException('Invalid agent token');
        return this.devopsService.getPendingCommands(id);
    }

    @Post('agent/:id/commands/:commandId/result')
    @ApiOperation({ summary: 'Agent: report command execution result' })
    async reportCommandResult(
        @Param('id', ParseIntPipe) id: number,
        @Param('commandId', ParseIntPipe) commandId: number,
        @Headers('x-agent-token') agentToken: string,
        @Body() body: { status: string; output?: string },
    ) {
        if (!agentToken) throw new UnauthorizedException('Missing X-Agent-Token header');
        const server = await this.serverMonitorService.authenticateAgent(agentToken);
        if (!server || server.server_id !== id) throw new UnauthorizedException('Invalid agent token');
        await this.devopsService.updateCommandStatus(commandId, body.status, body.output);
        return { success: true };
    }
}
