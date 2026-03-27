import {
    Controller,
    Get,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, RequirePermission } from '../../common/guards/roles.guard';
import { InterfacesService, InterfaceQueryDto, UpdateInterfaceDto } from './interfaces.service';

@ApiTags('Interfaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('interfaces')
export class InterfacesController {
    constructor(private readonly interfacesService: InterfacesService) { }

    @Get()
    @RequirePermission('devices:read')
    @ApiOperation({ summary: 'List all interfaces with filters and pagination' })
    findAll(@Query() query: InterfaceQueryDto) {
        return this.interfacesService.findAll(query);
    }

    // Get interfaces for a specific device
    @Get('device/:deviceId')
    @RequirePermission('devices:read')
    @ApiOperation({ summary: 'Get all interfaces for a specific device' })
    findByDevice(@Param('deviceId', ParseIntPipe) deviceId: number) {
        return this.interfacesService.findByDeviceId(deviceId);
    }

    // Static routes MUST come before parameterised routes
    @Patch('bulk/update')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Bulk update interfaces' })
    bulkUpdate(@Body() body: { ids: number[]; update: UpdateInterfaceDto }) {
        return this.interfacesService.bulkUpdate(body.ids, body.update);
    }

    @Get(':id')
    @RequirePermission('devices:read')
    @ApiOperation({ summary: 'Get a single interface with device info' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.interfacesService.findOne(id);
    }

    @Patch(':id')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Update interface (admin status, alias, polling)' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateInterfaceDto,
    ) {
        return this.interfacesService.update(id, dto);
    }
}
