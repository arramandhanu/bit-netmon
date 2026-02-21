import { Module } from '@nestjs/common';
import { SnmpService } from './snmp.service';
import { DeviceClassifierService } from './device-classifier.service';

@Module({
    providers: [SnmpService, DeviceClassifierService],
    exports: [SnmpService, DeviceClassifierService],
})
export class SnmpModule { }
