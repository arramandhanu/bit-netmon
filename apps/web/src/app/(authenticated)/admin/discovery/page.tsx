'use client';

import { useState } from 'react';
import { Radar, Play, Loader2, CheckCircle2, XCircle, Server, Clock } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { DataTable, Column } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { useDiscoveryScan, DiscoveryScanResult } from '@/hooks/use-admin';
import { ErrorState } from '@/components/ui/error-state';

/* ─── Component ──────────────────────────────────────────── */

export default function DiscoveryPage() {
    const [subnet, setSubnet] = useState('10.10.0.0/24');
    const [community, setCommunity] = useState('public');
    const { results, scanning, error, startScan } = useDiscoveryScan();

    const handleScan = () => {
        startScan(subnet, community);
    };

    const columns: Column<DiscoveryScanResult>[] = [
        { key: 'ip', header: 'IP Address', sortable: true, render: (r) => <span className="font-mono text-xs">{r.ip}</span> },
        { key: 'hostname', header: 'Hostname', sortable: true, render: (r) => <span className="font-medium">{r.hostname || '—'}</span> },
        { key: 'vendor', header: 'Vendor', sortable: true, render: (r) => <span>{r.vendor || 'Unknown'}</span> },
        {
            key: 'type',
            header: 'Type',
            render: (r) => (
                <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium capitalize">
                    {r.type.replace('_', ' ')}
                </span>
            ),
        },
        { key: 'status', header: 'Ping', render: (r) => <StatusBadge status={r.status} /> },
        {
            key: 'snmpReachable',
            header: 'SNMP',
            render: (r) =>
                r.snmpReachable ? (
                    <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> Reachable</span>
                ) : (
                    <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle className="h-3.5 w-3.5" /> Unreachable</span>
                ),
        },
        {
            key: 'added',
            header: 'Action',
            render: (r) =>
                r.added ? (
                    <span className="text-xs text-muted-foreground">Already added</span>
                ) : r.snmpReachable ? (
                    <button className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                        Add Device
                    </button>
                ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader title="Network Discovery" subtitle="Scan subnets to discover and add devices" />

            {/* KPIs */}
            {results.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard label="Hosts Found" value={results.length} icon={Radar} />
                    <MetricCard label="SNMP Reachable" value={results.filter((r) => r.snmpReachable).length} icon={CheckCircle2} />
                    <MetricCard label="Already Added" value={results.filter((r) => r.added).length} icon={Server} />
                    <MetricCard label="New Devices" value={results.filter((r) => !r.added && r.snmpReachable).length} icon={Clock} />
                </div>
            )}

            {/* Scan form */}
            <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Radar className="h-4 w-4 text-primary" />
                    Scan Configuration
                </h2>
                <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-1.5 flex-1 min-w-[200px]">
                        <label className="text-sm font-medium">Subnet / CIDR</label>
                        <input
                            type="text"
                            value={subnet}
                            onChange={(e) => setSubnet(e.target.value)}
                            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 ring-ring"
                            placeholder="10.10.0.0/24"
                        />
                    </div>
                    <div className="space-y-1.5 w-48">
                        <label className="text-sm font-medium">SNMP Community</label>
                        <input
                            type="text"
                            value={community}
                            onChange={(e) => setCommunity(e.target.value)}
                            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 ring-ring"
                            placeholder="public"
                        />
                    </div>
                    <button
                        onClick={handleScan}
                        disabled={scanning}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50 transition-all"
                    >
                        {scanning ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Scanning...
                            </>
                        ) : (
                            <>
                                <Play className="h-4 w-4" />
                                Start Scan
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && <ErrorState message={error} onRetry={handleScan} />}

            {/* Results */}
            {results.length > 0 && (
                <DataTable data={results} columns={columns} searchKey="ip" searchPlaceholder="Search by IP..." />
            )}
        </div>
    );
}
