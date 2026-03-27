'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

export interface UptimeDeviceSLA {
    deviceId: number;
    hostname?: string;
    ipAddress?: string;
    totalChecks: number;
    upChecks: number;
    downChecks: number;
    uptimePercent: number;
    downtimePercent: number;
    avgResponseMs: number;
    lastStatus: string;
    lastCheckedAt: string | null;
}

export interface UptimeSummary {
    fleetUptimePercent: number;
    fleetAvgResponseMs: number;
    totalDevices: number;
    devicesUp: number;
    devicesDown: number;
    devices: UptimeDeviceSLA[];
}

export interface UptimeHistoryPoint {
    bucket: string;
    device_id: number;
    status: string;
    avg_response_ms: number;
    total_checks: number;
    up_checks: number;
    down_checks: number;
}

export function useUptimeSummary(from?: string, to?: string, refreshInterval = 30000) {
    const [data, setData] = useState<UptimeSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        try {
            const params: any = {};
            if (from) params.from = from;
            if (to) params.to = to;
            const res = await api.get('/uptime/summary', { params });
            setData(res.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load uptime data');
        } finally {
            setLoading(false);
        }
    }, [from, to]);

    useEffect(() => {
        fetch();
        if (refreshInterval > 0) {
            const interval = setInterval(fetch, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [fetch, refreshInterval]);

    return { data, loading, error, refetch: fetch };
}

export function useUptimeHistory(deviceId: number, from?: string, to?: string, bucket?: string) {
    const [data, setData] = useState<UptimeHistoryPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        try {
            const params: any = {};
            if (from) params.from = from;
            if (to) params.to = to;
            if (bucket) params.bucket = bucket;
            const res = await api.get(`/uptime/${deviceId}`, { params });
            setData(res.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load uptime history');
        } finally {
            setLoading(false);
        }
    }, [deviceId, from, to, bucket]);

    useEffect(() => {
        fetch();
    }, [fetch]);

    return { data, loading, error, refetch: fetch };
}

export function useDeviceSLA(deviceId: number, from?: string, to?: string) {
    const [data, setData] = useState<UptimeDeviceSLA | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        try {
            const params: any = {};
            if (from) params.from = from;
            if (to) params.to = to;
            const res = await api.get(`/uptime/${deviceId}/sla`, { params });
            setData(res.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load SLA data');
        } finally {
            setLoading(false);
        }
    }, [deviceId, from, to]);

    useEffect(() => {
        fetch();
    }, [fetch]);

    return { data, loading, error, refetch: fetch };
}
