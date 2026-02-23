import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    UseGuards,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, RequirePermission } from '../../common/guards/roles.guard';
import { DeviceGroupsService } from './device-groups.service';

@ApiTags('Device Groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('device-groups')
export class DeviceGroupsController {
    constructor(private readonly groupsService: DeviceGroupsService) { }

    @Get()
    @RequirePermission('devices:read')
    @ApiOperation({ summary: 'List all device groups with member counts' })
    findAll() {
        return this.groupsService.findAll();
    }

    @Get(':id')
    @RequirePermission('devices:read')
    @ApiOperation({ summary: 'Get a single group with members' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.groupsService.findOne(id);
    }

    @Post()
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Create a new device group' })
    create(@Body() body: { name: string; description?: string }) {
        return this.groupsService.create(body.name, body.description);
    }

    @Delete(':id')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Delete a device group' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.groupsService.remove(id);
    }

    @Post(':id/members')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Add devices to group' })
    addMembers(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { deviceIds: number[] },
    ) {
        return this.groupsService.addMembers(id, body.deviceIds);
    }

    @Delete(':id/members')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Remove devices from group' })
    removeMembers(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { deviceIds: number[] },
    ) {
        return this.groupsService.removeMembers(id, body.deviceIds);
    }
}
