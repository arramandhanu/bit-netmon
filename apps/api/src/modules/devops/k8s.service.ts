import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import axios from 'axios';

/* ─── Types ──────────────────────────────────────────────── */

export interface K8sClusterDto {
    name: string;
    apiUrl: string;
    token: string;
    caCert?: string;
    skipTlsVerify?: boolean;
}

export interface K8sPod {
    name: string;
    namespace: string;
    status: string;
    ready: string;
    restarts: number;
    age: string;
    nodeName: string;
    ip: string | null;
}

export interface K8sDeployment {
    name: string;
    namespace: string;
    ready: string;
    upToDate: number;
    available: number;
    age: string;
    images: string[];
}

export interface K8sNode {
    name: string;
    status: string;
    roles: string;
    version: string;
    internalIp: string | null;
    os: string | null;
    cpu: string | null;
    memory: string | null;
}

/* ─── Service ────────────────────────────────────────────── */

@Injectable()
export class K8sService implements OnModuleInit {
    private readonly logger = new Logger(K8sService.name);

    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit() {
        try {
            await this.ensureTable();
            this.logger.log('K8s clusters table ensured');
        } catch (err: any) {
            this.logger.warn(`Failed to ensure k8s table: ${err.message}`);
        }
    }

    /* ─── CRUD ──────────────────────────────────────── */

