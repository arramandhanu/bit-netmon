'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Map as MapIcon, Server, GitBranch, Building2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useLocations, Location } from '@/hooks/use-locations';
import { useDevices, Device } from '@/hooks/use-devices';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useRouter, useSearchParams } from 'next/navigation';

const statusColors: Record<string, string> = {
    up: '#10b981',
    down: '#ef4444',
    warning: '#f59e0b',
    maintenance: '#8b5cf6',
    unknown: '#94a3b8',
};

/* ─── Health Color Helper ────────────────────────────────── */

function getLocationHealth(loc: any): string {
    const summary = loc.statusSummary || {};
    if (summary.down > 0) return statusColors.down;
    if (summary.warning > 0) return statusColors.warning;
    if (summary.maintenance > 0) return statusColors.maintenance;
    if (summary.up > 0) return statusColors.up;
    return statusColors.unknown;
}

/* ─── Topology View ────────────────────────────────────── */

function TopologyView({
    devices,
    locations,
    groupBy,
}: {
    devices: Device[];
    locations: Location[];
    groupBy: 'subnet' | 'location';
}) {
    const router = useRouter();
    const svgRef = useRef<SVGSVGElement>(null);
    const [hovered, setHovered] = useState<number | null>(null);

    // Group devices
    const groups = useMemo(() => {
        const map = new Map<string, Device[]>();
        if (groupBy === 'location') {
            const locMap = new Map<number, string>();
            locations.forEach(l => locMap.set(l.id, l.name));
            devices.forEach(d => {
                const key = locMap.get((d as any).locationId) || 'Unknown';
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(d);
            });
        } else {
            devices.forEach(d => {
                const subnet = d.ipAddress.split('.').slice(0, 3).join('.') + '.0/24';
                if (!map.has(subnet)) map.set(subnet, []);
                map.get(subnet)!.push(d);
            });
        }
        return Array.from(map.entries());
    }, [devices, locations, groupBy]);

    // Radial layout
    const layout = useMemo(() => {
        const nodes: { device: Device; x: number; y: number }[] = [];
        const cx = 500, cy = 350;
        const groupRadius = Math.min(280, 100 + groups.length * 30);

        groups.forEach(([, grpDevices], gi) => {
            const gAngle = (gi / Math.max(groups.length, 1)) * 2 * Math.PI - Math.PI / 2;
            const gx = cx + groupRadius * Math.cos(gAngle);
            const gy = cy + groupRadius * Math.sin(gAngle);
            const nodeRadius = 20 + grpDevices.length * 12;
            grpDevices.forEach((d: Device, di: number) => {
                const nAngle = (di / Math.max(grpDevices.length, 1)) * 2 * Math.PI - Math.PI / 2;
                nodes.push({ device: d, x: gx + nodeRadius * Math.cos(nAngle), y: gy + nodeRadius * Math.sin(nAngle) });
            });
        });
        return nodes;
    }, [groups]);

    // Edges
    const edges = useMemo(() => {
        const result: { from: number; to: number }[] = [];
        groups.forEach(([, grpDevices]) => {
            for (let i = 0; i < grpDevices.length; i++) {
                for (let j = i + 1; j < grpDevices.length; j++) {
                    result.push({ from: grpDevices[i].id, to: grpDevices[j].id });
                }
            }
        });
        return result;
    }, [groups]);

    const nodeMap = useMemo(() => {
        const m = new Map<number, (typeof layout)[0]>();
        layout.forEach(n => m.set(n.device.id, n));
        return m;
    }, [layout]);

    return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden relative" style={{ height: '600px' }}>
            <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 1000 700" className="block">
                {/* Group labels */}
                {groups.map(([label, grpDevices]) => {
                    const first = nodeMap.get(grpDevices[0].id);
                    if (!first) return null;
                    return (
                        <text key={label} x={first.x} y={first.y - 30} textAnchor="middle"
                            className="fill-gray-400 text-[10px] font-medium">{label}</text>
                    );
                })}
                {/* Edges */}
                {edges.map((e, i) => {
                    const a = nodeMap.get(e.from);
                    const b = nodeMap.get(e.to);
                    if (!a || !b) return null;
                    return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4" />;
                })}
                {/* Nodes */}
                {layout.map(({ device: d, x, y }) => {
                    const color = statusColors[d.status] || statusColors.unknown;
                    const isHover = hovered === d.id;
                    return (
                        <g key={d.id}
                            onMouseEnter={() => setHovered(d.id)}
                            onMouseLeave={() => setHovered(null)}
                            onClick={() => router.push(`/devices/${d.id}`)}
                            style={{ cursor: 'pointer' }}
                        >
                            <circle cx={x} cy={y} r={isHover ? 16 : 12} fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2" style={{ transition: 'r 0.15s ease' }} />
                            <circle cx={x} cy={y} r={4} fill={color} />
                            <text x={x} y={y + 24} textAnchor="middle" className="fill-gray-600 text-[9px] font-semibold pointer-events-none">
                                {d.hostname.length > 14 ? d.hostname.slice(0, 12) + '…' : d.hostname}
                            </text>
                            {isHover && (
                                <g>
                                    <rect x={x + 18} y={y - 30} width={160} height={52} rx={6} fill="white" stroke="#e5e7eb" strokeWidth="1" />
                                    <text x={x + 26} y={y - 14} className="fill-gray-900 text-[11px] font-bold">{d.hostname}</text>
                                    <text x={x + 26} y={y - 1} className="fill-gray-500 text-[10px]">{d.ipAddress}</text>
                                    <text x={x + 26} y={y + 12} className="fill-gray-400 text-[10px] capitalize">
                                        {d.deviceType.replace('_', ' ')} · {d.status}
                                    </text>
                                </g>
                            )}
                        </g>
                    );
                })}
            </svg>
            {/* Legend */}
            <div className="absolute bottom-4 left-4 flex items-center gap-4 bg-white/90 backdrop-blur rounded-lg border border-gray-200 px-3 py-2">
                {Object.entries(statusColors).map(([status, color]) => (
                    <span key={status} className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 capitalize">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{status}
                    </span>
                ))}
            </div>
        </div>
    );
}

