'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Server,
    Wifi,
    WifiOff,
    AlertTriangle,
    Plus,
    Search,
    Filter,
    MoreVertical,
    Eye,
    Bell,
    Globe,
    Terminal,
    ChevronUp,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Monitor,
    Router,
    Radio,
    Activity,
    Clock,
    MapPin,
    X,
    LayoutGrid,
    LayoutList,
    Trash2,
    AlertCircle,
    Loader2,
    Pencil,
    Edit2,
    Download,
    BarChart3,
    Wrench,
    Scan,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { useDevices, Device, deleteDevice, bulkDeleteDevices } from '@/hooks/use-devices';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { createDevice } from '@/hooks/use-devices';
import { api } from '@/lib/api-client';
import type { DeviceMetricRow } from '@/hooks/use-metrics';

/* ─── Helpers ────────────────────────────────────────────── */

function formatUptime(ticks: number | null): string {
    if (!ticks) return '—';
    const totalSec = Math.floor(ticks / 100);
    const days = Math.floor(totalSec / 86400);
    const hrs = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    if (days > 365) {
        const yrs = Math.floor(days / 365);
        const remDays = days % 365;
        return `${yrs}y ${Math.floor(remDays / 30)}mo ${remDays % 30}d`;
    }
    if (days > 0) return `${days}d ${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
}

function getRelativeTime(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 30) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function getDeviceIcon(type: string) {
    switch (type) {
        case 'router': return Router;
        case 'switch': return Monitor;
        case 'access_point': return Radio;
        case 'firewall': return Server;
        default: return Server;
    }
}

function timeAgo(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
}

/* ─── Mini Sparkline (pure SVG) ──────────────────────────── */

function MiniSparkline({ data, color = '#3b82f6', height = 24, width = 64 }: { data: number[]; color?: string; height?: number; width?: number }) {
    if (!data.length) return <span className="text-xs text-gray-300">—</span>;

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const pad = 2;
    const stepX = (width - pad * 2) / Math.max(data.length - 1, 1);

    const points = data.map((v, i) => {
        const x = pad + i * stepX;
        const y = height - pad - ((v - min) / range) * (height - pad * 2);
        return `${x},${y}`;
    }).join(' ');

    const areaPoints = `${pad},${height - pad} ${points} ${pad + (data.length - 1) * stepX},${height - pad}`;
    const gradId = `sg-${color.replace('#', '')}`;

    return (
        <svg width={width} height={height} className="block">
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <polygon points={areaPoints} fill={`url(#${gradId})`} />
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={pad + (data.length - 1) * stepX} cy={height - pad - ((data[data.length - 1] - min) / range) * (height - pad * 2)} r="2" fill={color} />
        </svg>
    );
}

/* ─── Device Health Cell (table row) ─────────────────────── */

function DeviceHealthCell({ deviceId, status }: { deviceId: number; status: string }) {
    const [metrics, setMetrics] = useState<{ cpu: number[]; mem: number[] } | null>(null);

    useEffect(() => {
        if (status === 'down') return;
        let cancelled = false;
        const from = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
        const to = new Date().toISOString();

        api.get(`/metrics/device/${deviceId}`, { params: { from, to, interval: '1h', limit: 12 } })
            .then(({ data: resp }: { data: any }) => {
                if (cancelled) return;
                const rows: DeviceMetricRow[] = (resp.data || []).reverse();
                setMetrics({
                    cpu: rows.map((r: DeviceMetricRow) => r.avg_cpu ?? 0),
                    mem: rows.map((r: DeviceMetricRow) => r.avg_memory ?? 0),
                });
            })
            .catch(() => { /* silent */ });
        return () => { cancelled = true; };
    }, [deviceId, status]);

    if (status === 'down') {
        return <span className="text-[10px] text-red-400 font-medium">Offline</span>;
    }

    if (!metrics || (metrics.cpu.length === 0 && metrics.mem.length === 0)) {
        return <span className="text-xs text-gray-300">—</span>;
    }

    const latestCpu = metrics.cpu.length > 0 ? metrics.cpu[metrics.cpu.length - 1] : null;
    const cpuColor = latestCpu !== null && latestCpu > 80 ? '#ef4444' : latestCpu !== null && latestCpu > 50 ? '#f59e0b' : '#10b981';

    return (
        <div className="flex items-center gap-2">
            <div className="flex flex-col items-start gap-0.5" title={`CPU: ${latestCpu?.toFixed(0) ?? '?'}%`}>
                <MiniSparkline data={metrics.cpu} color={cpuColor} width={48} height={18} />
                <span className="text-[9px] text-gray-400 leading-none">CPU</span>
            </div>
            <div className="flex flex-col items-start gap-0.5" title={`Mem: ${metrics.mem.length > 0 ? metrics.mem[metrics.mem.length - 1].toFixed(0) : '?'}%`}>
                <MiniSparkline data={metrics.mem} color="#8b5cf6" width={48} height={18} />
                <span className="text-[9px] text-gray-400 leading-none">Mem</span>
            </div>
        </div>
    );
}

/* ─── Action Menu ────────────────────────────────────────── */

