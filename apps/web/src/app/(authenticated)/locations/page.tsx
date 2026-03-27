'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    MapPin, Server, CheckCircle2, AlertTriangle, Search, Plus,
    Pencil, Trash2, Map, X, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { useToast } from '@/components/ui/toast';
import {
    useLocations,
    createLocation,
    updateLocation,
    deleteLocation,
    Location,
    CreateLocationPayload,
} from '@/hooks/use-locations';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

/* ─── Add / Edit Modal ───────────────────────────────────── */

function LocationModal({
    location,
    onClose,
    onSaved,
}: {
    location?: Location | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { addToast } = useToast();
    const isEdit = !!location;

    const [form, setForm] = useState<CreateLocationPayload>({
        name: location?.name || '',
        code: location?.code || '',
        address: location?.address || '',
        city: location?.city || '',
        province: location?.province || '',
        latitude: location?.latitude ?? undefined,
        longitude: location?.longitude ?? undefined,
    });
    const [saving, setSaving] = useState(false);

    const set = (k: keyof CreateLocationPayload, v: any) => setForm(prev => ({ ...prev, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.code.trim()) return;
        setSaving(true);
        try {
            const payload: CreateLocationPayload = {
                ...form,
                latitude: form.latitude ? Number(form.latitude) : undefined,
                longitude: form.longitude ? Number(form.longitude) : undefined,
            };
            if (isEdit) {
                await updateLocation(location!.id, payload);
                addToast({ type: 'success', title: 'Updated', message: `Location "${form.name}" updated.` });
            } else {
                await createLocation(payload);
                addToast({ type: 'success', title: 'Created', message: `Location "${form.name}" created.` });
            }
            onSaved();
            onClose();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed to save location.' });
        } finally {
            setSaving(false);
        }
    };

    const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-shadow';
    const labelCls = 'block text-xs font-semibold text-gray-500 mb-1';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Location' : 'Add Location'}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Location Name *</label>
                            <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Head Office Jakarta" required />
                        </div>
                        <div>
                            <label className={labelCls}>Code *</label>
                            <input className={inputCls} value={form.code} onChange={e => set('code', e.target.value)} placeholder="LOC-001" required />
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Address</label>
                        <input className={inputCls} value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="Jl. Sudirman No. 1" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>City</label>
                            <input className={inputCls} value={form.city || ''} onChange={e => set('city', e.target.value)} placeholder="Jakarta" />
                        </div>
                        <div>
                            <label className={labelCls}>Province</label>
                            <input className={inputCls} value={form.province || ''} onChange={e => set('province', e.target.value)} placeholder="DKI Jakarta" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Latitude</label>
                            <input className={inputCls} type="number" step="any" value={form.latitude ?? ''} onChange={e => set('latitude', e.target.value ? Number(e.target.value) : undefined)} placeholder="-6.2088" />
                        </div>
                        <div>
                            <label className={labelCls}>Longitude</label>
                            <input className={inputCls} type="number" step="any" value={form.longitude ?? ''} onChange={e => set('longitude', e.target.value ? Number(e.target.value) : undefined)} placeholder="106.8456" />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isEdit ? 'Save Changes' : 'Create Location'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Delete Confirmation ────────────────────────────────── */

function DeleteDialog({
    location,
    onClose,
    onDeleted,
}: {
    location: Location;
    onClose: () => void;
    onDeleted: () => void;
}) {
    const { addToast } = useToast();
    const [deleting, setDeleting] = useState(false);
    const deviceCount = location._count?.devices || 0;

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await deleteLocation(location.id);
            addToast({ type: 'success', title: 'Deleted', message: `Location "${location.name}" deleted.` });
            onDeleted();
            onClose();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Cannot delete location.' });
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Location</h3>
                <p className="text-sm text-gray-600 mb-1">
                    Are you sure you want to delete <strong>{location.name}</strong> ({location.code})?
                </p>
                {deviceCount > 0 && (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mt-3 text-xs text-amber-700">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        This location has {deviceCount} device(s). Reassign them before deleting.
                    </div>
                )}
                <div className="flex justify-end gap-3 mt-5">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleDelete} disabled={deleting || deviceCount > 0} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                        {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Page ───────────────────────────────────────────────── */

export default function LocationsPage() {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 12;
    const { data, loading, error, refetch } = useLocations({ page, limit: pageSize, search: search || undefined });

    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState<Location | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);

    if (loading && !data) return <DashboardSkeleton />;
    if (error || !data) return <ErrorState message={error || 'No data'} onRetry={refetch} />;

    const locations = data.items;
    const totalDevices = locations.reduce((s, l) => s + (l._count?.devices || 0) + (l._count?.serverMonitors || 0) + (l._count?.urlMonitors || 0), 0);
    const withCoords = locations.filter(l => l.latitude && l.longitude).length;

    return (
        <div className="space-y-6">
            <PageHeader title="Locations" subtitle={`${data.total} locations with ${totalDevices.toLocaleString()} devices`}>
                <button
                    onClick={() => { setEditTarget(null); setShowModal(true); }}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-all active:scale-[0.98]"
                >
                    <Plus className="h-4 w-4" />
                    Add Location
                </button>
            </PageHeader>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Total Locations" value={data.total} icon={MapPin} />
                <MetricCard label="Total Devices" value={totalDevices.toLocaleString()} icon={Server} />
                <MetricCard label="Cities" value={new Set(locations.map(l => l.city).filter(Boolean)).size} icon={CheckCircle2} />
                <MetricCard label="With Coordinates" value={withCoords} icon={Map} />
            </div>

            {/* Search */}
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search locations..."
                    className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-shadow placeholder:text-gray-400"
                />
            </div>

            {/* Card Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {locations.map((loc) => {
                    const deviceCount = (loc._count?.devices || 0) + (loc._count?.serverMonitors || 0) + (loc._count?.urlMonitors || 0);
                    return (
                        <div
                            key={loc.id}
                            className="rounded-xl border border-gray-200 bg-white p-5 transition-all hover:shadow-lg hover:scale-[1.01] cursor-pointer group"
                            onClick={() => router.push(`/locations/${loc.id}`)}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="rounded-lg bg-blue-50 p-2 text-blue-600 flex-shrink-0">
                                        <MapPin className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-gray-900 truncate">{loc.name}</h3>
                                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                            {[loc.address, loc.city, loc.province].filter(Boolean).join(', ') || loc.code}
                                        </p>
                                    </div>
                                </div>
                                {/* Actions */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setEditTarget(loc); setShowModal(true); }}
                                        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
                                        title="Edit"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); router.push(`/map?focus=${loc.id}`); }}
                                        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-green-600 transition-colors"
                                        title="View on Map"
                                    >
                                        <Map className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(loc); }}
                                        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-red-600 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-2 text-center mb-3">
                                <div className="rounded-lg bg-blue-50 p-2">
                                    <p className="text-lg font-bold text-gray-900">{deviceCount}</p>
                                    <p className="text-[10px] text-gray-500 uppercase font-medium">Devices</p>
                                </div>
                                <div className="rounded-lg bg-gray-50 p-2">
                                    <p className="text-lg font-bold text-gray-900">{loc.code}</p>
                                    <p className="text-[10px] text-gray-500 uppercase font-medium">Code</p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    {loc.latitude && loc.longitude ? (
                                        <>
                                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                            <span>Coordinates set</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                                            <span>No coordinates</span>
                                        </>
                                    )}
                                </div>
                                {loc.city && (
                                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{loc.city}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Pagination */}
            {data.pages > 1 && (
                <div className="flex items-center justify-between px-1">
                    <p className="text-xs text-gray-500">
                        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.total)} of {data.total}
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        {Array.from({ length: data.pages }, (_, i) => i + 1).slice(
                            Math.max(0, page - 3),
                            Math.min(data.pages, page + 2)
                        ).map(p => (
                            <button
                                key={p}
                                onClick={() => setPage(p)}
                                className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-50 text-gray-600'}`}
                            >
                                {p}
                            </button>
                        ))}
                        <button
                            onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                            disabled={page === data.pages}
                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Modals */}
            {showModal && (
                <LocationModal
                    location={editTarget}
                    onClose={() => { setShowModal(false); setEditTarget(null); }}
                    onSaved={refetch}
                />
            )}
            {deleteTarget && (
                <DeleteDialog
                    location={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onDeleted={refetch}
                />
            )}
        </div>
    );
}
