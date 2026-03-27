import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────── */

export interface Plan {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    priceMonthly: number;
    priceYearly: number | null;
    currency: string;
    maxDevices: number;
    maxServers: number;
    maxUrlMonitors: number;
    maxUsers: number;
    dataRetentionDays: number;
    minPollingInterval: number;
    features: Record<string, boolean>;
    sortOrder: number;
}

export interface UsageItem {
    used: number;
    limit: number;
    unlimited: boolean;
}

export interface BillingData {
    plan: Plan | null;
    subscription: {
        status: string;
        trialEndsAt: string | null;
        currentPeriodEnd: string;
    } | null;
    usage: {
        devices: UsageItem;
        servers: UsageItem;
        urlMonitors: UsageItem;
        users: UsageItem;
    } | null;
}

export interface Invoice {
    id: number;
    invoiceNumber: string;
    amount: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
    status: string;
    paidAt: string | null;
    createdAt: string;
}

/* ─── Hooks ──────────────────────────────────────── */

export function usePlans() {
    const [data, setData] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/billing/plans')
            .then(res => setData(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return { data, loading };
}

export function useSubscription() {
    const [data, setData] = useState<BillingData | null>(null);
    const [loading, setLoading] = useState(true);

    const refetch = useCallback(() => {
        setLoading(true);
        api.get('/billing/subscription')
            .then(res => setData(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { refetch(); }, [refetch]);

    return { data, loading, refetch };
}

export function useInvoices() {
    const [data, setData] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/billing/invoices')
            .then(res => setData(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return { data, loading };
}

export function useBillingConfig() {
    const [config, setConfig] = useState<{ clientKey: string; isConfigured: boolean } | null>(null);

    useEffect(() => {
        api.get('/billing/config')
            .then(res => setConfig(res.data))
            .catch(() => {});
    }, []);

    return config;
}

/* ─── Actions ────────────────────────────────────── */

export async function subscribeToPlan(planSlug: string) {
    const { data } = await api.post('/billing/subscribe', { planSlug });
    return data;
}

export async function cancelSubscription() {
    const { data } = await api.post('/billing/cancel');
    return data;
}

/* ─── Admin Hooks ────────────────────────────────── */

export function useAdminTenants() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const refetch = useCallback(() => {
        setLoading(true);
        api.get('/admin/tenants')
            .then(res => setData(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { refetch(); }, [refetch]);

    return { data, loading, refetch };
}

export function useAdminRevenue() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/admin/revenue')
            .then(res => setData(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return { data, loading };
}
