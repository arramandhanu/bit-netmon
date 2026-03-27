'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */

export interface DevopsOverview {
    totalServers: number;
    serversUp: number;
    serversDown: number;
    totalServices: number;
    activeServices: number;
    failedServices: number;
    servers: DevopsServer[];
}

export interface DevopsServer {
    server_id: number;
    name: string;
    server_type: string;
    ip_address: string | null;
    hostname: string | null;
    status: string;
    os_info: string | null;
    last_reported_at: string | null;
    location_name: string | null;
}

export interface SystemdService {
    id: number;
    server_id: number;
    name: string;
    description: string;
    load_state: string;
    active_state: string;
    sub_state: string;
    unit_file_state: string;
    updated_at: string;
}

export interface DevopsCommand {
    id: number;
    server_id: number;
    command_type: string;
    service_name: string;
    action: string;
    status: string;
    output: string | null;
    created_at: string;
    updated_at: string;
}

export interface GitConnection {
    id: number;
    provider: 'github' | 'gitlab';
    name: string;
    base_url: string | null;
    status: string;
    created_at: string;
    updated_at: string;
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

export interface K8sCluster {
    id: number;
    name: string;
    api_url: string;
    skip_tls_verify: boolean;
    status: string;
    created_at: string;
    updated_at: string;
}

export interface K8sClusterOverview {
    cluster: { id: number; name: string; apiUrl: string; status: string };
    stats: {
        nodes: number;
        nodesReady: number;
        pods: number;
        podsRunning: number;
        podsFailed: number;
        deployments: number;
        namespaces: number;
    };
    nodes: any[];
    pods: any[];
    deployments: any[];
    namespaces: string[];
}

/* ─── useDevopsOverview ──────────────────────────────────── */

export function useDevopsOverview() {
    const [data, setData] = useState<DevopsOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOverview = useCallback(async () => {
        try {
            setLoading(true);
            const { data: result } = await api.get<DevopsOverview>('/devops/overview');
            setData(result);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load DevOps overview');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchOverview(); }, [fetchOverview]);

    return { data, loading, error, refetch: fetchOverview };
}

/* ─── useServerServices ──────────────────────────────────── */

export function useServerServices(serverId: number) {
    const [data, setData] = useState<{ server: DevopsServer; services: SystemdService[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchServices = useCallback(async () => {
        try {
            setLoading(true);
            const { data: result } = await api.get(`/devops/servers/${serverId}/services`);
            setData(result);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load services');
        } finally {
            setLoading(false);
        }
    }, [serverId]);

    useEffect(() => { fetchServices(); }, [fetchServices]);

    return { data, loading, error, refetch: fetchServices };
}

/* ─── useCommandHistory ──────────────────────────────────── */

export function useCommandHistory(serverId: number) {
    const [data, setData] = useState<DevopsCommand[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = useCallback(async () => {
        try {
            setLoading(true);
            const { data: result } = await api.get<DevopsCommand[]>(`/devops/servers/${serverId}/commands`);
            setData(result);
        } catch {
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [serverId]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    return { data, loading, refetch: fetchHistory };
}

/* ─── Service Actions ────────────────────────────────────── */

export async function executeServiceAction(
    serverId: number,
    serviceName: string,
    action: 'start' | 'stop' | 'restart' | 'enable' | 'disable',
): Promise<DevopsCommand> {
    const { data } = await api.post<DevopsCommand>(
        `/devops/servers/${serverId}/services/${serviceName}/action`,
        { action },
    );
    return data;
}

/* ─── Git Connections ────────────────────────────────────── */

export function useGitConnections() {
    const [data, setData] = useState<GitConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        try {
            setLoading(true);
            const { data: result } = await api.get<GitConnection[]>('/devops/git/connections');
            setData(result);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load connections');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, error, refetch: fetch };
}

export async function addGitConnection(dto: {
    provider: 'github' | 'gitlab';
    token: string;
    name?: string;
    baseUrl?: string;
}): Promise<GitConnection> {
    const { data } = await api.post<GitConnection>('/devops/git/connections', dto);
    return data;
}

export async function deleteGitConnection(id: number): Promise<void> {
    await api.delete(`/devops/git/connections/${id}`);
}

export function useGitRepos(connectionId: number | null) {
    const [data, setData] = useState<GitRepo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        if (!connectionId) return;
        try {
            setLoading(true);
            const { data: result } = await api.get<GitRepo[]>(`/devops/git/connections/${connectionId}/repos`);
            setData(result);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load repos');
        } finally {
            setLoading(false);
        }
    }, [connectionId]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, error, refetch: fetch };
}

export function useGitPipelines(connectionId: number | null, repoFullName: string | null) {
    const [data, setData] = useState<GitPipeline[]>([]);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        if (!connectionId || !repoFullName) return;
        try {
            setLoading(true);
            const encoded = encodeURIComponent(repoFullName);
            const { data: result } = await api.get<GitPipeline[]>(`/devops/git/connections/${connectionId}/repos/${encoded}/pipelines`);
            setData(result);
        } catch {
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [connectionId, repoFullName]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, refetch: fetch };
}

export async function triggerGitPipeline(connectionId: number, repoFullName: string, ref: string): Promise<any> {
    const encoded = encodeURIComponent(repoFullName);
    const { data } = await api.post(`/devops/git/connections/${connectionId}/repos/${encoded}/trigger`, { ref });
    return data;
}

/* ─── K8s Clusters ───────────────────────────────────────── */

export function useK8sClusters() {
    const [data, setData] = useState<K8sCluster[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        try {
            setLoading(true);
            const { data: result } = await api.get<K8sCluster[]>('/devops/k8s/clusters');
            setData(result);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load clusters');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, error, refetch: fetch };
}

export async function addK8sCluster(dto: {
    name: string;
    apiUrl: string;
    token: string;
    skipTlsVerify?: boolean;
}): Promise<K8sCluster> {
    const { data } = await api.post<K8sCluster>('/devops/k8s/clusters', dto);
    return data;
}

export async function deleteK8sCluster(id: number): Promise<void> {
    await api.delete(`/devops/k8s/clusters/${id}`);
}

export function useK8sClusterOverview(clusterId: number | null) {
    const [data, setData] = useState<K8sClusterOverview | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        if (!clusterId) return;
        try {
            setLoading(true);
            const { data: result } = await api.get<K8sClusterOverview>(`/devops/k8s/clusters/${clusterId}/overview`);
            setData(result);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load cluster overview');
        } finally {
            setLoading(false);
        }
    }, [clusterId]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, error, refetch: fetch };
}

export async function restartK8sDeployment(clusterId: number, namespace: string, name: string): Promise<any> {
    const { data } = await api.post(`/devops/k8s/clusters/${clusterId}/deployments/${namespace}/${name}/restart`);
    return data;
}
