'use client';

import { useState } from 'react';
import {
    Server,
    CheckCircle2,
    XCircle,
    Plus,
    Cpu,
    MemoryStick,
    RefreshCw,
    Trash2,
    ExternalLink,
    X,
    Copy,
    Check,
    AlertCircle,
    Monitor,
    ChevronRight,
} from 'lucide-react';
import { useServerMonitorOverview, useServerMonitorActions } from '@/hooks/use-server-monitors';
import { useLocations } from '@/hooks/use-locations';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { MetricCard } from '@/components/ui/metric-card';
import Link from 'next/link';

// ─── Status Badge ───────────────────────────────────────

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

function getServerTypeIcon(type: string) {
    if (type === 'linux') return (
        <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 border border-orange-200">
            🐧 Linux
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
            🪟 Windows
        </span>
    );
}

function formatUptime(seconds: number | null | undefined): string {
    if (!seconds) return '-';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

function formatBytes(bytes: number | null | undefined): string {
    if (!bytes) return '-';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
}

// ─── Add Server Modal ───────────────────────────────────

function AddServerModal({
    onClose,
    onSave,
}: {
    onClose: () => void;
    onSave: (dto: any) => Promise<any>;
}) {
    const [form, setForm] = useState({
        name: '',
        serverType: 'linux' as 'linux' | 'windows',
        ipAddress: '',
        hostname: '',
        agentInterval: 300,
        locationId: '' as string | number,
    });
    const [saving, setSaving] = useState(false);
    const [created, setCreated] = useState<any>(null);
    const { data: locationsData } = useLocations({ limit: 100 });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const result = await onSave({
                ...form,
                locationId: form.locationId ? Number(form.locationId) : undefined,
            });
            setCreated(result);
        } finally {
            setSaving(false);
        }
    };

    if (created) {
        return <AgentInstallDialog server={created} onClose={onClose} />;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-gray-200">
                    <h2 className="text-lg font-semibold">Add New Server</h2>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Server Name</label>
                        <input
                            required
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Production Web Server"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Server Type</label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, serverType: 'linux' })}
                                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 p-4 transition-all ${
                                    form.serverType === 'linux'
                                        ? 'border-orange-400 bg-orange-50 text-orange-700'
                                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                }`}
                            >
                                <span className="text-2xl">🐧</span>
                                <span className="font-medium">Linux Server</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, serverType: 'windows' })}
                                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 p-4 transition-all ${
                                    form.serverType === 'windows'
                                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                }`}
                            >
                                <span className="text-2xl">🪟</span>
                                <span className="font-medium">Windows Server</span>
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">IP Address</label>
                            <input
                                value={form.ipAddress}
                                onChange={e => setForm({ ...form, ipAddress: e.target.value })}
                                placeholder="192.168.1.100"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Hostname</label>
                            <input
                                value={form.hostname}
                                onChange={e => setForm({ ...form, hostname: e.target.value })}
                                placeholder="web-server-01"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Agent Interval (seconds)</label>
                        <select
                            value={form.agentInterval}
                            onChange={e => setForm({ ...form, agentInterval: parseInt(e.target.value) })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        >
                            <option value={60}>Every 1 minute</option>
                            <option value={120}>Every 2 minutes</option>
                            <option value={300}>Every 5 minutes</option>
                            <option value={600}>Every 10 minutes</option>
                            <option value={900}>Every 15 minutes</option>
                            <option value={1800}>Every 30 minutes</option>
                        </select>
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
                            {saving ? 'Creating...' : 'Save & Next'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Agent Install Dialog ───────────────────────────────

function AgentInstallDialog({ server, onClose }: { server: any; onClose: () => void }) {
    const { getInstallScript, downloadInstallScript } = useServerMonitorActions();
    const [script, setScript] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState<'oneliner' | 'wget' | 'full' | 'chmod' | 'run' | null>(null);
    const [showFull, setShowFull] = useState(false);
    const [method, setMethod] = useState<'quick' | 'download'>('download');
    const [downloading, setDownloading] = useState(false);

    const isLinux = server.server_type === 'linux';
    const ext = isLinux ? 'sh' : 'ps1';
    const filename = `install-agent.${ext}`;

    // Determine API base URL for the one-liner
    const apiBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const rawUrl = `${apiBaseUrl}/api/v1/server-monitors/${server.server_id}/install-script/raw?token=${server.agent_token}`;
    const oneLiner = `curl -fsSL '${rawUrl}' | sudo bash`;
    const wgetLiner = `wget -qO ${filename} '${rawUrl}' && chmod +x ${filename} && sudo ./${filename}`;

    useState(() => {
        getInstallScript(server.server_id)
            .then(data => setScript(data.script))
            .catch(() => setScript('# Failed to generate install script'))
            .finally(() => setLoading(false));
    });

    const copyText = (text: string, type: typeof copied) => {
        navigator.clipboard.writeText(text);
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleDownload = async () => {
        setDownloading(true);
        try {
            await downloadInstallScript(server.server_id, server.server_type);
        } catch { /* ignore */ }
        setDownloading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-gray-200">
                    <div>
                        <h2 className="text-lg font-semibold">Install Agent</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Deploy the agent on your {isLinux ? 'Linux' : 'Windows'} server: <strong>{server.name}</strong>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
                </div>
                <div className="p-5 space-y-4">
                    {/* Method Selector */}
                    <div className="flex gap-2 rounded-xl bg-gray-100 p-1">
                        <button
                            onClick={() => setMethod('download')}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                                method === 'download'
                                    ? 'bg-white shadow-sm text-primary'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            📥 Download &amp; Run
                        </button>
                        <button
                            onClick={() => setMethod('quick')}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                                method === 'quick'
                                    ? 'bg-white shadow-sm text-primary'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            ⚡ Quick Install (One-liner)
                        </button>
                    </div>

                    {method === 'download' && (
                        <div className="space-y-3">
                            {/* Step 1: Download */}
                            <div className="rounded-xl border border-gray-200 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                                    <span className="text-sm font-semibold">Download the script</span>
                                </div>
                                <button
                                    onClick={handleDownload}
                                    disabled={downloading}
                                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    {downloading ? (
                                        <><RefreshCw className="h-4 w-4 animate-spin" /> Downloading...</>
                                    ) : (
                                        <>📥 Download <code className="bg-white/20 rounded px-1.5 py-0.5 text-xs">{filename}</code></>
                                    )}
                                </button>
                            </div>

                            {/* Step 2: chmod */}
                            {isLinux && (
                                <div className="rounded-xl border border-gray-200 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                                        <span className="text-sm font-semibold">Make it executable</span>
                                    </div>
                                    <div className="relative">
                                        <pre className="rounded-lg bg-gray-900 text-emerald-400 p-3 text-sm font-mono pr-20">
                                            {`chmod +x ${filename}`}
                                        </pre>
                                        <button
                                            onClick={() => copyText(`chmod +x ${filename}`, 'chmod')}
                                            className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-xs text-white transition-colors"
                                        >
                                            {copied === 'chmod' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                            {copied === 'chmod' ? 'Copied!' : 'Copy'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Run */}
                            <div className="rounded-xl border border-gray-200 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">{isLinux ? '3' : '2'}</span>
                                    <span className="text-sm font-semibold">Run the installer</span>
                                </div>
                                <div className="relative">
                                    <pre className="rounded-lg bg-gray-900 text-emerald-400 p-3 text-sm font-mono pr-20">
                                        {isLinux ? `sudo ./${filename}` : `powershell -ExecutionPolicy Bypass -File .\\${filename}`}
                                    </pre>
                                    <button
                                        onClick={() => copyText(isLinux ? `sudo ./${filename}` : `powershell -ExecutionPolicy Bypass -File .\\${filename}`, 'run')}
                                        className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-xs text-white transition-colors"
                                    >
                                        {copied === 'run' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                        {copied === 'run' ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                            </div>

                            {/* wget alternative */}
                            {isLinux && (
                                <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
                                    <p className="text-xs font-semibold text-blue-700 mb-2">💡 Alternative: wget one-liner</p>
                                    <div className="relative">
                                        <pre className="rounded-lg bg-gray-900 text-blue-300 p-3 text-xs font-mono overflow-auto whitespace-pre-wrap break-all pr-16">
                                            {wgetLiner}
                                        </pre>
                                        <button
                                            onClick={() => copyText(wgetLiner, 'wget')}
                                            className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-blue-600 hover:bg-blue-700 px-2 py-1 text-xs text-white transition-colors"
                                        >
                                            {copied === 'wget' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                            {copied === 'wget' ? 'Copied!' : 'Copy'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {method === 'quick' && (
                        <div className="space-y-3">
                            {/* One-liner command */}
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">ONE-LINER</span>
                                    <span className="text-xs text-gray-400">Just copy &amp; paste into your terminal</span>
                                </div>
                                <div className="relative">
                                    <pre className="rounded-xl bg-gray-900 text-emerald-400 p-4 text-xs overflow-auto font-mono whitespace-pre-wrap break-all pr-20">
                                        {oneLiner}
                                    </pre>
                                    <button
                                        onClick={() => copyText(oneLiner, 'oneliner')}
                                        className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs text-white transition-colors font-medium"
                                    >
                                        {copied === 'oneliner' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                        {copied === 'oneliner' ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Token info */}
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                        Agent Token: <code className="font-mono font-bold">{server.agent_token}</code>
                    </div>

                    {/* Expandable full script */}
                    <div>
                        <button
                            onClick={() => setShowFull(!showFull)}
                            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showFull ? 'rotate-90' : ''}`} />
                            {showFull ? 'Hide' : 'Show'} full install script
                        </button>
                        {showFull && (
                            <div className="relative mt-2">
                                <pre className="rounded-xl bg-gray-900 text-gray-100 p-4 text-xs overflow-auto max-h-60 font-mono">
                                    {loading ? 'Generating install script...' : script}
                                </pre>
                                {script && (
                                    <button
                                        onClick={() => copyText(script, 'full')}
                                        className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs text-white backdrop-blur transition-colors"
                                    >
                                        {copied === 'full' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                        {copied === 'full' ? 'Copied!' : 'Copy'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────

export default function ServerMonitorPage() {
    const { data, loading, error, refetch } = useServerMonitorOverview();
    const { create, remove, getInstallScript } = useServerMonitorActions();
    const [showAddModal, setShowAddModal] = useState(false);
    const [installServer, setInstallServer] = useState<any>(null);

    if (loading) return <DashboardSkeleton />;
    if (error || !data) return <ErrorState message={error || 'No data'} onRetry={refetch} />;

    const handleAdd = async (dto: any) => {
        const result = await create(dto);
        refetch();
        return result;
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this server? All metrics data will be lost.')) return;
        await remove(id);
        refetch();
    };

    return (
        <div className="space-y-6">
            {showAddModal && (
                <AddServerModal
                    onClose={() => { setShowAddModal(false); refetch(); }}
                    onSave={handleAdd}
                />
            )}

            {installServer && (
                <AgentInstallDialog
                    server={installServer}
                    onClose={() => { setInstallServer(null); }}
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Server Monitoring</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Monitor Linux & Windows server resources with agents
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 shadow-sm transition-colors"
                >
                    <Plus className="h-4 w-4" /> Add Server
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                    label="Total Servers"
                    value={data.totalServers.toLocaleString()}
                    icon={Server}
                    iconBg="bg-blue-100"
                    iconColor="text-blue-600"
                    detail={`${data.serversUp} up · ${data.serversDown} down`}
                />
                <MetricCard
                    label="Servers Up"
                    value={data.serversUp.toLocaleString()}
                    icon={CheckCircle2}
                    iconBg="bg-emerald-100"
                    iconColor="text-emerald-600"
                    detail={data.totalServers > 0 ? `${((data.serversUp / data.totalServers) * 100).toFixed(1)}% available` : '-'}
                />
                <MetricCard
                    label="Servers Down"
                    value={data.serversDown.toLocaleString()}
                    icon={XCircle}
                    iconBg="bg-red-100"
                    iconColor="text-red-600"
                    detail={data.serversDown > 0 ? 'Needs attention' : 'All servers up'}
                />
                <MetricCard
                    label="Avg CPU Usage"
                    value={`${data.avgCpuPercent}%`}
                    icon={Cpu}
                    iconBg="bg-purple-100"
                    iconColor="text-purple-600"
                    detail="Fleet average"
                />
                <MetricCard
                    label="Avg Memory"
                    value={`${data.avgMemPercent}%`}
                    icon={MemoryStick}
                    iconBg="bg-amber-100"
                    iconColor="text-amber-600"
                    detail="Fleet average"
                />
            </div>

            {/* Server Table */}
            <div className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-blue-500" />
                        <h2 className="font-semibold">Monitored Servers</h2>
                    </div>
                    <button onClick={refetch} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" /> Refresh
                    </button>
                </div>

                {data.servers.length === 0 ? (
                    <div className="p-12 text-center text-sm text-muted-foreground">
                        <Server className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="font-medium">No servers registered</p>
                        <p className="text-xs mt-1">Click &quot;Add Server&quot; to start monitoring your Linux or Windows servers</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Server</th>
                                    <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Type</th>
                                    <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Status</th>
                                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-3">CPU</th>
                                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-3">Memory</th>
                                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-3">Uptime</th>
                                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-3">Last Report</th>
                                    <th className="text-right text-xs font-semibold text-muted-foreground px-5 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.servers.map((server) => {
                                    const m = server.latestMetrics;
                                    const cpuTotal = m ? ((Number(m.cpu_user) || 0) + (Number(m.cpu_system) || 0)) : null;
                                    return (
                                        <tr key={server.server_id} className="hover:bg-accent/30 transition-colors">
                                            <td className="px-5 py-3">
                                                <Link href={`/server-monitor/${server.server_id}`} className="hover:text-primary">
                                                    <div className="text-sm font-medium">{server.name}</div>
                                                    <div className="text-xs text-muted-foreground">{server.ip_address || server.hostname || '-'}</div>
                                                </Link>
                                            </td>
                                            <td className="px-3 py-3 text-center">{getServerTypeIcon(server.server_type)}</td>
                                            <td className="px-3 py-3 text-center">{getStatusBadge(server.status)}</td>
                                            <td className="px-3 py-3 text-right">
                                                {cpuTotal != null ? (
                                                    <span className={`text-sm font-bold ${cpuTotal >= 90 ? 'text-red-600' : cpuTotal >= 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                        {cpuTotal.toFixed(1)}%
                                                    </span>
                                                ) : <span className="text-sm text-muted-foreground">-</span>}
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                {m?.mem_percent != null ? (
                                                    <span className={`text-sm font-bold ${Number(m.mem_percent) >= 90 ? 'text-red-600' : Number(m.mem_percent) >= 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                        {Number(m.mem_percent).toFixed(1)}%
                                                    </span>
                                                ) : <span className="text-sm text-muted-foreground">-</span>}
                                            </td>
                                            <td className="px-3 py-3 text-right text-sm text-muted-foreground">
                                                {formatUptime(m?.uptime_seconds)}
                                            </td>
                                            <td className="px-3 py-3 text-right text-xs text-muted-foreground">
                                                {server.last_reported_at
                                                    ? new Date(server.last_reported_at).toLocaleString()
                                                    : 'Never'}
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Link
                                                        href={`/server-monitor/${server.server_id}`}
                                                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                                                        title="View details"
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </Link>
                                                    <button
                                                        onClick={() => setInstallServer(server)}
                                                        className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                                                        title="Install/Reinstall Agent"
                                                    >
                                                        <Monitor className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(server.server_id)}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
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
