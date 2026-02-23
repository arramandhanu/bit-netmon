import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { DeviceGroupsController } from './device-groups.controller';
import { DeviceGroupsService } from './device-groups.service';
import { InterfacesController } from './interfaces.controller';
import { InterfacesService } from './interfaces.service';
import { SnmpModule } from '../snmp/snmp.module';

@Module({
    imports: [SnmpModule],
    controllers: [DevicesController, DeviceGroupsController, InterfacesController],
    providers: [DevicesService, DeviceGroupsService, InterfacesService],
    exports: [DevicesService, DeviceGroupsService, InterfacesService],
})
export class DevicesModule { }

