import {
    Controller, Get, Post, Patch, Delete, Body, Param,
    UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { BillingService } from './billing.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class BillingAdminController {
    constructor(private readonly billing: BillingService) { }

    // ─── Tenants ─────────────────────────────────────

    @Get('tenants')
    async listTenants() {
        return this.billing.getAllTenants();
    }

    @Get('tenants/:id')
    async getTenant(@Param('id', ParseIntPipe) id: number) {
        return this.billing.getTenant(id);
    }

    @Patch('tenants/:id')
    async updateTenant(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: any,
    ) {
        return this.billing.updateTenant(id, body);
    }

    @Post('tenants/:id/activate')
    async activateTenant(@Param('id', ParseIntPipe) id: number) {
        return this.billing.activateTenant(id);
    }

    @Post('tenants/:id/deactivate')
    async deactivateTenant(@Param('id', ParseIntPipe) id: number) {
        return this.billing.deactivateTenant(id);
    }

    @Post('tenants/:id/change-plan')
    async changeTenantPlan(
        @Param('id', ParseIntPipe) id: number,
        @Body('planId', ParseIntPipe) planId: number,
    ) {
        return this.billing.changeTenantPlan(id, planId);
    }

    // ─── Plans ───────────────────────────────────────

    @Get('plans')
    async listPlans() {
        return this.billing.getAllPlans();
    }

    @Post('plans')
    async createPlan(@Body() body: any) {
        return this.billing.createPlan(body);
    }

    @Patch('plans/:id')
    async updatePlan(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: any,
    ) {
        return this.billing.updatePlan(id, body);
    }

    @Delete('plans/:id')
    async deletePlan(@Param('id', ParseIntPipe) id: number) {
        return this.billing.deletePlan(id);
    }

    // ─── Revenue ─────────────────────────────────────

    @Get('revenue')
    async getRevenue() {
        return this.billing.getRevenue();
    }
}
