'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Server, Settings, CheckCircle2, XCircle, AlertTriangle,
    Search, RefreshCw, ChevronRight, Activity, Terminal,
    Play, Square, RotateCw, Shield,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { useDevopsOverview } from '@/hooks/use-devops';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
    up: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
    down: { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500' },
    unknown: { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400' },
};

export default function DevopsPage() {
    const router = useRouter();
    const { data, loading, error, refetch } = useDevopsOverview();
    const [search, setSearch] = useState('');

    if (loading && !data) return <DashboardSkeleton />;
    if (error || !data) return <ErrorState message={error || 'No data'} onRetry={refetch} />;

    const filteredServers = data.servers.filter(s => {
        if (!search) return true;
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q)
            || (s.ip_address || '').toLowerCase().includes(q)
            || (s.hostname || '').toLowerCase().includes(q);
    });

    return (
        <div className="space-y-6">
            <PageHeader
                title="DevOps"
                subtitle="Manage services, pipelines, and infrastructure"
            >
                <button
                    onClick={refetch}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </button>
            </PageHeader>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <MetricCard label="Total Servers" value={data.totalServers} icon={Server} />
                <MetricCard label="Servers Up" value={data.serversUp} icon={CheckCircle2} />
                <MetricCard label="Servers Down" value={data.serversDown} icon={XCircle} />
                <MetricCard label="Total Services" value={data.totalServices} icon={Settings} />
                <MetricCard label="Active Services" value={data.activeServices} icon={Activity} />
                <MetricCard label="Failed Services" value={data.failedServices} icon={AlertTriangle} />
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-purple-50 to-white p-5 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => router.push('/devops/git')}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="rounded-lg bg-purple-100 p-2.5">
                            <Shield className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Git & CI/CD</h3>
                            <p className="text-xs text-gray-500">Repositories & Pipelines</p>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600">Manage repositories, view CI/CD pipelines, trigger deployments.</p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white p-5 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => router.push('/devops/k8s')}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="rounded-lg bg-blue-100 p-2.5">
                            <Terminal className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Kubernetes</h3>
                            <p className="text-xs text-gray-500">Clusters & Deployments</p>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600">Monitor Kubernetes clusters, manage pods and deployments.</p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-amber-50 to-white p-5 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => document.getElementById('server-list')?.scrollIntoView({ behavior: 'smooth' })}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="rounded-lg bg-amber-100 p-2.5">
                            <Settings className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Services</h3>
                            <p className="text-xs text-gray-500">Systemd Units</p>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600">Manage systemd services on monitored servers. Start, stop, restart.</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search servers..."
                    className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-shadow placeholder:text-gray-400"
                />
            </div>

            {/* Server Cards Grid */}
            <div id="server-list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredServers.map(server => {
                    const sc = statusColors[server.status] || statusColors.unknown;
                    return (
                        <div
                            key={server.server_id}
                            className="rounded-xl border border-gray-200 bg-white p-5 transition-all hover:shadow-lg hover:scale-[1.01] cursor-pointer group"
                            onClick={() => router.push(`/devops/services/${server.server_id}`)}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="rounded-lg bg-blue-50 p-2 text-blue-600 flex-shrink-0">
                                        <Server className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-gray-900 truncate">{server.name}</h3>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {server.ip_address || server.hostname || 'No address'}
                                        </p>
                                    </div>
                                </div>
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${sc.bg} ${sc.text}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${sc.dot} ${server.status === 'up' ? 'animate-pulse' : ''}`} />
                                    {server.status.toUpperCase()}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-center mb-3">
                                <div className="rounded-lg bg-gray-50 p-2">
                                    <p className="text-xs text-gray-500">Type</p>
                                    <p className="text-sm font-semibold text-gray-900 capitalize">
                                        {server.server_type === 'linux' ? '🐧 Linux' : '🪟 Windows'}
                                    </p>
                                </div>
                                <div className="rounded-lg bg-gray-50 p-2">
                                    <p className="text-xs text-gray-500">Location</p>
                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                        {server.location_name || '—'}
                                    </p>
                                </div>
                            </div>

                            {server.os_info && (
                                <p className="text-[10px] text-gray-400 truncate">{server.os_info}</p>
                            )}

                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                                <div className="flex items-center gap-2">
                                    <button className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                                        onClick={(e) => { e.stopPropagation(); router.push(`/devops/services/${server.server_id}`); }}
                                        title="Manage Services">
                                        <Settings className="h-3.5 w-3.5" />
                                    </button>
                                    <button className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                        onClick={(e) => { e.stopPropagation(); router.push(`/server-monitor/${server.server_id}/terminal`); }}
                                        title="Terminal">
                                        <Terminal className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredServers.length === 0 && (
                <div className="text-center py-16">
                    <Server className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No servers found</p>
                    <p className="text-sm text-gray-400 mt-1">Add servers in the Server Monitor section first.</p>
                </div>
            )}
        </div>
    );
}
