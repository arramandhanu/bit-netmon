'use client';

import { useEffect, useRef, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
    MapPin, Server, ArrowLeft, Pencil, Trash2, Map as MapIcon,
    CheckCircle2, AlertTriangle, XCircle, Wrench, ChevronRight,
    Loader2, X,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import {
    updateLocation,
    deleteLocation,
    Location,
    CreateLocationPayload,
} from '@/hooks/use-locations';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

/* ─── Types ──────────────────────────────────────────────── */

interface DeviceRow {
    id: number;
    hostname: string;
    ipAddress: string;
    status: string;
    deviceType: string;
}

interface LocationDetail extends Location {
    devices: DeviceRow[];
}

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
    up: { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
    down: { color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
    warning: { color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertTriangle },
    maintenance: { color: 'text-violet-600', bg: 'bg-violet-50', icon: Wrench },
    unknown: { color: 'text-gray-500', bg: 'bg-gray-50', icon: Server },
};

/* ─── Edit Modal ─────────────────────────────────────────── */

function EditModal({
    location,
    onClose,
    onSaved,
}: {
    location: LocationDetail;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { addToast } = useToast();
    const [form, setForm] = useState<CreateLocationPayload>({
        name: location.name,
        code: location.code,
        address: location.address || '',
        city: location.city || '',
        province: location.province || '',
        latitude: location.latitude ?? undefined,
        longitude: location.longitude ?? undefined,
    });
    const [saving, setSaving] = useState(false);

    const set = (k: keyof CreateLocationPayload, v: any) => setForm(prev => ({ ...prev, [k]: v }));
    const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-shadow';
    const labelCls = 'block text-xs font-semibold text-gray-500 mb-1';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateLocation(location.id, {
                ...form,
                latitude: form.latitude ? Number(form.latitude) : undefined,
                longitude: form.longitude ? Number(form.longitude) : undefined,
            });
            addToast({ type: 'success', title: 'Updated', message: `Location "${form.name}" updated.` });
            onSaved();
            onClose();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed to update.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold">Edit Location</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Name *</label>
                            <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} required />
                        </div>
                        <div>
                            <label className={labelCls}>Code *</label>
                            <input className={inputCls} value={form.code} onChange={e => set('code', e.target.value)} required />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Address</label>
                        <input className={inputCls} value={form.address || ''} onChange={e => set('address', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelCls}>City</label><input className={inputCls} value={form.city || ''} onChange={e => set('city', e.target.value)} /></div>
                        <div><label className={labelCls}>Province</label><input className={inputCls} value={form.province || ''} onChange={e => set('province', e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelCls}>Latitude</label><input className={inputCls} type="number" step="any" value={form.latitude ?? ''} onChange={e => set('latitude', e.target.value ? Number(e.target.value) : undefined)} /></div>
                        <div><label className={labelCls}>Longitude</label><input className={inputCls} type="number" step="any" value={form.longitude ?? ''} onChange={e => set('longitude', e.target.value ? Number(e.target.value) : undefined)} /></div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                        <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── MiniMap ────────────────────────────────────────────── */

function MiniMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!mapRef.current) return;
        let instance: any = null;

        Promise.all([
            import('leaflet'),
            import('leaflet/dist/leaflet.css' as any),
        ]).then(([L]) => {
            if (!mapRef.current) return;
            instance = L.map(mapRef.current, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false }).setView([lat, lng], 14);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19 }).addTo(instance);
            const icon = L.divIcon({
                className: '',
                html: `<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 12px rgba(59,130,246,0.5);"></div>`,
                iconSize: [16, 16], iconAnchor: [8, 8],
            });
            L.marker([lat, lng], { icon }).addTo(instance).bindPopup(name);
            setReady(true);
        });

        return () => { instance?.remove(); };
    }, [lat, lng, name]);

    return (
        <div className="rounded-xl border border-gray-200 overflow-hidden relative" style={{ height: '200px' }}>
            <div ref={mapRef} className="h-full w-full" />
            {!ready && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                    <MapIcon className="h-6 w-6 text-gray-300 animate-pulse" />
                </div>
            )}
        </div>
    );
}

/* ─── Page ───────────────────────────────────────────────── */

