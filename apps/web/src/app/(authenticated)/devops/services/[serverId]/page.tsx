'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Settings, CheckCircle2, XCircle, AlertTriangle,
    Search, RefreshCw, Play, Square, RotateCw, Clock,
    ChevronRight, Server, Terminal, Loader2, Filter,
} from 'lucide-react';
import { useServerServices, useCommandHistory, executeServiceAction } from '@/hooks/use-devops';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast';

const stateConfig: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
    active: { color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
    inactive: { color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200', icon: Square },
    failed: { color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: XCircle },
    activating: { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: Loader2 },
    deactivating: { color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: Loader2 },
};

type FilterType = 'all' | 'active' | 'inactive' | 'failed';

export default function ServerServicesPage() {
    const params = useParams();
    const router = useRouter();
    const serverId = Number(params.serverId);
    const { data, loading, error, refetch } = useServerServices(serverId);
    const { data: commands, refetch: refetchCommands } = useCommandHistory(serverId);
    const { addToast } = useToast();

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<FilterType>('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);

    if (loading && !data) return <DashboardSkeleton />;
    if (error || !data) return <ErrorState message={error || 'Server not found'} onRetry={refetch} />;

    const { server, services } = data;

    const filteredServices = services.filter(svc => {
        if (filter !== 'all' && svc.active_state !== filter) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return svc.name.toLowerCase().includes(q) || svc.description.toLowerCase().includes(q);
    });

    const activeCount = services.filter(s => s.active_state === 'active').length;
    const inactiveCount = services.filter(s => s.active_state === 'inactive').length;
    const failedCount = services.filter(s => s.active_state === 'failed').length;

    const handleAction = async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
        setActionLoading(`${serviceName}-${action}`);
        try {
            await executeServiceAction(serverId, serviceName, action);
            addToast({
                type: 'success',
                title: `${action.charAt(0).toUpperCase() + action.slice(1)} Queued`,
                message: `Command "${action}" queued for ${serviceName}. Agent will execute on next poll.`,
            });
            refetchCommands();
        } catch (err: any) {
            addToast({
                type: 'error',
                title: 'Action Failed',
                message: err.response?.data?.message || `Failed to ${action} ${serviceName}`,
            });
        } finally {
            setActionLoading(null);
        }
    };

    const filters: { key: FilterType; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: services.length },
        { key: 'active', label: 'Active', count: activeCount },
        { key: 'inactive', label: 'Inactive', count: inactiveCount },
        { key: 'failed', label: 'Failed', count: failedCount },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/devops" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">{server.name}</h1>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                server.status === 'up' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                server.status === 'down' ? 'bg-red-50 text-red-700 border border-red-200' :
                                'bg-gray-50 text-gray-600 border border-gray-200'
                            }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${server.status === 'up' ? 'bg-emerald-500 animate-pulse' : server.status === 'down' ? 'bg-red-500' : 'bg-gray-400'}`} />
                                {server.status.toUpperCase()}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500">
                            {server.ip_address || server.hostname || 'No address'}
                            {server.os_info ? ` · ${server.os_info}` : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowHistory(!showHistory)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                        <Clock className="h-3.5 w-3.5" />
                        History
                    </button>
                    <Link href={`/server-monitor/${serverId}/terminal`}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors">
                        <Terminal className="h-3.5 w-3.5" />
                        Terminal
                    </Link>
                    <button onClick={refetch}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{services.length}</p>
                    <p className="text-xs text-gray-500 font-medium uppercase">Total Services</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{activeCount}</p>
                    <p className="text-xs text-emerald-600 font-medium uppercase">Active</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
                    <p className="text-2xl font-bold text-gray-700">{inactiveCount}</p>
                    <p className="text-xs text-gray-500 font-medium uppercase">Inactive</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                    <p className="text-2xl font-bold text-red-700">{failedCount}</p>
                    <p className="text-xs text-red-600 font-medium uppercase">Failed</p>
                </div>
            </div>

            {/* Command History Panel */}
            {showHistory && (
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-600" />
                            Command History
                        </h2>
                    </div>
                    {commands.length === 0 ? (
                        <div className="py-8 text-center text-sm text-gray-500">No commands executed yet</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                                        <th className="text-left px-5 py-3 font-semibold">Service</th>
                                        <th className="text-left px-5 py-3 font-semibold">Action</th>
                                        <th className="text-left px-5 py-3 font-semibold">Status</th>
                                        <th className="text-left px-5 py-3 font-semibold">When</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {commands.slice(0, 10).map(cmd => (
                                        <tr key={cmd.id} className="border-b border-gray-50">
                                            <td className="px-5 py-2.5 font-mono text-gray-900">{cmd.service_name}</td>
                                            <td className="px-5 py-2.5 capitalize text-gray-600">{cmd.action}</td>
                                            <td className="px-5 py-2.5">
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                    cmd.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                                    cmd.status === 'failed' ? 'bg-red-50 text-red-600' :
                                                    'bg-amber-50 text-amber-600'
                                                }`}>
                                                    {cmd.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-2.5 text-gray-400 text-xs">
                                                {new Date(cmd.created_at).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Search + Filter */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search services..."
                        className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-shadow placeholder:text-gray-400"
                    />
                </div>
                <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                    {filters.map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                                filter === f.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {f.label} ({f.count})
                        </button>
                    ))}
                </div>
            </div>

            {/* Services Table */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <Settings className="h-4 w-4 text-blue-600" />
                        Systemd Services ({filteredServices.length})
                    </h2>
                </div>

                {filteredServices.length === 0 ? (
                    <div className="py-16 text-center">
                        <Settings className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">
                            {services.length === 0
                                ? 'No services reported yet. Install the DevOps agent extension.'
                                : 'No services match your filter.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                                    <th className="text-left px-5 py-3 font-semibold">Status</th>
                                    <th className="text-left px-5 py-3 font-semibold">Service</th>
                                    <th className="text-left px-5 py-3 font-semibold">Description</th>
                                    <th className="text-left px-5 py-3 font-semibold">Sub State</th>
                                    <th className="text-left px-5 py-3 font-semibold">Enabled</th>
                                    <th className="text-right px-5 py-3 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredServices.map(svc => {
                                    const sc = stateConfig[svc.active_state] || stateConfig.inactive;
                                    const Icon = sc.icon;
                                    return (
                                        <tr key={svc.id || svc.name} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                            <td className="px-5 py-3">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize border ${sc.bg} ${sc.color}`}>
                                                    <Icon className={`h-3 w-3 ${svc.active_state === 'activating' || svc.active_state === 'deactivating' ? 'animate-spin' : ''}`} />
                                                    {svc.active_state}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <p className="font-mono font-medium text-gray-900">{svc.name}</p>
                                            </td>
                                            <td className="px-5 py-3 text-gray-500 max-w-[250px] truncate">
                                                {svc.description || '—'}
                                            </td>
                                            <td className="px-5 py-3 text-gray-500 capitalize">{svc.sub_state}</td>
                                            <td className="px-5 py-3">
                                                <span className={`text-xs font-semibold ${
                                                    svc.unit_file_state === 'enabled' ? 'text-emerald-600' :
                                                    svc.unit_file_state === 'disabled' ? 'text-gray-400' : 'text-gray-500'
                                                }`}>
                                                    {svc.unit_file_state}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    {svc.active_state !== 'active' && (
                                                        <button
                                                            onClick={() => handleAction(svc.name, 'start')}
                                                            disabled={actionLoading !== null}
                                                            className="p-1.5 rounded-md hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                                                            title="Start"
                                                        >
                                                            {actionLoading === `${svc.name}-start` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                                                        </button>
                                                    )}
                                                    {svc.active_state === 'active' && (
                                                        <button
                                                            onClick={() => handleAction(svc.name, 'stop')}
                                                            disabled={actionLoading !== null}
                                                            className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                                            title="Stop"
                                                        >
                                                            {actionLoading === `${svc.name}-stop` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleAction(svc.name, 'restart')}
                                                        disabled={actionLoading !== null}
                                                        className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                                                        title="Restart"
                                                    >
                                                        {actionLoading === `${svc.name}-restart` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
