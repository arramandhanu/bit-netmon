'use client';

import { useState } from 'react';
import {
    Globe,
    CheckCircle2,
    XCircle,
    Plus,
    Timer,
    RefreshCw,
    Trash2,
    Play,
    ExternalLink,
    AlertCircle,
    X,
} from 'lucide-react';
import { useUrlMonitorOverview, useUrlMonitorActions, UrlMonitor } from '@/hooks/use-url-monitors';
import { useLocations } from '@/hooks/use-locations';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { MetricCard } from '@/components/ui/metric-card';

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

function AddMonitorModal({ onClose, onSave }: { onClose: () => void; onSave: (dto: any) => Promise<void> }) {
    const [form, setForm] = useState({
        name: '',
        url: '',
        method: 'GET',
        expectedStatus: 200,
        checkInterval: 300,
        timeout: 30000,
        locationId: '' as string | number,
    });
    const [saving, setSaving] = useState(false);
    const { data: locationsData } = useLocations({ limit: 100 });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave({
                ...form,
                locationId: form.locationId ? Number(form.locationId) : undefined,
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-gray-200">
                    <h2 className="text-lg font-semibold">Add URL Monitor</h2>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input
                            required
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Production API"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">URL</label>
                        <input
                            required
                            value={form.url}
                            onChange={e => setForm({ ...form, url: e.target.value })}
                            placeholder="https://api.example.com/health"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Method</label>
                            <select
                                value={form.method}
                                onChange={e => setForm({ ...form, method: e.target.value })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            >
                                {['GET', 'POST', 'PUT', 'PATCH', 'HEAD'].map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Expected Status</label>
                            <input
                                type="number"
                                value={form.expectedStatus}
                                onChange={e => setForm({ ...form, expectedStatus: parseInt(e.target.value) })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Check Interval (seconds)</label>
                            <input
                                type="number"
                                value={form.checkInterval}
                                onChange={e => setForm({ ...form, checkInterval: parseInt(e.target.value) })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Timeout (ms)</label>
                            <input
                                type="number"
                                value={form.timeout}
                                onChange={e => setForm({ ...form, timeout: parseInt(e.target.value) })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Location</label>
                        <select
                            value={form.locationId}
                            onChange={e => setForm({ ...form, locationId: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        >
                            <option value="">— No location —</option>
                            {locationsData?.items.map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.name}{loc.city ? ` (${loc.city})` : ''}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                            {saving ? 'Adding...' : 'Add Monitor'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function WebMonitorPage() {
    const { data, loading, error, refetch } = useUrlMonitorOverview();
    const { create, remove, triggerCheck } = useUrlMonitorActions();
    const [showAddModal, setShowAddModal] = useState(false);
    const [checkingId, setCheckingId] = useState<number | null>(null);

    if (loading) return <DashboardSkeleton />;
    if (error || !data) return <ErrorState message={error || 'No data'} onRetry={refetch} />;

    const handleAdd = async (dto: any) => {
        await create(dto);
        refetch();
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this monitor?')) return;
        await remove(id);
        refetch();
    };

    const handleCheck = async (id: number) => {
        setCheckingId(id);
        try {
            await triggerCheck(id);
            refetch();
        } finally {
            setCheckingId(null);
        }
    };

    return (
        <div className="space-y-6">
            {showAddModal && (
                <AddMonitorModal onClose={() => setShowAddModal(false)} onSave={handleAdd} />
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Web / API Monitor</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Monitor HTTP/HTTPS endpoints availability and response time
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 shadow-sm transition-colors"
                >
                    <Plus className="h-4 w-4" /> Add Monitor
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Total Monitors"
                    value={data.totalMonitors.toLocaleString()}
                    icon={Globe}
                    iconBg="bg-blue-100"
                    iconColor="text-blue-600"
                    detail={`${data.monitorsUp} up · ${data.monitorsDown} down`}
                />
                <MetricCard
                    label="Services Up"
                    value={data.monitorsUp.toLocaleString()}
                    icon={CheckCircle2}
                    iconBg="bg-emerald-100"
                    iconColor="text-emerald-600"
                    detail={data.totalMonitors > 0 ? `${((data.monitorsUp / data.totalMonitors) * 100).toFixed(1)}% available` : 'No monitors'}
                />
                <MetricCard
                    label="Services Down"
                    value={data.monitorsDown.toLocaleString()}
                    icon={XCircle}
                    iconBg="bg-red-100"
                    iconColor="text-red-600"
                    detail={data.monitorsDown > 0 ? 'Needs attention' : 'All services up'}
                />
                <MetricCard
                    label="Avg Response Time"
                    value={`${data.avgResponseMs}ms`}
                    icon={Timer}
                    iconBg="bg-purple-100"
                    iconColor="text-purple-600"
                    detail="Across all monitors"
                />
            </div>

            {/* Monitor Table */}
            <div className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-blue-500" />
                        <h2 className="font-semibold">URL Monitors</h2>
                    </div>
                    <button onClick={refetch} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" /> Refresh
                    </button>
                </div>

                {data.monitors.length === 0 ? (
                    <div className="p-12 text-center text-sm text-muted-foreground">
                        <Globe className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="font-medium">No URL monitors configured</p>
                        <p className="text-xs mt-1">Click "Add Monitor" to start monitoring your web services</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Name</th>
                                    <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">URL</th>
                                    <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Status</th>
                                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-3">Response</th>
                                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-3">Uptime (24h)</th>
                                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-3">Interval</th>
                                    <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.monitors.map((monitor) => (
                                    <tr key={monitor.url_monitor_id} className="hover:bg-accent/30 transition-colors">
                                        <td className="px-5 py-3">
                                            <div className="text-sm font-medium">{monitor.name}</div>
                                            <div className="text-xs text-muted-foreground">{monitor.method}</div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <a
                                                href={monitor.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-primary hover:underline inline-flex items-center gap-1 max-w-xs truncate"
                                            >
                                                {monitor.url}
                                                <ExternalLink className="h-3 w-3 shrink-0" />
                                            </a>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            {getStatusBadge(monitor.status)}
                                        </td>
                                        <td className="px-3 py-3 text-right text-sm text-muted-foreground">
                                            {monitor.last_response_ms != null ? `${monitor.last_response_ms}ms` : '-'}
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            {monitor.uptimePercent24h != null ? (
                                                <span className={`text-sm font-bold ${
                                                    monitor.uptimePercent24h >= 99 ? 'text-emerald-600' :
                                                    monitor.uptimePercent24h >= 95 ? 'text-amber-600' : 'text-red-600'
                                                }`}>
                                                    {monitor.uptimePercent24h}%
                                                </span>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-right text-sm text-muted-foreground">
                                            {monitor.check_interval}s
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleCheck(monitor.url_monitor_id)}
                                                    disabled={checkingId === monitor.url_monitor_id}
                                                    className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors disabled:opacity-50"
                                                    title="Run check now"
                                                >
                                                    {checkingId === monitor.url_monitor_id
                                                        ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                        : <Play className="h-3.5 w-3.5" />
                                                    }
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(monitor.url_monitor_id)}
                                                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
