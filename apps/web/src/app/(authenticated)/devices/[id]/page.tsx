'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Clock, Gauge, Wifi,
    Activity, Pencil, Trash2, RefreshCw,
    Globe, Terminal, Settings, ChevronRight,
    Cpu, HardDrive, Network, BarChart3, Router, MonitorDot,
} from 'lucide-react';
import { useDevice, deleteDevice } from '@/hooks/use-devices';
import {
    useDeviceMetrics,
    useLatestDeviceMetrics,
    useInterfaceMetrics,
    triggerDevicePoll,
    TIME_RANGES,
} from '@/hooks/use-metrics';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast';

/* ─── Helpers ────────────────────────────────────────────── */

function formatUptime(seconds: number | null): string {
    if (!seconds) return '—';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
}

function formatSpeed(speed: number | null): string {
    if (!speed) return '—';
    if (speed >= 1e9) return `${(speed / 1e9).toFixed(0)} Gbps`;
    if (speed >= 1e6) return `${(speed / 1e6).toFixed(0)} Mbps`;
    if (speed >= 1e3) return `${(speed / 1e3).toFixed(0)} Kbps`;
    return `${speed} bps`;
}

function formatBps(b: number): string {
    if (b >= 1e9) return (b / 1e9).toFixed(1) + ' Gbps';
    if (b >= 1e6) return (b / 1e6).toFixed(1) + ' Mbps';
    if (b >= 1e3) return (b / 1e3).toFixed(1) + ' Kbps';
    return b.toFixed(0) + ' bps';
}

function formatBpsShort(b: number): string {
    if (b >= 1e9) return (b / 1e9).toFixed(1) + 'G';
    if (b >= 1e6) return (b / 1e6).toFixed(1) + 'M';
    if (b >= 1e3) return (b / 1e3).toFixed(1) + 'K';
    return b.toFixed(0);
}

function formatBytes(b: number | null): string {
    if (!b) return '—';
    if (b >= 1e12) return (b / 1e12).toFixed(1) + ' TB';
    if (b >= 1e9) return (b / 1e9).toFixed(0) + ' GB';
    if (b >= 1e6) return (b / 1e6).toFixed(0) + ' MB';
    return (b / 1e3).toFixed(0) + ' KB';
}

/* ─── RRD-Style Metric Chart Panel ───────────────────────── */

