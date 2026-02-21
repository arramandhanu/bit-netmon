'use client';

import { useState } from 'react';
import { AlertTriangle, Lock, Eye, Clock, Globe, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { DataTable, Column } from '@/components/ui/data-table';
import { useAuditLogs, useSecurityStats, AuditLogEntry } from '@/hooks/use-admin';

/* ─── Helper: format relative time ──────────────────────── */

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

/* ─── Component ──────────────────────────────────────────── */

export default function SecurityPage() {
    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);
    const { logs, meta, loading: logsLoading } = useAuditLogs({ page, limit: 25, action: actionFilter });
    const { stats, loading: statsLoading } = useSecurityStats();

    const logColumns: Column<AuditLogEntry>[] = [
        {
            key: 'user',
            header: 'User',
            sortable: true,
            render: (r) => (
                <span className="font-medium">
                    {r.user?.username || r.details?.username || '—'}
                </span>
            ),
        },
        {
            key: 'action',
            header: 'Action',
            sortable: true,
            render: (r) => {
                const colors: Record<string, string> = {
                    login_success: 'text-emerald-400',
                    login_failed: 'text-red-400',
                    settings_update: 'text-blue-400',
                };
                return (
                    <span className={`font-medium ${colors[r.action] || 'text-muted-foreground'}`}>
                        {r.action.replace(/_/g, ' ')}
                    </span>
                );
            },
        },
        {
            key: 'ipAddress',
            header: 'IP Address',
            render: (r) => <span className="font-mono text-xs">{r.ipAddress || '—'}</span>,
        },
        {
            key: 'entity',
            header: 'Entity',
        },
        {
            key: 'details',
            header: 'Details',
            render: (r) => {
                if (!r.details) return '—';
                const reason = r.details.reason;
                return reason ? <span className="text-xs text-muted-foreground">{reason}</span> : '—';
            },
        },
        {
            key: 'createdAt',
            header: 'Time',
            sortable: true,
            render: (r) => <span className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>,
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader title="Security" subtitle="Monitor login attempts and audit trail" />

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Failed Logins (24h)"
                    value={statsLoading ? '...' : stats?.failedLogins24h ?? 0}
                    icon={AlertTriangle}
                />
                <MetricCard
                    label="Active Sessions"
                    value={statsLoading ? '...' : stats?.activeSessions ?? 0}
                    icon={Eye}
                />
                <MetricCard
                    label="Total Audit Logs"
                    value={statsLoading ? '...' : stats?.totalLogs ?? 0}
                    icon={Lock}
                />
                <MetricCard
                    label="Last Activity"
                    value={
                        statsLoading
                            ? '...'
                            : stats?.recentActivity?.[0]
                                ? timeAgo(stats.recentActivity[0].createdAt)
                                : 'None'
                    }
                    icon={Clock}
                />
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2">
                {[
                    { label: 'All', value: undefined },
                    { label: 'Login Success', value: 'login_success' },
                    { label: 'Login Failed', value: 'login_failed' },
                    { label: 'Settings', value: 'settings_update' },
                ].map((f) => (
                    <button
                        key={f.label}
                        onClick={() => { setActionFilter(f.value); setPage(1); }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${actionFilter === f.value
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Audit Log Table */}
            <div>
                <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
                    <Globe className="h-4 w-4 text-primary" />
                    Audit Trail
                </h2>
                {logsLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                        <DataTable data={logs} columns={logColumns} searchKey="action" searchPlaceholder="Search by action..." />
                        {meta?.totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4">
                                <span className="text-xs text-muted-foreground">
                                    Page {meta.page} of {meta.totalPages} ({meta.total} rows)
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page <= 1}
                                        className="rounded-lg border border-border px-3 py-1 text-xs disabled:opacity-50"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                                        disabled={page >= meta.totalPages}
                                        className="rounded-lg border border-border px-3 py-1 text-xs disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
