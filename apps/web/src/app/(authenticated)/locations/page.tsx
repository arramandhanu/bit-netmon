'use client';

import { MapPin, Server, CheckCircle2, XCircle, AlertTriangle, Search } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { cn } from '@/lib/utils';
import { useLocations } from '@/hooks/use-locations';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

export default function LocationsPage() {
    const [search, setSearch] = useState('');
    const { data, loading, error, refetch } = useLocations({ limit: 100 });

    if (loading && !data) return <DashboardSkeleton />;
    if (error || !data) return <ErrorState message={error || 'No data'} onRetry={refetch} />;

    const locations = data.items;
    const totalDevices = locations.reduce((s, l) => s + (l._count?.devices || 0), 0);

    const filtered = locations.filter((l) =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        (l.address || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.city || '').toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div className="space-y-6">
            <PageHeader title="Locations" subtitle={`${locations.length} locations with ${totalDevices.toLocaleString()} devices`} />

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Total Locations" value={locations.length} icon={MapPin} />
                <MetricCard label="Total Devices" value={totalDevices.toLocaleString()} icon={Server} />
                <MetricCard label="Cities" value={new Set(locations.map(l => l.city).filter(Boolean)).size} icon={CheckCircle2} />
                <MetricCard label="With Coordinates" value={locations.filter(l => l.latitude && l.longitude).length} icon={XCircle} />
            </div>

            {/* Search */}
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search locations..."
                    className="h-9 w-full rounded-lg border border-input bg-background/50 pl-10 pr-4 text-sm outline-none ring-ring placeholder:text-muted-foreground focus:ring-2 transition-shadow"
                />
            </div>

            {/* Card Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((loc) => {
                    const deviceCount = loc._count?.devices || 0;

                    return (
                        <div
                            key={loc.id}
                            className={cn(
                                'rounded-xl border bg-card p-5 transition-all hover:shadow-lg hover:scale-[1.01] cursor-pointer',
                                'border-border/50',
                            )}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                        <MapPin className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{loc.name}</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                            {loc.address || loc.city || loc.code}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-2 text-center mb-3">
                                <div className="rounded-lg bg-primary/10 p-2">
                                    <p className="text-lg font-bold">{deviceCount}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">Devices</p>
                                </div>
                                <div className="rounded-lg bg-muted p-2">
                                    <p className="text-lg font-bold">{loc.code}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">Code</p>
                                </div>
                            </div>

                            {/* Coordinates indicator */}
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                {loc.latitude && loc.longitude ? (
                                    <>
                                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                        <span>Coordinates set</span>
                                    </>
                                ) : (
                                    <>
                                        <AlertTriangle className="h-3 w-3 text-amber-400" />
                                        <span>No coordinates</span>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
