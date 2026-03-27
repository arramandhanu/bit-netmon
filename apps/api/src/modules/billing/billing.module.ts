import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { MidtransService } from './midtrans.service';
import { EmailService } from './email.service';
import { BillingController } from './billing.controller';
import { BillingAdminController } from './billing-admin.controller';

@Module({
    controllers: [BillingController, BillingAdminController],
    providers: [BillingService, MidtransService, EmailService],
    exports: [BillingService, MidtransService, EmailService],
})
export class BillingModule { }
