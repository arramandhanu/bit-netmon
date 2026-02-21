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
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { useDevices, Device, deleteDevice, bulkDeleteDevices } from '@/hooks/use-devices';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast';

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

/* ─── Main Page ──────────────────────────────────────────── */

/* ─── Confirm Dialog ─────────────────────────────────────── */

function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel,
    loading: isLoading,
    onConfirm,
    onCancel,
}: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    loading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-6">{message}</p>
                <div className="flex items-center justify-end gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                    >
                        {isLoading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</>
                        ) : (
                            <><Trash2 className="h-4 w-4" /> {confirmLabel}</>
                        )}
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
                        <button
                            onClick={() => setShowConfirm(true)}
                            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors shadow-sm"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Selected
                        </button>
                    </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
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
                                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paged.length === 0 ? (
                                <tr>
                                    <td colSpan={viewMode === 'detail' ? 9 : 7} className="px-4 py-16 text-center text-gray-400">
                                        <Server className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                                        <p className="text-sm font-medium">No devices found</p>
                                        <p className="text-xs mt-1">Try adjusting your filters</p>
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
                                                <StatusBadge status={device.status} />
                                            </td>

                                            {/* Device Name */}
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => router.push(`/devices/${device.id}`)}
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
        </div>
    );
}
