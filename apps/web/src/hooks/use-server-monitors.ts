'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

// ─── Types ──────────────────────────────────────────────

export interface ServerMonitor {
    server_id: number;
    name: string;
    server_type: 'linux' | 'windows';
    ip_address: string | null;
    hostname: string | null;
    os_info: string | null;
    agent_token: string;
    agent_version: string | null;
    agent_interval: number;
    status: string;
    last_reported_at: string | null;
    enabled: boolean;
    monitor_options: any;
    created_at: string;
    updated_at: string;
    latestMetrics?: ServerMetrics | null;
}

export interface ServerMetrics {
    time: string;
    server_id: number;
    cpu_user: number | null;
    cpu_system: number | null;
    cpu_load1: number | null;
    cpu_load5: number | null;
    cpu_load15: number | null;
    cpu_cores: number | null;
    mem_total: number | null;
    mem_used: number | null;
    mem_percent: number | null;
    swap_total: number | null;
    swap_used: number | null;
    disk_json: Array<{ mountpoint: string; total: number; used: number; percent: number; fstype: string }> | null;
    disk_io_json: Array<{ device: string; readBytes: number; writeBytes: number }> | null;
    net_json: Array<{ interface: string; bytesIn: number; bytesOut: number; packetsIn?: number; packetsOut?: number }> | null;
    processes_json: Array<{ pid: number; name: string; cpu: number; memory: number; threads?: number }> | null;
    uptime_seconds: number | null;
}

export interface ServerOverview {
    totalServers: number;
    serversUp: number;
    serversDown: number;
    serversUnknown: number;
    avgCpuPercent: number;
    avgMemPercent: number;
    servers: (ServerMonitor & { latestMetrics: ServerMetrics | null })[];
}

// ─── Hooks ──────────────────────────────────────────────

export function useServerMonitorOverview(refreshInterval = 30000) {
    const [data, setData] = useState<ServerOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        try {
            const res = await api.get('/server-monitors/overview');
            setData(res.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load server monitors');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetch();
        if (refreshInterval > 0) {
            const interval = setInterval(fetch, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [fetch, refreshInterval]);

    return { data, loading, error, refetch: fetch };
}

export function useServerMonitorDetail(id: number) {
    const [data, setData] = useState<(ServerMonitor & { latestMetrics: ServerMetrics | null }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        try {
            const res = await api.get(`/server-monitors/${id}`);
            setData(res.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load server detail');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetch();
    }, [fetch]);

    return { data, loading, error, refetch: fetch };
}

export function useServerMetricsHistory(id: number, from?: string, to?: string) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            const res = await api.get(`/server-monitors/${id}/metrics?${params.toString()}`);
            setData(res.data);
        } catch {
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [id, from, to]);

    useEffect(() => {
        fetch();
    }, [fetch]);

    return { data, loading, refetch: fetch };
}

export function useServerMonitorActions() {
    const [saving, setSaving] = useState(false);

    const create = async (dto: {
        name: string;
        serverType: 'linux' | 'windows';
        ipAddress?: string;
        hostname?: string;
        agentInterval?: number;
        locationId?: number;
        monitorOptions?: any;
    }) => {
        setSaving(true);
        try {
            const res = await api.post('/server-monitors', dto);
            return res.data;
        } finally {
            setSaving(false);
        }
    };

    const update = async (id: number, dto: any) => {
        setSaving(true);
        try {
            const res = await api.patch(`/server-monitors/${id}`, dto);
            return res.data;
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id: number) => {
        await api.delete(`/server-monitors/${id}`);
    };

    const getInstallScript = async (id: number) => {
        const res = await api.get(`/server-monitors/${id}/install-script`);
        return res.data as { serverType: string; script: string };
    };

    const downloadInstallScript = async (id: number, serverType: 'linux' | 'windows' = 'linux') => {
        const res = await api.get(`/server-monitors/${id}/install-script`);
        const { script } = res.data as { serverType: string; script: string };
        const ext = serverType === 'linux' ? 'sh' : 'ps1';
        const filename = `install-agent.${ext}`;
        const blob = new Blob([script], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return { create, update, remove, getInstallScript, downloadInstallScript, saving };
}
