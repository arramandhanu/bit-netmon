import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    UseGuards,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles, RequirePermission } from '../../common/guards/roles.guard';
import { CurrentUser, TenantUser } from '../../common/guards/tenant.guard';
import { TicketsService } from './tickets.service';
import {
    CreateTicketDto, UpdateTicketDto, TicketQueryDto,
    CreateTicketCommentDto, AssignTicketDto,
} from './tickets.dto';

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class TicketsController {
    constructor(private readonly ticketsService: TicketsService) { }

    // ─── CRUD ───────────────────────────────────────────

    @Post('tickets')
    @RequirePermission('tickets:write')
    @ApiOperation({ summary: 'Create a new ticket' })
    create(@Body() dto: CreateTicketDto, @CurrentUser() user: TenantUser) {
        return this.ticketsService.create(dto, user);
    }

    @Get('tickets')
    @RequirePermission('tickets:read')
    @ApiOperation({ summary: 'List tickets with filters and pagination' })
    findAll(@Query() query: TicketQueryDto, @CurrentUser() user: TenantUser) {
        return this.ticketsService.findAll(query, user);
    }

    @Get('tickets/stats')
    @RequirePermission('tickets:read')
    @ApiOperation({ summary: 'Get ticket statistics for dashboard' })
    getStats(@CurrentUser() user: TenantUser) {
        return this.ticketsService.getStats(user);
    }

    @Get('tickets/team-members')
    @RequirePermission('tickets:read')
    @ApiOperation({ summary: 'Get team members for ticket assignment (same tenant)' })
    getTeamMembers(@CurrentUser() user: TenantUser) {
        return this.ticketsService.getTeamMembers(user);
    }

    @Get('tickets/:id')
    @RequirePermission('tickets:read')
    @ApiOperation({ summary: 'Get ticket detail with comments' })
    findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: TenantUser) {
        return this.ticketsService.findOne(id, user);
    }

    @Patch('tickets/:id')
    @RequirePermission('tickets:write')
    @ApiOperation({ summary: 'Update a ticket' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateTicketDto,
        @CurrentUser() user: TenantUser,
    ) {
        return this.ticketsService.update(id, dto, user);
    }

    @Delete('tickets/:id')
    @Roles('admin')
    @ApiOperation({ summary: 'Delete a ticket (admin only)' })
    delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: TenantUser) {
        return this.ticketsService.delete(id, user);
    }

    // ─── Comments ───────────────────────────────────────

    @Post('tickets/:id/comments')
    @RequirePermission('tickets:write')
    @ApiOperation({ summary: 'Add a comment to a ticket' })
    addComment(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: CreateTicketCommentDto,
        @CurrentUser() user: TenantUser,
    ) {
        return this.ticketsService.addComment(id, dto, user.id);
    }

    // ─── Assignment ─────────────────────────────────────

    @Post('tickets/:id/assign')
    @RequirePermission('tickets:write')
    @ApiOperation({ summary: 'Assign or reassign a ticket' })
    assign(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: AssignTicketDto,
        @CurrentUser() user: TenantUser,
    ) {
        return this.ticketsService.assign(id, dto, user);
    }

    // ─── Alert → Ticket ────────────────────────────────

    @Post('alerts/:id/create-ticket')
    @RequirePermission('tickets:write')
    @ApiOperation({ summary: 'Create a ticket from an alert' })
    createFromAlert(
        @Param('id', ParseIntPipe) alertId: number,
        @CurrentUser() user: TenantUser,
    ) {
        return this.ticketsService.createFromAlert(alertId, user);
    }
}
