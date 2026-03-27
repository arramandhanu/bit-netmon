import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MidtransService } from './midtrans.service';
import { EmailService } from './email.service';
import * as crypto from 'crypto';

@Injectable()
export class BillingService {
    private readonly logger = new Logger(BillingService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly midtrans: MidtransService,
        private readonly emailService: EmailService,
    ) { }

    // ─── Plans ──────────────────────────────────────────

    async getPublicPlans() {
        return this.prisma.plan.findMany({
            where: { isPublic: true },
            orderBy: { sortOrder: 'asc' },
        });
    }

    async getAllPlans() {
        return this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } });
    }

    async createPlan(data: any) {
        return this.prisma.plan.create({ data });
    }

    async updatePlan(id: number, data: any) {
        return this.prisma.plan.update({ where: { id }, data });
    }

    // ─── Tenants ────────────────────────────────────────

    async createTenant(params: {
        name: string;
        slug: string;
        contactEmail: string;
        company?: string;
        userId: number;
    }) {
        const existing = await this.prisma.tenant.findUnique({ where: { slug: params.slug } });
        if (existing) throw new BadRequestException('Tenant slug already exists');

        const starterPlan = await this.prisma.plan.findUnique({ where: { slug: 'business' } })
            ?? await this.prisma.plan.findUnique({ where: { slug: 'starter' } });
        if (!starterPlan) throw new Error('Business/Starter plan not found — run migration');

        const now = new Date();
        const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

        const tenant = await this.prisma.tenant.create({
            data: {
                name: params.name,
                slug: params.slug,
                contactEmail: params.contactEmail,
                company: params.company,
            },
        });

        await this.prisma.subscription.create({
            data: {
                tenantId: tenant.id,
                planId: starterPlan.id,
                status: 'trial',
                trialEndsAt: trialEnd,
                currentPeriodStart: now,
                currentPeriodEnd: trialEnd,
            },
        });

        await this.prisma.user.update({
            where: { id: params.userId },
            data: { tenantId: tenant.id },
        });

        this.logger.log(`Created tenant "${params.name}" with trial subscription`);
        return tenant;
    }

    async getAllTenants() {
        return this.prisma.tenant.findMany({
            include: {
                subscriptions: {
                    include: { plan: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
                _count: { select: { users: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getTenant(id: number) {
        return this.prisma.tenant.findUnique({
            where: { id },
            include: {
                subscriptions: {
                    include: { plan: true, payments: { orderBy: { createdAt: 'desc' }, take: 5 } },
                    orderBy: { createdAt: 'desc' },
                },
                invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
                users: { select: { id: true, username: true, email: true, role: true } },
                _count: { select: { users: true } },
            },
        });
    }

    async updateTenant(id: number, data: any) {
        return this.prisma.tenant.update({ where: { id }, data });
    }

    // ─── Subscription ───────────────────────────────────

    async getActiveSubscription(tenantId: number) {
        return this.prisma.subscription.findFirst({
            where: {
                tenantId,
                status: { in: ['trial', 'active'] },
            },
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async subscribe(tenantId: number, planSlug: string) {
        const plan = await this.prisma.plan.findUnique({ where: { slug: planSlug } });
        if (!plan) throw new NotFoundException('Plan not found');

        if (plan.priceMonthly === 0) {
            throw new BadRequestException('Cannot subscribe to free plan via payment');
        }

        let subscription = await this.getActiveSubscription(tenantId);
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        if (!subscription) {
            subscription = await this.prisma.subscription.create({
                data: {
                    tenantId,
                    planId: plan.id,
                    status: 'active',
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                },
                include: { plan: true },
            });
        }

        const orderId = `NETMON-${tenantId}-${Date.now()}`;
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });

        const { token, redirectUrl } = await this.midtrans.createTransaction({
            orderId,
            amount: plan.priceMonthly,
            customerName: tenant?.name || 'Customer',
            customerEmail: tenant?.contactEmail || '',
            itemName: `BitNetMon ${plan.name} - Monthly`,
        });

        await this.prisma.payment.create({
            data: {
                subscriptionId: subscription.id,
                midtransOrderId: orderId,
                snapToken: token,
                snapRedirectUrl: redirectUrl,
                amount: plan.priceMonthly,
                status: 'pending',
            },
        });

        return { snapToken: token, redirectUrl, orderId, plan: plan.name, amount: plan.priceMonthly };
    }

    async handlePaymentNotification(notification: any) {
        const status = await this.midtrans.verifyNotification(notification);
        const orderId = status.order_id;
        const transactionStatus = status.transaction_status;
        const fraudStatus = status.fraud_status;

        this.logger.log(`Payment notification: order=${orderId} status=${transactionStatus} fraud=${fraudStatus}`);

        const payment = await this.prisma.payment.findUnique({
            where: { midtransOrderId: orderId },
            include: { subscription: { include: { plan: true } } },
        });

        if (!payment) {
            this.logger.warn(`Payment not found for order ${orderId}`);
            return;
        }

        let paymentStatus: any = 'pending';
        const now = new Date();

        if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
            if (fraudStatus === 'accept' || !fraudStatus) {
                paymentStatus = 'paid';
                const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                await this.prisma.subscription.update({
                    where: { id: payment.subscriptionId },
                    data: { status: 'active', planId: payment.subscription.planId, currentPeriodStart: now, currentPeriodEnd: periodEnd },
                });
                const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${payment.id}`;
                await this.prisma.invoice.create({
                    data: { invoiceNumber, tenantId: payment.subscription.tenantId, subscriptionId: payment.subscriptionId, amount: payment.amount, periodStart: now, periodEnd, status: 'paid', paidAt: now },
                });
            }
        } else if (transactionStatus === 'deny' || transactionStatus === 'cancel') {
            paymentStatus = 'failed';
        } else if (transactionStatus === 'expire') {
            paymentStatus = 'expired';
        }

        await this.prisma.payment.update({
            where: { id: payment.id },
            data: { status: paymentStatus, midtransTransId: status.transaction_id, paymentType: status.payment_type, paidAt: paymentStatus === 'paid' ? now : null, rawNotification: notification },
        });
    }

    async cancelSubscription(tenantId: number) {
        const sub = await this.getActiveSubscription(tenantId);
        if (!sub) throw new NotFoundException('No active subscription');

        const starter = await this.prisma.plan.findUnique({ where: { slug: 'starter' } });
        await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'cancelled', cancelledAt: new Date() } });

        if (starter) {
            const now = new Date();
            await this.prisma.subscription.create({
                data: { tenantId, planId: starter.id, status: 'active', currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) },
            });
        }
        return { message: 'Subscription cancelled, downgraded to Starter' };
    }

    // ─── Usage & Quotas ─────────────────────────────────

    async getUsage(tenantId: number) {
        const sub = await this.getActiveSubscription(tenantId);
        if (!sub) return null;

        const [deviceCount, serverCount, urlCount, userCount] = await Promise.all([
            this.prisma.device.count({ where: { tenantId } }),
            this.prisma.serverMonitor.count({ where: { tenantId } }),
            this.prisma.urlMonitor.count({ where: { tenantId } }),
            this.prisma.user.count({ where: { tenantId } }),
        ]);

        return {
            plan: sub.plan,
            subscription: { status: sub.status, trialEndsAt: sub.trialEndsAt, currentPeriodEnd: sub.currentPeriodEnd },
            usage: {
                devices: { used: deviceCount, limit: sub.plan.maxDevices, unlimited: sub.plan.maxDevices === -1 },
                servers: { used: serverCount, limit: sub.plan.maxServers, unlimited: sub.plan.maxServers === -1 },
                urlMonitors: { used: urlCount, limit: sub.plan.maxUrlMonitors, unlimited: sub.plan.maxUrlMonitors === -1 },
                users: { used: userCount, limit: sub.plan.maxUsers, unlimited: sub.plan.maxUsers === -1 },
            },
        };
    }

    async checkQuota(tenantId: number, resource: 'devices' | 'servers' | 'urlMonitors' | 'users'): Promise<boolean> {
        const usage = await this.getUsage(tenantId);
        if (!usage) return true;
        const r = usage.usage[resource];
        if (r.unlimited) return true;
        return r.used < r.limit;
    }

    // ─── Invoices ───────────────────────────────────────

    async getInvoices(tenantId: number) {
        return this.prisma.invoice.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    }

    // ─── Revenue (admin) ────────────────────────────────

    async getRevenue() {
        const [totalTenants, activeSubs, totalRevenue, recentPayments] = await Promise.all([
            this.prisma.tenant.count(),
            this.prisma.subscription.count({ where: { status: { in: ['active', 'trial'] } } }),
            this.prisma.payment.aggregate({ where: { status: 'paid' }, _sum: { amount: true } }),
            this.prisma.payment.findMany({
                where: { status: 'paid' }, orderBy: { paidAt: 'desc' }, take: 10,
                include: { subscription: { include: { tenant: true, plan: true } } },
            }),
        ]);
        return { totalTenants, activeSubscriptions: activeSubs, totalRevenue: totalRevenue._sum.amount || 0, recentPayments };
    }

    // ─── Registration with Email Verification ───────────

    async registerWithTrial(params: {
        username: string;
        email: string;
        password: string;
        companyName?: string;
        fullName?: string;
        phone?: string;
        address?: string;
    }) {
        const existingUser = await this.prisma.user.findFirst({
            where: { OR: [{ username: params.username }, { email: params.email }] },
        });
        if (existingUser) throw new BadRequestException('Username or email already exists');

        const bcrypt = require('bcryptjs');
        const passwordHash = await bcrypt.hash(params.password, 10);
        const slug = params.username.toLowerCase().replace(/[^a-z0-9]/g, '-');

        // Verification token (valid 24h)
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Create tenant
        const tenant = await this.prisma.tenant.create({
            data: {
                name: params.companyName || params.fullName || params.username,
                slug,
                contactEmail: params.email,
                contactPhone: params.phone,
                company: params.companyName,
            },
        });

        // Create user — inactive until email verified, role = user (SaaS customer)
        const user = await this.prisma.user.create({
            data: {
                username: params.username,
                email: params.email,
                passwordHash,
                fullName: params.fullName,
                phone: params.phone,
                displayName: params.fullName,
                role: 'user',
                tenantId: tenant.id,
                isActive: false,
                emailVerified: false,
                verificationToken,
                verificationExpires,
            },
        });

        // Create trial subscription
        const starterPlan = await this.prisma.plan.findUnique({ where: { slug: 'business' } })
            ?? await this.prisma.plan.findUnique({ where: { slug: 'starter' } });
        if (starterPlan) {
            const now = new Date();
            const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
            await this.prisma.subscription.create({
                data: { tenantId: tenant.id, planId: starterPlan.id, status: 'trial', trialEndsAt: trialEnd, currentPeriodStart: now, currentPeriodEnd: trialEnd },
            });
        }

        // Send verification email
        await this.emailService.sendVerificationEmail(params.email, params.username, verificationToken);
        this.logger.log(`User "${params.username}" registered — verification email sent to ${params.email}`);

        return {
            message: 'Registrasi berhasil! Silakan cek email Anda untuk verifikasi akun.',
            user: { id: user.id, username: user.username, email: user.email },
            tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
            trial: { daysRemaining: 14 },
            emailSent: true,
        };
    }

    // ─── Verify Email ───────────────────────────────────

    async verifyEmail(token: string) {
        const user = await this.prisma.user.findFirst({ where: { verificationToken: token } });
        if (!user) throw new BadRequestException('Token verifikasi tidak valid');

        if (user.verificationExpires && user.verificationExpires < new Date()) {
            throw new BadRequestException('Token verifikasi sudah expired. Silakan minta token baru.');
        }

        if (user.emailVerified) {
            return { message: 'Email sudah terverifikasi', alreadyVerified: true };
        }

        await this.prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: true, isActive: true, verificationToken: null, verificationExpires: null },
        });

        this.logger.log(`Email verified for user "${user.username}"`);
        return { message: 'Email berhasil diverifikasi! Silakan login.', verified: true, username: user.username };
    }

    // ─── Resend Verification ────────────────────────────

    async resendVerification(email: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new NotFoundException('Email tidak ditemukan');
        if (user.emailVerified) throw new BadRequestException('Email sudah terverifikasi');

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await this.prisma.user.update({ where: { id: user.id }, data: { verificationToken, verificationExpires } });
        await this.emailService.sendVerificationEmail(email, user.username, verificationToken);

        return { message: 'Email verifikasi telah dikirim ulang' };
    }

    get midtransClientKey(): string {
        return this.midtrans.clientKey;
    }

    get isMidtransConfigured(): boolean {
        return this.midtrans.isConfigured;
    }

    // ─── Admin Tenant Management ────────────────────────

    async activateTenant(id: number) {
        await this.prisma.tenant.update({ where: { id }, data: { isActive: true } });
        // Also activate all users in tenant
        await this.prisma.user.updateMany({ where: { tenantId: id }, data: { isActive: true } });
        this.logger.log(`Tenant ${id} activated`);
        return { message: 'Tenant activated' };
    }

    async deactivateTenant(id: number) {
        await this.prisma.tenant.update({ where: { id }, data: { isActive: false } });
        // Also deactivate all users in tenant
        await this.prisma.user.updateMany({ where: { tenantId: id }, data: { isActive: false } });
        this.logger.log(`Tenant ${id} deactivated`);
        return { message: 'Tenant deactivated' };
    }

    async changeTenantPlan(tenantId: number, planId: number) {
        const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) throw new NotFoundException('Plan not found');

        // Find active subscription
        const sub = await this.getActiveSubscription(tenantId);
        if (sub) {
            await this.prisma.subscription.update({
                where: { id: sub.id },
                data: { planId, status: 'active' },
            });
        } else {
            const now = new Date();
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            await this.prisma.subscription.create({
                data: { tenantId, planId, status: 'active', currentPeriodStart: now, currentPeriodEnd: periodEnd },
            });
        }
        this.logger.log(`Tenant ${tenantId} changed to plan ${plan.name}`);
        return { message: `Plan changed to ${plan.name}` };
    }

    async deletePlan(id: number) {
        const subCount = await this.prisma.subscription.count({ where: { planId: id } });
        if (subCount > 0) throw new BadRequestException('Cannot delete plan with active subscriptions');
        await this.prisma.plan.delete({ where: { id } });
        return { message: 'Plan deleted' };
    }

    // ─── Subscription Status ────────────────────────────

    async getSubscriptionStatus(tenantId: number) {
        const sub = await this.getActiveSubscription(tenantId);
        if (!sub) {
            return { status: 'no_subscription', canAccessDevices: false, dataRetentionDaysLeft: 0 };
        }

        const now = new Date();

        if (sub.status === 'active') {
            return {
                status: 'active',
                canAccessDevices: true,
                plan: sub.plan,
                currentPeriodEnd: sub.currentPeriodEnd,
                dataRetentionDaysLeft: null,
            };
        }

        if (sub.status === 'trial') {
            const trialEnd = sub.trialEndsAt ? new Date(sub.trialEndsAt) : sub.currentPeriodEnd;
            const trialExpired = now > trialEnd;

            if (!trialExpired) {
                const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
                return {
                    status: 'trial',
                    canAccessDevices: true,
                    plan: sub.plan,
                    trialEndsAt: trialEnd,
                    trialDaysLeft: daysLeft,
                    dataRetentionDaysLeft: null,
                };
            }

            // Trial expired — data retained for 30 days after trial end
            const dataExpiryDate = new Date(trialEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
            const dataExpired = now > dataExpiryDate;
            const dataRetentionDaysLeft = dataExpired ? 0 : Math.ceil((dataExpiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

            return {
                status: dataExpired ? 'data_expired' : 'trial_expired',
                canAccessDevices: false,
                plan: sub.plan,
                trialEndsAt: trialEnd,
                trialDaysLeft: 0,
                dataRetentionDaysLeft,
                dataExpiryDate,
            };
        }

        // Cancelled or other statuses
        return {
            status: sub.status,
            canAccessDevices: sub.status !== 'cancelled' && sub.status !== 'suspended',
            plan: sub.plan,
            currentPeriodEnd: sub.currentPeriodEnd,
            dataRetentionDaysLeft: null,
        };
    }
}
