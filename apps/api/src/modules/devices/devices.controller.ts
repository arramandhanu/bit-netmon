import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, RequirePermission } from '../../common/guards/roles.guard';
import { CurrentUser, TenantUser } from '../../common/guards/tenant.guard';
import { DevicesService } from './devices.service';
import { CreateDeviceDto, UpdateDeviceDto, DeviceQueryDto, BulkDeleteDeviceDto, BulkUpdateDeviceDto, TestSnmpDto } from './devices.dto';

@ApiTags('Devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('devices')
export class DevicesController {
    constructor(private readonly devicesService: DevicesService) { }

    @Get()
    @RequirePermission('devices:read')
    @ApiOperation({ summary: 'List all devices with pagination and filters' })
    findAll(@Query() query: DeviceQueryDto, @CurrentUser() user: TenantUser) {
        return this.devicesService.findAll(query, user);
    }

    @Get(':id')
    @RequirePermission('devices:read')
    @ApiOperation({ summary: 'Get a single device by ID with its interfaces' })
    findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: TenantUser) {
        return this.devicesService.findOne(id, user);
    }

    @Post()
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Create a new device' })
    create(@Body() dto: CreateDeviceDto, @CurrentUser() user: TenantUser) {
        return this.devicesService.create(dto, user);
    }

    @Post('test-snmp')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Test SNMP connectivity without saving the device' })
    testSnmp(@Body() dto: TestSnmpDto) {
        return this.devicesService.testSnmp(dto);
    }

    @Post('bulk-delete')
    @RequirePermission('devices:delete')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Bulk delete devices by IDs' })
    bulkDelete(@Body() dto: BulkDeleteDeviceDto, @CurrentUser() user: TenantUser) {
        return this.devicesService.bulkRemove(dto.ids, user);
    }

    @Patch('bulk-update')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Bulk update devices by IDs' })
    bulkUpdate(@Body() dto: BulkUpdateDeviceDto, @CurrentUser() user: TenantUser) {
        return this.devicesService.bulkUpdate(dto.ids, dto.data, user);
    }

    @Patch(':id')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Update a device' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateDeviceDto,
        @CurrentUser() user: TenantUser,
    ) {
        return this.devicesService.update(id, dto, user);
    }

    @Delete(':id')
    @RequirePermission('devices:delete')
    @ApiOperation({ summary: 'Delete a device' })
    remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: TenantUser) {
        return this.devicesService.remove(id, user);
    }

    // ─── Maintenance Windows ────────────────────────────

    @Post(':id/maintenance')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Put a device into maintenance mode' })
    startMaintenance(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { reason?: string; endsAt?: string },
    ) {
        return this.devicesService.startMaintenance(id, body.reason, body.endsAt ? new Date(body.endsAt) : undefined);
    }

    @Delete(':id/maintenance')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'End maintenance mode for a device' })
    endMaintenance(@Param('id', ParseIntPipe) id: number) {
        return this.devicesService.endMaintenance(id);
    }
}
