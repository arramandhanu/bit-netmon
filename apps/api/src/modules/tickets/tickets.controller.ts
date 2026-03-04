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
    Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles, RequirePermission } from '../../common/guards/roles.guard';
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
    create(@Body() dto: CreateTicketDto, @Req() req: any) {
        return this.ticketsService.create(dto, req.user?.id || 0);
    }

    @Get('tickets')
    @RequirePermission('tickets:read')
    @ApiOperation({ summary: 'List tickets with filters and pagination' })
    findAll(@Query() query: TicketQueryDto) {
        return this.ticketsService.findAll(query);
    }

    @Get('tickets/stats')
    @RequirePermission('tickets:read')
    @ApiOperation({ summary: 'Get ticket statistics for dashboard' })
    getStats() {
        return this.ticketsService.getStats();
    }

    @Get('tickets/:id')
    @RequirePermission('tickets:read')
    @ApiOperation({ summary: 'Get ticket detail with comments' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.ticketsService.findOne(id);
    }

    @Patch('tickets/:id')
    @RequirePermission('tickets:write')
    @ApiOperation({ summary: 'Update a ticket' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateTicketDto,
        @Req() req: any,
    ) {
        return this.ticketsService.update(id, dto, req.user?.id || 0);
    }

    @Delete('tickets/:id')
    @Roles('admin')
    @ApiOperation({ summary: 'Delete a ticket (admin only)' })
    delete(@Param('id', ParseIntPipe) id: number) {
        return this.ticketsService.delete(id);
    }

    // ─── Comments ───────────────────────────────────────

    @Post('tickets/:id/comments')
    @RequirePermission('tickets:write')
    @ApiOperation({ summary: 'Add a comment to a ticket' })
    addComment(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: CreateTicketCommentDto,
        @Req() req: any,
    ) {
        return this.ticketsService.addComment(id, dto, req.user?.id || 0);
    }

    // ─── Assignment ─────────────────────────────────────

    @Post('tickets/:id/assign')
    @RequirePermission('tickets:write')
    @ApiOperation({ summary: 'Assign or reassign a ticket' })
    assign(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: AssignTicketDto,
        @Req() req: any,
    ) {
        return this.ticketsService.assign(id, dto, req.user?.id || 0);
    }

    // ─── Alert → Ticket ────────────────────────────────

    @Post('alerts/:id/create-ticket')
    @RequirePermission('tickets:write')
    @ApiOperation({ summary: 'Create a ticket from an alert' })
    createFromAlert(
        @Param('id', ParseIntPipe) alertId: number,
        @Req() req: any,
    ) {
        return this.ticketsService.createFromAlert(alertId, req.user?.id || 0);
    }
}
