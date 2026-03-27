'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

export interface UrlMonitor {
    url_monitor_id: number;
    name: string;
    url: string;
    method: string;
    expected_status: number;
    check_interval: number;
    timeout: number;
    headers: Record<string, string> | null;
    body: string | null;
    enabled: boolean;
    status: string;
    last_checked_at: string | null;
    last_response_ms: number | null;
    uptimePercent24h: number | null;
    created_at: string;
    updated_at: string;
}

export interface UrlMonitorOverview {
    totalMonitors: number;
    monitorsUp: number;
    monitorsDown: number;
    monitorsUnknown: number;
    avgResponseMs: number;
    monitors: UrlMonitor[];
}

export interface UrlCheckResult {
    time: string;
    monitor_id: number;
    status_code: number | null;
    response_ms: number;
    is_up: boolean;
    error_message: string | null;
}

export function useUrlMonitorOverview(refreshInterval = 30000) {
    const [data, setData] = useState<UrlMonitorOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        try {
            const res = await api.get('/url-monitors/overview');
            setData(res.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load URL monitors');
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

export function useUrlMonitorDetail(id: number) {
    const [data, setData] = useState<(UrlMonitor & { history: UrlCheckResult[] }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        try {
            const res = await api.get(`/url-monitors/${id}`);
            setData(res.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load monitor detail');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetch();
    }, [fetch]);

    return { data, loading, error, refetch: fetch };
}

export function useUrlMonitorActions() {
    const [saving, setSaving] = useState(false);

    const create = async (dto: {
        name: string;
        url: string;
        method?: string;
        expectedStatus?: number;
        checkInterval?: number;
        timeout?: number;
        headers?: Record<string, string>;
        body?: string;
        locationId?: number;
    }) => {
        setSaving(true);
        try {
            const res = await api.post('/url-monitors', dto);
            return res.data;
        } finally {
            setSaving(false);
        }
    };

    const update = async (id: number, dto: any) => {
        setSaving(true);
        try {
            const res = await api.patch(`/url-monitors/${id}`, dto);
            return res.data;
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id: number) => {
        await api.delete(`/url-monitors/${id}`);
    };

    const triggerCheck = async (id: number) => {
        const res = await api.post(`/url-monitors/${id}/check`);
        return res.data;
    };

    return { create, update, remove, triggerCheck, saving };
}
