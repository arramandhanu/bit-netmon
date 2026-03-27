import { Module } from '@nestjs/common';
import { ServerMonitorService } from './server-monitor.service';
import { ServerMonitorController } from './server-monitor.controller';
import { ServerMonitorLegacyController } from './server-monitor-legacy.controller';
import { AiAnalyticsService } from './ai-analytics.service';
import { AiAnalyticsController } from './ai-analytics.controller';
import { RemoteTerminalGateway } from './remote-terminal.gateway';

@Module({
    controllers: [ServerMonitorController, ServerMonitorLegacyController, AiAnalyticsController],
    providers: [ServerMonitorService, AiAnalyticsService, RemoteTerminalGateway],
    exports: [ServerMonitorService, AiAnalyticsService],
})
export class ServerMonitorModule {}
