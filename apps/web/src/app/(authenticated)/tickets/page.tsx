'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Ticket, AlertCircle, Clock, CheckCircle2, TrendingUp, Lock,
    Filter, ChevronDown, RefreshCw, User, ChevronLeft, ChevronRight,
    Plus, Search, Inbox, Download, Trash2, ArrowUpDown, ArrowUp, ArrowDown,
    UserPlus, CheckSquare, ArrowUpRight, PauseCircle,
} from 'lucide-react';
import { useTickets, useTicketStats, deleteTicket, updateTicket } from '@/hooks/use-tickets';
import type { Ticket as TicketType } from '@/hooks/use-tickets';
import { getStoredUser } from '@/hooks/use-auth';
import { MetricCard } from '@/components/ui/metric-card';

/* ─── Status / Priority Configs ─────────────────────────── */

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    open: { label: 'Open', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    in_progress: { label: 'In Progress', bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-500' },
    waiting: { label: 'Waiting', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    escalated: { label: 'Escalated', bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
    on_hold: { label: 'On Hold', bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
    resolved: { label: 'Resolved', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    closed: { label: 'Closed', bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' },
};

const priorityConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
    critical: { label: 'Critical', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' },
    high: { label: 'High', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' },
    medium: { label: 'Medium', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
    low: { label: 'Low', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
};

/* ─── Sort Header Helper ────────────────────────────────── */

interface SortHeaderProps {
    label: string;
    field: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    onSort: (field: string) => void;
    align?: 'left' | 'right';
}

function SortHeader({ label, field, sortBy, sortOrder, onSort, align = 'left' }: SortHeaderProps) {
    const active = sortBy === field;
    return (
        <th
            className={`px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest cursor-pointer hover:text-foreground select-none transition-colors ${align === 'right' ? 'text-right' : ''}`}
            onClick={() => onSort(field)}
        >
            <span className="inline-flex items-center gap-1">
                {label}
                {active ? (
                    sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                )}
            </span>
        </th>
    );
}

/* ─── Component ──────────────────────────────────────────── */

export default function TicketsPage() {
    const router = useRouter();
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Bulk selection
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [bulkAction, setBulkAction] = useState('');
    const [bulkProcessing, setBulkProcessing] = useState(false);
    const currentUser = getStoredUser();
    const isAdmin = currentUser?.role === 'admin';

    const { data, loading, refetch } = useTickets({ page, status, search, limit: 15, sortBy, sortOrder });
    const { stats } = useTicketStats();

    const tickets = data?.data ?? [];
    const meta = data?.meta ?? null;
    const totalPages = meta?.totalPages || 1;

    const handleSearch = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setPage(1);
        refetch();
    }, [refetch]);

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
        setPage(1);
    };

    // ─── Bulk Actions ──────────────────────────────────
    const toggleSelect = (id: number) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selected.size === tickets.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(tickets.map((t: TicketType) => t.id)));
        }
    };

    const handleBulkAction = async () => {
        if (selected.size === 0 || !bulkAction) return;
        setBulkProcessing(true);
        try {
            const ids = Array.from(selected);
            if (bulkAction === 'delete') {
                if (!confirm(`Delete ${ids.length} ticket(s)? This cannot be undone.`)) { setBulkProcessing(false); return; }
                await Promise.all(ids.map(id => deleteTicket(id)));
            } else if (['open', 'in_progress', 'waiting', 'resolved', 'closed'].includes(bulkAction)) {
                await Promise.all(ids.map(id => updateTicket(id, { status: bulkAction })));
            }
            setSelected(new Set());
            setBulkAction('');
            refetch();
        } catch (err) {
            console.error('Bulk action failed', err);
        } finally {
            setBulkProcessing(false);
        }
    };

    // ─── CSV Export ─────────────────────────────────────
    const handleExport = () => {
        const rows = tickets.map((t: TicketType) => ({
            'Ticket ID': t.ticketNumber,
            Title: t.title,
            Status: t.status,
            Priority: t.priority,
            Category: t.category,
            Assignee: t.assignee?.displayName || t.assignee?.username || 'Unassigned',
            Creator: t.creator?.displayName || t.creator?.username || '',
            Device: t.device?.displayName || t.device?.hostname || '',
            'Due Date': t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '',
            Created: new Date(t.createdAt).toLocaleString(),
        }));

        if (rows.length === 0) return;
        const headers = Object.keys(rows[0]);
        const csv = [
            headers.join(','),
            ...rows.map((r: Record<string, string>) => headers.map(h => `"${(r[h] || '').replace(/"/g, '""')}"`).join(',')),
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tickets-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-8">
            {/* Page Title */}
            <div className="flex items-end justify-between">
                <div>
                    <h2 className="text-2xl font-extrabold tracking-tight">Support Tickets</h2>
                    <p className="text-muted-foreground font-medium">Monitor and manage network incident responses</p>
                </div>
                <Link
                    href="/tickets/create"
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-[0.98]"
                >
                    <Plus className="h-4 w-4" />
                    Create New Ticket
                </Link>
            </div>

            {/* ─── Stat Cards (clickable filters) ─────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <MetricCard label="Total" value={stats?.total ?? 0} icon={Ticket} iconBg="bg-blue-100" iconColor="text-blue-600" active={status === ''} onClick={() => { setStatus(''); setPage(1); }} />
                <MetricCard label="Open" value={stats?.open ?? 0} icon={Inbox} iconBg="bg-sky-100" iconColor="text-sky-600" active={status === 'open'} onClick={() => { setStatus('open'); setPage(1); }} />
                <MetricCard label="In Progress" value={stats?.inProgress ?? 0} icon={Clock} iconBg="bg-orange-100" iconColor="text-orange-600" active={status === 'in_progress'} onClick={() => { setStatus('in_progress'); setPage(1); }} />
                <MetricCard label="Escalated" value={stats?.escalated ?? 0} icon={ArrowUpRight} iconBg="bg-rose-100" iconColor="text-rose-600" active={status === 'escalated'} onClick={() => { setStatus('escalated'); setPage(1); }} />
                <MetricCard label="On Hold" value={stats?.onHold ?? 0} icon={PauseCircle} iconBg="bg-purple-100" iconColor="text-purple-600" active={status === 'on_hold'} onClick={() => { setStatus('on_hold'); setPage(1); }} />
                <MetricCard label="Resolved" value={stats?.resolved ?? 0} icon={CheckCircle2} iconBg="bg-emerald-100" iconColor="text-emerald-600" active={status === 'resolved'} onClick={() => { setStatus('resolved'); setPage(1); }} />
                <MetricCard label="Closed" value={stats?.closed ?? 0} icon={Lock} iconBg="bg-slate-100" iconColor="text-slate-600" active={status === 'closed'} onClick={() => { setStatus('closed'); setPage(1); }} />
            </div>

            {/* ─── Filter Bar + Table ───────────────────────── */}
            <div className="bg-card rounded-2xl border border-border/30 shadow-sm overflow-hidden">
                {/* Filter bar */}
                <div className="p-5 border-b border-border/30 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <form onSubmit={handleSearch} className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search tickets..."
                                className="pl-9 pr-3 py-2 rounded-xl text-sm border border-border/50 bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 w-48"
                            />
                        </form>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-primary border border-border/50 rounded-xl hover:border-primary/30 transition-all" title="Export CSV">
                            <Download className="h-3.5 w-3.5" />
                            Export
                        </button>
                        <button onClick={() => refetch()} className="p-2 text-muted-foreground hover:text-primary transition-colors" title="Refresh">
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Bulk action bar */}
                {selected.size > 0 && (
                    <div className="px-5 py-3 bg-primary/5 border-b border-primary/20 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <CheckSquare className="h-4 w-4 text-primary" />
                            <span className="text-sm font-bold text-primary">{selected.size} selected</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <select
                                value={bulkAction}
                                onChange={(e) => setBulkAction(e.target.value)}
                                className="px-3 py-1.5 text-sm rounded-lg border border-border/50 bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                            >
                                <option value="">Choose action...</option>
                                <optgroup label="Change Status">
                                    <option value="open">Set Open</option>
                                    <option value="in_progress">Set In Progress</option>
                                    <option value="waiting">Set Waiting</option>
                                    <option value="resolved">Set Resolved</option>
                                    <option value="closed">Set Closed</option>
                                </optgroup>
                                {isAdmin && <option value="delete">Delete Selected</option>}
                            </select>
                            <button
                                onClick={handleBulkAction}
                                disabled={bulkProcessing || !bulkAction}
                                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all"
                            >
                                {bulkProcessing ? 'Processing...' : 'Apply'}
                            </button>
                            <button
                                onClick={() => { setSelected(new Set()); setBulkAction(''); }}
                                className="text-sm text-muted-foreground hover:text-foreground"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-accent/50">
                            <tr>
                                <th className="px-6 py-4 w-12">
                                    <input
                                        type="checkbox"
                                        checked={tickets.length > 0 && selected.size === tickets.length}
                                        onChange={toggleSelectAll}
                                        className="rounded border-border/50 text-primary focus:ring-primary/20 cursor-pointer"
                                    />
                                </th>
                                <SortHeader label="Ticket ID" field="ticketNumber" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Subject</th>
                                <SortHeader label="Status" field="status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                <SortHeader label="Priority" field="priority" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Assigned To</th>
                                <SortHeader label="Created" field="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center">
                                        <div className="h-6 w-6 mx-auto animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                                    </td>
                                </tr>
                            ) : tickets.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center">
                                        <Ticket className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                                        <p className="font-bold text-muted-foreground">No tickets found</p>
                                        <p className="text-xs text-muted-foreground/70 mt-1">Create your first ticket to get started</p>
                                    </td>
                                </tr>
                            ) : (
                                tickets.map((ticket: TicketType) => {
                                    const sc = statusConfig[ticket.status] || statusConfig.open;
                                    const pc = priorityConfig[ticket.priority] || priorityConfig.medium;
                                    const isOverdue = ticket.dueDate && new Date(ticket.dueDate) < new Date() && !['resolved', 'closed'].includes(ticket.status);
                                    const isSelected = selected.has(ticket.id);

                                    return (
                                        <tr
                                            key={ticket.id}
                                            className={`hover:bg-accent/30 transition-colors cursor-pointer group ${isOverdue ? 'bg-red-50/30' : ''} ${isSelected ? 'bg-primary/5' : ''}`}
                                        >
                                            <td className="px-6 py-5" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelect(ticket.id)}
                                                    className="rounded border-border/50 text-primary focus:ring-primary/20 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-6 py-5" onClick={() => router.push(`/tickets/${ticket.id}`)}>
                                                <span className="font-bold text-primary group-hover:underline">
                                                    {ticket.ticketNumber}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5" onClick={() => router.push(`/tickets/${ticket.id}`)}>
                                                <p className="font-bold">{ticket.title}</p>
                                                {ticket.device && (
                                                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                                                        {ticket.device.displayName || ticket.device.hostname}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-6 py-5" onClick={() => router.push(`/tickets/${ticket.id}`)}>
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${sc.bg} ${sc.text}`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${sc.dot} mr-2`} />
                                                    {isOverdue ? 'Overdue' : sc.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5" onClick={() => router.push(`/tickets/${ticket.id}`)}>
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${pc.bg} ${pc.text} border ${pc.border}`}>
                                                    {pc.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5" onClick={() => router.push(`/tickets/${ticket.id}`)}>
                                                {ticket.assignee ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                                            {(ticket.assignee.displayName || ticket.assignee.username)[0].toUpperCase()}
                                                        </div>
                                                        <span className="text-sm font-semibold">{ticket.assignee.displayName || ticket.assignee.username}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <User className="h-4 w-4" />
                                                        <span className="text-sm font-medium italic">Unassigned</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-5 text-right text-sm text-muted-foreground font-medium" onClick={() => router.push(`/tickets/${ticket.id}`)}>
                                                {new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-border/30 flex items-center justify-between bg-accent/30">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        Showing {tickets.length} of {meta?.total ?? 0} tickets
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(Math.max(1, page - 1))}
                            disabled={page <= 1}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/50 bg-card hover:bg-accent disabled:opacity-50 transition-colors"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPage(p)}
                                className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${p === page
                                    ? 'bg-primary text-primary-foreground border border-primary'
                                    : 'border border-border/50 bg-card hover:bg-accent'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                        <button
                            onClick={() => setPage(Math.min(totalPages, page + 1))}
                            disabled={page >= totalPages}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/50 bg-card hover:bg-accent disabled:opacity-50 transition-colors"
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
