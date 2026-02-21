'use client';

import { useEffect, useRef, useState } from 'react';
import { Map as MapIcon, Server } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useLocations } from '@/hooks/use-locations';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

const statusColors: Record<string, string> = {
    up: '#10b981',
    down: '#ef4444',
    warning: '#f59e0b',
};

/* ─── Component ──────────────────────────────────────────── */

export default function NetworkMapPage() {
    const mapRef = useRef<HTMLDivElement>(null);
    const [mapReady, setMapReady] = useState(false);
    const { data, loading, error, refetch } = useLocations({ limit: 100 });

    useEffect(() => {
        if (!mapRef.current || !data) return;

        const locationsWithCoords = data.items.filter(l => l.latitude && l.longitude);
        if (locationsWithCoords.length === 0) return;

        let mapInstance: any = null;

        Promise.all([
            import('leaflet'),
            import('leaflet/dist/leaflet.css' as any),
        ]).then(([L]) => {
            if (!mapRef.current) return;

            mapInstance = L.map(mapRef.current, {
                zoomControl: true,
                attributionControl: false,
            }).setView([-2.5, 117.0], 5);

            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                subdomains: 'abcd',
                maxZoom: 19,
            }).addTo(mapInstance);

            locationsWithCoords.forEach((loc) => {
                const color = statusColors.up; // Default — future: aggregate device statuses
                const deviceCount = loc._count?.devices || 0;

                const icon = L.divIcon({
                    className: 'custom-marker',
                    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.6);box-shadow:0 0 10px ${color}80;"></div>`,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7],
                });

                const marker = L.marker([loc.latitude!, loc.longitude!], { icon }).addTo(mapInstance);
                marker.bindPopup(`
                    <div style="font-family:system-ui;font-size:12px;min-width:180px;">
                        <strong style="font-size:13px;">${loc.name}</strong><br/>
                        <span style="color:#94a3b8;">${loc.address || loc.city || ''}</span><br/>
                        <span style="color:#94a3b8;">${deviceCount} devices</span><br/><br/>
                        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:4px;"></span>
                        <span style="text-transform:uppercase;font-weight:600;color:${color};">${loc.code}</span>
                    </div>
                `);
            });

            setMapReady(true);
        });

        return () => {
            mapInstance?.remove();
        };
    }, [data]);

    if (loading && !data) return <DashboardSkeleton />;
    if (error) return <ErrorState message={error} onRetry={refetch} />;

    const locationsWithCoords = data?.items.filter(l => l.latitude && l.longitude) || [];

    return (
        <div className="space-y-6">
            <PageHeader title="Network Map" subtitle={`${locationsWithCoords.length} locations with coordinates`}>
                <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" /> Up
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" /> Warning
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" /> Down
                    </span>
                </div>
            </PageHeader>

            {/* Map */}
            <div className="rounded-xl border border-border bg-card overflow-hidden relative" style={{ height: '550px' }}>
                <div ref={mapRef} className="h-full w-full" />
                {!mapReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-card">
                        <div className="flex flex-col items-center gap-2">
                            <MapIcon className="h-8 w-8 text-muted-foreground animate-pulse" />
                            <p className="text-sm text-muted-foreground">Loading map...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Location list */}
            <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Server className="h-4 w-4 text-primary" />
                    Locations ({locationsWithCoords.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {locationsWithCoords.map((loc) => (
                        <div key={loc.id} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors cursor-pointer">
                            <span
                                className="h-3 w-3 rounded-full shrink-0"
                                style={{ backgroundColor: statusColors.up, boxShadow: `0 0 8px ${statusColors.up}80` }}
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{loc.name}</p>
                                <p className="text-[11px] text-muted-foreground">{loc._count?.devices || 0} devices · {loc.code}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
