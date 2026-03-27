import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    ParseIntPipe,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, RequirePermission } from '../../common/guards/roles.guard';
import { CurrentUser, TenantUser } from '../../common/guards/tenant.guard';
import { UrlMonitorService, UrlMonitorDto } from './url-monitor.service';

@ApiTags('Web/API Monitoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('url-monitors')
export class UrlMonitorController {
    constructor(private readonly service: UrlMonitorService) {}

    @Get('overview')
    @ApiOperation({ summary: 'Get URL monitoring dashboard overview' })
    async getOverview(@CurrentUser() user: TenantUser) {
        return this.service.getOverview(user);
    }

    @Get()
    @ApiOperation({ summary: 'List all URL monitors' })
    async findAll(@CurrentUser() user: TenantUser) {
        return this.service.findAll(user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get URL monitor detail with check history' })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: TenantUser,
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        const [monitor, history] = await Promise.all([
            this.service.findOne(id, user),
            this.service.getHistory(id, from, to),
        ]);
        return { ...monitor, history };
    }

    @Post()
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Create a new URL monitor' })
    async create(@Body() dto: UrlMonitorDto, @CurrentUser() user: TenantUser) {
        return this.service.create(dto, user);
    }

    @Patch(':id')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Update a URL monitor' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: Partial<UrlMonitorDto>,
        @CurrentUser() user: TenantUser,
    ) {
        return this.service.update(id, dto, user);
    }

    @Delete(':id')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Delete a URL monitor' })
    async delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: TenantUser) {
        await this.service.delete(id, user);
        return { success: true };
    }

    @Post(':id/check')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Trigger an immediate check for a URL monitor' })
    async triggerCheck(@Param('id', ParseIntPipe) id: number) {
        const monitor = await this.service.findOne(id);
        const result = await this.service.performCheck(monitor);
        await this.service.recordCheckResult(id, result);
        return result;
    }
}
