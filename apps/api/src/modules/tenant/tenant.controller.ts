import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    ParseIntPipe,
    ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { CurrentUser, TenantUser, isSuperAdmin } from '../../common/guards/tenant.guard';
import { TenantService } from './tenant.service';

@ApiTags('Tenant / Team')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenant')
export class TenantController {
    constructor(private readonly tenantService: TenantService) {}

    // ─── Team Info ──────────────────────────────────────

    @Get('info')
    @ApiOperation({ summary: 'Get current tenant info with plan limits and usage' })
    async getTenantInfo(@CurrentUser() user: TenantUser) {
        if (isSuperAdmin(user)) {
            return this.tenantService.getSuperAdminInfo();
        }
        if (!user.tenantId) {
            throw new ForbiddenException('No tenant associated with your account');
        }
        return this.tenantService.getTenantInfo(user.tenantId);
    }

    // ─── Invitations ────────────────────────────────────

    @Post('invite')
    @Roles('admin')
    @ApiOperation({ summary: 'Invite a user to your tenant by email' })
    async inviteUser(
        @Body() body: { email: string; role?: 'admin' | 'operator' | 'viewer' | 'user' },
        @CurrentUser() user: TenantUser,
    ) {
        if (!user.tenantId) {
            throw new ForbiddenException('No tenant associated with your account');
        }
        return this.tenantService.inviteUser(
            user.tenantId,
            body.email,
            body.role || 'viewer',
            user.id,
        );
    }

    @Get('invite/accept')
    @ApiOperation({ summary: 'Accept a tenant invitation via token (public)' })
    async acceptInvitation(@Query('token') token: string) {
        return this.tenantService.acceptInvitation(token);
    }

    @Get('invitations')
    @Roles('admin')
    @ApiOperation({ summary: 'List pending invitations for your tenant' })
    async listInvitations(@CurrentUser() user: TenantUser) {
        if (isSuperAdmin(user)) {
            return this.tenantService.listAllInvitations();
        }
        if (!user.tenantId) {
            throw new ForbiddenException('No tenant associated with your account');
        }
        return this.tenantService.listInvitations(user.tenantId);
    }

    @Delete('invitations/:id')
    @Roles('admin')
    @ApiOperation({ summary: 'Cancel a pending invitation' })
    async cancelInvitation(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: TenantUser,
    ) {
        if (!user.tenantId) {
            throw new ForbiddenException('No tenant associated with your account');
        }
        return this.tenantService.cancelInvitation(user.tenantId, id);
    }

    // ─── Team Members ───────────────────────────────────

    @Get('team')
    @ApiOperation({ summary: 'List all team members in your tenant' })
    async listTeam(@CurrentUser() user: TenantUser) {
        if (isSuperAdmin(user)) {
            return this.tenantService.listAllMembers();
        }
        if (!user.tenantId) {
            throw new ForbiddenException('No tenant associated with your account');
        }
        return this.tenantService.listTeamMembers(user.tenantId);
    }

    @Delete('team/:userId')
    @Roles('admin')
    @ApiOperation({ summary: 'Remove a team member from your tenant' })
    async removeTeamMember(
        @Param('userId', ParseIntPipe) userId: number,
        @CurrentUser() user: TenantUser,
    ) {
        if (!user.tenantId) {
            throw new ForbiddenException('No tenant associated with your account');
        }
        return this.tenantService.removeTeamMember(user.tenantId, userId, user.id);
    }
}
