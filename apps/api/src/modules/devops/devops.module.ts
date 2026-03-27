import { Module } from '@nestjs/common';
import { DevopsController } from './devops.controller';
import { DevopsService } from './devops.service';
import { GitController } from './git.controller';
import { GitService } from './git.service';
import { K8sController } from './k8s.controller';
import { K8sService } from './k8s.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ServerMonitorModule } from '../server-monitor/server-monitor.module';

@Module({
    imports: [PrismaModule, ServerMonitorModule],
    controllers: [DevopsController, GitController, K8sController],
    providers: [DevopsService, GitService, K8sService],
    exports: [DevopsService, GitService, K8sService],
})
export class DevopsModule {}