export default function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { addToast } = useToast();
    const [location, setLocation] = useState<LocationDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showEdit, setShowEdit] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const fetchLocation = async () => {
        try {
            setLoading(true);
            const { data } = await api.get<LocationDetail>(`/locations/${id}`);
            setLocation(data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load location');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLocation(); }, [id]);

    const handleDelete = async () => {
        if (!location) return;
        if (!confirm(`Delete "${location.name}"?`)) return;
        setDeleting(true);
        try {
            await deleteLocation(location.id);
            addToast({ type: 'success', title: 'Deleted', message: `Location "${location.name}" deleted.` });
            router.push('/locations');
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Cannot delete.' });
        } finally {
            setDeleting(false);
        }
    };

    if (loading) return <DashboardSkeleton />;
    if (error || !location) return <ErrorState message={error || 'Location not found'} onRetry={fetchLocation} />;

    const devices = location.devices || [];
    const statusCounts: Record<string, number> = {};
    devices.forEach(d => { statusCounts[d.status] = (statusCounts[d.status] || 0) + 1; });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.push('/locations')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                        <MapPin className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{location.name}</h1>
                        <p className="text-sm text-gray-500">
                            {[location.code, location.city, location.province].filter(Boolean).join(' · ')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowEdit(true)} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                        <Pencil className="h-4 w-4" /> Edit
                    </button>
                    <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
                        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
                    </button>
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{devices.length}</p>
                    <p className="text-xs text-gray-500 font-medium uppercase">Devices</p>
                </div>
                {Object.entries(statusConfig).map(([status, cfg]) => {
                    const count = statusCounts[status] || 0;
                    if (count === 0 && status !== 'up' && status !== 'down') return null;
                    const Icon = cfg.icon;
                    return (
                        <div key={status} className={`rounded-xl border border-gray-200 ${cfg.bg} p-4 text-center`}>
                            <div className="flex items-center justify-center gap-1.5 mb-1">
                                <Icon className={`h-4 w-4 ${cfg.color}`} />
                            </div>
                            <p className={`text-2xl font-bold ${cfg.color}`}>{count}</p>
                            <p className="text-xs text-gray-500 font-medium uppercase capitalize">{status}</p>
                        </div>
                    );
                })}
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left — Info + Map */}
                <div className="space-y-5">
                    {/* Info card */}
                    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Location Info</h2>
                        <div className="space-y-2.5 text-sm">
                            {[
                                ['Code', location.code],
                                ['Address', location.address],
                                ['City', location.city],
                                ['Province', location.province],
                                ['Latitude', location.latitude?.toString()],
                                ['Longitude', location.longitude?.toString()],
                                ['Created', new Date(location.createdAt).toLocaleDateString()],
                            ].map(([label, val]) => val ? (
                                <div key={label as string} className="flex justify-between">
                                    <span className="text-gray-500">{label}</span>
                                    <span className="font-medium text-gray-900 text-right">{val}</span>
                                </div>
                            ) : null)}
                        </div>
                    </div>

                    {/* Mini map */}
                    {location.latitude && location.longitude ? (
                        <MiniMap lat={Number(location.latitude)} lng={Number(location.longitude)} name={location.name} />
                    ) : (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                            <MapIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No coordinates set</p>
                            <button onClick={() => setShowEdit(true)} className="text-xs text-blue-600 hover:underline mt-1">Set coordinates →</button>
                        </div>
                    )}
                </div>

                {/* Right — Device table */}
                <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                            <Server className="h-4 w-4 text-blue-600" />
                            Devices at this Location ({devices.length})
                        </h2>
                    </div>

                    {devices.length === 0 ? (
                        <div className="py-16 text-center">
                            <Server className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No devices at this location yet</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                                        <th className="text-left px-5 py-3 font-semibold">Status</th>
                                        <th className="text-left px-5 py-3 font-semibold">Hostname</th>
                                        <th className="text-left px-5 py-3 font-semibold">IP Address</th>
                                        <th className="text-left px-5 py-3 font-semibold">Type</th>
                                        <th className="text-left px-5 py-3 font-semibold"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {devices.map(d => {
                                        const sc = statusConfig[d.status] || statusConfig.unknown;
                                        const Icon = sc.icon;
                                        return (
                                            <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => router.push(`/devices/${d.id}`)}>
                                                <td className="px-5 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${sc.bg} ${sc.color}`}>
                                                        <Icon className="h-3 w-3" /> {d.status}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 font-medium text-gray-900">{d.hostname}</td>
                                                <td className="px-5 py-3 font-mono text-gray-600">{d.ipAddress}</td>
                                                <td className="px-5 py-3 text-gray-500 capitalize">{d.deviceType.replace('_', ' ')}</td>
                                                <td className="px-5 py-3 text-gray-400"><ChevronRight className="h-4 w-4" /></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {showEdit && (
                <EditModal
                    location={location}
                    onClose={() => setShowEdit(false)}
                    onSaved={fetchLocation}
                />
            )}
        </div>
    );
}
