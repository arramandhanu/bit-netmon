import {
    Controller, Get, Post, Body, Query, Req, Res, UseGuards,
    HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
    constructor(private readonly billing: BillingService) { }

    /** Public: list available plans */
    @Get('plans')
    async getPlans() {
        return this.billing.getPublicPlans();
    }

    /** Public: Midtrans config for frontend */
    @Get('config')
    async getConfig() {
        return {
            clientKey: this.billing.midtransClientKey,
            isConfigured: this.billing.isMidtransConfigured,
        };
    }

    /** Auth: current subscription + usage */
    @Get('subscription')
    @UseGuards(JwtAuthGuard)
    async getSubscription(@Req() req: any) {
        const tenantId = req.user?.tenantId;
        if (!tenantId) return { subscription: null, usage: null };
        const [subscription, usage] = await Promise.all([
            this.billing.getActiveSubscription(tenantId),
            this.billing.getUsage(tenantId),
        ]);
        return { subscription, ...usage };
    }

    /** Auth: subscribe to a plan (returns Snap token) */
    @Post('subscribe')
    @UseGuards(JwtAuthGuard)
    async subscribe(@Req() req: any, @Body('planSlug') planSlug: string) {
        const tenantId = req.user?.tenantId;
        if (!tenantId) throw new Error('No tenant associated with user');
        return this.billing.subscribe(tenantId, planSlug);
    }

    /** Auth: cancel subscription */
    @Post('cancel')
    @UseGuards(JwtAuthGuard)
    async cancel(@Req() req: any) {
        const tenantId = req.user?.tenantId;
        if (!tenantId) throw new Error('No tenant');
        return this.billing.cancelSubscription(tenantId);
    }

    /** Auth: usage details */
    @Get('usage')
    @UseGuards(JwtAuthGuard)
    async getUsage(@Req() req: any) {
        const tenantId = req.user?.tenantId;
        if (!tenantId) return null;
        return this.billing.getUsage(tenantId);
    }

    /** Auth: invoices */
    @Get('invoices')
    @UseGuards(JwtAuthGuard)
    async getInvoices(@Req() req: any) {
        const tenantId = req.user?.tenantId;
        if (!tenantId) return [];
        return this.billing.getInvoices(tenantId);
    }

    /** Auth: subscription status (for trial expiry blocking) */
    @Get('subscription-status')
    @UseGuards(JwtAuthGuard)
    async getSubscriptionStatus(@Req() req: any) {
        const tenantId = req.user?.tenantId;
        if (!tenantId) return { status: 'no_subscription', canAccessDevices: true };
        return this.billing.getSubscriptionStatus(tenantId);
    }

    /** Midtrans webhook (no auth — verified by signature) */
    @Post('webhook')
    @HttpCode(200)
    async webhook(@Body() body: any) {
        await this.billing.handlePaymentNotification(body);
        return { status: 'ok' };
    }

    /** Public: register new account with trial + email verification */
    @Post('register')
    async register(@Body() body: {
        username: string;
        email: string;
        password: string;
        companyName?: string;
        fullName?: string;
        phone?: string;
        address?: string;
    }) {
        return this.billing.registerWithTrial(body);
    }

    /** Public: verify email via token (GET — clickable from email) */
    @Get('verify')
    async verifyEmail(@Query('token') token: string, @Res() res: Response) {
        try {
            await this.billing.verifyEmail(token);
            // Redirect to login page with success message
            return res.redirect('/login?verified=true');
        } catch (err: any) {
            return res.redirect(`/login?error=${encodeURIComponent(err.message)}`);
        }
    }

    /** Public: resend verification email */
    @Post('resend-verification')
    async resendVerification(@Body('email') email: string) {
        return this.billing.resendVerification(email);
    }
}
