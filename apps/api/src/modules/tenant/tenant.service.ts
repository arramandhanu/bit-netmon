import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../billing/email.service';


@Injectable()
export class TenantService {
    private readonly logger = new Logger(TenantService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly emailService: EmailService,
        private readonly config: ConfigService,
    ) {}

    // ─── Invite a user to the tenant ────────────────────

    async inviteUser(
        tenantId: number,
        email: string,
        role: 'admin' | 'operator' | 'viewer' | 'user',
        invitedById: number,
    ) {
        // Check plan user limit
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            include: {
                users: { select: { id: true } },
                subscriptions: {
                    where: { status: { in: ['active', 'trial'] } },
                    include: { plan: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });

        if (!tenant) throw new NotFoundException('Tenant not found');

        const activeSub = tenant.subscriptions[0];
        const maxUsers = activeSub?.plan?.maxUsers ?? 1;
        const currentUserCount = tenant.users.length;

        // Count pending invitations too
        const pendingCount = await this.prisma.tenantInvitation.count({
            where: { tenantId, acceptedAt: null, expiresAt: { gte: new Date() } },
        });

        if (currentUserCount + pendingCount >= maxUsers) {
            throw new ForbiddenException(
                `User limit reached (${maxUsers}). Upgrade your plan or remove existing users first.`,
            );
        }

        // Check if user already in this tenant
        const existingUser = await this.prisma.user.findUnique({ where: { email } });
        if (existingUser && existingUser.tenantId === tenantId) {
            throw new ConflictException('User is already a member of this tenant');
        }

        // Check for existing pending invitation
        const existingInvite = await this.prisma.tenantInvitation.findFirst({
            where: { tenantId, email, acceptedAt: null, expiresAt: { gte: new Date() } },
        });
        if (existingInvite) {
            throw new ConflictException('An invitation has already been sent to this email');
        }

        // Create invitation
        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const invitation = await this.prisma.tenantInvitation.create({
            data: {
                tenantId,
                email,
                role: role as any,
                token,
                expiresAt,
                invitedById,
            },
        });

        // Send invitation email
        await this.sendInvitationEmail(email, tenant.name, token);

        this.logger.log(`Invitation sent to ${email} for tenant #${tenantId}`);

        return {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            expiresAt: invitation.expiresAt,
        };
    }

    // ─── Accept an invitation ───────────────────────────

    async acceptInvitation(token: string) {
        const invitation = await this.prisma.tenantInvitation.findUnique({
            where: { token },
            include: { tenant: true },
        });

        if (!invitation) {
            throw new NotFoundException('Invalid invitation token');
        }

        if (invitation.acceptedAt) {
            throw new ConflictException('This invitation has already been accepted');
        }

        if (invitation.expiresAt < new Date()) {
            throw new BadRequestException('This invitation has expired. Ask the admin to send a new one.');
        }

        // Check if user exists
        const existingUser = await this.prisma.user.findUnique({
            where: { email: invitation.email },
        });

        if (existingUser) {
            // Move existing user to this tenant
            await this.prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    tenantId: invitation.tenantId,
                    role: invitation.role,
                },
            });
        }
        // If user doesn't exist, they'll need to register first, then this gets linked

        // Mark invitation as accepted
        await this.prisma.tenantInvitation.update({
            where: { id: invitation.id },
            data: { acceptedAt: new Date() },
        });

        this.logger.log(`Invitation accepted for ${invitation.email} → tenant #${invitation.tenantId}`);

        return {
            message: existingUser
                ? `You have been added to ${invitation.tenant.name}`
                : `Invitation accepted. Please register with email ${invitation.email} to join ${invitation.tenant.name}`,
            tenantName: invitation.tenant.name,
        };
    }

    // ─── List team members ──────────────────────────────

    async listTeamMembers(tenantId: number) {
        const members = await this.prisma.user.findMany({
            where: { tenantId },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        });

        return members;
    }

    // ─── Remove a team member ───────────────────────────

    async removeTeamMember(tenantId: number, userId: number, requesterId: number) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        if (!user || user.tenantId !== tenantId) {
            throw new NotFoundException('User not found in this tenant');
        }

        if (userId === requesterId) {
            throw new ForbiddenException('You cannot remove yourself from the tenant');
        }

        // Remove user from tenant (don't delete the user, just unlink)
        await this.prisma.user.update({
            where: { id: userId },
            data: { tenantId: null, role: 'viewer' },
        });

        this.logger.log(`User #${userId} removed from tenant #${tenantId}`);

        return { message: `User ${user.username} removed from tenant` };
    }

    // ─── List pending invitations ───────────────────────

    async listInvitations(tenantId: number) {
        const invitations = await this.prisma.tenantInvitation.findMany({
            where: { tenantId, acceptedAt: null, expiresAt: { gte: new Date() } },
            select: {
                id: true,
                email: true,
                role: true,
                expiresAt: true,
                createdAt: true,
                invitedBy: { select: { username: true, displayName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return invitations;
    }

    // ─── Cancel an invitation ───────────────────────────

    async cancelInvitation(tenantId: number, invitationId: number) {
        const invitation = await this.prisma.tenantInvitation.findUnique({
            where: { id: invitationId },
        });

        if (!invitation || invitation.tenantId !== tenantId) {
            throw new NotFoundException('Invitation not found');
        }

        if (invitation.acceptedAt) {
            throw new ConflictException('Cannot cancel — invitation already accepted');
        }

        await this.prisma.tenantInvitation.delete({ where: { id: invitationId } });

        return { message: 'Invitation cancelled' };
    }

    // ─── Get tenant info ────────────────────────────────

    async getTenantInfo(tenantId: number) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            include: {
                _count: {
                    select: {
                        users: true,
                        devices: true,
                        serverMonitors: true,
                        urlMonitors: true,
                        locations: true,
                    },
                },
                subscriptions: {
                    where: { status: { in: ['active', 'trial'] } },
                    include: { plan: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });

        if (!tenant) throw new NotFoundException('Tenant not found');

        const activeSub = tenant.subscriptions[0];

        return {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            contactEmail: tenant.contactEmail,
            company: tenant.company,
            plan: activeSub?.plan ? {
                name: activeSub.plan.name,
                maxDevices: activeSub.plan.maxDevices,
                maxServers: activeSub.plan.maxServers,
                maxUrlMonitors: activeSub.plan.maxUrlMonitors,
                maxUsers: activeSub.plan.maxUsers,
            } : null,
            usage: tenant._count,
        };
    }

    // ─── Superadmin helpers ────────────────────────────

    async getSuperAdminInfo() {
        const tenantCount = await this.prisma.tenant.count();
        const userCount = await this.prisma.user.count();
        const deviceCount = await this.prisma.device.count();

        return {
            id: 0,
            name: 'Superadmin',
            slug: 'superadmin',
            contactEmail: 'admin@netmon.local',
            company: 'NetMon',
            plan: { name: 'Superadmin', maxDevices: -1, maxServers: -1, maxUrlMonitors: -1, maxUsers: -1 },
            usage: { users: userCount, devices: deviceCount, tenants: tenantCount, serverMonitors: 0, urlMonitors: 0, locations: 0 },
        };
    }

    async listAllMembers() {
        return this.prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
                tenantId: true,
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    async listAllInvitations() {
        return this.prisma.tenantInvitation.findMany({
            where: { acceptedAt: null, expiresAt: { gte: new Date() } },
            select: {
                id: true,
                email: true,
                role: true,
                expiresAt: true,
                createdAt: true,
                tenant: { select: { name: true } },
                invitedBy: { select: { username: true, displayName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ─── Private helpers ────────────────────────────────

    private async sendInvitationEmail(to: string, tenantName: string, token: string) {
        const baseUrl = this.config.get<string>('apiBaseUrl', 'https://netmon.bitlab.co.id');
        const acceptUrl = `${baseUrl}/api/v1/tenant/invite/accept?token=${token}`;

        // Reuse the transporter from EmailService (logged for now)
        this.logger.log(`[Invitation] Accept URL for ${to}: ${acceptUrl}`);

        // If EmailService supports generic sending, use it; otherwise log
        try {
            if (this.emailService.isConfigured) {
                // Send simple invitation email via nodemailer directly
                const nodemailer = await import('nodemailer');
                const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f7f8fc; padding: 40px 0;">
    <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
        <h1 style="color: #111827; font-size: 22px; text-align: center;">Team Invitation</h1>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
            You have been invited to join <strong>${tenantName}</strong> on <strong>BitNetMon</strong>.
        </p>
        <div style="text-align: center; margin: 32px 0;">
            <a href="${acceptUrl}" 
               style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px;">
                Accept Invitation
            </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px;">This invitation expires in 7 days.</p>
    </div>
</body>
</html>`;

                // Access transporter through email service config
                const host = this.config.get<string>('smtp.host');
                const port = this.config.get<number>('smtp.port') || 587;
                const user = this.config.get<string>('smtp.user');
                const pass = this.config.get<string>('smtp.pass');

                if (host && user && pass) {
                    const transport = nodemailer.createTransport({
                        host,
                        port,
                        secure: port === 465,
                        auth: { user, pass },
                        tls: { rejectUnauthorized: false },
                    });

                    await transport.sendMail({
                        from: `"BitNetMon" <${user}>`,
                        to,
                        subject: `Invitation to join ${tenantName} - BitNetMon`,
                        html,
                    });

                    this.logger.log(`Invitation email sent to ${to}`);
                }
            }
        } catch (err: any) {
            this.logger.warn(`Failed to send invitation email: ${err.message}`);
        }
    }
}
