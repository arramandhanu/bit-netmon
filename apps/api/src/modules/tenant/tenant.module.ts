import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { BillingModule } from '../billing/billing.module';

@Module({
    imports: [BillingModule],
    controllers: [TenantController],
    providers: [TenantService],
    exports: [TenantService],
})
export class TenantModule {}
