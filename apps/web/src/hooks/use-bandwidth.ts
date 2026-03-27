'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */

export interface BandwidthSummary {
    avg_in_bps: number | null;
    avg_out_bps: number | null;
    peak_in_bps: number | null;
    peak_out_bps: number | null;
    total_in_bytes: number | null;
    total_out_bytes: number | null;
    avg_in_util: number | null;
    avg_out_util: number | null;
    interfaces_count: number;
}

export interface BandwidthTimeSeries {
    bucket: string;
    total_in_bps: number;
    total_out_bps: number;
    peak_in_bps: number;
    peak_out_bps: number;
    avg_in_util: number;
    avg_out_util: number;
    interfaces_count: number;
    samples: number;
}

export interface InterfaceBandwidth {
    if_index: number;
    if_name: string;
    if_descr: string;
    if_alias: string;
    if_speed: number;
    avg_in_bps: number;
    avg_out_bps: number;
    peak_in_bps: number;
    peak_out_bps: number;
    avg_in_util: number;
    avg_out_util: number;
    total_in_errors: number;
    total_out_errors: number;
    oper_status: string;
}

export interface BandwidthOverview {
    deviceId: number;
    from: string;
    to: string;
    interval: string;
    summary: BandwidthSummary | null;
    timeSeries: BandwidthTimeSeries[];
    interfaces: InterfaceBandwidth[];
}

export interface TopInterface {
    device_id: number;
    device_name: string;
    device_ip: string;
    if_index: number;
    if_name: string;
    if_descr: string;
    if_alias: string;
    if_speed: number;
    avg_in_bps: number;
    avg_out_bps: number;
    avg_total_bps: number;
    peak_in_bps: number;
    peak_out_bps: number;
    peak_total_bps: number;
    avg_in_util: number;
    avg_out_util: number;
    total_in_errors: number;
    total_out_errors: number;
    oper_status: string;
}

export interface BandwidthReportRow {
    device: string;
    ip_address: string;
    interface: string;
    description: string;
    alias: string;
    speed_bps: number;
    avg_in_bps: number;
    avg_out_bps: number;
    max_in_bps: number;
    max_out_bps: number;
    avg_in_util: number;
    avg_out_util: number;
    max_in_util: number;
    max_out_util: number;
    total_in_errors: number;
    total_out_errors: number;
    p95_in_bps: number;
    p95_out_bps: number;
    samples: number;
}

/* ─── Hooks ──────────────────────────────────────────────── */

export function useBandwidthOverview(deviceId: number | null, timeRange: string, interval?: string) {
    const [data, setData] = useState<BandwidthOverview | null>(null);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        if (!deviceId) { setData(null); return; }
        setLoading(true);
        try {
            const from = getFromDate(timeRange);
            const params = new URLSearchParams({
                from: from.toISOString(),
                to: new Date().toISOString(),
                interval: interval || getAutoInterval(timeRange),
            });
            const res = await api.get(`/metrics/bandwidth/${deviceId}?${params}`);
            setData(res.data);
        } catch (err) {
            console.error('Failed to load bandwidth overview', err);
        } finally {
            setLoading(false);
        }
    }, [deviceId, timeRange, interval]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, refetch: fetch };
}

export function useTopInterfaces(timeRange: string, topN = 20) {
    const [data, setData] = useState<TopInterface[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const from = getFromDate(timeRange);
            const params = new URLSearchParams({
                from: from.toISOString(),
                to: new Date().toISOString(),
                topN: String(topN),
            });
            const res = await api.get(`/metrics/bandwidth/top?${params}`);
            setData(res.data.data || []);
        } catch (err) {
            console.error('Failed to load top interfaces', err);
        } finally {
            setLoading(false);
        }
    }, [timeRange, topN]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, refetch: fetch };
}

export async function fetchBandwidthReport(timeRange: string, deviceId?: number): Promise<BandwidthReportRow[]> {
    const from = getFromDate(timeRange);
    const params = new URLSearchParams({
        from: from.toISOString(),
        to: new Date().toISOString(),
    });
    if (deviceId) params.set('deviceId', String(deviceId));
    const res = await api.get(`/metrics/bandwidth/report?${params}`);
    return res.data.data || [];
}

/* ─── Helpers ────────────────────────────────────────────── */

function getFromDate(range: string): Date {
    const now = Date.now();
    const map: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
    };
    return new Date(now - (map[range] || map['24h']));
}

function getAutoInterval(range: string): string {
    const map: Record<string, string> = {
        '1h': '1m',
        '6h': '5m',
        '24h': '15m',
        '7d': '1h',
        '30d': '6h',
    };
    return map[range] || '5m';
}

export function formatBps(bps: number | null | undefined): string {
    if (!bps || bps === 0) return '0 bps';
    if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`;
    if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbps`;
    if (bps >= 1e3) return `${(bps / 1e3).toFixed(2)} Kbps`;
    return `${Math.round(bps)} bps`;
}

export function formatBytes(bytes: number | null | undefined): string {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`;
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
    if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(2)} KB`;
    return `${Math.round(bytes)} B`;
}

export function exportToCsv(data: BandwidthReportRow[], filename: string) {
    const headers = [
        'Device', 'IP Address', 'Interface', 'Description', 'Alias',
        'Speed (bps)', 'Avg In (bps)', 'Avg Out (bps)', 'Max In (bps)', 'Max Out (bps)',
        'Avg In Util %', 'Avg Out Util %', 'Max In Util %', 'Max Out Util %',
        'P95 In (bps)', 'P95 Out (bps)', 'In Errors', 'Out Errors', 'Samples',
    ];
    const rows = data.map(r => [
        r.device, r.ip_address, r.interface, r.description, r.alias,
        r.speed_bps, r.avg_in_bps, r.avg_out_bps, r.max_in_bps, r.max_out_bps,
        r.avg_in_util, r.avg_out_util, r.max_in_util, r.max_out_util,
        r.p95_in_bps, r.p95_out_bps, r.total_in_errors, r.total_out_errors, r.samples,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
