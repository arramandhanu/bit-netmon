import { Module } from '@nestjs/common';
import { AlertingService } from './alerting.service';
import { AlertingController } from './alerting.controller';
import { AlertEvaluatorService } from './alert-evaluator.service';
import { NotificationService } from './notification.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
    imports: [SettingsModule],
    controllers: [AlertingController],
    providers: [
        AlertingService,
        AlertEvaluatorService,
        NotificationService,
    ],
    exports: [AlertEvaluatorService],
})
export class AlertingModule { }
