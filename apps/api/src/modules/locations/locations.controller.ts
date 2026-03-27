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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, RequirePermission } from '../../common/guards/roles.guard';
import { CurrentUser, TenantUser } from '../../common/guards/tenant.guard';
import { LocationsService } from './locations.service';
import { CreateLocationDto, UpdateLocationDto, LocationQueryDto } from './locations.dto';

@ApiTags('Locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('locations')
export class LocationsController {
    constructor(private readonly locationsService: LocationsService) { }

    @Get()
    @RequirePermission('devices:read')
    @ApiOperation({ summary: 'List all locations with device counts' })
    findAll(@Query() query: LocationQueryDto, @CurrentUser() user: TenantUser) {
        return this.locationsService.findAll(query, user);
    }

    @Get(':id')
    @RequirePermission('devices:read')
    @ApiOperation({ summary: 'Get a location by ID with its devices' })
    findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: TenantUser) {
        return this.locationsService.findOne(id, user);
    }

    @Post()
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Create a new location' })
    create(@Body() dto: CreateLocationDto, @CurrentUser() user: TenantUser) {
        return this.locationsService.create(dto, user);
    }

    @Patch(':id')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Update a location' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateLocationDto,
        @CurrentUser() user: TenantUser,
    ) {
        return this.locationsService.update(id, dto, user);
    }

    @Delete(':id')
    @RequirePermission('devices:delete')
    @ApiOperation({ summary: 'Delete a location (must have no devices)' })
    remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: TenantUser) {
        return this.locationsService.remove(id, user);
    }
}
