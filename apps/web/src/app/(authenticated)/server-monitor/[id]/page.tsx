'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Cpu,
    MemoryStick,
    HardDrive,
    Network,
    Activity,
    Server,
    Clock,
    RefreshCw,
    Copy,
    Check,
    Monitor,
    Terminal,
} from 'lucide-react';
import { useServerMonitorDetail, useServerMetricsHistory, useServerMonitorActions } from '@/hooks/use-server-monitors';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import Link from 'next/link';

function formatBytes(bytes: number | null | undefined): string {
    if (bytes == null) return '-';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(0)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
}

function formatUptime(seconds: number | null | undefined): string {
    if (!seconds) return '-';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days} days, ${hours} hours, ${mins} minutes`;
    if (hours > 0) return `${hours} hours, ${mins} minutes`;
    return `${mins} minutes`;
}

function StatusBadge({ value, thresholds }: { value: number | null; thresholds?: [number, number] }) {
    if (value == null) return <span className="text-muted-foreground">-</span>;
    const [warn, crit] = thresholds || [70, 90];
    const color = value >= crit ? 'text-red-600' : value >= warn ? 'text-amber-600' : 'text-emerald-600';
    const bg = value >= crit ? 'bg-red-50 border-red-200' : value >= warn ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200';
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${color} ${bg} border`}>
            {value.toFixed(1)}%
        </span>
    );
}