function ActionMenu({ device, onClose, onDelete }: { device: Device; onClose: () => void; onDelete?: (d: Device) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    const actions = [
        {
            icon: Eye,
            label: 'View Device',
            onClick: () => router.push(`/devices/${device.id}`),
        },
        {
            icon: Pencil,
            label: 'Edit Device',
            onClick: () => router.push(`/devices/${device.id}/edit`),
        },
        {
            icon: Bell,
            label: 'Check Alerts',
            onClick: () => router.push(`/alerts?deviceId=${device.id}`),
        },
        {
            icon: Globe,
            label: 'Open in Browser',
            onClick: () => window.open(`http://${device.ipAddress}`, '_blank'),
        },
        {
            icon: Terminal,
            label: 'Telnet / SSH',
            onClick: () => window.open(`ssh://${device.ipAddress}`, '_blank'),
        },
        {
            icon: Wrench,
            label: device.status === 'maintenance' ? 'End Maintenance' : 'Maintenance Mode',
            onClick: () => {
                if (device.status === 'maintenance') {
                    api.delete(`/devices/${device.id}/maintenance`)
                        .then(() => { if (typeof window !== 'undefined') window.location.reload(); })
                        .catch(() => { });
                } else {
                    const reason = window.prompt('Maintenance reason (optional):');
                    if (reason !== null) {
                        api.post(`/devices/${device.id}/maintenance`, { reason })
                            .then(() => { if (typeof window !== 'undefined') window.location.reload(); })
                            .catch(() => { });
                    }
                }
            },
        },
        {
            icon: Trash2,
            label: 'Delete Device',
            danger: true,
            onClick: () => { if (onDelete) onDelete(device); },
        },
    ];

    return (
        <div
            ref={ref}
            className="absolute right-0 top-8 z-50 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
            onClick={(e) => e.stopPropagation()}
        >
            {actions.map((action: any) => (
                <button
                    key={action.label}
                    onClick={() => { action.onClick(); onClose(); }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${action.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                >
                    <action.icon className={`h-4 w-4 ${action.danger ? 'text-red-400' : 'text-gray-400'}`} />
                    {action.label}
                </button>
            ))}
        </div>
    );
}

/* ─── Last Seen Pulse ────────────────────────────────────── */

function LastSeenPulse({ status, lastPolledAt }: { status: string; lastPolledAt: string | null }) {
    const [relTime, setRelTime] = useState(() => getRelativeTime(lastPolledAt));

    useEffect(() => {
        // Update every 5 seconds so the "Just now" / "12s ago" feels live
        const timer = setInterval(() => setRelTime(getRelativeTime(lastPolledAt)), 5000);
        return () => clearInterval(timer);
    }, [lastPolledAt]);

    return (
        <div className="flex flex-col gap-1 items-start">
            <StatusBadge status={status} />
            <span className="text-[10px] text-gray-500 font-medium tracking-wide pl-0.5">
                {relTime}
            </span>
        </div>
    );
}

/* ─── Status Card ────────────────────────────────────────── */

function StatusCard({
    label,
    value,
    icon: Icon,
    color,
    active,
    onClick,
    subtitle,
}: {
    label: string;
    value: number;
    icon: React.ElementType;
    color: string;
    active: boolean;
    onClick: () => void;
    subtitle?: string;
}) {
    const colorMap: Record<string, { bg: string; border: string; icon: string; text: string }> = {
        blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500', text: 'text-blue-700' },
        green: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-500', text: 'text-emerald-700' },
        red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500', text: 'text-red-700' },
        amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-500', text: 'text-amber-700' },
    };
    const c = colorMap[color] || colorMap.blue;

    return (
        <button
            onClick={onClick}
            className={`
                rounded-xl border p-4 text-left transition-all w-full
                ${active ? `${c.bg} ${c.border} shadow-sm ring-1 ring-${color}-300` : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}
            `}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
                <div className={`rounded-lg p-1.5 ${active ? c.bg : 'bg-gray-50'}`}>
                    <Icon className={`h-4 w-4 ${active ? c.icon : 'text-gray-400'}`} />
                </div>
            </div>
            <p className={`text-2xl font-bold ${active ? c.text : 'text-gray-900'}`}>{value}</p>
            {subtitle && (
                <p className={`text-xs mt-0.5 ${active ? c.icon : 'text-gray-400'}`}>{subtitle}</p>
            )}
        </button>
    );
}

/* ─── Filter Dropdown ────────────────────────────────────── */

function FilterDropdown({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all appearance-none cursor-pointer"
            title={label}
        >
            <option value="">{label}</option>
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    );
}

/* ─── Quick Add / Bulk Import Modal ─────────────────────── */

function QuickAddModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
    const { addToast } = useToast();
    const [tab, setTab] = useState<'single' | 'bulk'>('single');

    // Single add form
    const [single, setSingle] = useState({ hostname: '', ipAddress: '', deviceType: 'router', snmpCommunity: 'public' });
    const [singleErrors, setSingleErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    // Bulk import
    const [bulkText, setBulkText] = useState('');
    const [bulkStatus, setBulkStatus] = useState<{ ip: string; status: 'pending' | 'ok' | 'err'; msg?: string }[]>([]);
    const [bulkRunning, setBulkRunning] = useState(false);

    const resetSingle = () => { setSingle({ hostname: '', ipAddress: '', deviceType: 'router', snmpCommunity: 'public' }); setSingleErrors({}); };
    const resetBulk = () => { setBulkText(''); setBulkStatus([]); };

    if (!open) return null;

    const validateSingle = () => {
        const e: Record<string, string> = {};
        if (!single.hostname.trim()) e.hostname = 'Required';
        else if (/\s/.test(single.hostname.trim())) e.hostname = 'No spaces allowed';
        if (!single.ipAddress.trim()) e.ipAddress = 'Required';
        else if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(single.ipAddress.trim()) && !/^[a-zA-Z0-9][a-zA-Z0-9\-.]*[a-zA-Z0-9]$/.test(single.ipAddress.trim())) {
            e.ipAddress = 'Enter a valid IP or hostname';
        }
        setSingleErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSingleAdd = async () => {
        if (!validateSingle()) return;
        setSaving(true);
        try {
            await createDevice({ hostname: single.hostname.trim(), ipAddress: single.ipAddress.trim(), deviceType: single.deviceType, snmpCommunity: single.snmpCommunity.trim() || 'public', snmpVersion: 'v2c', snmpPort: 161, pollingInterval: 300, pollingEnabled: true });
            addToast({ type: 'success', title: 'Device Added', message: `"${single.hostname}" has been added.` });
            resetSingle();
            onAdded();
            onClose();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Failed', message: err?.response?.data?.message || 'Could not add device.' });
        } finally {
            setSaving(false);
        }
    };

    const handleBulkImport = async () => {
        const ips = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
        if (!ips.length) return;
        setBulkRunning(true);
        setBulkStatus(ips.map(ip => ({ ip, status: 'pending' })));
        for (let i = 0; i < ips.length; i++) {
            const ip = ips[i];
            try {
                await createDevice({ hostname: ip, ipAddress: ip, deviceType: 'unknown', snmpCommunity: 'public', snmpVersion: 'v2c', snmpPort: 161, pollingInterval: 300, pollingEnabled: true });
                setBulkStatus(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'ok' } : s));
            } catch (err: any) {
                const msg = err?.response?.data?.message || 'Error';
                setBulkStatus(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'err', msg } : s));
            }
        }
        setBulkRunning(false);
        onAdded();
    };

    const inputCls = (err?: string) =>
        `w-full h-9 rounded-lg border ${err ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-400'} bg-white px-3 text-sm outline-none focus:ring-1 focus:border-blue-400 transition-all`;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">Add Device</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Quick-add one device or import multiple at once</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"><X className="h-5 w-5" /></button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                    {(['single', 'bulk'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === t ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {t === 'single' ? '🖥 Single Device' : '📋 Bulk Import'}
                        </button>
                    ))}
                </div>

                {tab === 'single' && (
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Hostname <span className="text-red-500">*</span></label>
                                <input value={single.hostname} onChange={e => { setSingle(p => ({ ...p, hostname: e.target.value })); if (singleErrors.hostname) setSingleErrors(p => { const n = { ...p }; delete n.hostname; return n; }); }}
                                    placeholder="router-hq-01" className={inputCls(singleErrors.hostname)} />
                                {singleErrors.hostname && <p className="text-xs text-red-500 mt-0.5">{singleErrors.hostname}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">IP Address <span className="text-red-500">*</span></label>
                                <input value={single.ipAddress} onChange={e => { setSingle(p => ({ ...p, ipAddress: e.target.value })); if (singleErrors.ipAddress) setSingleErrors(p => { const n = { ...p }; delete n.ipAddress; return n; }); }}
                                    placeholder="10.0.1.1" className={inputCls(singleErrors.ipAddress)} />
                                {singleErrors.ipAddress && <p className="text-xs text-red-500 mt-0.5">{singleErrors.ipAddress}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Device Type</label>
                                <select value={single.deviceType} onChange={e => setSingle(p => ({ ...p, deviceType: e.target.value }))} className={inputCls()}>
                                    {['router', 'switch', 'firewall', 'access_point', 'server', 'unknown'].map(v => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">SNMP Community</label>
                                <input value={single.snmpCommunity} onChange={e => setSingle(p => ({ ...p, snmpCommunity: e.target.value }))} placeholder="public" className={inputCls()} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => { resetSingle(); onClose(); }} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                            <button onClick={handleSingleAdd} disabled={saving}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                {saving ? 'Adding...' : 'Add Device'}
                            </button>
                        </div>
                    </div>
                )}

                {tab === 'bulk' && (
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">IP Addresses <span className="text-gray-400">(one per line)</span></label>
                            <textarea
                                rows={6}
                                value={bulkText}
                                onChange={e => setBulkText(e.target.value)}
                                placeholder={`10.0.1.1\n10.0.1.2\n10.0.1.254`}
                                disabled={bulkRunning}
                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400 font-mono resize-none disabled:opacity-50"
                            />
                            <p className="text-xs text-gray-500 mt-1">Each IP will be added with hostname = the IP, SNMPv2c community 'public', and polling enabled. You can edit them later.</p>
                        </div>
                        {bulkStatus.length > 0 && (
                            <div className="max-h-36 overflow-auto rounded-lg border border-gray-100 bg-gray-50 divide-y divide-gray-100">
                                {bulkStatus.map((s, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.status === 'ok' ? 'bg-green-500' : s.status === 'err' ? 'bg-red-500' : 'bg-gray-300 animate-pulse'
                                            }`} />
                                        <span className="font-mono text-gray-700 flex-1">{s.ip}</span>
                                        {s.status === 'ok' && <span className="text-green-600 font-medium">Added</span>}
                                        {s.status === 'err' && <span className="text-red-600">{s.msg}</span>}
                                        {s.status === 'pending' && <span className="text-gray-400">Waiting...</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-end gap-3">
                            <button onClick={() => { resetBulk(); onClose(); }} disabled={bulkRunning} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Close</button>
                            <button onClick={handleBulkImport} disabled={bulkRunning || !bulkText.trim()}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
                                {bulkRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                {bulkRunning ? 'Importing...' : 'Import Devices'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Bulk Edit Modal ────────────────────────────────────── */

function BulkEditModal({ open, onClose, onUpdated, selectedCount, selectedIds }: { open: boolean; onClose: () => void; onUpdated: () => void; selectedCount: number; selectedIds: number[] }) {
    const { addToast } = useToast();
    const [saving, setSaving] = useState(false);

    const [fields, setFields] = useState({
        deviceType: '',
        pollingInterval: '',
        snmpCommunity: '',
        snmpVersion: '',
    });

    const handleSave = async () => {
        try {
            setSaving(true);
            const dto: any = {};
            if (fields.deviceType) dto.deviceType = fields.deviceType;
            if (fields.pollingInterval) dto.pollingInterval = Number(fields.pollingInterval);
            if (fields.snmpCommunity) dto.snmpCommunity = fields.snmpCommunity;
            if (fields.snmpVersion) dto.snmpVersion = fields.snmpVersion;

            if (Object.keys(dto).length === 0) {
                onClose();
                return;
            }

            // Using api-client to hit the endpoint we just created in the backend
            await api.patch('/devices/bulk-update', { ids: selectedIds, data: dto });

            addToast({ type: 'success', title: 'Bulk Edit Successful', message: `Updated ${selectedCount} devices.` });
            onUpdated();
            onClose();
        } catch (error: any) {
            addToast({ type: 'error', title: 'Update Failed', message: error.response?.data?.message || 'Failed to update devices.' });
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Bulk Edit Devices</h2>
                        <p className="text-sm text-gray-500 mt-1">Applying changes to <span className="font-semibold text-blue-600">{selectedCount}</span> devices.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3 border border-amber-200 flex items-center gap-2 font-medium">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Only fields with values will be updated. Blank fields will be left unchanged.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 focus-within:text-blue-600">
                            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 transition-colors">Device Type</label>
                            <select
                                value={fields.deviceType}
                                onChange={e => setFields(p => ({ ...p, deviceType: e.target.value }))}
                                className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-gray-900"
                            >
                                <option value="">— No Change —</option>
                                <option value="router">Router</option>
                                <option value="switch">Switch</option>
                                <option value="firewall">Firewall</option>
                                <option value="server">Server</option>
                                <option value="access_point">Access Point</option>
                            </select>
                        </div>
                        <div className="space-y-1.5 focus-within:text-blue-600">
                            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 transition-colors">SNMP Version</label>
                            <select
                                value={fields.snmpVersion}
                                onChange={e => setFields(p => ({ ...p, snmpVersion: e.target.value }))}
                                className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-gray-900"
                            >
                                <option value="">— No Change —</option>
                                <option value="v1">v1</option>
                                <option value="v2c">v2c</option>
                                <option value="v3">v3</option>
                            </select>
                        </div>
                        <div className="space-y-1.5 focus-within:text-blue-600">
                            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 transition-colors">Poll Interval (s)</label>
                            <input
                                type="number"
                                min="10"
                                value={fields.pollingInterval}
                                onChange={e => setFields(p => ({ ...p, pollingInterval: e.target.value }))}
                                placeholder="e.g. 60"
                                className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400"
                            />
                        </div>
                        <div className="space-y-1.5 focus-within:text-blue-600">
                            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 transition-colors">SNMP Community</label>
                            <input
                                type="text"
                                value={fields.snmpCommunity}
                                onChange={e => setFields(p => ({ ...p, snmpCommunity: e.target.value }))}
                                placeholder="Public / Private"
                                className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400"
                            />
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-900 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Apply Changes
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Quick View Drawer ──────────────────────────────────── */

function DeviceQuickView({ device, onClose, onFullView }: { device: Device | null; onClose: () => void; onFullView: (id: number) => void }) {
    if (!device) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm transition-opacity">
            <div className="w-[450px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-gray-900">{device.hostname}</h2>
                            <StatusBadge status={device.status} />
                        </div>
                        <p className="text-sm text-gray-500 mt-1 font-mono">{device.ipAddress}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Vitals */}
                    <section>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Device Vitals</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col gap-1">
                                <span className="text-xs font-semibold text-gray-500 uppercase">Platform</span>
                                <span className="text-sm font-medium text-gray-900 capitalize">{device.deviceType.replace('_', ' ')}</span>
                                <span className="text-xs text-gray-500 truncate">{device.osVersion || 'Unknown OS'}</span>
                            </div>
                            <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col gap-1">
                                <span className="text-xs font-semibold text-gray-500 uppercase">Uptime</span>
                                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                                    <Clock className="h-4 w-4 text-gray-400" />
                                    {formatUptime(device.uptime)}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Metadata */}
                    <section>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Metadata</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-sm text-gray-500">Vendor</span>
                                <span className="text-sm font-medium text-gray-900">{device.vendor || '—'}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-sm text-gray-500">Model</span>
                                <span className="text-sm font-medium text-gray-900">{device.model || '—'}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-sm text-gray-500">Poll Interval</span>
                                <span className="text-sm font-medium text-gray-900">{device.pollingInterval}s</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-sm text-gray-500">SNMP Version</span>
                                <span className="text-sm font-medium text-gray-900 uppercase">{device.snmpVersion}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm text-gray-500">Interfaces Linked</span>
                                <span className="text-sm font-medium text-gray-900">{device._count?.interfaces || 0}</span>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                    <button
                        onClick={() => onFullView(device.id)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:text-blue-600 font-medium transition-colors shadow-sm"
                    >
                        <Eye className="h-4 w-4" />
                        View Full Details
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────── */

export default function DevicesPage() {
    const router = useRouter();
    const { data, loading, error, refetch, updateQuery } = useDevices({ limit: 50 });

    // Local UI state — all hooks MUST be above early returns
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [showBulkEdit, setShowBulkEdit] = useState(false);
    const [quickViewDevice, setQuickViewDevice] = useState<Device | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState('');
    const [vendorFilter, setVendorFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<string>('hostname');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(15);
    const [activeMenu, setActiveMenu] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<'detail' | 'compact'>('detail');

    // Selection & delete state
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [showConfirm, setShowConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [singleDeleteTarget, setSingleDeleteTarget] = useState<Device | null>(null);

    const allDevices = data?.items ?? [];

    // Stats
    const stats = useMemo(() => ({
        total: data?.total ?? 0,
        up: allDevices.filter((d: Device) => d.status === 'up').length,
        down: allDevices.filter((d: Device) => d.status === 'down').length,
        unknown: allDevices.filter((d: Device) => d.status !== 'up' && d.status !== 'down').length,
    }), [allDevices, data?.total]);

    const uptimePct = stats.total > 0 ? ((stats.up / stats.total) * 100).toFixed(1) : '0';

    // Unique values for filters
    const vendors = useMemo(() => [...new Set(allDevices.map((d) => d.vendor).filter(Boolean))] as string[], [allDevices]);
    const types = useMemo(() => [...new Set(allDevices.map((d) => d.deviceType).filter(Boolean))], [allDevices]);

    // Filter + search + sort
    const filtered = useMemo(() => {
        let result = allDevices;
        if (statusFilter) result = result.filter((d) => d.status === statusFilter);
        if (typeFilter) result = result.filter((d) => d.deviceType === typeFilter);
        if (vendorFilter) result = result.filter((d) => d.vendor === vendorFilter);
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            result = result.filter((d) =>
                d.hostname.toLowerCase().includes(q) ||
                d.ipAddress.toLowerCase().includes(q) ||
                (d.vendor && d.vendor.toLowerCase().includes(q)) ||
                (d.location?.name && d.location.name.toLowerCase().includes(q))
            );
        }
        // Sort
        result = [...result].sort((a, b) => {
            const av = (a as any)[sortKey] ?? '';
            const bv = (b as any)[sortKey] ?? '';
            const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return result;
    }, [allDevices, statusFilter, typeFilter, vendorFilter, searchTerm, sortKey, sortDir]);

    const totalPages = Math.ceil(filtered.length / pageSize);
    const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const handleStatusFilter = (status: string) => {
        setStatusFilter((prev) => (prev === status ? '' : status));
        setPage(0);
    };

    const hasFilters = statusFilter || typeFilter || vendorFilter || searchTerm;

    // Selection helpers
    const toggleSelect = (id: number) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const toggleAll = () => {
        if (selected.size === paged.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(paged.map((d) => d.id)));
        }
    };
    const isAllSelected = paged.length > 0 && selected.size === paged.length;
    const isSomeSelected = selected.size > 0 && selected.size < paged.length;

    // Delete handlers
    const { addToast } = useToast();
    const handleBulkDelete = async () => {
        try {
            setDeleting(true);
            const count = selected.size;
            await bulkDeleteDevices(Array.from(selected));
            setSelected(new Set());
            setShowConfirm(false);
            addToast({ type: 'success', title: 'Devices Deleted', message: `${count} device${count > 1 ? 's' : ''} deleted successfully.` });
            refetch();
        } catch {
            addToast({ type: 'error', title: 'Delete Failed', message: 'Could not delete the selected devices.' });
        } finally {
            setDeleting(false);
        }
    };
    const handleSingleDelete = async () => {
        if (!singleDeleteTarget) return;
        try {
            setDeleting(true);
            const name = singleDeleteTarget.hostname;
            await deleteDevice(singleDeleteTarget.id);
            setSingleDeleteTarget(null);
            selected.delete(singleDeleteTarget.id);
            setSelected(new Set(selected));
            addToast({ type: 'success', title: 'Device Deleted', message: `"${name}" has been deleted.` });
            refetch();
        } catch {
            addToast({ type: 'error', title: 'Delete Failed', message: `Could not delete "${singleDeleteTarget.hostname}".` });
        } finally {
            setDeleting(false);
        }
    };

    const SortIcon = ({ col }: { col: string }) => {
        if (sortKey !== col) return null;
        return sortDir === 'asc'
            ? <ChevronUp className="h-3.5 w-3.5" />
            : <ChevronDown className="h-3.5 w-3.5" />;
    };

    const thClass = (col: string) =>
        `px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-gray-900 transition-colors`;

    // Early returns AFTER all hooks
    if (loading && !data) return <DashboardSkeleton />;
    if (error || !data) return <ErrorState message={error || 'No data'} onRetry={refetch} />;

    return (
        <div className="space-y-5">
            {/* Header */}
            <PageHeader title="Devices" subtitle={`${stats.total} devices across all locations`}>
                <button
                    onClick={() => {
                        const subnets = window.prompt('Enter subnet(s) to scan (comma-separated, e.g. 10.0.0.0/24):');
                        if (subnets) {
                            api.post('/discovery/scan', { subnets: subnets.split(',').map((s: string) => s.trim()) })
                                .then(({ data }: { data: any }) => {
                                    addToast({ type: 'success', title: 'Discovery Started', message: `Job ${data.jobId || 'started'}. Check results shortly.` });
                                })
                                .catch(() => addToast({ type: 'error', title: 'Discovery Failed', message: 'Could not start discovery scan.' }));
                        }
                    }}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98]"
                >
                    <Scan className="h-4 w-4" />
                    Discover
                </button>
                <button
                    onClick={() => {
                        api.get('/export/devices', { responseType: 'blob' })
                            .then(({ data: blob }) => {
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `devices-${new Date().toISOString().slice(0, 10)}.csv`;
                                a.click();
                                URL.revokeObjectURL(url);
                                addToast({ type: 'success', title: 'Export Complete', message: 'Devices exported as CSV.' });
                            })
                            .catch(() => addToast({ type: 'error', title: 'Export Failed', message: 'Could not export devices.' }));
                    }}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98]"
                >
                    <Download className="h-4 w-4" />
                    Export
                </button>
                <button
                    onClick={() => setShowQuickAdd(true)}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98]"
                >
                    <Plus className="h-4 w-4" />
                    Quick Add
                </button>
                <button
                    onClick={() => router.push('/devices/new')}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-[0.98]"
                >
                    <Plus className="h-4 w-4" />
                    Add Device
                </button>
            </PageHeader>

            {/* Status Cards — clickable filters */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatusCard
                    label="Total Devices"
                    value={stats.total}
                    icon={Server}
                    color="blue"
                    active={statusFilter === ''}
                    onClick={() => handleStatusFilter('')}
                />
                <StatusCard
                    label="Online"
                    value={stats.up}
                    icon={Wifi}
                    color="green"
                    active={statusFilter === 'up'}
                    onClick={() => handleStatusFilter('up')}
                    subtitle={`↑ ${uptimePct}% uptime`}
                />
                <StatusCard
                    label="Offline"
                    value={stats.down}
                    icon={WifiOff}
                    color="red"
                    active={statusFilter === 'down'}
                    onClick={() => handleStatusFilter('down')}
                />
                <StatusCard
                    label="Unknown"
                    value={stats.unknown}
                    icon={AlertTriangle}
                    color="amber"
                    active={statusFilter === 'unknown'}
                    onClick={() => handleStatusFilter('unknown')}
                />
            </div>

            {/* Filter Toolbar */}
            <div className="rounded-xl border border-gray-200 bg-white">
                <div className="flex flex-wrap items-center gap-3 p-3 border-b border-gray-100">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                            placeholder="Search hostname, IP, vendor, location..."
                            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50/50 pl-10 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:bg-white transition-all placeholder:text-gray-400"
                        />
                    </div>

                    {/* Dropdowns */}
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-gray-400" />
                        <FilterDropdown
                            label="All Types"
                            value={typeFilter}
                            options={types.map((t) => ({ value: t, label: t.replace('_', ' ') }))}
                            onChange={(v) => { setTypeFilter(v); setPage(0); }}
                        />
                        <FilterDropdown
                            label="All Vendors"
                            value={vendorFilter}
                            options={vendors.map((v) => ({ value: v, label: v }))}
                            onChange={(v) => { setVendorFilter(v); setPage(0); }}
                        />
                    </div>

                    {/* View toggle */}
                    <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden ml-auto">
                        <button
                            onClick={() => setViewMode('detail')}
                            className={`p-1.5 transition-colors ${viewMode === 'detail' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Detail view"
                        >
                            <LayoutList className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('compact')}
                            className={`p-1.5 transition-colors ${viewMode === 'compact' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Compact view"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Clear filters */}
                    {hasFilters && (
                        <button
                            onClick={() => { setStatusFilter(''); setTypeFilter(''); setVendorFilter(''); setSearchTerm(''); setPage(0); }}
                            className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                            <X className="h-3 w-3" />
                            Clear
                        </button>
                    )}
                </div>

                {/* Active Filter Chips */}
                {hasFilters && (
                    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-gray-100 bg-gray-50/30">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mr-1">Active:</span>
                        {statusFilter && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                                Status: {statusFilter}
                                <button onClick={() => { setStatusFilter(''); setPage(0); }} className="hover:text-blue-900"><X className="h-3 w-3" /></button>
                            </span>
                        )}
                        {typeFilter && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                                Type: {typeFilter.replace('_', ' ')}
                                <button onClick={() => { setTypeFilter(''); setPage(0); }} className="hover:text-purple-900"><X className="h-3 w-3" /></button>
                            </span>
                        )}
                        {vendorFilter && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                                Vendor: {vendorFilter}
                                <button onClick={() => { setVendorFilter(''); setPage(0); }} className="hover:text-emerald-900"><X className="h-3 w-3" /></button>
                            </span>
                        )}
                        {searchTerm && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                                Search: &quot;{searchTerm}&quot;
                                <button onClick={() => { setSearchTerm(''); setPage(0); }} className="hover:text-amber-900"><X className="h-3 w-3" /></button>
                            </span>
                        )}
                    </div>
                )}

                {/* Selection Toolbar */}
                {selected.size > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border-b border-blue-100">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-blue-700">
                                {selected.size} device{selected.size > 1 ? 's' : ''} selected
                            </span>
                            <button
                                onClick={() => setSelected(new Set())}
                                className="text-xs text-blue-600 hover:text-blue-800 underline transition-colors"
                            >
                                Clear selection
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            {selected.size >= 2 && selected.size <= 4 && (
                                <button
                                    onClick={() => router.push(`/devices/compare?ids=${Array.from(selected).join(',')}`)}
                                    className="flex items-center gap-1.5 rounded-lg bg-white border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm"
                                >
                                    <BarChart3 className="h-3.5 w-3.5" />
                                    Compare
                                </button>
                            )}
                            <button
                                onClick={() => setShowBulkEdit(true)}
                                className="flex items-center gap-1.5 rounded-lg bg-white border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all shadow-sm"
                            >
                                <Edit2 className="h-3.5 w-3.5" />
                                Edit Selected
                            </button>
                            <button
                                onClick={() => setShowConfirm(true)}
                                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors shadow-sm"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete Selected
                            </button>
                        </div>
                    </div>
                )}

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-gray-100">
                    {paged.length === 0 ? (
                        <div className="px-4 py-16 text-center">
                            <Server className="mx-auto h-10 w-10 text-blue-400 mb-3" />
                            <p className="text-sm font-medium text-gray-500">{hasFilters ? 'No devices match your filters.' : 'No devices yet.'}</p>
                        </div>
                    ) : (
                        paged.map((device) => (
                            <div key={device.id} className="px-4 py-3 flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={selected.has(device.id)}
                                    onChange={() => toggleSelect(device.id)}
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${device.status === 'up' ? 'bg-green-500' : device.status === 'down' ? 'bg-red-500' : 'bg-gray-400'}`} />
                                        <button
                                            onClick={() => setQuickViewDevice(device)}
                                            className="text-sm font-semibold text-blue-600 truncate hover:underline"
                                        >
                                            {device.hostname}
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                                        <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">{device.ipAddress}</code>
                                        <span className="capitalize">{device.deviceType.replace('_', ' ')}</span>
                                        {device.vendor && <span>{device.vendor}</span>}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatUptime(device.uptime)}</span>
                                        {device.location?.name && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{device.location.name}</span>}
                                    </div>
                                </div>
                                <button
                                    onClick={() => router.push(`/devices/${device.id}`)}
                                    className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors flex-shrink-0"
                                >
                                    <Eye className="h-4 w-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Table (desktop) */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="w-10 px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        ref={(el) => { if (el) el.indeterminate = isSomeSelected; }}
                                        onChange={toggleAll}
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                </th>
                                <th className={thClass('status')} onClick={() => handleSort('status')}>
                                    <div className="flex items-center gap-1">S. <SortIcon col="status" /></div>
                                </th>
                                <th className={thClass('hostname')} onClick={() => handleSort('hostname')}>
                                    <div className="flex items-center gap-1">Device <SortIcon col="hostname" /></div>
                                </th>
                                <th className={thClass('ipAddress')} onClick={() => handleSort('ipAddress')}>
                                    <div className="flex items-center gap-1">IP Address <SortIcon col="ipAddress" /></div>
                                </th>
                                {viewMode === 'detail' && (
                                    <>
                                        <th className={thClass('deviceType')} onClick={() => handleSort('deviceType')}>
                                            <div className="flex items-center gap-1">Platform <SortIcon col="deviceType" /></div>
                                        </th>
                                        <th className={thClass('osVersion')}>
                                            <div className="flex items-center gap-1">Operating System</div>
                                        </th>
                                    </>
                                )}
                                <th className={thClass('uptime')}>
                                    <div className="flex items-center gap-1">Uptime</div>
                                </th>
                                <th className={thClass('location')}>
                                    <div className="flex items-center gap-1">Location</div>
                                </th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                    Health
                                </th>
                                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paged.length === 0 ? (
                                <tr>
                                    <td colSpan={viewMode === 'detail' ? 11 : 9} className="px-4 py-20 text-center">
                                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 mb-4">
                                            <Server className="h-8 w-8 text-blue-500" />
                                        </div>
                                        <h3 className="text-sm font-bold text-gray-900 mb-1">No devices found</h3>
                                        <p className="text-xs text-gray-500 mb-6 max-w-sm mx-auto">
                                            {hasFilters ? "We couldn't find any devices matching your current filters. Try changing your search terms." : "Get started by adding your first network device to begin monitoring traffic and performance."}
                                        </p>
                                        {!hasFilters && (
                                            <button
                                                onClick={() => router.push('/devices/new')}
                                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98]"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Add First Device
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                paged.map((device) => {
                                    const DevIcon = getDeviceIcon(device.deviceType);
                                    return (
                                        <tr
                                            key={device.id}
                                            className={`group transition-colors ${selected.has(device.id) ? 'bg-blue-50/50' : 'hover:bg-blue-50/30'
                                                }`}
                                        >
                                            {/* Checkbox */}
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(device.id)}
                                                    onChange={() => toggleSelect(device.id)}
                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3">
                                                <LastSeenPulse status={device.status} lastPolledAt={device.lastPolledAt} />
                                            </td>

                                            {/* Device Name */}
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => setQuickViewDevice(device)}
                                                    className="text-blue-600 font-semibold hover:text-blue-800 hover:underline transition-colors text-left"
                                                >
                                                    {device.hostname}
                                                </button>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-xs text-gray-400">{device.vendor || 'Unknown'}</span>
                                                    {device._count?.interfaces ? (
                                                        <>
                                                            <span className="text-gray-300">·</span>
                                                            <span className="inline-flex items-center gap-0.5 text-xs text-gray-400">
                                                                <Activity className="h-3 w-3" />
                                                                {device._count.interfaces}
                                                            </span>
                                                        </>
                                                    ) : null}
                                                </div>
                                            </td>

                                            {/* IP Address */}
                                            <td className="px-4 py-3">
                                                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-700">
                                                    {device.ipAddress}
                                                </code>
                                            </td>

                                            {/* Platform (detail only) */}
                                            {
                                                viewMode === 'detail' && (
                                                    <>
                                                        <td className="px-4 py-3">
                                                            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 capitalize">
                                                                {device.deviceType.replace('_', ' ')}
                                                            </span>
                                                            {device.model && (
                                                                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{device.model}</p>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 max-w-[250px]">
                                                            <p className="text-xs text-gray-600 truncate">
                                                                {device.osVersion || '—'}
                                                            </p>
                                                        </td>
                                                    </>
                                                )
                                            }

                                            {/* Uptime */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                                                    <span className="text-xs text-gray-600 font-medium">
                                                        {formatUptime(device.uptime)}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-0.5">
                                                    polled {timeAgo(device.lastPolledAt)}
                                                </p>
                                            </td>

                                            {/* Location */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                                                    <span className="text-xs text-gray-600">
                                                        {device.location?.name || '—'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Health Sparkline */}
                                            <td className="px-4 py-3">
                                                <DeviceHealthCell deviceId={device.id} status={device.status} />
                                            </td>

                                            {/* Actions */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    {/* Quick action icons (visible on hover) */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); router.push(`/devices/${device.id}`); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-all"
                                                        title="View Device"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); router.push(`/alerts?deviceId=${device.id}`); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-amber-600 transition-all"
                                                        title="Check Alerts"
                                                    >
                                                        <Bell className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); window.open(`http://${device.ipAddress}`, '_blank'); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-green-600 transition-all"
                                                        title="Open in Browser"
                                                    >
                                                        <Globe className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); window.open(`ssh://${device.ipAddress}`, '_blank'); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-purple-600 transition-all"
                                                        title="SSH / Telnet"
                                                    >
                                                        <Terminal className="h-4 w-4" />
                                                    </button>

                                                    {/* 3-dot menu */}
                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveMenu(activeMenu === device.id ? null : device.id);
                                                            }}
                                                            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all"
                                                        >
                                                            <MoreVertical className="h-4 w-4" />
                                                        </button>
                                                        {activeMenu === device.id && (
                                                            <ActionMenu
                                                                device={device}
                                                                onClose={() => setActiveMenu(null)}
                                                                onDelete={(d) => setSingleDeleteTarget(d)}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                        <p className="text-xs text-gray-500">
                            Showing {filtered.length === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length} {filtered.length !== data.total ? `(filtered from ${data.total})` : 'entries'}
                        </p>
                        <select
                            value={pageSize}
                            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                            className="h-7 rounded border border-gray-200 bg-white px-1.5 text-xs text-gray-600 outline-none cursor-pointer"
                        >
                            {[10, 15, 25, 50].map((n) => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage(0)}
                            disabled={page === 0}
                            className="px-2 py-1 rounded text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                        >
                            «
                        </button>
                        <button
                            onClick={() => setPage(Math.max(0, page - 1))}
                            disabled={page === 0}
                            className="flex h-7 w-7 items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4 text-gray-500" />
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            const p = page < 3 ? i : Math.min(page - 2 + i, totalPages - 1);
                            if (p >= totalPages || p < 0) return null;
                            return (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`
                                        flex h-7 w-7 items-center justify-center rounded text-xs font-medium transition-colors
                                        ${p === page ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}
                                    `}
                                >
                                    {p + 1}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                            disabled={page >= totalPages - 1}
                            className="flex h-7 w-7 items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
                        >
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                        </button>
                        <button
                            onClick={() => setPage(Math.max(0, totalPages - 1))}
                            disabled={page >= totalPages - 1}
                            className="px-2 py-1 rounded text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                        >
                            »
                        </button>
                    </div>
                </div>
            </div>

            {/* Confirm Dialogs */}
            <ConfirmDialog
                open={showConfirm}
                title="Delete Selected Devices"
                message={`Are you sure you want to delete ${selected.size} device${selected.size > 1 ? 's' : ''}? This action cannot be undone and will also remove all associated interfaces and metrics.`}
                confirmLabel={`Delete ${selected.size} Device${selected.size > 1 ? 's' : ''}`}
                loading={deleting}
                onConfirm={handleBulkDelete}
                onCancel={() => setShowConfirm(false)}
            />
            <ConfirmDialog
                open={!!singleDeleteTarget}
                title="Delete Device"
                message={`Are you sure you want to delete "${singleDeleteTarget?.hostname}"? This action cannot be undone.`}
                confirmLabel="Delete Device"
                loading={deleting}
                onConfirm={handleSingleDelete}
                onCancel={() => setSingleDeleteTarget(null)}
            />

            <QuickAddModal
                open={showQuickAdd}
                onClose={() => setShowQuickAdd(false)}
                onAdded={refetch}
            />

            <BulkEditModal
                open={showBulkEdit}
                onClose={() => setShowBulkEdit(false)}
                onUpdated={() => { setSelected(new Set()); refetch(); }}
                selectedCount={selected.size}
                selectedIds={Array.from(selected)}
            />

            <DeviceQuickView
                device={quickViewDevice}
                onClose={() => setQuickViewDevice(null)}
                onFullView={(id) => {
                    setQuickViewDevice(null);
                    router.push(`/devices/${id}`);
                }}
            />
        </div>
    );
}
