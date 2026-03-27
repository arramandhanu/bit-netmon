import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import axios from 'axios';

/* ─── Types ──────────────────────────────────────────────── */

export interface GitConnectionDto {
    provider: 'github' | 'gitlab';
    token: string;
    name?: string;
    baseUrl?: string; // For self-hosted GitLab
}

export interface GitRepo {
    id: number | string;
    name: string;
    fullName: string;
    description: string | null;
    url: string;
    defaultBranch: string;
    language: string | null;
    isPrivate: boolean;
    updatedAt: string;
    stars?: number;
    openIssues?: number;
}

export interface GitPipeline {
    id: number | string;
    status: string;
    ref: string;
    sha: string;
    message?: string;
    createdAt: string;
    updatedAt: string;
    webUrl?: string;
    duration?: number;
}

/* ─── Service ────────────────────────────────────────────── */

@Injectable()
export class GitService implements OnModuleInit {
    private readonly logger = new Logger(GitService.name);

    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit() {
        try {
            await this.ensureTable();
            this.logger.log('Git connections table ensured');
        } catch (err: any) {
            this.logger.warn(`Failed to ensure git table: ${err.message}`);
        }
    }

    /* ─── CRUD ──────────────────────────────────────── */

    async addConnection(dto: GitConnectionDto): Promise<any> {
        // Validate the token by making a test API call
        await this.validateToken(dto.provider, dto.token, dto.baseUrl);

        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `INSERT INTO devops_git_connections (provider, token, name, base_url, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'connected', NOW(), NOW())
             RETURNING id, provider, name, base_url, status, created_at, updated_at`,
            dto.provider,
            dto.token,
            dto.name || `${dto.provider} connection`,
            dto.baseUrl || null,
        );
        return this.serializeRow(rows[0]);
    }

    async getConnections(): Promise<any[]> {
        try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT id, provider, name, base_url, status, created_at, updated_at
                 FROM devops_git_connections
                 ORDER BY created_at DESC`,
            );
            return rows.map(this.serializeRow);
        } catch {
            return [];
        }
    }

    async deleteConnection(id: number): Promise<void> {
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `DELETE FROM devops_git_connections WHERE id = $1 RETURNING id`, id,
        );
        if (rows.length === 0) throw new NotFoundException(`Connection #${id} not found`);
    }

    /* ─── GitHub / GitLab API ──────────────────────── */

    async getRepos(connectionId: number): Promise<GitRepo[]> {
        const conn = await this.getConnection(connectionId);

        if (conn.provider === 'github') {
            return this.fetchGitHubRepos(conn.token);
        } else {
            return this.fetchGitLabRepos(conn.token, conn.base_url);
        }
    }

    async getPipelines(connectionId: number, repoFullName: string): Promise<GitPipeline[]> {
        const conn = await this.getConnection(connectionId);

        if (conn.provider === 'github') {
            return this.fetchGitHubWorkflows(conn.token, repoFullName);
        } else {
            return this.fetchGitLabPipelines(conn.token, conn.base_url, repoFullName);
        }
    }

    async triggerPipeline(connectionId: number, repoFullName: string, ref: string): Promise<any> {
        const conn = await this.getConnection(connectionId);

        if (conn.provider === 'github') {
            return this.triggerGitHubWorkflow(conn.token, repoFullName, ref);
        } else {
            return this.triggerGitLabPipeline(conn.token, conn.base_url, repoFullName, ref);
        }
    }

    /* ─── GitHub ──────────────────────────────────── */

    private async fetchGitHubRepos(token: string): Promise<GitRepo[]> {
        try {
            const { data } = await axios.get('https://api.github.com/user/repos', {
                headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
                params: { sort: 'updated', per_page: 50 },
                timeout: 15000,
            });
            return data.map((r: any) => ({
                id: r.id,
                name: r.name,
                fullName: r.full_name,
                description: r.description,
                url: r.html_url,
                defaultBranch: r.default_branch,
                language: r.language,
                isPrivate: r.private,
                updatedAt: r.updated_at,
                stars: r.stargazers_count,
                openIssues: r.open_issues_count,
            }));
        } catch (err: any) {
            this.logger.warn(`GitHub repos fetch failed: ${err.message}`);
            throw new BadRequestException('Failed to fetch GitHub repositories. Check your token.');
        }
    }

    private async fetchGitHubWorkflows(token: string, repoFullName: string): Promise<GitPipeline[]> {
        try {
            const { data } = await axios.get(`https://api.github.com/repos/${repoFullName}/actions/runs`, {
                headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
                params: { per_page: 20 },
                timeout: 15000,
            });
            return (data.workflow_runs || []).map((r: any) => ({
                id: r.id,
                status: r.conclusion || r.status,
                ref: r.head_branch,
                sha: r.head_sha?.substring(0, 7),
                message: r.display_title,
                createdAt: r.created_at,
                updatedAt: r.updated_at,
                webUrl: r.html_url,
                duration: r.run_started_at ? Math.round((new Date(r.updated_at).getTime() - new Date(r.run_started_at).getTime()) / 1000) : undefined,
            }));
        } catch (err: any) {
            this.logger.warn(`GitHub workflows fetch failed: ${err.message}`);
            return [];
        }
    }

    private async triggerGitHubWorkflow(token: string, repoFullName: string, ref: string): Promise<any> {
        try {
            // Get the first workflow
            const { data: workflows } = await axios.get(`https://api.github.com/repos/${repoFullName}/actions/workflows`, {
                headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
                timeout: 15000,
            });
            if (!workflows.workflows?.length) throw new BadRequestException('No workflows found');

            await axios.post(
                `https://api.github.com/repos/${repoFullName}/actions/workflows/${workflows.workflows[0].id}/dispatches`,
                { ref },
                { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }, timeout: 15000 },
            );
            return { success: true, message: `Workflow dispatched on branch ${ref}` };
        } catch (err: any) {
            throw new BadRequestException(err.response?.data?.message || 'Failed to trigger workflow');
        }
    }

    /* ─── GitLab ──────────────────────────────────── */

    private async fetchGitLabRepos(token: string, baseUrl?: string): Promise<GitRepo[]> {
        const url = baseUrl || 'https://gitlab.com';
        try {
            const { data } = await axios.get(`${url}/api/v4/projects`, {
                headers: { 'PRIVATE-TOKEN': token },
                params: { membership: true, order_by: 'updated_at', per_page: 50 },
                timeout: 15000,
            });
            return data.map((r: any) => ({
                id: r.id,
                name: r.name,
                fullName: r.path_with_namespace,
                description: r.description,
                url: r.web_url,
                defaultBranch: r.default_branch,
                language: null,
                isPrivate: r.visibility === 'private',
                updatedAt: r.last_activity_at,
                stars: r.star_count,
                openIssues: r.open_issues_count,
            }));
        } catch (err: any) {
            this.logger.warn(`GitLab repos fetch failed: ${err.message}`);
            throw new BadRequestException('Failed to fetch GitLab projects. Check your token.');
        }
    }

    private async fetchGitLabPipelines(token: string, baseUrl: string | null, repoFullName: string): Promise<GitPipeline[]> {
        const url = baseUrl || 'https://gitlab.com';
        try {
            const projectId = encodeURIComponent(repoFullName);
            const { data } = await axios.get(`${url}/api/v4/projects/${projectId}/pipelines`, {
                headers: { 'PRIVATE-TOKEN': token },
                params: { per_page: 20 },
                timeout: 15000,
            });
            return data.map((r: any) => ({
                id: r.id,
                status: r.status,
                ref: r.ref,
                sha: r.sha?.substring(0, 7),
                createdAt: r.created_at,
                updatedAt: r.updated_at,
                webUrl: r.web_url,
                duration: r.duration,
            }));
        } catch (err: any) {
            this.logger.warn(`GitLab pipelines fetch failed: ${err.message}`);
            return [];
        }
    }

    private async triggerGitLabPipeline(token: string, baseUrl: string | null, repoFullName: string, ref: string): Promise<any> {
        const url = baseUrl || 'https://gitlab.com';
        try {
            const projectId = encodeURIComponent(repoFullName);
            await axios.post(
                `${url}/api/v4/projects/${projectId}/pipeline`,
                { ref },
                { headers: { 'PRIVATE-TOKEN': token }, timeout: 15000 },
            );
            return { success: true, message: `Pipeline triggered on branch ${ref}` };
        } catch (err: any) {
            throw new BadRequestException(err.response?.data?.message || 'Failed to trigger pipeline');
        }
    }

    /* ─── Helpers ─────────────────────────────────── */

    private async validateToken(provider: string, token: string, baseUrl?: string): Promise<void> {
        try {
            if (provider === 'github') {
                await axios.get('https://api.github.com/user', {
                    headers: { Authorization: `token ${token}` },
                    timeout: 10000,
                });
            } else {
                const url = baseUrl || 'https://gitlab.com';
                await axios.get(`${url}/api/v4/user`, {
                    headers: { 'PRIVATE-TOKEN': token },
                    timeout: 10000,
                });
            }
        } catch {
            throw new BadRequestException(`Invalid ${provider} token. Please check your access token.`);
        }
    }

    private async getConnection(id: number): Promise<any> {
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM devops_git_connections WHERE id = $1`, id,
        );
        if (rows.length === 0) throw new NotFoundException(`Connection #${id} not found`);
        return rows[0];
    }

    private async ensureTable(): Promise<void> {
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS devops_git_connections (
                id SERIAL PRIMARY KEY,
                provider VARCHAR(20) NOT NULL,
                token TEXT NOT NULL,
                name VARCHAR(255) DEFAULT '',
                base_url VARCHAR(500),
                status VARCHAR(50) DEFAULT 'connected',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
    }

    private serializeRow(row: any): any {
        const out: any = {};
        for (const [key, value] of Object.entries(row)) {
            if (typeof value === 'bigint') out[key] = Number(value);
            else if (value instanceof Date) out[key] = value.toISOString();
            else out[key] = value;
        }
        return out;
    }
}
