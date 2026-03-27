'use client';

import { useState, useEffect } from 'react';
import {
    Building2, TrendingUp, Users, CreditCard, DollarSign,
    CheckCircle2, XCircle, Clock, Loader2, AlertTriangle,
    ChevronRight, Crown, BarChart3, Play, Pause, RefreshCw,
    Plus, Pencil, Trash2, X, Eye,
} from 'lucide-react';
import { useAdminTenants, useAdminRevenue } from '@/hooks/use-billing';
import { api } from '@/lib/api-client';

function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

const statusColors: Record<string, { bg: string; text: string }> = {
    trial: { bg: 'bg-amber-100', text: 'text-amber-700' },
    active: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    past_due: { bg: 'bg-red-100', text: 'text-red-700' },
    suspended: { bg: 'bg-gray-100', text: 'text-gray-700' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

/* ─── Tenant Detail Modal ────────────────────────────── */
function TenantDetailModal({ tenant, onClose }: { tenant: any; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
                    <h2 className="text-lg font-bold text-gray-900">Tenant Detail</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-gray-500 block text-xs">Name</span>
                            <span className="font-medium text-gray-900">{tenant.name}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 block text-xs">Slug</span>
                            <span className="font-medium text-gray-900">{tenant.slug}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 block text-xs">Contact Email</span>
                            <span className="font-medium text-gray-900">{tenant.contactEmail || '-'}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 block text-xs">Contact Phone</span>
                            <span className="font-medium text-gray-900">{tenant.contactPhone || '-'}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 block text-xs">Company</span>
                            <span className="font-medium text-gray-900">{tenant.company || '-'}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 block text-xs">Status</span>
                            <span className={`font-medium ${tenant.isActive !== false ? 'text-emerald-600' : 'text-red-500'}`}>
                                {tenant.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-500 block text-xs">Total Users</span>
                            <span className="font-medium text-gray-900">{tenant._count?.users || 0}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 block text-xs">Created</span>
                            <span className="font-medium text-gray-900">{new Date(tenant.createdAt).toLocaleDateString('id-ID')}</span>
                        </div>
                    </div>

                    {/* Subscriptions */}
                    {tenant.subscriptions && tenant.subscriptions.length > 0 && (
                        <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Subscriptions</h4>
                            {tenant.subscriptions.map((sub: any) => {
                                const st = statusColors[sub.status] || statusColors.cancelled;
                                return (
                                    <div key={sub.id} className="p-3 bg-gray-50 rounded-lg mb-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Crown className="h-4 w-4 text-amber-500" />
                                                <span className="text-sm font-medium">{sub.plan?.name || 'Unknown'}</span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${st.bg} ${st.text}`}>
                                                {sub.status}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {new Date(sub.currentPeriodStart).toLocaleDateString('id-ID')} — {new Date(sub.currentPeriodEnd).toLocaleDateString('id-ID')}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Users */}
                    {tenant.users && tenant.users.length > 0 && (
                        <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Users ({tenant.users.length})</h4>
                            <div className="space-y-1">
                                {tenant.users.map((u: any) => (
                                    <div key={u.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                                        <div>
                                            <span className="text-sm font-medium text-gray-900">{u.displayName || u.username}</span>
                                            <span className="text-xs text-gray-400 ml-2">{u.email}</span>
                                        </div>
                                        <span className="text-xs text-gray-500 uppercase font-semibold">{u.role}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Plan Modal ─────────────────────────────────────── */
function PlanModal({ plan, onClose, onSaved }: { plan?: any; onClose: () => void; onSaved: () => void }) {
    const isEdit = !!plan;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSaving(true);
        setError('');
        const fd = new FormData(e.currentTarget);

        const data = {
            name: fd.get('name') as string,
            slug: (fd.get('slug') as string).toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            description: fd.get('description') as string,
            priceMonthly: parseInt(fd.get('priceMonthly') as string) || 0,
            priceYearly: parseInt(fd.get('priceYearly') as string) || 0,
            maxDevices: parseInt(fd.get('maxDevices') as string) || 5,
            maxServers: parseInt(fd.get('maxServers') as string) || 2,
            maxUrlMonitors: parseInt(fd.get('maxUrlMonitors') as string) || 3,
            maxUsers: parseInt(fd.get('maxUsers') as string) || 1,
            dataRetentionDays: parseInt(fd.get('dataRetentionDays') as string) || 7,
            minPollingInterval: parseInt(fd.get('minPollingInterval') as string) || 600,
        };

        try {
            if (isEdit) {
                await api.patch(`/admin/plans/${plan.id}`, data);
            } else {
                await api.post('/admin/plans', data);
            }
            onSaved();
            onClose();
        } catch (err: any) {
            setError(err?.response?.data?.message || err.message || 'Failed');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold">{isEdit ? 'Edit Plan' : 'Create Plan'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
                </div>

                {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-xs font-medium text-gray-500">Name</span>
                            <input name="name" required defaultValue={plan?.name || ''} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-medium text-gray-500">Slug</span>
                            <input name="slug" required defaultValue={plan?.slug || ''} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </label>
                    </div>
                    <label className="block">
                        <span className="text-xs font-medium text-gray-500">Description</span>
                        <input name="description" defaultValue={plan?.description || ''} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-xs font-medium text-gray-500">Price Monthly (IDR)</span>
                            <input name="priceMonthly" type="number" min="0" defaultValue={plan?.priceMonthly || 0} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-medium text-gray-500">Price Yearly (IDR)</span>
                            <input name="priceYearly" type="number" min="0" defaultValue={plan?.priceYearly || 0} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </label>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                        <label className="block">
                            <span className="text-xs font-medium text-gray-500">Devices</span>
                            <input name="maxDevices" type="number" defaultValue={plan?.maxDevices ?? 5} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-medium text-gray-500">Servers</span>
                            <input name="maxServers" type="number" defaultValue={plan?.maxServers ?? 2} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-medium text-gray-500">URLs</span>
                            <input name="maxUrlMonitors" type="number" defaultValue={plan?.maxUrlMonitors ?? 3} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-medium text-gray-500">Users</span>
                            <input name="maxUsers" type="number" defaultValue={plan?.maxUsers ?? 1} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-xs font-medium text-gray-500">Retention (days)</span>
                            <input name="dataRetentionDays" type="number" defaultValue={plan?.dataRetentionDays ?? 7} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-medium text-gray-500">Min Polling (sec)</span>
                            <input name="minPollingInterval" type="number" defaultValue={plan?.minPollingInterval ?? 600} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </label>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
                        <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white shadow-md hover:bg-blue-700 disabled:opacity-50">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isEdit ? 'Save' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Change Plan Modal ──────────────────────────────── */
function ChangePlanModal({ tenant, onClose, onSaved }: { tenant: any; onClose: () => void; onSaved: () => void }) {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get('/admin/plans').then(r => setPlans(r.data)).finally(() => setLoading(false));
    }, []);

    const handleChange = async (planId: number) => {
        if (!confirm(`Change plan for ${tenant.name}?`)) return;
        setSaving(true);
        try {
            await api.post(`/admin/tenants/${tenant.id}/change-plan`, { planId });
            onSaved();
            onClose();
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold">Change Plan — {tenant.name}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
                </div>
                {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /></div>
                ) : (
                    <div className="space-y-2">
                        {plans.map(p => {
                            const isCurrent = tenant.subscriptions?.[0]?.plan?.id === p.id;
                            return (
                                <button key={p.id} onClick={() => !isCurrent && handleChange(p.id)}
                                    disabled={isCurrent || saving}
                                    className={`w-full text-left p-3 rounded-lg border transition-all ${isCurrent
                                        ? 'border-blue-300 bg-blue-50'
                                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                                    } disabled:opacity-60`}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                                        <span className="text-xs text-gray-500">{p.priceMonthly === 0 ? 'Free' : formatRupiah(p.priceMonthly)}</span>
                                    </div>
                                    {isCurrent && <span className="text-[10px] text-blue-600 font-bold">CURRENT</span>}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────── */
export default function AdminBillingPage() {
    const { data: tenants, loading: tenantsLoading, refetch: refetchTenants } = useAdminTenants();
    const { data: revenue, loading: revenueLoading } = useAdminRevenue();
    const [plans, setPlans] = useState<any[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [detailTenant, setDetailTenant] = useState<any>(null);
    const [changePlanTenant, setChangePlanTenant] = useState<any>(null);
    const [planModal, setPlanModal] = useState<{ open: boolean; plan?: any }>({ open: false });

    useEffect(() => {
        api.get('/admin/plans').then(r => setPlans(r.data)).catch(() => {}).finally(() => setPlansLoading(false));
    }, []);

    const refetchPlans = () => {
        api.get('/admin/plans').then(r => setPlans(r.data)).catch(() => {});
    };

    const handleActivate = async (id: number) => {
        setActionLoading(id);
        try { await api.post(`/admin/tenants/${id}/activate`); refetchTenants(); } catch { } finally { setActionLoading(null); }
    };

    const handleDeactivate = async (id: number) => {
        if (!confirm('Deactivate this tenant?')) return;
        setActionLoading(id);
        try { await api.post(`/admin/tenants/${id}/deactivate`); refetchTenants(); } catch { } finally { setActionLoading(null); }
    };

    const handleDeletePlan = async (id: number) => {
        if (!confirm('Delete this plan?')) return;
        try { await api.delete(`/admin/plans/${id}`); refetchPlans(); } catch (err: any) { alert(err?.response?.data?.message || 'Failed'); }
    };

    if (tenantsLoading || revenueLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                    <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Billing Administration</h1>
                    <p className="text-sm text-gray-500">Manage tenants, subscriptions, plans, and revenue</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="text-sm text-gray-500">Total Tenants</span>
                    </div>
                    <span className="text-3xl font-black text-gray-900">{revenue?.totalTenants || 0}</span>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </div>
                        <span className="text-sm text-gray-500">Active Subscriptions</span>
                    </div>
                    <span className="text-3xl font-black text-gray-900">{revenue?.activeSubscriptions || 0}</span>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                            <DollarSign className="h-4 w-4 text-purple-600" />
                        </div>
                        <span className="text-sm text-gray-500">Total Revenue</span>
                    </div>
                    <span className="text-2xl font-black text-gray-900">{formatRupiah(revenue?.totalRevenue || 0)}</span>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-amber-600" />
                        </div>
                        <span className="text-sm text-gray-500">MRR (Est.)</span>
                    </div>
                    <span className="text-2xl font-black text-gray-900">
                        {formatRupiah(revenue?.activeSubscriptions ? (revenue.totalRevenue / Math.max(revenue.activeSubscriptions, 1)) : 0)}
                    </span>
                </div>
            </div>

            {/* Tenants Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        <h3 className="font-semibold">Tenant List</h3>
                    </div>
                    <span className="text-xs text-gray-400">{tenants.length} total</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                                <th className="px-4 py-3 text-left">Tenant</th>
                                <th className="px-4 py-3 text-left">Contact</th>
                                <th className="px-4 py-3 text-center">Users</th>
                                <th className="px-4 py-3 text-left">Plan</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-left">Created</th>
                                <th className="px-4 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {tenants.map((t: any) => {
                                const sub = t.subscriptions?.[0];
                                const st = statusColors[sub?.status || 'cancelled'] || statusColors.cancelled;
                                const isActive = t.isActive !== false;
                                return (
                                    <tr key={t.id} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="font-medium text-gray-900">{t.name}</p>
                                                <p className="text-xs text-gray-400">{t.slug}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">{t.contactEmail}</td>
                                        <td className="px-4 py-3 text-center">{t._count?.users || 0}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <Crown className="h-3.5 w-3.5 text-amber-500" />
                                                <span className="text-xs font-medium">{sub?.plan?.name || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${st.bg} ${st.text}`}>
                                                {sub?.status || 'none'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {new Date(t.createdAt).toLocaleDateString('id-ID')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => setDetailTenant(t)} title="View Detail"
                                                    className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                                    <Eye className="h-3.5 w-3.5" />
                                                </button>
                                                <button onClick={() => setChangePlanTenant(t)} title="Change Plan"
                                                    className="rounded-lg p-1.5 text-gray-400 hover:bg-purple-50 hover:text-purple-600 transition-colors">
                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                </button>
                                                {isActive ? (
                                                    <button onClick={() => handleDeactivate(t.id)} disabled={actionLoading === t.id} title="Deactivate"
                                                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50">
                                                        {actionLoading === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleActivate(t.id)} disabled={actionLoading === t.id} title="Activate"
                                                        className="rounded-lg p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors disabled:opacity-50">
                                                        {actionLoading === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {tenants.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No tenants yet</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Plans Management */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-purple-500" />
                        <h3 className="font-semibold">Plans Management</h3>
                    </div>
                    <button onClick={() => setPlanModal({ open: true })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
                        <Plus className="h-3.5 w-3.5" /> New Plan
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                                <th className="px-4 py-3 text-left">Plan</th>
                                <th className="px-4 py-3 text-right">Monthly</th>
                                <th className="px-4 py-3 text-right">Yearly</th>
                                <th className="px-4 py-3 text-center">Devices</th>
                                <th className="px-4 py-3 text-center">Servers</th>
                                <th className="px-4 py-3 text-center">URLs</th>
                                <th className="px-4 py-3 text-center">Users</th>
                                <th className="px-4 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {plans.map((p: any) => (
                                <tr key={p.id} className="hover:bg-gray-50/50">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-gray-900">{p.name}</p>
                                        <p className="text-xs text-gray-400">{p.slug}</p>
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium">{p.priceMonthly === 0 ? 'Free' : formatRupiah(p.priceMonthly)}</td>
                                    <td className="px-4 py-3 text-right text-gray-500">{p.priceYearly === 0 ? '-' : formatRupiah(p.priceYearly)}</td>
                                    <td className="px-4 py-3 text-center">{p.maxDevices === -1 ? '∞' : p.maxDevices}</td>
                                    <td className="px-4 py-3 text-center">{p.maxServers === -1 ? '∞' : p.maxServers}</td>
                                    <td className="px-4 py-3 text-center">{p.maxUrlMonitors === -1 ? '∞' : p.maxUrlMonitors}</td>
                                    <td className="px-4 py-3 text-center">{p.maxUsers === -1 ? '∞' : p.maxUsers}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => setPlanModal({ open: true, plan: p })} title="Edit"
                                                className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button onClick={() => handleDeletePlan(p.id)} title="Delete"
                                                className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Recent Payments */}
            {revenue?.recentPayments?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-green-500" />
                        <h3 className="font-semibold">Recent Payments</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {revenue.recentPayments.map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        {p.subscription?.tenant?.name}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {p.subscription?.plan?.name} — {p.paymentType}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-emerald-600">{formatRupiah(p.amount)}</p>
                                    <p className="text-[10px] text-gray-400">
                                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString('id-ID') : '-'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modals */}
            {detailTenant && <TenantDetailModal tenant={detailTenant} onClose={() => setDetailTenant(null)} />}
            {changePlanTenant && <ChangePlanModal tenant={changePlanTenant} onClose={() => setChangePlanTenant(null)} onSaved={() => refetchTenants()} />}
            {planModal.open && <PlanModal plan={planModal.plan} onClose={() => setPlanModal({ open: false })} onSaved={() => refetchPlans()} />}
        </div>
    );
}
