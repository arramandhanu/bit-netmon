import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { ExportService } from './export.service';

@Module({
    imports: [PrismaModule],
    controllers: [ReportController],
    providers: [ReportService, ExportService],
    exports: [ReportService, ExportService],
})
export class ReportsModule { }
