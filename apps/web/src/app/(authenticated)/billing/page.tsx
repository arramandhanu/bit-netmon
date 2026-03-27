'use client';

import { useState, useEffect } from 'react';
import {
    CreditCard, Sparkles, Server, HardDrive, Globe, Users,
    CheckCircle2, ArrowUpRight, Clock, AlertTriangle, Loader2,
    Crown, Zap, Shield, FileText, XCircle, ExternalLink,
} from 'lucide-react';
import { useSubscription, usePlans, useInvoices, subscribeToPlan, cancelSubscription, useBillingConfig } from '@/hooks/use-billing';

function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function UsageMeter({ label, used, limit, unlimited, icon: Icon }: any) {
    const pct = unlimited ? 0 : limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
    const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500';
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">{label}</span>
            </div>
            <div className="flex items-end justify-between mb-2">
                <span className="text-2xl font-bold text-gray-900">{used}</span>
                <span className="text-sm text-gray-400">/ {unlimited ? '∞' : limit}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${color}`}
                    style={{ width: unlimited ? '5%' : `${Math.max(pct, 2)}%` }} />
            </div>
        </div>
    );
}

export default function BillingPage() {
    const { data: billing, loading, refetch } = useSubscription();
    const { data: plans } = usePlans();
    const { data: invoices } = useInvoices();
    const billingConfig = useBillingConfig();
    const [subscribing, setSubscribing] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [snapLoaded, setSnapLoaded] = useState(false);

    // Load Midtrans Snap JS dynamically with the actual client key
    useEffect(() => {
        if (!billingConfig?.clientKey || !billingConfig.isConfigured) return;
        if (document.getElementById('midtrans-snap-js')) {
            setSnapLoaded(true);
            return;
        }
        const script = document.createElement('script');
        script.id = 'midtrans-snap-js';
        script.src = 'https://app.midtrans.com/snap/snap.js';
        script.setAttribute('data-client-key', billingConfig.clientKey);
        script.onload = () => setSnapLoaded(true);
        script.onerror = () => console.error('Failed to load Midtrans Snap JS');
        document.head.appendChild(script);
    }, [billingConfig]);

    const handleSubscribe = async (planSlug: string) => {
        setSubscribing(planSlug);
        try {
            const result = await subscribeToPlan(planSlug);
            // Open Midtrans Snap popup
            if (result.snapToken && (window as any).snap) {
                (window as any).snap.pay(result.snapToken, {
                    onSuccess: () => { refetch(); },
                    onPending: () => { refetch(); },
                    onError: () => { alert('Pembayaran gagal'); },
                    onClose: () => { refetch(); },
                });
            } else if (result.redirectUrl) {
                window.open(result.redirectUrl, '_blank');
            } else {
                alert('Payment gateway belum tersedia. Hubungi admin.');
            }
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || 'Gagal memproses pembayaran';
            alert(msg);
        } finally {
            setSubscribing(null);
        }
    };

    const handleCancel = async () => {
        if (!confirm('Yakin ingin membatalkan subscription? Anda akan di-downgrade ke paket Starter.')) return;
        setCancelling(true);
        try {
            await cancelSubscription();
            refetch();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed');
        } finally {
            setCancelling(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
        );
    }

    const currentPlan = billing?.plan;
    const sub = billing?.subscription;
    const usage = billing?.usage;
    const isTrialing = sub?.status === 'trial';
    const trialDaysLeft = sub?.trialEndsAt
        ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                    <CreditCard className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
                    <p className="text-sm text-gray-500">Kelola paket dan pembayaran Anda</p>
                </div>
            </div>

            {/* Trial Banner */}
            {isTrialing && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
                    <Clock className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <h3 className="font-semibold text-amber-800">
                            Trial — {trialDaysLeft} hari tersisa
                        </h3>
                        <p className="text-sm text-amber-700 mt-1">
                            Upgrade ke paket berbayar sebelum trial berakhir untuk melanjutkan akses semua fitur.
                        </p>
                    </div>
                </div>
            )}

            {/* Current Plan Card */}
            {currentPlan && (
                <div className="bg-white rounded-xl border-2 border-blue-200 p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Crown className="h-6 w-6 text-blue-600" />
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Paket {currentPlan.name}</h2>
                                <p className="text-sm text-gray-500">{currentPlan.description}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-black text-gray-900">
                                {currentPlan.priceMonthly === 0 ? 'GRATIS' : formatRupiah(currentPlan.priceMonthly)}
                            </span>
                            {currentPlan.priceMonthly > 0 && <span className="text-sm text-gray-400">/bulan</span>}
                        </div>
                    </div>
                    {sub && sub.status !== 'trial' && currentPlan.priceMonthly > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-sm text-gray-500">
                                Berlaku sampai: {new Date(sub.currentPeriodEnd).toLocaleDateString('id-ID')}
                            </span>
                            <button onClick={handleCancel} disabled={cancelling}
                                className="text-sm text-red-500 hover:text-red-700 font-medium">
                                {cancelling ? 'Membatalkan...' : 'Batalkan Subscription'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Usage */}
            {usage && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Penggunaan</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <UsageMeter label="Network Devices" icon={Server} {...usage.devices} />
                        <UsageMeter label="Server Agents" icon={HardDrive} {...usage.servers} />
                        <UsageMeter label="URL Monitors" icon={Globe} {...usage.urlMonitors} />
                        <UsageMeter label="Users" icon={Users} {...usage.users} />
                    </div>
                </div>
            )}

            {/* Plans */}
            <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {currentPlan?.slug === 'starter' ? 'Upgrade Paket' : 'Semua Paket'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {plans.map(plan => {
                        const isCurrent = plan.slug === currentPlan?.slug;
                        const isPopular = plan.slug === 'business';
                        const isEnterprise = plan.slug === 'enterprise';
                        const isFree = plan.priceMonthly === 0 && !isEnterprise;
                        return (
                            <div key={plan.id}
                                className={`relative rounded-xl border-2 p-5 transition-all ${isCurrent
                                    ? 'border-blue-500 bg-blue-50/50'
                                    : isPopular
                                        ? 'border-purple-300 bg-white shadow-lg shadow-purple-500/10'
                                        : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}>
                                {isPopular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-bold uppercase rounded-full">
                                        Populer
                                    </div>
                                )}
                                <h4 className="text-lg font-bold text-gray-900">{plan.name}</h4>
                                <div className="mt-2">
                                    <span className="text-2xl font-black text-gray-900">
                                        {isEnterprise ? 'Custom' : plan.priceMonthly === 0 ? 'Gratis' : formatRupiah(plan.priceMonthly)}
                                    </span>
                                    {plan.priceMonthly > 0 && !isEnterprise && <span className="text-sm text-gray-400">/bln</span>}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">{plan.description}</p>
                                <ul className="mt-4 space-y-2 text-xs text-gray-600">
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                        {plan.maxDevices === -1 ? 'Unlimited' : plan.maxDevices} devices
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                        {plan.maxServers === -1 ? 'Unlimited' : plan.maxServers} servers
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                        {plan.maxUrlMonitors === -1 ? 'Unlimited' : plan.maxUrlMonitors} URL monitors
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                        {plan.dataRetentionDays} hari retensi data
                                    </li>
                                    {plan.features?.aiAnalytics && (
                                        <li className="flex items-center gap-1.5">
                                            <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                                            AI Analytics & Reports
                                        </li>
                                    )}
                                    {plan.features?.devops && (
                                        <li className="flex items-center gap-1.5">
                                            <Zap className="h-3.5 w-3.5 text-blue-500" />
                                            DevOps Integration
                                        </li>
                                    )}
                                    {plan.features?.remoteTerminal && (
                                        <li className="flex items-center gap-1.5">
                                            <Shield className="h-3.5 w-3.5 text-green-500" />
                                            Remote Terminal
                                        </li>
                                    )}
                                </ul>
                                <div className="mt-4">
                                    {isCurrent ? (
                                        <div className="w-full h-9 flex items-center justify-center bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold">
                                            Paket Aktif
                                        </div>
                                    ) : isEnterprise ? (
                                        <a href="https://bintanginovasiteknologi.com/contact" target="_blank" rel="noopener noreferrer"
                                            className="w-full h-9 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-all">
                                            Hubungi Kami <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                    ) : isFree ? (
                                        <div className="w-full h-9 flex items-center justify-center bg-gray-100 text-gray-500 rounded-lg text-xs font-medium">
                                            Free Tier
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleSubscribe(plan.slug)}
                                            disabled={subscribing === plan.slug}
                                            className={`w-full h-9 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all ${isPopular
                                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/25 hover:shadow-lg'
                                                : 'bg-gray-900 text-white hover:bg-gray-800'
                                            }`}>
                                            {subscribing === plan.slug ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <>Upgrade <ArrowUpRight className="h-3.5 w-3.5" /></>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Invoices */}
            {invoices.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Riwayat Invoice</h3>
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                                    <th className="px-4 py-3 text-left">Invoice</th>
                                    <th className="px-4 py-3 text-left">Periode</th>
                                    <th className="px-4 py-3 text-right">Jumlah</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {invoices.map(inv => (
                                    <tr key={inv.id} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-3 font-medium">{inv.invoiceNumber}</td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {new Date(inv.periodStart).toLocaleDateString('id-ID')} — {new Date(inv.periodEnd).toLocaleDateString('id-ID')}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold">{formatRupiah(inv.amount)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${inv.status === 'paid'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-amber-100 text-amber-700'
                                            }`}>{inv.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