function MetricChartPanel({ title, icon: Icon, data, unit, color, maxVal, label }: {
    title: string;
    icon: any;
    data: [number, number][];
    unit: string;
    color: string;
    maxVal?: number;
    label?: string;
}) {
    const chartRef = useRef<HTMLDivElement>(null);
    const hasData = data.length > 0;
    const latestVal = hasData ? data[data.length - 1][1] : 0;

    useEffect(() => {
        if (!chartRef.current || !hasData) return;
        let instance: any = null;

        import('echarts').then((echarts) => {
            if (!chartRef.current) return;
            instance = echarts.init(chartRef.current);

            instance.setOption({
                backgroundColor: '#fafafa',
                animation: false,
                tooltip: {
                    trigger: 'axis',
                    backgroundColor: '#fff',
                    borderColor: '#d4d4d4',
                    textStyle: { color: '#1e293b', fontSize: 11 },
                    valueFormatter: (v: number) => `${v.toFixed(1)}${unit}`,
                },
                grid: { left: 45, right: 16, top: 12, bottom: 32 },
                xAxis: {
                    type: 'time',
                    axisLine: { lineStyle: { color: '#999' } },
                    axisTick: { lineStyle: { color: '#999' } },
                    axisLabel: {
                        color: '#555',
                        fontSize: 10,
                        formatter: (val: number) => {
                            const d = new Date(val);
                            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                            return `${days[d.getDay()]} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                        },
                    },
                    splitLine: {
                        show: true,
                        lineStyle: { color: '#f0c0c0', type: 'solid', width: 0.5 },
                    },
                },
                yAxis: {
                    type: 'value',
                    max: maxVal || undefined,
                    min: 0,
                    axisLine: { lineStyle: { color: '#999' } },
                    axisTick: { lineStyle: { color: '#999' } },
                    axisLabel: { color: '#555', fontSize: 10, formatter: `{value}` },
                    splitLine: {
                        show: true,
                        lineStyle: { color: '#f0c0c0', type: 'solid', width: 0.5 },
                    },
                },
                series: [{
                    type: 'line',
                    data,
                    step: false,
                    smooth: false,
                    symbol: 'none',
                    lineStyle: { color, width: 0.5 },
                    areaStyle: { color, opacity: 0.85 },
                }],
            });

            const onResize = () => instance?.resize();
            window.addEventListener('resize', onResize);
            return () => window.removeEventListener('resize', onResize);
        });

        return () => { instance?.dispose(); };
    }, [data, unit, color, maxVal, hasData]);

    const pct = maxVal ? (latestVal / maxVal) * 100 : 0;

    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <Icon className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-bold text-blue-600">{title}</h3>
            </div>
            {hasData ? (
                <>
                    <div ref={chartRef} className="h-48 w-full" />
                    {/* RRD-style utilization bar */}
                    {maxVal && (
                        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-3">
                            <span className="text-xs text-gray-600 font-medium truncate flex-shrink-0">{label || title}</span>
                            <div className="flex-grow h-3 bg-gray-200 rounded-sm overflow-hidden">
                                <div
                                    className="h-full rounded-sm transition-all"
                                    style={{
                                        width: `${Math.min(pct, 100)}%`,
                                        backgroundColor: pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#84cc16',
                                    }}
                                />
                            </div>
                            <span className="text-xs font-bold text-gray-700 flex-shrink-0">{latestVal.toFixed(0)}{unit}</span>
                        </div>
                    )}
                </>
            ) : (
                <div className="h-48 flex flex-col items-center justify-center text-gray-400 text-sm">
                    <p>No data yet</p>
                    <p className="text-xs">Waiting for SNMP polling...</p>
                </div>
            )}
        </div>
    );
}

/* ─── Per-Interface Traffic Panel (RRD-style) ────────────── */

function InterfaceTrafficPanel({ deviceId, iface, rangeIdx, hours }: {
    deviceId: string; iface: any; rangeIdx: number; hours: number;
}) {
    const { data } = useInterfaceMetrics(deviceId, iface.ifIndex, rangeIdx);
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartRef.current || data.length === 0) return;
        let instance: any = null;

        import('echarts').then((echarts) => {
            if (!chartRef.current) return;
            instance = echarts.init(chartRef.current);

            const inData = data.map((r: any) => [new Date(r.bucket).getTime(), r.avg_in_bps || 0]);
            const outData = data.map((r: any) => [new Date(r.bucket).getTime(), r.avg_out_bps || 0]);

            instance.setOption({
                backgroundColor: '#fafafa',
                animation: false,
                tooltip: {
                    trigger: 'axis',
                    backgroundColor: '#fff',
                    borderColor: '#d4d4d4',
                    textStyle: { color: '#1e293b', fontSize: 11 },
                    valueFormatter: (v: number) => formatBps(v),
                },
                legend: { show: false },
                grid: { left: 55, right: 16, top: 12, bottom: 32 },
                xAxis: {
                    type: 'time',
                    axisLine: { lineStyle: { color: '#999' } },
                    axisTick: { lineStyle: { color: '#999' } },
                    axisLabel: {
                        color: '#555',
                        fontSize: 10,
                        formatter: (val: number) => {
                            const d = new Date(val);
                            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                            return `${days[d.getDay()]} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                        },
                    },
                    splitLine: {
                        show: true,
                        lineStyle: { color: '#f0c0c0', type: 'solid', width: 0.5 },
                    },
                },
                yAxis: {
                    type: 'value',
                    min: 0,
                    axisLine: { lineStyle: { color: '#999' } },
                    axisTick: { lineStyle: { color: '#999' } },
                    axisLabel: { color: '#555', fontSize: 10, formatter: (v: number) => formatBpsShort(v) },
                    splitLine: {
                        show: true,
                        lineStyle: { color: '#f0c0c0', type: 'solid', width: 0.5 },
                    },
                },
                series: [
                    {
                        name: 'Inbound',
                        type: 'line',
                        data: inData,
                        smooth: false,
                        symbol: 'none',
                        lineStyle: { color: '#00cc00', width: 0.5 },
                        areaStyle: { color: '#00cc00', opacity: 0.7 },
                    },
                    {
                        name: 'Outbound',
                        type: 'line',
                        data: outData,
                        smooth: false,
                        symbol: 'none',
                        lineStyle: { color: '#0000ff', width: 0.5 },
                        areaStyle: { color: '#0000ff', opacity: 0.4 },
                    },
                ],
            });

            const onResize = () => instance?.resize();
            window.addEventListener('resize', onResize);
            return () => window.removeEventListener('resize', onResize);
        });

        return () => { instance?.dispose(); };
    }, [data, hours]);

    // Calculate latest values
    const latest = data.length > 0 ? data[data.length - 1] : null;
    const inBps = latest?.avg_in_bps || 0;
    const outBps = latest?.avg_out_bps || 0;
    const hasData = data.length > 0;
    const isUp = iface.ifOperStatus === 'up';

    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-blue-500" />
                    <h3 className="text-sm font-bold text-blue-600">
                        {iface.ifName || `if${iface.ifIndex}`}
                        {iface.ifAlias && <span className="text-gray-400 font-normal ml-1">— {iface.ifAlias}</span>}
                    </h3>
                    <span className={`ml-1 w-2 h-2 rounded-full ${isUp ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
            </div>
            {hasData ? (
                <>
                    <div ref={chartRef} className="h-48 w-full" />
                    {/* RRD-style traffic legend footer */}
                    <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#00cc00' }} />
                            <span className="text-xs text-gray-600 font-medium">Inbound</span>
                            <span className="text-xs font-bold text-gray-700">{formatBps(inBps)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#0000ff' }} />
                            <span className="text-xs text-gray-600 font-medium">Outbound</span>
                            <span className="text-xs font-bold text-gray-700">{formatBps(outBps)}</span>
                        </div>
                    </div>
                </>
            ) : (
                <div className="h-48 flex flex-col items-center justify-center text-gray-400 text-sm">
                    <p>No data yet</p>
                    <p className="text-xs">Waiting for SNMP polling...</p>
                </div>
            )}
        </div>
    );
}

/* ─── Confirm Dialog ─────────────────────────────────────── */

function ConfirmDialog({
    open, title, message, confirmLabel, loading, onConfirm, onCancel,
}: {
    open: boolean; title: string; message: string; confirmLabel: string;
    loading?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">{message}</p>
                <div className="mt-5 flex justify-end gap-3">
                    <button onClick={onCancel} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                    <button onClick={onConfirm} disabled={loading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors">{loading ? 'Deleting...' : confirmLabel}</button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────── */

export default function DeviceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const deviceId = params.id as string;
    const { device, loading, error, refetch } = useDevice(deviceId);
    const { addToast } = useToast();

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [timeRange, setTimeRange] = useState(1); // default 24h
    const [interfaceFilter, setInterfaceFilter] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);

    const range = TIME_RANGES[timeRange];

    const { data: deviceMetrics, loading: metricsLoading, refetch: refetchMetrics } = useDeviceMetrics(deviceId, timeRange);
    const { data: latestMetrics } = useLatestDeviceMetrics(deviceId);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handlePollNow = async () => {
        if (!device) return;
        try {
            await triggerDevicePoll(device.id);
            addToast({ type: 'success', title: 'Poll Triggered', message: `Polling ${device.hostname} via SNMP...` });
            setTimeout(() => { refetch(); refetchMetrics(); }, 5000);
        } catch {
            addToast({ type: 'error', title: 'Poll Failed', message: 'Could not trigger SNMP poll.' });
        }
    };

    const handleDelete = async () => {
        if (!device) return;
        try {
            setDeleting(true);
            await deleteDevice(device.id);
            addToast({ type: 'success', title: 'Device Deleted', message: `"${device.hostname}" has been deleted.` });
            router.push('/devices');
        } catch {
            addToast({ type: 'error', title: 'Delete Failed', message: `Could not delete "${device.hostname}".` });
        } finally { setDeleting(false); setShowDeleteConfirm(false); }
    };

    // Chart data
    const cpuData = useMemo(() => deviceMetrics.map((r: any) => [new Date(r.bucket).getTime(), r.avg_cpu ?? 0] as [number, number]), [deviceMetrics]);
    const memData = useMemo(() => deviceMetrics.map((r: any) => [new Date(r.bucket).getTime(), r.avg_memory ?? 0] as [number, number]), [deviceMetrics]);
    const responseData = useMemo(() => deviceMetrics.map((r: any) => [new Date(r.bucket).getTime(), r.avg_response_time ?? 0] as [number, number]), [deviceMetrics]);

    if (loading) return <DashboardSkeleton />;
    if (error || !device) return <ErrorState message={error || 'Device not found'} onRetry={refetch} />;

    const interfaces = device.interfaces || [];
    const isOnline = device.status === 'up';
    const cpuVal = latestMetrics?.cpu_utilization ?? null;
    const memPct = latestMetrics?.memory_percent ?? null;
    const memUsed = latestMetrics?.memory_used ?? null;
    const memTotal = latestMetrics?.memory_total ?? null;
    const responseMs = latestMetrics?.response_time_ms ?? null;

    const filteredInterfaces = interfaces.filter((iface: any) => {
        if (!interfaceFilter) return true;
        const q = interfaceFilter.toLowerCase();
        return (iface.ifName || '').toLowerCase().includes(q)
            || (iface.ifAlias || '').toLowerCase().includes(q)
            || (iface.ifDescr || '').toLowerCase().includes(q);
    });

    return (
        <div className="space-y-6">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-sm text-gray-500">
                <Link href="/devices" className="hover:text-blue-500 transition-colors">Devices</Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-gray-900 font-medium">{device.hostname}</span>
            </nav>

            {/* Device Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Router className="h-7 w-7 text-blue-500" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-gray-900">{device.hostname}</h1>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${isOnline
                                ? 'bg-emerald-100 text-emerald-600'
                                : 'bg-red-100 text-red-600'
                                }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                {isOnline ? 'ONLINE' : 'OFFLINE'}
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm">
                            IP: {device.ipAddress}
                            {device.vendor && ` · ${device.vendor}`}
                            {device.model && ` ${device.model}`}
                            {latestMetrics?.uptime && ` · Up for ${formatUptime(latestMetrics.uptime)}`}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handlePollNow}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold text-sm hover:bg-blue-600 transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Poll Now
                    </button>
                    <button
                        onClick={() => window.open(`ssh://${device.ipAddress}`, '_blank')}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors"
                    >
                        <Terminal className="h-4 w-4" />
                        SSH
                    </button>
                    <button
                        onClick={() => window.open(`http://${device.ipAddress}`, '_blank')}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors"
                    >
                        <Globe className="h-4 w-4" />
                        Web UI
                    </button>
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="flex items-center justify-center p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <Settings className="h-4 w-4" />
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-xl py-1 z-50">
                                <button onClick={() => { setShowMenu(false); router.push(`/devices/${device.id}/edit`); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                    <Pencil className="h-4 w-4 text-gray-400" /> Edit Device
                                </button>
                                <div className="my-1 border-t border-gray-100" />
                                <button onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                                    <Trash2 className="h-4 w-4" /> Delete Device
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* CPU Utilization */}
                <div className="bg-white p-5 rounded-xl border border-gray-200">
                    <p className="text-gray-500 text-sm font-medium mb-1">CPU Utilization</p>
                    <div className="flex items-end justify-between">
                        <h3 className="text-2xl font-bold">{cpuVal != null ? `${cpuVal.toFixed(0)}%` : '—'}</h3>
                    </div>
                    <div className="mt-3 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${cpuVal ?? 0}%` }} />
                    </div>
                </div>

                {/* Memory Usage */}
                <div className="bg-white p-5 rounded-xl border border-gray-200">
                    <p className="text-gray-500 text-sm font-medium mb-1">Memory Usage</p>
                    <div className="flex items-end justify-between">
                        <h3 className="text-2xl font-bold">
                            {memUsed != null ? formatBytes(memUsed) : '—'}
                            {memTotal != null && <span className="text-sm font-normal text-gray-400"> / {formatBytes(memTotal)}</span>}
                        </h3>
                    </div>
                    <div className="mt-3 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${memPct ?? 0}%` }} />
                    </div>
                </div>

                {/* Avg Response Time */}
                <div className="bg-white p-5 rounded-xl border border-gray-200">
                    <p className="text-gray-500 text-sm font-medium mb-1">Avg Response Time</p>
                    <div className="flex items-end justify-between">
                        <h3 className="text-2xl font-bold">{responseMs != null ? `${responseMs} ms` : '—'}</h3>
                    </div>
                    <div className="mt-3 flex gap-1 h-2 items-end">
                        {[0.2, 0.4, 1, 0.6, 0.3].map((h, i) => (
                            <div key={i} className="w-full bg-blue-500 rounded-sm transition-all" style={{ height: `${h * 8}px`, opacity: h }} />
                        ))}
                    </div>
                </div>

                {/* Uptime */}
                <div className="bg-white p-5 rounded-xl border border-gray-200">
                    <p className="text-gray-500 text-sm font-medium mb-1">Uptime</p>
                    <div className="flex items-end justify-between">
                        <h3 className="text-2xl font-bold">{formatUptime(latestMetrics?.uptime ?? device.uptime)}</h3>
                    </div>
                    <div className="mt-3 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: '100%' }} />
                    </div>
                </div>
            </div>

            {/* Performance Graphs */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg">Performance Graphs</h3>
                    <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                        {TIME_RANGES.map((r, i) => (
                            <button
                                key={r.label}
                                onClick={() => setTimeRange(i)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${timeRange === i
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <MetricChartPanel
                        title="Processor Utilization"
                        icon={Cpu}
                        data={cpuData}
                        unit="%"
                        color="#3b82f6"
                        maxVal={100}
                    />
                    <MetricChartPanel
                        title="Memory Utilization"
                        icon={HardDrive}
                        data={memData}
                        unit="%"
                        color="#8b5cf6"
                        maxVal={100}
                    />
                    <MetricChartPanel
                        title="Response Time"
                        icon={BarChart3}
                        data={responseData}
                        unit="ms"
                        color="#10b981"
                    />
                </div>
            </div>

            {/* Hardware Info + Polling Settings */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                    <h3 className="font-bold text-lg mb-4">Hardware Info</h3>
                    <div className="space-y-0">
                        {([
                            ['Vendor', device.vendor || '—'],
                            ['Model', device.model || '—'],
                            ['OS Version', device.osVersion || '—'],
                            ['IP Address', device.ipAddress],
                            ['Type', device.deviceType || '—'],
                        ] as [string, string][]).map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-b-0">
                                <span className="text-gray-500 text-sm">{label}</span>
                                <span className="font-semibold text-sm">{value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200">
                    <h3 className="font-bold text-lg mb-4">Polling Settings</h3>
                    <div className="space-y-0">
                        {([
                            ['Interval', `${device.pollingInterval}s`],
                            ['Method', `SNMP ${device.snmpVersion}`],
                            ['Last Contact', device.lastPolledAt ? (() => {
                                const diff = Math.floor((Date.now() - new Date(device.lastPolledAt).getTime()) / 1000);
                                if (diff < 60) return `${diff}s ago`;
                                if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                                return `${Math.floor(diff / 3600)}h ago`;
                            })() : 'Never'],
                            ['Location', device.location?.name || '—'],
                        ] as [string, string][]).map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-b-0">
                                <span className="text-gray-500 text-sm">{label}</span>
                                <span className="font-semibold text-sm">{value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Interface Traffic Charts */}
            {interfaces.length > 0 && (
                <div>
                    <h3 className="font-bold text-lg mb-4">Interface Traffic</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {interfaces
                            .map((iface: any) => (
                                <InterfaceTrafficPanel
                                    key={iface.id}
                                    deviceId={deviceId}
                                    iface={iface}
                                    rangeIdx={timeRange}
                                    hours={range.hours}
                                />
                            ))}
                    </div>
                </div>
            )}

            {/* Interface Statistics Table */}
            {interfaces.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="font-bold text-lg">Interface Statistics</h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={interfaceFilter}
                                onChange={(e) => setInterfaceFilter(e.target.value)}
                                className="text-xs border border-gray-200 bg-gray-50 rounded-lg py-1.5 px-3 w-48 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Filter interfaces..."
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Interface</th>
                                    <th className="px-6 py-3">Speed</th>
                                    <th className="px-6 py-3">Type</th>
                                    <th className="px-6 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredInterfaces.map((iface: any) => {
                                    const isUp = iface.ifOperStatus === 'up';
                                    return (
                                        <tr key={iface.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isUp
                                                    ? 'bg-emerald-100 text-emerald-600'
                                                    : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {isUp ? 'UP' : 'DOWN'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-semibold">{iface.ifName || `if${iface.ifIndex}`}</p>
                                                <p className="text-xs text-gray-400">{iface.ifAlias || iface.ifDescr || '—'}</p>
                                            </td>
                                            <td className="px-6 py-4">{formatSpeed(Number(iface.ifSpeed) || 0)}</td>
                                            <td className="px-6 py-4 text-gray-500">{iface.ifType || '—'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-gray-400 hover:text-blue-500 transition-colors">
                                                    <MonitorDot className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filteredInterfaces.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            No interfaces match your filter.
                        </div>
                    )}
                </div>
            )}

            {/* Delete confirm */}
            <ConfirmDialog
                open={showDeleteConfirm}
                title="Delete Device"
                message={`Are you sure you want to delete "${device.hostname}"? This will remove all interfaces, metrics, and alerts. This action cannot be undone.`}
                confirmLabel="Delete Device"
                loading={deleting}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    );
}
