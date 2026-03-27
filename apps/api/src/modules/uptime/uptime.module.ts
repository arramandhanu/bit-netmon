import { Module } from '@nestjs/common';
import { UptimeService } from './uptime.service';
import { UptimeController } from './uptime.controller';

@Module({
    controllers: [UptimeController],
    providers: [UptimeService],
    exports: [UptimeService],
})
export class UptimeModule {}
