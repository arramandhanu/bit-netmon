import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { UrlMonitorService } from './url-monitor.service';
import { UrlMonitorController } from './url-monitor.controller';
import { UrlMonitorProcessor } from './url-monitor.processor';
import { UptimeModule } from '../uptime/uptime.module';

@Module({
    imports: [
        UptimeModule,
        BullModule.registerQueue({ name: 'url-monitor' }),
    ],
    controllers: [UrlMonitorController],
    providers: [UrlMonitorService, UrlMonitorProcessor],
    exports: [UrlMonitorService],
})
export class UrlMonitorModule {}
