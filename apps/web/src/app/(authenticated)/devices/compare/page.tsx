'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, Cpu, HardDrive, Clock, Activity, Server, Wifi, WifiOff,
    MapPin, BarChart3,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import type { DeviceMetricRow } from '@/hooks/use-metrics';

/* ─── Types ──────────────────────────────────────────────── */

interface CompareDevice {
    id: number;
    hostname: string;
    ipAddress: string;
    deviceType: string;
    vendor: string | null;
    model: string | null;
    status: string;
    uptime: number | null;
    lastPolledAt: string | null;
    location?: { name: string } | null;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'];

/* ─── Mini Chart ─────────────────────────────────────────── */

function CompareChart({ datasets, label, unit = '%', height = 120 }: {
    datasets: { label: string; data: number[]; color: string }[];
    label: string;
    unit?: string;
    height?: number;
}) {
    const allValues = datasets.flatMap(d => d.data);
    const max = Math.max(...allValues, 1);
    const min = Math.min(...allValues, 0);
    const range = max - min || 1;
    const width = 300;
    const pad = 4;

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{label}</h4>
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block">
                {datasets.map((ds, di) => {
                    if (!ds.data.length) return null;
                    const stepX = (width - pad * 2) / Math.max(ds.data.length - 1, 1);
                    const points = ds.data.map((v, i) => {
                        const x = pad + i * stepX;
                        const y = height - pad - ((v - min) / range) * (height - pad * 2);
                        return `${x},${y}`;
                    }).join(' ');
                    return (
                        <polyline key={di} points={points} fill="none" stroke={ds.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
                    );
                })}
            </svg>
            <div className="flex flex-wrap gap-3 mt-2">
                {datasets.map((ds, i) => {
                    const latest = ds.data.length > 0 ? ds.data[ds.data.length - 1] : null;
                    return (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ds.color }} />
                            <span className="text-gray-500">{ds.label}:</span>
                            <span className="font-semibold text-gray-700">{latest !== null ? `${latest.toFixed(1)}${unit}` : '—'}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ─── Stat Card ──────────────────────────────────────────── */

function StatRow({ label, values, colors }: { label: string; values: (string | number | null)[]; colors: string[] }) {
    return (
        <div className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
            <span className="text-xs font-medium text-gray-500 w-28 flex-shrink-0">{label}</span>
            <div className="flex flex-1 gap-4">
                {values.map((v, i) => (
                    <div key={i} className="flex-1 text-sm font-semibold" style={{ color: colors[i] }}>
                        {v ?? '—'}
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─── Page ───────────────────────────────────────────────── */

export default function DeviceComparePage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { addToast } = useToast();
    const ids = useMemo(() => (searchParams.get('ids') || '').split(',').map(Number).filter(Boolean), [searchParams]);

    const [devices, setDevices] = useState<CompareDevice[]>([]);
    const [metrics, setMetrics] = useState<Record<number, DeviceMetricRow[]>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (ids.length < 2) return;
        setLoading(true);

        // Fetch device info for each ID
        const fetchDevices = ids.map(id =>
            api.get(`/devices/${id}`).then(r => r.data).catch(() => null)
        );

        // Fetch 24h metrics for each ID
        const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const to = new Date().toISOString();
        const fetchMetrics = ids.map(id =>
            api.get(`/metrics/device/${id}`, { params: { from, to, interval: '1h', limit: 24 } })
                .then(r => (r.data.data || []).reverse() as DeviceMetricRow[])
                .catch(() => [] as DeviceMetricRow[])
        );

        Promise.all([Promise.all(fetchDevices), Promise.all(fetchMetrics)])
            .then(([devs, mets]) => {
                setDevices(devs.filter(Boolean) as CompareDevice[]);
                const metricMap: Record<number, DeviceMetricRow[]> = {};
                ids.forEach((id, i) => { metricMap[id] = mets[i]; });
                setMetrics(metricMap);
            })
            .catch(() => addToast({ type: 'error', title: 'Failed', message: 'Could not load comparison data.' }))
            .finally(() => setLoading(false));
    }, [ids.join(',')]);

    function formatUptime(ticks: number | null): string {
        if (!ticks) return '—';
        const totalSec = Math.floor(ticks / 100);
        const days = Math.floor(totalSec / 86400);
        const hrs = Math.floor((totalSec % 86400) / 3600);
        if (days > 0) return `${days}d ${hrs}h`;
        return `${hrs}h`;
    }

    if (ids.length < 2) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <BarChart3 className="h-12 w-12 text-gray-300 mb-4" />
                <h2 className="text-lg font-bold text-gray-700 mb-2">Select 2–4 devices to compare</h2>
                <p className="text-sm text-gray-500 mb-4">Go back to the devices list and select devices, then click Compare.</p>
                <button onClick={() => router.push('/devices')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Devices
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-pulse text-gray-400 text-sm">Loading comparison data…</div>
            </div>
        );
    }

    const colors = devices.map((_, i) => COLORS[i % COLORS.length]);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => router.push('/devices')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Device Comparison</h1>
                    <p className="text-sm text-gray-500">Comparing {devices.length} devices side-by-side</p>
                </div>
            </div>

            {/* Device Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {devices.map((d, i) => (
                    <div key={d.id} className="rounded-xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: colors[i] }}>
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`h-3 w-3 rounded-full ${d.status === 'up' ? 'bg-green-500' : d.status === 'down' ? 'bg-red-500' : 'bg-gray-400'}`} />
                            <h3 className="text-sm font-bold text-gray-900 truncate">{d.hostname}</h3>
                        </div>
                        <div className="space-y-1 text-xs text-gray-500">
                            <p><code className="bg-gray-100 px-1 py-0.5 rounded">{d.ipAddress}</code></p>
                            <p className="capitalize">{d.deviceType.replace('_', ' ')} · {d.vendor || 'Unknown'}</p>
                            {d.location?.name && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{d.location.name}</p>}
                        </div>
                    </div>
                ))}
            </div>

            {/* Property Comparison Table */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Properties</h3>
                <StatRow label="Status" values={devices.map(d => d.status.toUpperCase())} colors={colors} />
                <StatRow label="IP Address" values={devices.map(d => d.ipAddress)} colors={colors} />
                <StatRow label="Type" values={devices.map(d => d.deviceType.replace('_', ' '))} colors={colors} />
                <StatRow label="Vendor" values={devices.map(d => d.vendor || '—')} colors={colors} />
                <StatRow label="Model" values={devices.map(d => d.model || '—')} colors={colors} />
                <StatRow label="Uptime" values={devices.map(d => formatUptime(d.uptime))} colors={colors} />
                <StatRow label="Location" values={devices.map(d => d.location?.name || '—')} colors={colors} />
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-4">
                <CompareChart
                    label="CPU Usage (24h)"
                    datasets={devices.map((d, i) => ({
                        label: d.hostname,
                        data: (metrics[d.id] || []).map(r => r.avg_cpu ?? 0),
                        color: colors[i],
                    }))}
                />
                <CompareChart
                    label="Memory Usage (24h)"
                    datasets={devices.map((d, i) => ({
                        label: d.hostname,
                        data: (metrics[d.id] || []).map(r => r.avg_memory ?? 0),
                        color: colors[i],
                    }))}
                />
                <CompareChart
                    label="Response Time (24h)"
                    unit="ms"
                    datasets={devices.map((d, i) => ({
                        label: d.hostname,
                        data: (metrics[d.id] || []).map(r => r.avg_response_time ?? 0),
                        color: colors[i],
                    }))}
                />
            </div>
        </div>
    );
}
