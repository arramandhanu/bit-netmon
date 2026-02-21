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
} from 'lucide-react';
import Link from 'next/link';
import { useDashboard } from '@/hooks/use-dashboard';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

export default function DashboardPage() {
    const { data, loading, error, refetch } = useDashboard();

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
                <KpiCard
                    label="Total Devices"
                    value={data.totalDevices.toLocaleString()}
                    icon={Server}
                    gradient="from-blue-600 to-blue-400"
                    iconColor="text-blue-400"
                    detail={`${data.devicesUp} up · ${data.devicesDown} down`}
                />
                <KpiCard
                    label="Devices Online"
                    value={data.devicesUp.toLocaleString()}
                    icon={CheckCircle2}
                    gradient="from-emerald-600 to-emerald-400"
                    iconColor="text-emerald-400"
                    detail={`${data.totalDevices > 0 ? ((data.devicesUp / data.totalDevices) * 100).toFixed(1) : 0}% uptime`}
                />
                <KpiCard
                    label="Devices Offline"
                    value={data.devicesDown.toLocaleString()}
                    icon={XCircle}
                    gradient="from-red-600 to-red-400"
                    iconColor="text-red-400"
                    detail={data.devicesDown > 0 ? 'Requires attention' : 'All clear'}
                    alert={data.devicesDown > 0}
                />
                <KpiCard
                    label="Avg CPU / Memory"
                    value={`${data.avgCpu}% / ${data.avgMemory}%`}
                    icon={Activity}
                    gradient="from-purple-600 to-purple-400"
                    iconColor="text-purple-400"
                    detail="Across all devices"
                />
            </div>

            {/* Two columns: alerts + top CPU */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Alerts */}
                <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b border-border/50">
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
                <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b border-border/50">
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
        </div>
    );
}

/* ─── KPI Card ───────────────────────────────────────────── */

function KpiCard({
    label,
    value,
    icon: Icon,
    gradient,
    iconColor,
    detail,
    alert = false,
}: {
    label: string;
    value: string;
    icon: React.ElementType;
    gradient: string;
    iconColor: string;
    detail: string;
    alert?: boolean;
}) {
    return (
        <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 transition-all hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.01]">
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity`} />
            <div className="relative flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">{label}</p>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} bg-opacity-10`}>
                    <Icon className={`h-[18px] w-[18px] ${iconColor}`} />
                </div>
            </div>
            <p className={`relative text-2xl font-bold tracking-tight ${alert ? 'text-red-400' : ''}`}>
                {value}
            </p>
            <p className="relative text-xs text-muted-foreground mt-1">{detail}</p>
        </div>
    );
}
