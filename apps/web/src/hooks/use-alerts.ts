'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */

export interface AlertRule {
    id: number;
    name: string;
    description?: string;
    metricName: string;
    condition: string;
    threshold: number;
    duration: number;
    severity: string;
    enabled: boolean;
    notifyChannels: string[];
    deviceGroupId?: number;
    createdAt: string;
    updatedAt: string;
    // Legacy aliases for backwards compat in templates
    metric?: string;
    channels?: string[];
}

export interface AlertEvent {
    id: number;
    ruleId: number;
    deviceId: number;
    severity: string;
    metricName: string;
    metricValue: number;
    thresholdValue: number;
    message: string;
    state: string;
    acknowledgedBy: number | null;
    acknowledgedAt: string | null;
    resolvedAt: string | null;
    triggeredAt: string;
}

export interface AlertStats {
    active: number;
    acknowledged: number;
    critical: number;
    warning: number;
    rules: number;
    enabledRules: number;
}

export interface AlertHistoryQuery {
    page?: number;
    limit?: number;
    severity?: string;
    state?: string;
    deviceId?: number;
}

/* ─── useActiveAlerts ────────────────────────────────────── */

export function useActiveAlerts(refreshInterval = 30000) {
    const [alerts, setAlerts] = useState<AlertEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAlerts = useCallback(async () => {
        try {
            const { data } = await api.get<AlertEvent[]>('/alerts/active');
            setAlerts(data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load active alerts');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAlerts();
        if (refreshInterval > 0) {
            const interval = setInterval(fetchAlerts, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [fetchAlerts, refreshInterval]);

    return { alerts, loading, error, refetch: fetchAlerts };
}

/* ─── useAlertHistory ────────────────────────────────────── */

export function useAlertHistory(initialQuery: AlertHistoryQuery = {}) {
    const [data, setData] = useState<{ items: AlertEvent[]; total: number; page: number; pages: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState<AlertHistoryQuery>(initialQuery);

    const fetchHistory = useCallback(async (q?: AlertHistoryQuery) => {
        const params = q || query;
        try {
            setLoading(true);
            const { data: result } = await api.get('/alerts/history', { params });
            setData(result);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load alert history');
        } finally {
            setLoading(false);
        }
    }, [query]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const updateQuery = useCallback((newQuery: Partial<AlertHistoryQuery>) => {
        setQuery(prev => ({ ...prev, ...newQuery }));
    }, []);

    return { data, loading, error, refetch: fetchHistory, query, updateQuery };
}

/* ─── useAlertRules ──────────────────────────────────────── */

export function useAlertRules() {
    const [rules, setRules] = useState<AlertRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRules = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get<AlertRule[]>('/alerts/rules');
            setRules(data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load alert rules');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    return { rules, loading, error, refetch: fetchRules };
}

/* ─── useAlertStats ──────────────────────────────────────── */

export function useAlertStats() {
    const [stats, setStats] = useState<AlertStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        try {
            const { data } = await api.get<AlertStats>('/alerts/stats');
            setStats(data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load alert stats');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return { stats, loading, error, refetch: fetchStats };
}

/* ─── Alert Actions ──────────────────────────────────────── */

export async function acknowledgeAlert(id: number) {
    const { data } = await api.post(`/alerts/${id}/acknowledge`);
    return data;
}

export async function resolveAlert(id: number) {
    const { data } = await api.post(`/alerts/${id}/resolve`);
    return data;
}

export async function createAlertRule(dto: {
    name: string;
    description?: string;
    metricName: string;
    condition: string;
    threshold: number;
    duration?: number;
    severity?: string;
    notifyChannels?: string[];
    deviceGroupId?: number;
}) {
    const { data } = await api.post<AlertRule>('/alerts/rules', dto);
    return data;
}

export async function updateAlertRule(id: number, dto: Partial<AlertRule>) {
    const { data } = await api.patch<AlertRule>(`/alerts/rules/${id}`, dto);
    return data;
}

export async function deleteAlertRule(id: number) {
    await api.delete(`/alerts/rules/${id}`);
}
