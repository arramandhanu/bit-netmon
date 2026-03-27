import {
    Controller, Get, Post, Delete,
    Param, Body,
    ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, RequirePermission } from '../../common/guards/roles.guard';
import { GitService, GitConnectionDto } from './git.service';

@ApiTags('DevOps - Git')
@Controller('devops/git')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class GitController {
    constructor(private readonly gitService: GitService) {}

    @Get('connections')
    @ApiOperation({ summary: 'List Git connections' })
    async getConnections() {
        return this.gitService.getConnections();
    }

    @Post('connections')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Add a Git connection (GitHub/GitLab)' })
    async addConnection(@Body() dto: GitConnectionDto) {
        return this.gitService.addConnection(dto);
    }

    @Delete('connections/:id')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Delete a Git connection' })
    async deleteConnection(@Param('id', ParseIntPipe) id: number) {
        await this.gitService.deleteConnection(id);
        return { success: true };
    }

    @Get('connections/:id/repos')
    @ApiOperation({ summary: 'List repositories for a connection' })
    async getRepos(@Param('id', ParseIntPipe) id: number) {
        return this.gitService.getRepos(id);
    }

    @Get('connections/:id/repos/:repoFullName/pipelines')
    @ApiOperation({ summary: 'List pipelines/workflows for a repo' })
    async getPipelines(
        @Param('id', ParseIntPipe) id: number,
        @Param('repoFullName') repoFullName: string,
    ) {
        // repoFullName comes URL-encoded (owner/repo → owner%2Frepo)
        const decoded = decodeURIComponent(repoFullName);
        return this.gitService.getPipelines(id, decoded);
    }

    @Post('connections/:id/repos/:repoFullName/trigger')
    @RequirePermission('devices:write')
    @ApiOperation({ summary: 'Trigger a pipeline/workflow' })
    async triggerPipeline(
        @Param('id', ParseIntPipe) id: number,
        @Param('repoFullName') repoFullName: string,
        @Body() body: { ref: string },
    ) {
        const decoded = decodeURIComponent(repoFullName);
        return this.gitService.triggerPipeline(id, decoded, body.ref || 'main');
    }
}
