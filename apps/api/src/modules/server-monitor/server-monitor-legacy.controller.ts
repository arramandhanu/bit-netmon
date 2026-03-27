import { Controller, Get, Param, Query, Res, ParseIntPipe, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerMonitorService } from './server-monitor.service';
import type { Response } from 'express';

// ─── Legacy Unversioned Endpoint for Scripts ───
// This controller is mounted at the root to avoid global prefix and versioning issues,
// specifically handling the legacy /api/server-monitors/... path for agents.

@Controller()
export class ServerMonitorLegacyController {
    constructor(
        private readonly service: ServerMonitorService,
        private readonly config: ConfigService,
    ) {}

    @Get('server-monitors/:id/install-script/raw')
    async getRawInstallScriptAlias(
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
}
