'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Activity, ArrowUpDown, Gauge, Search, Filter, Power,
    PowerOff, Eye, ToggleLeft, ToggleRight, ChevronLeft,
    ChevronRight, X, Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/components/ui/toast';
import {
    useInterfaces,
    updateInterface,
    InterfaceRecord,
} from '@/hooks/use-interfaces';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

/* ─── Helpers ────────────────────────────────────────────── */

function formatSpeed(speed: number | null): string {
    if (!speed) return '—';
    if (speed >= 1_000_000_000) return `${(speed / 1_000_000_000).toFixed(0)} Gbps`;
    if (speed >= 1_000_000) return `${(speed / 1_000_000).toFixed(0)} Mbps`;
    if (speed >= 1_000) return `${(speed / 1_000).toFixed(0)} Kbps`;
    return `${speed} bps`;
}

/* ─── Component ──────────────────────────────────────────── */

export default function InterfacesPage() {
    const router = useRouter();
    const { addToast } = useToast();

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 25;

    const { data, loading, error, refetch } = useInterfaces({
        page,
        limit: pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
    });

    // Toggle helpers
    const [togglingId, setTogglingId] = useState<number | null>(null);

    const handleToggleAdmin = async (iface: InterfaceRecord) => {
        setTogglingId(iface.id);
        try {
            const newStatus = iface.ifAdminStatus === 'up' ? 'down' : 'up';
            await updateInterface(iface.id, { ifAdminStatus: newStatus });
            addToast({
                type: 'success',
                title: 'Updated',
                message: `${iface.ifName} admin ${newStatus === 'up' ? 'enabled' : 'disabled'}`,
            });
            refetch();
        } catch {
            addToast({ type: 'error', title: 'Error', message: 'Failed to update interface' });
        } finally {
            setTogglingId(null);
        }
    };

    const handleTogglePolling = async (iface: InterfaceRecord) => {
        setTogglingId(iface.id);
        try {
            await updateInterface(iface.id, { pollingEnabled: !iface.pollingEnabled });
            addToast({
                type: 'success',
                title: 'Updated',
                message: `Polling ${!iface.pollingEnabled ? 'enabled' : 'disabled'} for ${iface.ifName}`,
            });
            refetch();
        } catch {
            addToast({ type: 'error', title: 'Error', message: 'Failed to toggle polling' });
        } finally {
            setTogglingId(null);
        }
    };

    if (loading && !data) return <DashboardSkeleton />;
    if (error || !data) return <ErrorState message={error || 'No data'} onRetry={refetch} />;

    const stats = data.stats;
    const interfaces = data.items;

    // Active filters for chips
    const activeFilters: { label: string; clear: () => void }[] = [];
    if (statusFilter) activeFilters.push({ label: `Status: ${statusFilter}`, clear: () => { setStatusFilter(''); setPage(1); } });
    if (typeFilter) activeFilters.push({ label: `Type: ${typeFilter}`, clear: () => { setTypeFilter(''); setPage(1); } });
    if (search) activeFilters.push({ label: `Search: "${search}"`, clear: () => { setSearch(''); setPage(1); } });

    return (
        <div className="space-y-6">
            <PageHeader
                title="Interfaces"
                subtitle={`${data.total} interfaces across devices`}
            />

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Total Interfaces"
                    value={stats.totalInterfaces.toLocaleString()}
                    icon={Activity}
                    iconBg="bg-blue-100"
                    iconColor="text-blue-600"
                />
                <MetricCard
                    label="Oper Up"
                    value={stats.totalUp.toLocaleString()}
                    icon={Power}
                    iconBg="bg-emerald-100"
                    iconColor="text-emerald-600"
                    trend={stats.totalInterfaces > 0 ? `${Math.round((stats.totalUp / stats.totalInterfaces) * 100)}%` : '0%'}
                    trendUp
                />
                <MetricCard
                    label="Oper Down"
                    value={stats.totalDown.toLocaleString()}
                    icon={PowerOff}
                    iconBg="bg-red-100"
                    iconColor="text-red-600"
                />
                <MetricCard
                    label="Filtered"
                    value={data.total.toLocaleString()}
                    icon={Gauge}
                    iconBg="bg-purple-100"
                    iconColor="text-purple-600"
                />
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search interface or device..."
                        className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-shadow placeholder:text-gray-400"
                    />
                </div>

                {/* Status filter */}
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 text-gray-600 cursor-pointer"
                >
                    <option value="">All Status</option>
                    <option value="up">Up</option>
                    <option value="down">Down</option>
                </select>

                {/* Type filter */}
                <select
                    value={typeFilter}
                    onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                    className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 text-gray-600 cursor-pointer"
                >
                    <option value="">All Types</option>
                    {data.filterOptions.types.map((t) => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>

                {/* Clear all */}
                {activeFilters.length > 0 && (
                    <button
                        onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setPage(1); }}
                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                        Clear all
                    </button>
                )}
            </div>

            {/* Filter chips */}
            {activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    {activeFilters.map((f) => (
                        <span
                            key={f.label}
                            className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                        >
                            {f.label}
                            <button onClick={f.clear} className="hover:text-blue-900 transition-colors">
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Table */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Device</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Interface</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Speed</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">MAC</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Admin</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Polling</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {interfaces.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-16 text-gray-400 text-sm">
                                        No interfaces found
                                    </td>
                                </tr>
                            ) : (
                                interfaces.map((iface) => (
                                    <tr
                                        key={iface.id}
                                        className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                                    >
                                        {/* Oper Status */}
                                        <td className="px-4 py-3">
                                            <StatusBadge status={iface.ifOperStatus || 'unknown'} />
                                        </td>

                                        {/* Device */}
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => router.push(`/devices/${iface.device.id}`)}
                                                className="text-left hover:text-blue-600 transition-colors"
                                            >
                                                <p className="font-medium text-gray-900">{iface.device.hostname}</p>
                                                <p className="text-[11px] text-gray-400 font-mono">{iface.device.ipAddress}</p>
                                            </button>
                                        </td>

                                        {/* Interface name */}
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-xs font-medium text-gray-900">{iface.ifName || `ifIndex:${iface.ifIndex}`}</span>
                                        </td>

                                        {/* Description / Alias */}
                                        <td className="px-4 py-3">
                                            <span className="text-xs text-gray-500 line-clamp-1 max-w-[200px] block">
                                                {iface.ifAlias || iface.ifDescr || '—'}
                                            </span>
                                        </td>

                                        {/* Type */}
                                        <td className="px-4 py-3">
                                            <span className="text-xs text-gray-500">{iface.ifType || '—'}</span>
                                        </td>

                                        {/* Speed */}
                                        <td className="px-4 py-3">
                                            <span className="text-xs font-medium text-gray-700">
                                                {formatSpeed(iface.ifHighSpeed ? Number(iface.ifHighSpeed) * 1_000_000 : iface.ifSpeed ? Number(iface.ifSpeed) : null)}
                                            </span>
                                        </td>

                                        {/* MAC */}
                                        <td className="px-4 py-3">
                                            <span className="text-[11px] font-mono text-gray-400">{iface.ifPhysAddress || '—'}</span>
                                        </td>

                                        {/* Admin status */}
                                        <td className="px-4 py-3">
                                            <StatusBadge status={iface.ifAdminStatus || 'unknown'} />
                                        </td>

                                        {/* Polling */}
                                        <td className="px-4 py-3">
                                            {iface.pollingEnabled ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                                    <ToggleRight className="h-3.5 w-3.5" /> On
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-medium">
                                                    <ToggleLeft className="h-3.5 w-3.5" /> Off
                                                </span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => router.push(`/devices/${iface.device.id}`)}
                                                    className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
                                                    title="View Device"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleAdmin(iface)}
                                                    disabled={togglingId === iface.id}
                                                    className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-amber-600 disabled:opacity-50 transition-colors"
                                                    title={iface.ifAdminStatus === 'up' ? 'Admin Down' : 'Admin Up'}
                                                >
                                                    {togglingId === iface.id ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : iface.ifAdminStatus === 'up' ? (
                                                        <PowerOff className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <Power className="h-3.5 w-3.5" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleTogglePolling(iface)}
                                                    disabled={togglingId === iface.id}
                                                    className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-violet-600 disabled:opacity-50 transition-colors"
                                                    title={iface.pollingEnabled ? 'Disable Polling' : 'Enable Polling'}
                                                >
                                                    {iface.pollingEnabled ? (
                                                        <ToggleRight className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <ToggleLeft className="h-3.5 w-3.5" />
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {data.pages > 1 && (
                <div className="flex items-center justify-between px-1">
                    <p className="text-xs text-gray-500">
                        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.total)} of {data.total}
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        {Array.from({ length: data.pages }, (_, i) => i + 1)
                            .slice(Math.max(0, page - 3), Math.min(data.pages, page + 2))
                            .map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-50 text-gray-600'}`}
                                >
                                    {p}
                                </button>
                            ))
                        }
                        <button
                            onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                            disabled={page === data.pages}
                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
