'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wifi, WifiOff, Radio, Signal, ChevronRight, Clock } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useDevices, Device } from '@/hooks/use-devices';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

/* ─── Helpers ────────────────────────────────────────────── */

function formatUptime(seconds: number | null): string {
    if (!seconds || seconds <= 0) return '—';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    if (d > 0) return `${d}d ${h}h`;
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

/* ─── Component ──────────────────────────────────────────── */

export default function WirelessPage() {
    const router = useRouter();
    const { data, loading, error, refetch } = useDevices({ type: 'access_point', limit: 100 });
    const [statusFilter, setStatusFilter] = useState<'all' | 'up' | 'down'>('all');

    if (loading && !data) return <DashboardSkeleton />;
    if (error || !data) return <ErrorState message={error || 'No data'} onRetry={refetch} />;

    const allAPs = data.items;
    const totalOnline = allAPs.filter((ap) => ap.status === 'up').length;
    const totalOffline = allAPs.filter((ap) => ap.status === 'down').length;

    const accessPoints = statusFilter === 'all'
        ? allAPs
        : allAPs.filter(ap => ap.status === statusFilter);

    return (
        <div className="space-y-6">
            <PageHeader title="Wireless" subtitle={`${allAPs.length} access points managed`} />

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Total APs" value={allAPs.length} icon={Radio} />
                <MetricCard
                    label="Online"
                    value={totalOnline}
                    icon={Wifi}
                    trend={allAPs.length > 0 ? `${Math.round((totalOnline / allAPs.length) * 100)}%` : '0%'}
                    trendUp
                />
                <MetricCard label="Offline" value={totalOffline} icon={WifiOff} />
                <MetricCard label="Interfaces" value={allAPs.reduce((s, ap) => s + (ap._count?.interfaces || 0), 0)} icon={Signal} />
            </div>

            {/* Status filter buttons */}
            <div className="flex items-center gap-2">
                {([
                    { key: 'all' as const, label: 'All', count: allAPs.length },
                    { key: 'up' as const, label: 'Online', count: totalOnline },
                    { key: 'down' as const, label: 'Offline', count: totalOffline },
                ]).map(f => (
                    <button
                        key={f.key}
                        onClick={() => setStatusFilter(f.key)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === f.key
                                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        {f.label}
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusFilter === f.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                            {f.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">AP Name</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">IP</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vendor</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Model</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Uptime</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Location</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Interfaces</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Last Polled</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {accessPoints.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-16 text-sm text-gray-400">
                                        No access points found
                                    </td>
                                </tr>
                            ) : (
                                accessPoints.map((ap) => (
                                    <tr
                                        key={ap.id}
                                        className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                                        onClick={() => router.push(`/devices/${ap.id}`)}
                                    >
                                        <td className="px-4 py-3">
                                            <StatusBadge status={ap.status} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-medium text-gray-900">{ap.hostname}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-xs text-gray-600">{ap.ipAddress}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-gray-600">{ap.vendor || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-gray-600">{ap.model || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="flex items-center gap-1 text-xs text-gray-500">
                                                <Clock className="h-3 w-3" />
                                                {formatUptime(ap.uptime)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {ap.location ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); router.push(`/locations/${ap.location!.id}`); }}
                                                    className="text-xs text-blue-600 hover:underline font-medium"
                                                >
                                                    {ap.location.name}
                                                </button>
                                            ) : (
                                                <span className="text-xs text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-gray-500">{ap._count?.interfaces || 0}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs text-gray-400">
                                                {ap.lastPolledAt ? new Date(ap.lastPolledAt).toLocaleTimeString() : 'Never'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-300">
                                            <ChevronRight className="h-4 w-4" />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