function ProgressBar({ value, color }: { value: number; color?: string }) {
    const barColor = color || (value >= 90 ? 'bg-red-500' : value >= 70 ? 'bg-amber-500' : 'bg-emerald-500');
    return (
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(value, 100)}%` }} />
        </div>
    );
}

type Tab = 'general' | 'disk' | 'network' | 'process';

export default function ServerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = Number(params.id);
    const { data: server, loading, error, refetch } = useServerMonitorDetail(id);
    const { data: metricsHistory } = useServerMetricsHistory(id);
    const { getInstallScript } = useServerMonitorActions();
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [showScript, setShowScript] = useState(false);
    const [script, setScript] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    if (loading) return <DashboardSkeleton />;
    if (error || !server) return <ErrorState message={error || 'Server not found'} onRetry={refetch} />;

    const m = server.latestMetrics;
    const cpuTotal = m ? ((Number(m.cpu_user) || 0) + (Number(m.cpu_system) || 0)) : null;

    const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
        { key: 'general', label: 'General', icon: Cpu },
        { key: 'disk', label: 'Disk', icon: HardDrive },
        { key: 'network', label: 'Network', icon: Network },
        { key: 'process', label: 'Process', icon: Activity },
    ];

    const handleShowScript = async () => {
        if (!script) {
            const data = await getInstallScript(id);
            setScript(data.script);
        }
        setShowScript(true);
    };

    const handleCopy = () => {
        if (script) {
            navigator.clipboard.writeText(script);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="space-y-6">
            {/* Breadcrumb + Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/server-monitor" className="p-2 rounded-lg hover:bg-accent transition-colors">
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
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {server.server_type === 'linux' ? '🐧 Linux' : '🪟 Windows'}
                            {server.os_info ? ` · ${server.os_info}` : ''}
                            {server.ip_address ? ` · ${server.ip_address}` : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link href={`/server-monitor/${id}/terminal`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors">
                        <Terminal className="h-3.5 w-3.5" /> Terminal
                    </Link>
                    <button onClick={handleShowScript} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
                        <Monitor className="h-3.5 w-3.5" /> Install Agent
                    </button>
                    <button onClick={refetch} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Cpu className="h-3.5 w-3.5 text-purple-500" /> CPU Usage
                    </div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl font-bold">{cpuTotal != null ? `${cpuTotal.toFixed(1)}%` : '-'}</span>
                        <StatusBadge value={cpuTotal} />
                    </div>
                    {cpuTotal != null && <ProgressBar value={cpuTotal} />}
                    {m?.cpu_cores && <p className="text-xs text-muted-foreground mt-1">{m.cpu_cores} cores · Load: {m.cpu_load1 || '-'}</p>}
                </div>

                <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <MemoryStick className="h-3.5 w-3.5 text-amber-500" /> Memory
                    </div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl font-bold">{m?.mem_percent != null ? `${Number(m.mem_percent).toFixed(1)}%` : '-'}</span>
                        <StatusBadge value={m?.mem_percent != null ? Number(m.mem_percent) : null} />
                    </div>
                    {m?.mem_percent != null && <ProgressBar value={Number(m.mem_percent)} />}
                    {m?.mem_total && <p className="text-xs text-muted-foreground mt-1">{formatBytes(m.mem_used)} / {formatBytes(m.mem_total)}</p>}
                </div>

                <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <HardDrive className="h-3.5 w-3.5 text-blue-500" /> Disk
                    </div>
                    {m?.disk_json && Array.isArray(m.disk_json) && m.disk_json.length > 0 ? (
                        <>
                            <span className="text-2xl font-bold">{m.disk_json.length} partitions</span>
                            <p className="text-xs text-muted-foreground mt-1">Max usage: {Math.max(...m.disk_json.map((d: any) => d.percent || 0))}%</p>
                        </>
                    ) : (
                        <span className="text-2xl font-bold text-muted-foreground">-</span>
                    )}
                </div>

                <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Network className="h-3.5 w-3.5 text-cyan-500" /> Network
                    </div>
                    {m?.net_json && Array.isArray(m.net_json) ? (
                        <>
                            <span className="text-2xl font-bold">{m.net_json.length} interfaces</span>
                        </>
                    ) : (
                        <span className="text-2xl font-bold text-muted-foreground">-</span>
                    )}
                </div>

                <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Clock className="h-3.5 w-3.5 text-green-500" /> Uptime
                    </div>
                    <span className="text-lg font-bold">{formatUptime(m?.uptime_seconds)}</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
                <div className="flex border-b border-gray-200">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                                activeTab === tab.key
                                    ? 'border-primary text-primary bg-primary/5'
                                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/30'
                            }`}
                        >
                            <tab.icon className="h-4 w-4" /> {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-5">
                    {activeTab === 'general' && <GeneralTab metrics={m} />}
                    {activeTab === 'disk' && <DiskTab metrics={m} />}
                    {activeTab === 'network' && <NetworkTab metrics={m} />}
                    {activeTab === 'process' && <ProcessTab metrics={m} />}
                </div>
            </div>

            {/* Install Script Modal */}
            {showScript && script && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4">
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <h2 className="text-lg font-semibold">Agent Install Script</h2>
                            <button onClick={() => setShowScript(false)} className="p-1 rounded-lg hover:bg-gray-100">✕</button>
                        </div>
                        <div className="p-5">
                            <div className="relative">
                                <pre className="rounded-xl bg-gray-900 text-gray-100 p-4 text-xs overflow-auto max-h-80 font-mono">{script}</pre>
                                <button
                                    onClick={handleCopy}
                                    className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs text-white backdrop-blur transition-colors"
                                >
                                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Tab Components ─────────────────────────────────────

function GeneralTab({ metrics: m }: { metrics: any }) {
    if (!m) return <p className="text-sm text-muted-foreground">No metrics data available. Make sure the agent is installed and running.</p>;

    const cpuTotal = (Number(m.cpu_user) || 0) + (Number(m.cpu_system) || 0);

    return (
        <div className="space-y-6">
            {/* CPU Details */}
            <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Cpu className="h-4 w-4 text-purple-500" /> CPU Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-muted-foreground">CPU User</p>
                        <p className="text-lg font-bold">{m.cpu_user != null ? `${Number(m.cpu_user).toFixed(1)}%` : '-'}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-muted-foreground">CPU System</p>
                        <p className="text-lg font-bold">{m.cpu_system != null ? `${Number(m.cpu_system).toFixed(1)}%` : '-'}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-muted-foreground">Total Usage</p>
                        <p className="text-lg font-bold">{cpuTotal.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-muted-foreground">Cores</p>
                        <p className="text-lg font-bold">{m.cpu_cores || '-'}</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-2">
                    <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-muted-foreground">Load Avg (1m)</p>
                        <p className="text-lg font-bold">{m.cpu_load1 != null ? Number(m.cpu_load1).toFixed(2) : '-'}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-muted-foreground">Load Avg (5m)</p>
                        <p className="text-lg font-bold">{m.cpu_load5 != null ? Number(m.cpu_load5).toFixed(2) : '-'}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-muted-foreground">Load Avg (15m)</p>
                        <p className="text-lg font-bold">{m.cpu_load15 != null ? Number(m.cpu_load15).toFixed(2) : '-'}</p>
                    </div>
                </div>
            </div>

            {/* Memory Details */}
            <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><MemoryStick className="h-4 w-4 text-amber-500" /> Memory Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-lg font-bold">{formatBytes(m.mem_total)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-muted-foreground">Used</p>
                        <p className="text-lg font-bold">{formatBytes(m.mem_used)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-muted-foreground">Usage</p>
                        <p className="text-lg font-bold">{m.mem_percent != null ? `${Number(m.mem_percent).toFixed(1)}%` : '-'}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-muted-foreground">Swap Used</p>
                        <p className="text-lg font-bold">{formatBytes(m.swap_used)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DiskTab({ metrics: m }: { metrics: any }) {
    const disks = m?.disk_json;
    if (!disks || !Array.isArray(disks) || disks.length === 0) {
        return <p className="text-sm text-muted-foreground">No disk data available.</p>;
    }

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2"><HardDrive className="h-4 w-4 text-blue-500" /> Disk Partitions</h3>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50">
                            <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2">Mount Point</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2">Filesystem</th>
                            <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2">Total</th>
                            <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2">Used</th>
                            <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2">Usage</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2 w-40">Bar</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {disks.map((disk: any, i: number) => (
                            <tr key={i} className="hover:bg-accent/30 transition-colors">
                                <td className="px-4 py-2 text-sm font-mono">{disk.mountpoint}</td>
                                <td className="px-4 py-2 text-sm text-muted-foreground">{disk.fstype || '-'}</td>
                                <td className="px-4 py-2 text-sm text-right">{formatBytes(disk.total)}</td>
                                <td className="px-4 py-2 text-sm text-right">{formatBytes(disk.used)}</td>
                                <td className="px-4 py-2 text-right">
                                    <StatusBadge value={disk.percent} thresholds={[70, 90]} />
                                </td>
                                <td className="px-4 py-2"><ProgressBar value={disk.percent || 0} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Disk I/O */}
            {m?.disk_io_json && Array.isArray(m.disk_io_json) && m.disk_io_json.length > 0 && (
                <>
                    <h3 className="text-sm font-semibold flex items-center gap-2 mt-6"><Activity className="h-4 w-4 text-indigo-500" /> Disk I/O</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2">Device</th>
                                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2">Read</th>
                                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2">Written</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {m.disk_io_json.map((dio: any, i: number) => (
                                    <tr key={i} className="hover:bg-accent/30 transition-colors">
                                        <td className="px-4 py-2 text-sm font-mono">{dio.device}</td>
                                        <td className="px-4 py-2 text-sm text-right">{formatBytes(dio.readBytes)}</td>
                                        <td className="px-4 py-2 text-sm text-right">{formatBytes(dio.writeBytes)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}

function NetworkTab({ metrics: m }: { metrics: any }) {
    const nets = m?.net_json;
    if (!nets || !Array.isArray(nets) || nets.length === 0) {
        return <p className="text-sm text-muted-foreground">No network data available.</p>;
    }

    return (
        <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4"><Network className="h-4 w-4 text-cyan-500" /> Network Interfaces</h3>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50">
                            <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2">Interface</th>
                            <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2">Bytes In</th>
                            <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2">Bytes Out</th>
                            <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2">Packets In</th>
                            <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2">Packets Out</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {nets.map((net: any, i: number) => (
                            <tr key={i} className="hover:bg-accent/30 transition-colors">
                                <td className="px-4 py-2 text-sm font-mono">{net.interface}</td>
                                <td className="px-4 py-2 text-sm text-right">{formatBytes(net.bytesIn)}</td>
                                <td className="px-4 py-2 text-sm text-right">{formatBytes(net.bytesOut)}</td>
                                <td className="px-4 py-2 text-sm text-right">{net.packetsIn?.toLocaleString() || '-'}</td>
                                <td className="px-4 py-2 text-sm text-right">{net.packetsOut?.toLocaleString() || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ProcessTab({ metrics: m }: { metrics: any }) {
    const procs = m?.processes_json;
    if (!procs || !Array.isArray(procs) || procs.length === 0) {
        return <p className="text-sm text-muted-foreground">No process data available.</p>;
    }

    return (
        <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4"><Activity className="h-4 w-4 text-green-500" /> Top Processes (by CPU)</h3>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50">
                            <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2">PID</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2">Process Name</th>
                            <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2">CPU %</th>
                            <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2">Memory %</th>
                            <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2">Threads</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {procs.map((proc: any, i: number) => (
                            <tr key={i} className="hover:bg-accent/30 transition-colors">
                                <td className="px-4 py-2 text-sm font-mono text-muted-foreground">{proc.pid}</td>
                                <td className="px-4 py-2 text-sm font-medium">{proc.name}</td>
                                <td className="px-4 py-2 text-sm text-right">
                                    <span className={`font-bold ${Number(proc.cpu) >= 50 ? 'text-red-600' : Number(proc.cpu) >= 20 ? 'text-amber-600' : ''}`}>
                                        {Number(proc.cpu).toFixed(1)}%
                                    </span>
                                </td>
                                <td className="px-4 py-2 text-sm text-right">{Number(proc.memory).toFixed(1)}%</td>
                                <td className="px-4 py-2 text-sm text-right text-muted-foreground">{proc.threads || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
