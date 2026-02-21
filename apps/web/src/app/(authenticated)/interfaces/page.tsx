'use client';

import { Activity, ArrowUpDown, Gauge, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { DataTable, Column } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { useDevices, Device, DeviceInterface } from '@/hooks/use-devices';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

/* ─── Helper ─────────────────────────────────────────────── */

interface FlatInterface extends DeviceInterface {
    deviceHostname: string;
}

function formatSpeed(speed: number | null): string {
    if (!speed) return '—';
    if (speed >= 1_000_000_000) return `${(speed / 1_000_000_000).toFixed(0)} Gbps`;
    if (speed >= 1_000_000) return `${(speed / 1_000_000).toFixed(0)} Mbps`;
    if (speed >= 1_000) return `${(speed / 1_000).toFixed(0)} Kbps`;
    return `${speed} bps`;
}

/* ─── Component ──────────────────────────────────────────── */

export default function InterfacesPage() {
    const { data, loading, error, refetch } = useDevices({ limit: 100 });

    if (loading && !data) return <DashboardSkeleton />;
    if (error || !data) return <ErrorState message={error || 'No data'} onRetry={refetch} />;

    // Flatten all interfaces from all devices
    const interfaces: FlatInterface[] = data.items.flatMap((device) =>
        (device.interfaces || []).map((iface) => ({
            ...iface,
            deviceHostname: device.hostname,
        })),
    );

    const totalUp = interfaces.filter((i) => i.ifOperStatus === 'up').length;
    const totalDown = interfaces.filter((i) => i.ifOperStatus === 'down').length;

    const columns: Column<FlatInterface>[] = [
        { key: 'ifOperStatus', header: 'Status', className: 'w-20', render: (r) => <StatusBadge status={r.ifOperStatus} /> },
        { key: 'deviceHostname', header: 'Device', sortable: true, render: (r) => <span className="font-medium">{r.deviceHostname}</span> },
        { key: 'ifName', header: 'Interface', sortable: true, render: (r) => <span className="font-mono text-xs">{r.ifName}</span> },
        { key: 'ifSpeed', header: 'Speed', sortable: true, render: (r) => <span>{formatSpeed(r.ifSpeed)}</span> },
        { key: 'ifType', header: 'Type', render: (r) => <span className="text-muted-foreground text-xs">{r.ifType || '—'}</span> },
        { key: 'ifAlias', header: 'Description', render: (r) => <span className="text-muted-foreground text-xs">{r.ifAlias || '—'}</span> },
        {
            key: 'ifAdminStatus',
            header: 'Admin',
            className: 'w-20',
            render: (r) => <StatusBadge status={r.ifAdminStatus} />,
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader title="Interfaces" subtitle={`${interfaces.length} interfaces across ${data.items.length} devices`} />

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Total Interfaces" value={interfaces.length} icon={Activity} />
                <MetricCard label="Oper Up" value={totalUp} icon={Activity} trend={interfaces.length > 0 ? `${Math.round((totalUp / interfaces.length) * 100)}%` : '0%'} trendUp />
                <MetricCard label="Oper Down" value={totalDown} icon={ArrowUpDown} />
                <MetricCard label="Devices" value={data.items.length} icon={Gauge} />
            </div>

            {/* Table */}
            <DataTable
                data={interfaces}
                columns={columns}
                searchKey="deviceHostname"
                searchPlaceholder="Search by device..."
            />
        </div>
    );
}
