'use client';

import { useState } from 'react';
import {
    Bell, AlertTriangle, CheckCircle2, XCircle, Shield,
    Clock, Plus, Eye, Filter,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { DataTable, Column } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import {
    useActiveAlerts,
    useAlertRules,
    useAlertStats,
    acknowledgeAlert,
    resolveAlert,
    AlertEvent,
    AlertRule,
} from '@/hooks/use-alerts';

const severityColor: Record<string, string> = {
    critical: 'border-red-500/20 bg-red-500/5',
    warning: 'border-amber-500/20 bg-amber-500/5',
    info: 'border-blue-500/20 bg-blue-500/5',
};

/* ─── Component ──────────────────────────────────────────── */

export default function AlertsPage() {
    const [tab, setTab] = useState<'active' | 'rules'>('active');
    const { alerts, loading: alertsLoading, error: alertsError, refetch: refetchAlerts } = useActiveAlerts();
    const { rules, loading: rulesLoading, error: rulesError, refetch: refetchRules } = useAlertRules();
    const { stats, loading: statsLoading } = useAlertStats();

    const isLoading = alertsLoading && rulesLoading && statsLoading;
    const hasError = alertsError || rulesError;

    if (isLoading && !alerts.length && !rules.length) return <DashboardSkeleton />;
    if (hasError) return <ErrorState message={alertsError || rulesError || 'Failed to load alerts'} onRetry={() => { refetchAlerts(); refetchRules(); }} />;

    const handleAcknowledge = async (id: number) => {
        try {
            await acknowledgeAlert(id);
            refetchAlerts();
        } catch {
            // Could add toast here
        }
    };

    const handleResolve = async (id: number) => {
        try {
            await resolveAlert(id);
            refetchAlerts();
        } catch {
            // Could add toast here
        }
    };

    /* ─── Alert columns ──────────────────────────────────── */

    const alertColumns: Column<AlertEvent>[] = [
        {
            key: 'severity',
            header: 'Severity',
            className: 'w-24',
            render: (row) => (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${row.severity === 'critical' ? 'bg-red-500/15 text-red-400' :
                        row.severity === 'warning' ? 'bg-amber-500/15 text-amber-400' :
                            'bg-blue-500/15 text-blue-400'
                    }`}>
                    {row.severity === 'critical' ? <XCircle className="h-3 w-3" /> :
                        row.severity === 'warning' ? <AlertTriangle className="h-3 w-3" /> :
                            <Bell className="h-3 w-3" />}
                    {row.severity}
                </span>
            ),
        },
        {
            key: 'message',
            header: 'Message',
            render: (row) => (
                <div>
                    <p className="text-sm font-medium">{row.message || `${row.metricName} threshold exceeded`}</p>
                    <p className="text-xs text-muted-foreground">Device #{row.deviceId}</p>
                </div>
            ),
        },
        {
            key: 'metricValue',
            header: 'Value',
            render: (row) => (
                <span className="text-sm">{row.metricValue} / {row.thresholdValue}</span>
            ),
        },
        {
            key: 'state',
            header: 'State',
            render: (row) => <StatusBadge status={row.state} />,
        },
        {
            key: 'triggeredAt',
            header: 'Time',
            render: (row) => (
                <span className="text-xs text-muted-foreground">
                    {new Date(row.triggeredAt).toLocaleString()}
                </span>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
                <div className="flex gap-1">
                    {row.state === 'triggered' && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleAcknowledge(row.id); }}
                                className="rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
                            >
                                Acknowledge
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleResolve(row.id); }}
                                className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                            >
                                Resolve
                            </button>
                        </>
                    )}
                    {row.state === 'acknowledged' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleResolve(row.id); }}
                            className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        >
                            Resolve
                        </button>
                    )}
                </div>
            ),
        },
    ];

    /* ─── Rule columns ───────────────────────────────────── */

    const ruleColumns: Column<AlertRule>[] = [
        {
            key: 'enabled',
            header: 'Status',
            className: 'w-20',
            render: (row) => (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${row.enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'
                    }`}>
                    {row.enabled ? 'Active' : 'Disabled'}
                </span>
            ),
        },
        { key: 'name', header: 'Name', sortable: true },
        { key: 'metric', header: 'Metric', sortable: true },
        {
            key: 'condition',
            header: 'Condition',
            render: (row) => <span className="text-sm font-mono">{row.condition} {row.threshold}</span>,
        },
        {
            key: 'severity',
            header: 'Severity',
            render: (row) => (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${row.severity === 'critical' ? 'bg-red-500/15 text-red-400' :
                        row.severity === 'warning' ? 'bg-amber-500/15 text-amber-400' :
                            'bg-blue-500/15 text-blue-400'
                    }`}>
                    {row.severity}
                </span>
            ),
        },
        {
            key: 'duration',
            header: 'Duration',
            render: (row) => <span className="text-sm text-muted-foreground">{row.duration}s</span>,
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader title="Alerts" subtitle="Monitoring alerts and rules">
                <button className="flex items-center gap-2 rounded-lg gradient-primary px-4 py-2 text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all hover:opacity-90">
                    <Plus className="h-4 w-4" />
                    New Rule
                </button>
            </PageHeader>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Active Alerts" value={stats?.active ?? alerts.filter(a => a.state === 'triggered').length} icon={Bell} />
                <MetricCard label="Critical" value={stats?.critical ?? alerts.filter(a => a.severity === 'critical').length} icon={XCircle} />
                <MetricCard label="Acknowledged" value={stats?.acknowledged ?? alerts.filter(a => a.state === 'acknowledged').length} icon={Eye} />
                <MetricCard label="Alert Rules" value={stats?.rules ?? rules.length} icon={Shield} />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border/50">
                <button
                    onClick={() => setTab('active')}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === 'active' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Active Alerts ({alerts.length})
                </button>
                <button
                    onClick={() => setTab('rules')}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === 'rules' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Alert Rules ({rules.length})
                </button>
            </div>

            {/* Tab content */}
            {tab === 'active' ? (
                alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <CheckCircle2 className="h-12 w-12 text-emerald-400 opacity-40 mb-3" />
                        <h3 className="font-semibold text-lg">All Clear</h3>
                        <p className="text-sm text-muted-foreground">No active alerts at the moment</p>
                    </div>
                ) : (
                    <DataTable data={alerts} columns={alertColumns} searchKey="message" searchPlaceholder="Search alerts..." />
                )
            ) : (
                <DataTable data={rules} columns={ruleColumns} searchKey="name" searchPlaceholder="Search rules..." />
            )}
        </div>
    );
}