/* ─── Main Component ─────────────────────────────────────── */

export default function NetworkMapPage() {
    const mapRef = useRef<HTMLDivElement>(null);
    const [mapReady, setMapReady] = useState(false);
    const [tab, setTab] = useState<'geo' | 'topology'>('geo');
    const [topoGroup, setTopoGroup] = useState<'subnet' | 'location'>('subnet');
    const router = useRouter();
    const searchParams = useSearchParams();
    const focusId = searchParams.get('focus');

    const { data, loading, error, refetch } = useLocations({ limit: 100 });
    const { data: devicesData, loading: devicesLoading } = useDevices();

    useEffect(() => {
        if (tab !== 'geo' || !mapRef.current || !data) return;

        const locationsWithCoords = data.items.filter((l: any) => l.latitude && l.longitude);
        if (locationsWithCoords.length === 0) return;

        let mapInstance: any = null;
        let cancelled = false;

        Promise.all([
            import('leaflet'),
            import('leaflet/dist/leaflet.css' as any),
        ]).then(([L]) => {
            if (cancelled || !mapRef.current) return;

            // Prevent "Map container is already initialized" error
            if ((mapRef.current as any)._leaflet_id) {
                return;
            }

            mapInstance = L.map(mapRef.current, {
                zoomControl: true,
                attributionControl: false,
            }).setView([-2.5, 117.0], 5);

            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                subdomains: 'abcd',
                maxZoom: 19,
            }).addTo(mapInstance);

            locationsWithCoords.forEach((loc: any) => {
                const color = getLocationHealth(loc);
                const deviceCount = loc._count?.devices || 0;

                const icon = L.divIcon({
                    className: 'custom-marker',
                    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 12px ${color}60;transition:transform 0.15s;"></div>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                });

                const marker = L.marker([Number(loc.latitude), Number(loc.longitude)], { icon }).addTo(mapInstance);

                // Build status breakdown for popup
                const summary = loc.statusSummary || {};
                const statusParts = Object.entries(summary)
                    .filter(([, v]) => (v as number) > 0)
                    .map(([s, v]) => `<span style="color:${statusColors[s] || '#94a3b8'};font-weight:600">${v} ${s}</span>`)
                    .join(' · ');

                marker.bindPopup(`
                    <div style="font-family:system-ui;font-size:12px;min-width:200px;cursor:pointer" onclick="window.location.href='/locations/${loc.id}'">
                        <strong style="font-size:13px;">${loc.name}</strong><br/>
                        <span style="color:#94a3b8;">${loc.address || loc.city || ''}</span><br/>
                        <span style="color:#94a3b8;">${deviceCount} devices</span><br/>
                        ${statusParts ? `<div style="margin-top:4px">${statusParts}</div>` : ''}
                        <div style="margin-top:6px;color:#3b82f6;font-size:11px;font-weight:500">Click to view details →</div>
                    </div>
                `);

                marker.on('click', () => {
                    marker.openPopup();
                });

                // If this is the focused location, zoom to it
                if (focusId && Number(focusId) === loc.id) {
                    setTimeout(() => {
                        mapInstance.setView([Number(loc.latitude), Number(loc.longitude)], 14, { animate: true });
                        marker.openPopup();
                    }, 500);
                }
            });

            // Draw connection lines between locations
            if (locationsWithCoords.length > 1) {
                const coords = locationsWithCoords.map((l: any) => [Number(l.latitude), Number(l.longitude)] as [number, number]);
                L.polyline(coords, {
                    color: '#e5e7eb',
                    weight: 1,
                    dashArray: '6,6',
                    opacity: 0.7,
                }).addTo(mapInstance);
            }

            setMapReady(true);
        });

        return () => {
            cancelled = true;
            mapInstance?.remove();
            setMapReady(false);
        };
    }, [data, tab, focusId]);

    if (loading && !data) return <DashboardSkeleton />;
    if (error) return <ErrorState message={error} onRetry={refetch} />;

    const locationsWithCoords = data?.items.filter((l: any) => l.latitude && l.longitude) || [];
    const allDevices: Device[] = devicesData?.items || [];
    const allLocations: Location[] = data?.items || [];

    return (
        <div className="space-y-6">
            <PageHeader title="Network Map" subtitle={`${locationsWithCoords.length} locations · ${allDevices.length} devices`}>
                <div className="flex items-center gap-2">
                    {/* View toggle */}
                    <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 overflow-hidden">
                        <button
                            onClick={() => setTab('geo')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${tab === 'geo' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <MapIcon className="h-3.5 w-3.5" />
                            Geographic
                        </button>
                        <button
                            onClick={() => setTab('topology')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${tab === 'topology' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <GitBranch className="h-3.5 w-3.5" />
                            Topology
                        </button>
                    </div>

                    {/* Topology grouping toggle */}
                    {tab === 'topology' && (
                        <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 overflow-hidden">
                            <button
                                onClick={() => setTopoGroup('subnet')}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors ${topoGroup === 'subnet' ? 'bg-violet-50 text-violet-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                By Subnet
                            </button>
                            <button
                                onClick={() => setTopoGroup('location')}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors ${topoGroup === 'location' ? 'bg-violet-50 text-violet-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Building2 className="h-3.5 w-3.5" />
                                By Location
                            </button>
                        </div>
                    )}

                    {/* Legend */}
                    <div className="flex items-center gap-3 text-xs ml-2">
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
                </div>
            </PageHeader>

            {/* View */}
            {tab === 'geo' ? (
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden relative" style={{ height: '550px' }}>
                    <div ref={mapRef} className="h-full w-full" />
                    {!mapReady && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white">
                            <div className="flex flex-col items-center gap-2">
                                <MapIcon className="h-8 w-8 text-gray-400 animate-pulse" />
                                <p className="text-sm text-gray-500">Loading map...</p>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                devicesLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-pulse text-gray-400 text-sm">Loading topology...</div>
                    </div>
                ) : (
                    <TopologyView devices={allDevices} locations={allLocations} groupBy={topoGroup} />
                )
            )}

            {/* Location list */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Server className="h-4 w-4 text-blue-600" />
                    Locations ({allLocations.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {allLocations.map((loc: any) => {
                        const color = getLocationHealth(loc);
                        const hasCoords = loc.latitude && loc.longitude;
                        return (
                            <div
                                key={loc.id}
                                className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 hover:shadow-sm transition-all cursor-pointer group"
                                onClick={() => {
                                    if (tab === 'geo' && hasCoords) {
                                        // Navigate with focus param to zoom the map
                                        router.push(`/map?focus=${loc.id}`);
                                    } else {
                                        router.push(`/locations/${loc.id}`);
                                    }
                                }}
                            >
                                <span
                                    className="h-3.5 w-3.5 rounded-full shrink-0"
                                    style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate text-gray-900">{loc.name}</p>
                                    <p className="text-[11px] text-gray-500">
                                        {loc._count?.devices || 0} devices · {loc.code}
                                        {loc.city ? ` · ${loc.city}` : ''}
                                    </p>
                                </div>
                                {!hasCoords && (
                                    <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium shrink-0">
                                        No coords
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
