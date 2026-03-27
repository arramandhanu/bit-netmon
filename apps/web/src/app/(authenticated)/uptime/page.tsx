'use client';

import { useState } from 'react';
import {
    Clock,
    CheckCircle2,
    XCircle,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    Server,
    ChevronRight,
    Timer,
} from 'lucide-react';
import Link from 'next/link';
import { useUptimeSummary, UptimeDeviceSLA } from '@/hooks/use-uptime';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { MetricCard } from '@/components/ui/metric-card';
import { SubscriptionGuard } from '@/components/ui/subscription-guard';

const PERIOD_OPTIONS = [
    { label: 'Last 24 Hours', value: '24h', ms: 24 * 60 * 60 * 1000 },
    { label: 'Last 7 Days', value: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
    { label: 'Last 30 Days', value: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
    { label: 'Last 90 Days', value: '90d', ms: 90 * 24 * 60 * 60 * 1000 },
];

function getSLAColor(percent: number): string {
    if (percent >= 99.9) return 'text-emerald-600';
    if (percent >= 99) return 'text-green-600';
    if (percent >= 95) return 'text-amber-600';
    return 'text-red-600';
}

function getSLABg(percent: number): string {
    if (percent >= 99.9) return 'bg-emerald-50';
    if (percent >= 99) return 'bg-green-50';
    if (percent >= 95) return 'bg-amber-50';
    return 'bg-red-50';
}

function getStatusBadge(status: string) {
    if (status === 'up') return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Up
        </span>
    );
    if (status === 'down') return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 border border-red-200">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Down
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600 border border-gray-200">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" /> Unknown
        </span>
    );
}

export default function UptimePage() {
    const [period, setPeriod] = useState(PERIOD_OPTIONS[0]);
    const from = new Date(Date.now() - period.ms).toISOString();
    const to = new Date().toISOString();
    const { data, loading, error, refetch } = useUptimeSummary(from, to);

    if (loading) return <DashboardSkeleton />;
    if (error || !data) return <ErrorState message={error || 'No data'} onRetry={refetch} />;

    return (
        <SubscriptionGuard>
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Uptime / SLA</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Monitor device availability and service level agreements
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {PERIOD_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setPeriod(opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                period.value === opt.value
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-accent/50 text-muted-foreground hover:bg-accent'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Fleet Uptime"
                    value={`${data.fleetUptimePercent}%`}
                    icon={Clock}
                    iconBg="bg-emerald-100"
                    iconColor="text-emerald-600"
                    detail={`${data.totalDevices} devices monitored`}
                />
                <MetricCard
                    label="Devices Online"
                    value={data.devicesUp.toLocaleString()}
                    icon={CheckCircle2}
                    iconBg="bg-green-100"
                    iconColor="text-green-600"
                    detail={data.totalDevices > 0 ? `${((data.devicesUp / data.totalDevices) * 100).toFixed(1)}% of fleet` : 'No devices'}
                />
                <MetricCard
                    label="Devices Offline"
                    value={data.devicesDown.toLocaleString()}
                    icon={XCircle}
                    iconBg="bg-red-100"
                    iconColor="text-red-600"
                    detail={data.devicesDown > 0 ? 'Requires attention' : 'All devices up'}
                />
                <MetricCard
                    label="Avg Response Time"
                    value={`${data.fleetAvgResponseMs}ms`}
                    icon={Timer}
                    iconBg="bg-blue-100"
                    iconColor="text-blue-600"
                    detail="Across all UP devices"
                />
            </div>

            {/* Device SLA Table */}
            <div className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-blue-500" />
                        <h2 className="font-semibold">Device Uptime SLA</h2>
                    </div>
                    <span className="text-xs text-muted-foreground">
                        {data.devices.length} devices · {period.label}
                    </span>
                </div>

                {data.devices.length === 0 ? (
                    <div className="p-12 text-center text-sm text-muted-foreground">
                        <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="font-medium">No uptime data yet</p>
                        <p className="text-xs mt-1">Data will appear after devices are polled</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Device</th>
                                    <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">IP Address</th>
                                    <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Status</th>
                                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-3">Uptime %</th>
                                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-3">Avg Response</th>
                                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-3">Total Checks</th>
                                    <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">Last Check</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.devices.map((device) => (
                                    <tr key={device.deviceId} className="hover:bg-accent/30 transition-colors">
                                        <td className="px-5 py-3">
                                            <Link href={`/devices`} className="text-sm font-medium hover:text-primary transition-colors">
                                                {device.hostname || `Device #${device.deviceId}`}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-3 text-sm text-muted-foreground font-mono">
                                            {device.ipAddress || '-'}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            {getStatusBadge(device.lastStatus)}
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <span className={`text-sm font-bold ${getSLAColor(device.uptimePercent)}`}>
                                                {device.uptimePercent}%
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-right text-sm text-muted-foreground">
                                            {device.avgResponseMs}ms
                                        </td>
                                        <td className="px-3 py-3 text-right text-sm text-muted-foreground">
                                            {device.totalChecks.toLocaleString()}
                                        </td>
                                        <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                                            {device.lastCheckedAt
                                                ? new Date(device.lastCheckedAt).toLocaleString()
                                                : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
        </SubscriptionGuard>
    );
}
