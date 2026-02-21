import {
    Controller,
    Get,
    Put,
    Body,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, RequirePermission } from '../../common/guards/roles.guard';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './settings.dto';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SettingsController {

    constructor(private readonly settingsService: SettingsService) { }

    @Get()
    @RequirePermission('settings:read')
    @ApiOperation({ summary: 'Get all system settings (grouped by category)' })
    getAll(@Query('category') category?: string) {
        return this.settingsService.getAll(category);
    }

    @Put()
    @RequirePermission('settings:write')
    @ApiOperation({ summary: 'Bulk update system settings' })
    update(@Body() dto: UpdateSettingsDto) {
        return this.settingsService.bulkUpsert(dto.settings);
    }
}
