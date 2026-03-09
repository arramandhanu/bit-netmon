'use client';

import {
    Server,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    MapPin,
    Activity,
    Clock,
    TrendingUp,
    ChevronRight,
    Cpu,
    Wifi,
    Ticket,
    Shield,
    Search,
    Router,
} from 'lucide-react';
import Link from 'next/link';
import { useDashboard } from '@/hooks/use-dashboard';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { MetricCard } from '@/components/ui/metric-card';
import { getStoredUser } from '@/hooks/use-auth';

export default function DashboardPage() {
    const { data, loading, error, refetch } = useDashboard();
    const currentUser = getStoredUser();
    const userRole = currentUser?.role || 'viewer';
    const isAdminMode = userRole === 'admin' || userRole === 'operator';

    if (loading) return <DashboardSkeleton />;
    if (error || !data) return <ErrorState message={error || 'No data'} onRetry={refetch} />;

    const recentAlerts = data.metrics
        .filter(m => m.device_status === 'down' || (m.cpu_utilization && m.cpu_utilization > 80))
        .slice(0, 5)
        .map((m, i) => ({
            id: i,
            severity: m.device_status === 'down' ? 'critical' : 'warning',
            device: `Device #${m.device_id}`,
            message: m.device_status === 'down'
                ? 'Device unreachable'
                : `CPU usage ${m.cpu_utilization}%`,
            time: new Date(m.time).toLocaleTimeString(),
        }));

    const severityStyle: Record<string, { color: string; bg: string; border: string; dot: string }> = {
        critical: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-500' },
        warning: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-500' },
        info: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', dot: 'bg-blue-500' },
    };

    return (
        <div className="space-y-6">
            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Total Devices"
                    value={data.totalDevices.toLocaleString()}
                    icon={Server}
                    iconBg="bg-blue-100"
                    iconColor="text-blue-600"
                    detail={`${data.devicesUp} up · ${data.devicesDown} down`}
                />
                <MetricCard
                    label="Devices Online"
                    value={data.devicesUp.toLocaleString()}
                    icon={CheckCircle2}
                    iconBg="bg-emerald-100"
                    iconColor="text-emerald-600"
                    detail={`${data.totalDevices > 0 ? ((data.devicesUp / data.totalDevices) * 100).toFixed(1) : 0}% uptime`}
                />
                <MetricCard
                    label="Devices Offline"
                    value={data.devicesDown.toLocaleString()}
                    icon={XCircle}
                    iconBg="bg-red-100"
                    iconColor="text-red-600"
                    detail={data.devicesDown > 0 ? 'Requires attention' : 'All clear'}
                />
                <MetricCard
                    label="Avg CPU / Memory"
                    value={`${data.avgCpu}% / ${data.avgMemory}%`}
                    icon={Activity}
                    iconBg="bg-purple-100"
                    iconColor="text-purple-600"
                    detail="Across all devices"
                />
            </div>

            {/* Secondary KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Locations"
                    value={data.totalLocations.toLocaleString()}
                    icon={MapPin}
                    iconBg="bg-orange-100"
                    iconColor="text-orange-600"
                    detail={`${data.activeLocations} active locations`}
                />
                <MetricCard
                    label="Interfaces"
                    value={data.totalInterfaces.toLocaleString()}
                    icon={Router}
                    iconBg="bg-teal-100"
                    iconColor="text-teal-600"
                    detail={data.interfacesDown > 0 ? `${data.interfacesDown} down` : 'All interfaces up'}
                />
                <MetricCard
                    label="Wireless"
                    value={`${data.clientsConnected}`}
                    icon={Wifi}
                    iconBg="bg-cyan-100"
                    iconColor="text-cyan-600"
                    detail={`${data.totalAps} Access Points online`}
                />
                <MetricCard
                    label="Open Tickets"
                    value={data.openTickets.toLocaleString()}
                    icon={Ticket}
                    iconBg="bg-pink-100"
                    iconColor="text-pink-600"
                    detail="Awaiting resolution"
                />
            </div>

            {/* Two columns: alerts + top CPU */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Alerts */}
                <div className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                            <h2 className="font-semibold">Issues Detected</h2>
                        </div>
                        <Link href="/alerts" className="flex items-center gap-1 text-xs text-primary hover:underline">
                            View all <ChevronRight className="h-3 w-3" />
                        </Link>
                    </div>
                    <div className="divide-y divide-border/30">
                        {recentAlerts.length === 0 ? (
                            <div className="p-8 text-center text-sm text-muted-foreground">
                                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400 opacity-50" />
                                No active issues
                            </div>
                        ) : (
                            recentAlerts.map((alert) => {
                                const style = severityStyle[alert.severity] || severityStyle.info;
                                return (
                                    <div key={alert.id} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50 transition-colors">
                                        <div className={`h-2 w-2 rounded-full ${style.dot}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{alert.device}</p>
                                            <p className="text-xs text-muted-foreground truncate">{alert.message}</p>
                                        </div>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">{alert.time}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Top CPU Usage */}
                <div className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-blue-400" />
                            <h2 className="font-semibold">Top CPU Usage</h2>
                        </div>
                        <Link href="/devices" className="flex items-center gap-1 text-xs text-primary hover:underline">
                            All devices <ChevronRight className="h-3 w-3" />
                        </Link>
                    </div>
                    <div className="divide-y divide-border/30">
                        {data.topCpuDevices.length === 0 ? (
                            <div className="p-8 text-center text-sm text-muted-foreground">No CPU data available</div>
                        ) : (
                            data.topCpuDevices.map((device) => (
                                <div key={device.device_id} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">Device #{device.device_id}</p>
                                    </div>
                                    <div className="flex items-center gap-2 w-40">
                                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${(device.cpu_utilization || 0) > 80 ? 'bg-red-500' :
                                                    (device.cpu_utilization || 0) > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                                                    }`}
                                                style={{ width: `${device.cpu_utilization || 0}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-muted-foreground w-10 text-right">
                                            {device.cpu_utilization || 0}%
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Row: Recent Tickets & Admin Tools */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Tickets Widget */}
                <div className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                            <Ticket className="h-4 w-4 text-pink-400" />
                            <h2 className="font-semibold">Recent Tickets</h2>
                        </div>
                        <Link href="/tickets" className="flex items-center gap-1 text-xs text-primary hover:underline">
                            View all <ChevronRight className="h-3 w-3" />
                        </Link>
                    </div>
                    <div className="divide-y divide-border/30">
                        {data.recentTickets.length === 0 ? (
                            <div className="p-8 text-center text-sm text-muted-foreground">No open tickets</div>
                        ) : (
                            data.recentTickets.map((ticket: any) => (
                                <Link key={ticket.id} href={`/tickets?id=${ticket.id}`}>
                                    <div className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50 transition-colors cursor-pointer">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{ticket.title}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {ticket.device?.hostname ? `Device: ${ticket.device.hostname}` : 'General Issue'}
                                            </p>
                                        </div>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            {new Date(ticket.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>

                {/* Admin Operations Placeholder */}
                {isAdminMode && (
                    <div className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-purple-400" />
                                <h2 className="font-semibold">Admin Overview</h2>
                            </div>
                        </div>
                        <div className="p-5 flex flex-col gap-4">
                            <div className="flex items-center justify-between bg-accent/30 rounded-lg p-4 border border-border/50">
                                <div className="flex items-center gap-3">
                                    <Search className="h-5 w-5 text-indigo-500" />
                                    <div>
                                        <p className="text-sm font-medium">Recent Discoveries</p>
                                        <p className="text-xs text-muted-foreground">0 devices found</p>
                                    </div>
                                </div>
                                <Link href="/admin/discovery" className="text-xs text-primary hover:underline">Manage</Link>
                            </div>
                            <div className="flex items-center justify-between bg-accent/30 rounded-lg p-4 border border-border/50">
                                <div className="flex items-center gap-3">
                                    <Shield className="h-5 w-5 text-rose-500" />
                                    <div>
                                        <p className="text-sm font-medium">Security Events</p>
                                        <p className="text-xs text-muted-foreground">0 new alerts</p>
                                    </div>
                                </div>
                                <Link href="/admin/security" className="text-xs text-primary hover:underline">Review</Link>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

