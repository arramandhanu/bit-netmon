import {
    Controller, Get, Post, Delete,
    Param, Body, Query,
    ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, RequirePermission } from '../../common/guards/roles.guard';
import { K8sService, K8sClusterDto } from './k8s.service';

@ApiTags('DevOps - Kubernetes')
@Controller('devops/k8s')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class K8sController {
    constructor(private readonly k8sService: K8sService) {}

    @Get('clusters')
    @ApiOperation({ summary: 'List connected K8s clusters' })
    async getClusters() {
        return this.k8sService.getClusters();
    }

    @Post('clusters')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Add a K8s cluster' })
    async addCluster(@Body() dto: K8sClusterDto) {
        return this.k8sService.addCluster(dto);
    }

    @Delete('clusters/:id')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Delete a K8s cluster' })
    async deleteCluster(@Param('id', ParseIntPipe) id: number) {
        await this.k8sService.deleteCluster(id);
        return { success: true };
    }

    @Get('clusters/:id/overview')
    @ApiOperation({ summary: 'Get cluster overview (nodes, pods, deployments)' })
    async getClusterOverview(@Param('id', ParseIntPipe) id: number) {
        return this.k8sService.getClusterOverview(id);
    }

    @Get('clusters/:id/namespaces')
    @ApiOperation({ summary: 'List namespaces' })
    async getNamespaces(@Param('id', ParseIntPipe) id: number) {
        return this.k8sService.getNamespaces(id);
    }

    @Get('clusters/:id/pods')
    @ApiOperation({ summary: 'List pods' })
    async getPods(
        @Param('id', ParseIntPipe) id: number,
        @Query('namespace') namespace?: string,
    ) {
        return this.k8sService.getPods(id, namespace || '_all');
    }

    @Get('clusters/:id/deployments')
    @ApiOperation({ summary: 'List deployments' })
    async getDeployments(
        @Param('id', ParseIntPipe) id: number,
        @Query('namespace') namespace?: string,
    ) {
        return this.k8sService.getDeployments(id, namespace || '_all');
    }

    @Get('clusters/:id/nodes')
    @ApiOperation({ summary: 'List nodes' })
    async getNodes(@Param('id', ParseIntPipe) id: number) {
        return this.k8sService.getNodes(id);
    }

    @Post('clusters/:id/deployments/:namespace/:name/restart')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Restart a deployment (rolling restart)' })
    async restartDeployment(
        @Param('id', ParseIntPipe) id: number,
        @Param('namespace') namespace: string,
        @Param('name') name: string,
    ) {
        return this.k8sService.restartDeployment(id, namespace, name);
    }
}
