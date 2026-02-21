import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SnmpModule } from '../snmp/snmp.module';
import { DiscoveryService } from './discovery.service';
import { DiscoveryProcessor } from './discovery.processor';
import { DiscoveryController } from './discovery.controller';

@Module({
    imports: [
        SnmpModule,
        BullModule.registerQueue({ name: 'discovery' }),
    ],
    controllers: [DiscoveryController],
    providers: [DiscoveryService, DiscoveryProcessor],
    exports: [DiscoveryService],
})
export class DiscoveryModule { }
