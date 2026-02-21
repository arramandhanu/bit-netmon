'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */

export type MetricInterval = '1m' | '5m' | '15m' | '1h' | '6h' | '1d';

export interface DeviceMetricRow {
    bucket: string;
    avg_cpu: number | null;
    max_cpu: number | null;
    avg_memory: number | null;
    max_memory: number | null;
    avg_response_time: number | null;
    max_response_time: number | null;
    uptime: number | null;
    samples: number;
}

export interface InterfaceMetricRow {
    bucket: string;
    avg_in_bps: number | null;
    max_in_bps: number | null;
    avg_out_bps: number | null;
    max_out_bps: number | null;
    avg_in_util: number | null;
    max_in_util: number | null;
    avg_out_util: number | null;
    max_out_util: number | null;
    total_in_errors: number | null;
    total_out_errors: number | null;
    samples: number;
}

export interface LatestDeviceMetrics {
    cpu_utilization: number | null;
    memory_percent: number | null;
    memory_used: number | null;
    memory_total: number | null;
    response_time_ms: number | null;
    uptime: number | null;
    device_status: string | null;
}

/* ─── Time range presets ─────────────────────────────────── */

export const TIME_RANGES = [
    { label: '6h', hours: 6, interval: '5m' as MetricInterval },
    { label: '24h', hours: 24, interval: '5m' as MetricInterval },
    { label: '7d', hours: 168, interval: '1h' as MetricInterval },
    { label: '30d', hours: 720, interval: '6h' as MetricInterval },
];

/* ─── useDeviceMetrics ───────────────────────────────────── */

export function useDeviceMetrics(deviceId: number | string, rangeIdx: number = 1) {
    const [data, setData] = useState<DeviceMetricRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const range = TIME_RANGES[rangeIdx] || TIME_RANGES[1];

    const fetchMetrics = useCallback(async () => {
        try {
            setLoading(true);
            const from = new Date(Date.now() - range.hours * 60 * 60 * 1000).toISOString();
            const to = new Date().toISOString();

            const { data: resp } = await api.get(`/metrics/device/${deviceId}`, {
                params: { from, to, interval: range.interval, limit: 500 },
            });

            // API returns data in DESC order; reverse to chronological
            const rows: DeviceMetricRow[] = (resp.data || []).reverse();
            setData(rows);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load metrics');
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [deviceId, range.hours, range.interval]);

    useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

    return { data, loading, error, refetch: fetchMetrics };
}

/* ─── useLatestDeviceMetrics ─────────────────────────────── */

export function useLatestDeviceMetrics(deviceId: number | string) {
    const [data, setData] = useState<LatestDeviceMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/metrics/device/${deviceId}/latest`)
            .then(({ data: resp }) => setData(resp.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [deviceId]);

    return { data, loading };
}

/* ─── useInterfaceMetrics ────────────────────────────────── */

export function useInterfaceMetrics(deviceId: number | string, ifIndex: number, rangeIdx: number = 1) {
    const [data, setData] = useState<InterfaceMetricRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const range = TIME_RANGES[rangeIdx] || TIME_RANGES[1];

    const fetchMetrics = useCallback(async () => {
        try {
            setLoading(true);
            const from = new Date(Date.now() - range.hours * 60 * 60 * 1000).toISOString();
            const to = new Date().toISOString();

            const { data: resp } = await api.get(`/metrics/interface/${deviceId}/${ifIndex}`, {
                params: { from, to, interval: range.interval, limit: 500 },
            });

            const rows: InterfaceMetricRow[] = (resp.data || []).reverse();
            setData(rows);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load interface metrics');
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [deviceId, ifIndex, range.hours, range.interval]);

    useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

    return { data, loading, error, refetch: fetchMetrics };
}

/* ─── Trigger Poll ───────────────────────────────────────── */

export async function triggerDevicePoll(deviceId: number | string) {
    const { data } = await api.post(`/polling/trigger/${deviceId}`);
    return data;
}