    async addCluster(dto: K8sClusterDto): Promise<any> {
        // Validate by testing the connection
        await this.testConnection(dto);

        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `INSERT INTO devops_k8s_clusters (name, api_url, token, ca_cert, skip_tls_verify, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'connected', NOW(), NOW())
             RETURNING id, name, api_url, skip_tls_verify, status, created_at, updated_at`,
            dto.name,
            dto.apiUrl,
            dto.token,
            dto.caCert || null,
            dto.skipTlsVerify ?? true,
        );
        return this.serializeRow(rows[0]);
    }

    async getClusters(): Promise<any[]> {
        try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT id, name, api_url, skip_tls_verify, status, created_at, updated_at
                 FROM devops_k8s_clusters
                 ORDER BY created_at DESC`,
            );
            return rows.map(this.serializeRow);
        } catch {
            return [];
        }
    }

    async deleteCluster(id: number): Promise<void> {
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `DELETE FROM devops_k8s_clusters WHERE id = $1 RETURNING id`, id,
        );
        if (rows.length === 0) throw new NotFoundException(`Cluster #${id} not found`);
    }

    /* ─── K8s API Queries ────────────────────────── */

    async getNamespaces(clusterId: number): Promise<string[]> {
        const cluster = await this.getCluster(clusterId);
        const client = this.createClient(cluster);

        try {
            const { data } = await client.get('/api/v1/namespaces');
            return (data.items || []).map((ns: any) => ns.metadata.name);
        } catch (err: any) {
            this.logger.warn(`Failed to get namespaces: ${err.message}`);
            throw new BadRequestException('Failed to get namespaces');
        }
    }

    async getPods(clusterId: number, namespace?: string): Promise<K8sPod[]> {
        const cluster = await this.getCluster(clusterId);
        const client = this.createClient(cluster);
        const ns = namespace || 'default';

        try {
            const url = namespace === '_all'
                ? '/api/v1/pods'
                : `/api/v1/namespaces/${ns}/pods`;
            const { data } = await client.get(url);
            return (data.items || []).map((pod: any) => ({
                name: pod.metadata.name,
                namespace: pod.metadata.namespace,
                status: pod.status.phase,
                ready: this.getPodReadyCount(pod),
                restarts: this.getPodRestarts(pod),
                age: this.getAge(pod.metadata.creationTimestamp),
                nodeName: pod.spec.nodeName || '',
                ip: pod.status.podIP || null,
            }));
        } catch (err: any) {
            this.logger.warn(`Failed to get pods: ${err.message}`);
            throw new BadRequestException('Failed to get pods');
        }
    }

    async getDeployments(clusterId: number, namespace?: string): Promise<K8sDeployment[]> {
        const cluster = await this.getCluster(clusterId);
        const client = this.createClient(cluster);
        const ns = namespace || 'default';

        try {
            const url = namespace === '_all'
                ? '/apis/apps/v1/deployments'
                : `/apis/apps/v1/namespaces/${ns}/deployments`;
            const { data } = await client.get(url);
            return (data.items || []).map((dep: any) => ({
                name: dep.metadata.name,
                namespace: dep.metadata.namespace,
                ready: `${dep.status.readyReplicas || 0}/${dep.status.replicas || 0}`,
                upToDate: dep.status.updatedReplicas || 0,
                available: dep.status.availableReplicas || 0,
                age: this.getAge(dep.metadata.creationTimestamp),
                images: (dep.spec.template.spec.containers || []).map((c: any) => c.image),
            }));
        } catch (err: any) {
            this.logger.warn(`Failed to get deployments: ${err.message}`);
            throw new BadRequestException('Failed to get deployments');
        }
    }

    async getNodes(clusterId: number): Promise<K8sNode[]> {
        const cluster = await this.getCluster(clusterId);
        const client = this.createClient(cluster);

        try {
            const { data } = await client.get('/api/v1/nodes');
            return (data.items || []).map((node: any) => {
                const conditions = node.status.conditions || [];
                const ready = conditions.find((c: any) => c.type === 'Ready');
                return {
                    name: node.metadata.name,
                    status: ready?.status === 'True' ? 'Ready' : 'NotReady',
                    roles: this.getNodeRoles(node),
                    version: node.status.nodeInfo?.kubeletVersion || '',
                    internalIp: (node.status.addresses || []).find((a: any) => a.type === 'InternalIP')?.address || null,
                    os: `${node.status.nodeInfo?.osImage || ''} (${node.status.nodeInfo?.architecture || ''})`,
                    cpu: node.status.capacity?.cpu || null,
                    memory: node.status.capacity?.memory || null,
                };
            });
        } catch (err: any) {
            this.logger.warn(`Failed to get nodes: ${err.message}`);
            throw new BadRequestException('Failed to get nodes');
        }
    }

    async restartDeployment(clusterId: number, namespace: string, name: string): Promise<any> {
        const cluster = await this.getCluster(clusterId);
        const client = this.createClient(cluster);

        try {
            // Patch with an annotation to trigger rolling restart
            await client.patch(
                `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
                {
                    spec: {
                        template: {
                            metadata: {
                                annotations: {
                                    'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
                                },
                            },
                        },
                    },
                },
                { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } },
            );
            return { success: true, message: `Deployment ${name} restarting` };
        } catch (err: any) {
            throw new BadRequestException(err.response?.data?.message || `Failed to restart deployment ${name}`);
        }
    }

    async getClusterOverview(clusterId: number): Promise<any> {
        const cluster = await this.getCluster(clusterId);

        try {
            const [nodes, pods, deployments, namespaces] = await Promise.all([
                this.getNodes(clusterId),
                this.getPods(clusterId, '_all'),
                this.getDeployments(clusterId, '_all'),
                this.getNamespaces(clusterId),
            ]);

            return {
                cluster: { id: cluster.id, name: cluster.name, apiUrl: cluster.api_url, status: cluster.status },
                stats: {
                    nodes: nodes.length,
                    nodesReady: nodes.filter(n => n.status === 'Ready').length,
                    pods: pods.length,
                    podsRunning: pods.filter(p => p.status === 'Running').length,
                    podsFailed: pods.filter(p => p.status === 'Failed').length,
                    deployments: deployments.length,
                    namespaces: namespaces.length,
                },
                nodes,
                pods: pods.slice(0, 100),
                deployments,
                namespaces,
            };
        } catch (err: any) {
            this.logger.warn(`Cluster overview failed: ${err.message}`);
            throw new BadRequestException('Failed to get cluster overview. Check connection.');
        }
    }

    /* ─── Helpers ─────────────────────────────────── */

    private async testConnection(dto: K8sClusterDto): Promise<void> {
        try {
            const client = axios.create({
                baseURL: dto.apiUrl,
                headers: { Authorization: `Bearer ${dto.token}` },
                timeout: 10000,
                ...(dto.skipTlsVerify
                    ? { httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) }
                    : {}),
            });
            await client.get('/api/v1/namespaces');
        } catch (err: any) {
            if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
                throw new BadRequestException(`Cannot connect to cluster at ${dto.apiUrl}`);
            }
            if (err.response?.status === 401 || err.response?.status === 403) {
                throw new BadRequestException('Invalid cluster token or insufficient permissions');
            }
            throw new BadRequestException(`Cluster connection test failed: ${err.message}`);
        }
    }

    private async getCluster(id: number): Promise<any> {
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM devops_k8s_clusters WHERE id = $1`, id,
        );
        if (rows.length === 0) throw new NotFoundException(`Cluster #${id} not found`);
        return rows[0];
    }

    private createClient(cluster: any) {
        const config: any = {
            baseURL: cluster.api_url,
            headers: { Authorization: `Bearer ${cluster.token}` },
            timeout: 15000,
        };
        if (cluster.skip_tls_verify) {
            config.httpsAgent = new (require('https').Agent)({ rejectUnauthorized: false });
        }
        return axios.create(config);
    }

    private getPodReadyCount(pod: any): string {
        const containers = pod.status.containerStatuses || [];
        const ready = containers.filter((c: any) => c.ready).length;
        return `${ready}/${containers.length || pod.spec.containers?.length || 0}`;
    }

    private getPodRestarts(pod: any): number {
        return (pod.status.containerStatuses || [])
            .reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0);
    }

    private getAge(timestamp: string): string {
        const diff = Date.now() - new Date(timestamp).getTime();
        const days = Math.floor(diff / 86400000);
        if (days > 0) return `${days}d`;
        const hours = Math.floor(diff / 3600000);
        if (hours > 0) return `${hours}h`;
        const minutes = Math.floor(diff / 60000);
        return `${minutes}m`;
    }

    private getNodeRoles(node: any): string {
        const labels = node.metadata.labels || {};
        const roles: string[] = [];
        for (const key of Object.keys(labels)) {
            if (key.startsWith('node-role.kubernetes.io/')) {
                roles.push(key.replace('node-role.kubernetes.io/', ''));
            }
        }
        return roles.length > 0 ? roles.join(',') : '<none>';
    }

    private async ensureTable(): Promise<void> {
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS devops_k8s_clusters (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                api_url VARCHAR(500) NOT NULL,
                token TEXT NOT NULL,
                ca_cert TEXT,
                skip_tls_verify BOOLEAN DEFAULT true,
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
