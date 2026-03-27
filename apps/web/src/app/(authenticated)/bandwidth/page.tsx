'use client';

import { useState, useEffect } from 'react';
import {
    Activity, ArrowDownLeft, ArrowUpRight, BarChart3, Download,
    Clock, Wifi, AlertTriangle, TrendingUp, ChevronRight, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import {
    useBandwidthOverview,
    useTopInterfaces,
    fetchBandwidthReport,
    formatBps,
    formatBytes,
    exportToCsv,
} from '@/hooks/use-bandwidth';
import { api } from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */

interface DeviceOption {
    id: number;
    hostname: string;
    displayName?: string;
    ipAddress: string;
    status: string;
}

/* ─── Time Range Options ─────────────────────────────────── */

const TIME_RANGES = [
    { value: '1h', label: '1 Hour' },
    { value: '6h', label: '6 Hours' },
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
];

/* ─── Component ──────────────────────────────────────────── */

export default function BandwidthPage() {
    const [devices, setDevices] = useState<DeviceOption[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
    const [timeRange, setTimeRange] = useState('24h');
    const [exporting, setExporting] = useState(false);

    // Load devices
    useEffect(() => {
        api.get('/devices?limit=100')
            .then(res => {
                const items = res.data?.items || res.data?.data || [];
                setDevices(items);
                if (items.length > 0 && !selectedDevice) {
                    setSelectedDevice(items[0].id);
                }
            })
            .catch(() => { });
    }, []);

    // Hooks
    const { data: overview, loading: overviewLoading } = useBandwidthOverview(selectedDevice, timeRange);
    const { data: topInterfaces, loading: topLoading } = useTopInterfaces(timeRange, 15);

    const handleExport = async () => {
        setExporting(true);
        try {
            const rows = await fetchBandwidthReport(timeRange, selectedDevice || undefined);
            const dateStr = new Date().toISOString().split('T')[0];
            exportToCsv(rows, `bandwidth_report_${dateStr}.csv`);
        } catch (err) {
            console.error('Export failed', err);
        } finally {
            setExporting(false);
        }
    };

    const summary = overview?.summary;

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Link href="/dashboard" className="hover:text-primary">Dashboard</Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground">Bandwidth Monitor</span>
            </nav>

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight">Bandwidth Monitor</h2>
                    <p className="mt-1 text-muted-foreground">Real-time bandwidth usage and detailed traffic reports</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Device Selector */}
                    <select
                        value={selectedDevice || ''}
                        onChange={e => setSelectedDevice(Number(e.target.value) || null)}
                        className="px-3 py-2 rounded-lg border border-border/50 bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    >
                        {devices.map(d => (
                            <option key={d.id} value={d.id}>
                                {d.displayName || d.hostname} ({d.ipAddress})
                            </option>
                        ))}
                    </select>

                    {/* Time Range */}
                    <div className="flex rounded-lg border border-border/50 overflow-hidden">
                        {TIME_RANGES.map(tr => (
                            <button
                                key={tr.value}
                                onClick={() => setTimeRange(tr.value)}
                                className={`px-3 py-2 text-xs font-semibold transition-colors ${
                                    timeRange === tr.value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-background hover:bg-accent text-muted-foreground'
                                }`}
                            >
                                {tr.label}
                            </button>
                        ))}
                    </div>

                    {/* Export */}
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard
                    icon={ArrowDownLeft}
                    label="Average Download"
                    value={formatBps(summary?.avg_in_bps)}
                    sub={`Peak: ${formatBps(summary?.peak_in_bps)}`}
                    color="text-blue-500"
                    bgColor="bg-blue-500/10"
                />
                <SummaryCard
                    icon={ArrowUpRight}
                    label="Average Upload"
                    value={formatBps(summary?.avg_out_bps)}
                    sub={`Peak: ${formatBps(summary?.peak_out_bps)}`}
                    color="text-emerald-500"
                    bgColor="bg-emerald-500/10"
                />
                <SummaryCard
                    icon={Activity}
                    label="Total Transferred"
                    value={formatBytes((summary?.total_in_bytes || 0) + (summary?.total_out_bytes || 0))}
                    sub={`↓ ${formatBytes(summary?.total_in_bytes)} ↑ ${formatBytes(summary?.total_out_bytes)}`}
                    color="text-purple-500"
                    bgColor="bg-purple-500/10"
                />
                <SummaryCard
                    icon={Wifi}
                    label="Avg Utilization"
                    value={`${((summary?.avg_in_util || 0) + (summary?.avg_out_util || 0)).toFixed(1)}%`}
                    sub={`${summary?.interfaces_count || 0} active interfaces`}
                    color="text-amber-500"
                    bgColor="bg-amber-500/10"
                />
            </div>

            {/* Traffic Chart */}
            <div className="bg-card rounded-xl border border-border/30 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-border/30 bg-accent/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <BarChart3 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold">Traffic Over Time</h3>
                            <p className="text-xs text-muted-foreground">Aggregate bandwidth across all interfaces</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Inbound</span>
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Outbound</span>
                    </div>
                </div>
                <div className="p-5">
                    {overviewLoading ? (
                        <div className="h-64 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : overview?.timeSeries.length ? (
                        <TrafficChart data={overview.timeSeries} />
                    ) : (
                        <div className="h-64 flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                                <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No traffic data available</p>
                                <p className="text-xs mt-1">Enable polling on device interfaces to collect bandwidth data</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Two Column: Per-Interface + Top Interfaces */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Per-Interface Breakdown */}
                <div className="bg-card rounded-xl border border-border/30 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-border/30 bg-accent/30 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <Wifi className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                            <h3 className="font-bold">Interface Breakdown</h3>
                            <p className="text-xs text-muted-foreground">Per-interface bandwidth for selected device</p>
                        </div>
                    </div>
                    <div className="divide-y divide-border/30 max-h-[500px] overflow-y-auto">
                        {overviewLoading ? (
                            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : overview?.interfaces.length ? (
                            overview.interfaces.map((iface, idx) => (
                                <div key={idx} className="p-4 hover:bg-accent/30 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`h-2 w-2 rounded-full shrink-0 ${iface.oper_status === 'up' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                            <span className="font-semibold text-sm truncate">{iface.if_name || iface.if_descr}</span>
                                            {iface.if_alias && <span className="text-xs text-muted-foreground truncate">({iface.if_alias})</span>}
                                        </div>
                                        <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatBps(iface.if_speed || 0)} link</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="text-blue-500 font-medium">↓ In</span>
                                                <span className="font-semibold">{formatBps(iface.avg_in_bps)}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(iface.avg_in_util || 0, 100)}%` }} />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="text-emerald-500 font-medium">↑ Out</span>
                                                <span className="font-semibold">{formatBps(iface.avg_out_bps)}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(iface.avg_out_util || 0, 100)}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                    {(iface.total_in_errors > 0 || iface.total_out_errors > 0) && (
                                        <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                                            <AlertTriangle className="h-3 w-3" />
                                            {iface.total_in_errors + iface.total_out_errors} errors detected
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-muted-foreground text-sm">No interface data available</div>
                        )}
                    </div>
                </div>

                {/* Top Interfaces (All Devices) */}
                <div className="bg-card rounded-xl border border-border/30 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-border/30 bg-accent/30 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                            <TrendingUp className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                            <h3 className="font-bold">Top Interfaces</h3>
                            <p className="text-xs text-muted-foreground">Highest bandwidth across all devices</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        {topLoading ? (
                            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : topInterfaces.length ? (
                            <table className="w-full text-sm">
                                <thead className="bg-accent/50 sticky top-0">
                                    <tr>
                                        <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground">#</th>
                                        <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground">Device / Interface</th>
                                        <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground">Avg In</th>
                                        <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground">Avg Out</th>
                                        <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground">Peak</th>
                                        <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground">Util</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {topInterfaces.map((iface, idx) => (
                                        <tr key={idx} className="hover:bg-accent/30 transition-colors">
                                            <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                                            <td className="px-4 py-3">
                                                <div className="font-semibold truncate max-w-[200px]">{iface.device_name}</div>
                                                <div className="text-xs text-muted-foreground">{iface.if_name} {iface.if_alias ? `(${iface.if_alias})` : ''}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-blue-500">{formatBps(iface.avg_in_bps)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-emerald-500">{formatBps(iface.avg_out_bps)}</td>
                                            <td className="px-4 py-3 text-right font-mono">{formatBps(iface.peak_total_bps)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                    (iface.avg_in_util + iface.avg_out_util) / 2 > 80
                                                        ? 'bg-red-100 text-red-700'
                                                        : (iface.avg_in_util + iface.avg_out_util) / 2 > 50
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                    {((iface.avg_in_util + iface.avg_out_util) / 2).toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-8 text-center text-muted-foreground text-sm">No interface data available</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Summary Card Component ─────────────────────────────── */

function SummaryCard({ icon: Icon, label, value, sub, color, bgColor }: {
    icon: any; label: string; value: string; sub: string; color: string; bgColor: string;
}) {
    return (
        <div className="bg-card rounded-xl border border-border/30 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${bgColor}`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
            </div>
            <div className="text-2xl font-extrabold tracking-tight">{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{sub}</div>
        </div>
    );
}

/* ─── Traffic Chart (CSS-based bar chart) ────────────────── */

function TrafficChart({ data }: { data: any[] }) {
    if (!data.length) return null;

    const maxBps = Math.max(
        ...data.map(d => Math.max(d.total_in_bps || 0, d.total_out_bps || 0)),
        1,
    );

    // Show max ~60 bars
    const step = Math.max(1, Math.floor(data.length / 60));
    const sampled = data.filter((_, i) => i % step === 0);

    return (
        <div className="space-y-3">
            <div className="flex items-end gap-px h-48" style={{ minWidth: sampled.length * 8 }}>
                {sampled.map((d, idx) => {
                    const inH = maxBps > 0 ? (d.total_in_bps / maxBps) * 100 : 0;
                    const outH = maxBps > 0 ? (d.total_out_bps / maxBps) * 100 : 0;
                    return (
                        <div key={idx} className="flex-1 flex gap-px items-end min-w-[4px] group relative" title={`${new Date(d.bucket).toLocaleTimeString()} — In: ${formatBps(d.total_in_bps)}, Out: ${formatBps(d.total_out_bps)}`}>
                            <div
                                className="flex-1 bg-blue-500/80 rounded-t-sm transition-all hover:bg-blue-500"
                                style={{ height: `${Math.max(inH, 1)}%` }}
                            />
                            <div
                                className="flex-1 bg-emerald-500/80 rounded-t-sm transition-all hover:bg-emerald-500"
                                style={{ height: `${Math.max(outH, 1)}%` }}
                            />
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>{data[0]?.bucket ? new Date(data[0].bucket).toLocaleString() : ''}</span>
                <span className="text-center font-medium">Peak: {formatBps(maxBps)}</span>
                <span>{data[data.length - 1]?.bucket ? new Date(data[data.length - 1].bucket).toLocaleString() : ''}</span>
            </div>
        </div>
    );
}
