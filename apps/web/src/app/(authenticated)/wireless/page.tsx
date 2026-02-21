'use client';

import { Wifi, WifiOff, Users, Radio, Signal } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { DataTable, Column } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { useDevices, Device } from '@/hooks/use-devices';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

/* ─── Component ──────────────────────────────────────────── */

export default function WirelessPage() {
    const { data, loading, error, refetch } = useDevices({ type: 'access_point', limit: 100 });

    if (loading && !data) return <DashboardSkeleton />;
    if (error || !data) return <ErrorState message={error || 'No data'} onRetry={refetch} />;

    const accessPoints = data.items;
    const totalOnline = accessPoints.filter((ap) => ap.status === 'up').length;
    const totalOffline = accessPoints.filter((ap) => ap.status === 'down').length;

    const columns: Column<Device>[] = [
        { key: 'status', header: 'Status', className: 'w-20', render: (r) => <StatusBadge status={r.status} /> },
        { key: 'hostname', header: 'AP Name', sortable: true, render: (r) => <span className="font-medium">{r.hostname}</span> },
        { key: 'ipAddress', header: 'IP', sortable: true },
        { key: 'vendor', header: 'Vendor', render: (r) => <span>{r.vendor || '—'}</span> },
        { key: 'model', header: 'Model', render: (r) => <span>{r.model || '—'}</span> },
        {
            key: 'location',
            header: 'Location',
            sortable: true,
            render: (r) => <span>{r.location?.name || '—'}</span>,
        },
        {
            key: 'interfaces',
            header: 'Interfaces',
            render: (r) => <span className="text-muted-foreground">{r._count?.interfaces || 0}</span>,
        },
        {
            key: 'lastPolledAt',
            header: 'Last Polled',
            render: (r) => (
                <span className="text-xs text-muted-foreground">
                    {r.lastPolledAt ? new Date(r.lastPolledAt).toLocaleTimeString() : 'Never'}
                </span>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader title="Wireless" subtitle={`${accessPoints.length} access points managed`} />

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Total APs" value={accessPoints.length} icon={Radio} />
                <MetricCard label="Online" value={totalOnline} icon={Wifi} trend={accessPoints.length > 0 ? `${Math.round((totalOnline / accessPoints.length) * 100)}%` : '0%'} trendUp />
                <MetricCard label="Offline" value={totalOffline} icon={WifiOff} />
                <MetricCard label="Total Devices" value={data.total} icon={Users} />
            </div>

            {/* Table */}
            <DataTable
                data={accessPoints}
                columns={columns}
                searchKey="hostname"
                searchPlaceholder="Search APs..."
            />
        </div>
    );
}
