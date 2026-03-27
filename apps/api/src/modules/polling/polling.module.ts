import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SnmpModule } from '../snmp/snmp.module';
import { AlertingModule } from '../alerting/alerting.module';
import { UptimeModule } from '../uptime/uptime.module';
import { PollingService } from './polling.service';
import { PollingProcessor } from './polling.processor';

@Module({
    imports: [
        SnmpModule,
        AlertingModule,
        UptimeModule,
        BullModule.registerQueue({ name: 'polling' }),
    ],
    providers: [PollingService, PollingProcessor],
    exports: [PollingService],
})
export class PollingModule { }
