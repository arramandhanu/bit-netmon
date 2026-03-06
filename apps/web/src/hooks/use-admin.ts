'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */

export interface User {
    id: number;
    username: string;
    email: string;
    displayName: string | null;
    role: string;
    isActive: boolean;
    lastLoginAt: string | null;
    createdAt: string;
}

export interface DiscoveryScanResult {
    ip: string;
    hostname: string | null;
    vendor: string | null;
    type: string;
    status: string;
    snmpReachable: boolean;
    added: boolean;
}

export interface AuditLogEntry {
    id: number;
    userId: number | null;
    action: string;
    entity: string;
    entityId: number | null;
    details: any;
    ipAddress: string | null;
    createdAt: string;
    user?: { username: string; displayName: string | null };
}

export interface SecurityStats {
    failedLogins24h: number;
    activeSessions: number;
    totalLogs: number;
    recentActivity: AuditLogEntry[];
}

/* ─── useUsers ───────────────────────────────────────────── */

export function useUsers() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get<User[]>('/auth/users');
            setUsers(data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    return { users, loading, error, refetch: fetchUsers };
}

/* ─── useDiscoveryScan ───────────────────────────────────── */

export function useDiscoveryScan() {
    const [results, setResults] = useState<DiscoveryScanResult[]>([]);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const startScan = useCallback(async (subnet: string, community: string) => {
        try {
            setScanning(true);
            setError(null);
            const { data } = await api.post<DiscoveryScanResult[]>('/discovery/scan', {
                subnet,
                community,
            });
            setResults(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Scan failed');
        } finally {
            setScanning(false);
        }
    }, []);

    return { results, scanning, error, startScan };
}

/* ─── User mutations ─────────────────────────────────────── */

export async function createUser(dto: { username: string; email: string; password: string; role: string }) {
    const { data } = await api.post<User>('/auth/register', dto);
    return data;
}

export async function updateUser(id: number, dto: { email?: string; displayName?: string; role?: string; isActive?: boolean }) {
    const { data } = await api.put<User>(`/auth/users/${id}`, dto);
    return data;
}

export async function deleteUser(id: number) {
    const { data } = await api.delete(`/auth/users/${id}`);
    return data;
}

/* ─── useSettings ────────────────────────────────────────── */

export function useSettings() {
    const [settings, setSettings] = useState<Record<string, Record<string, string>>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/settings');
            setSettings(data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load settings');
        } finally {
            setLoading(false);
        }
    }, []);

    const saveSettings = useCallback(async (values: Record<string, string>) => {
        try {
            setSaving(true);
            const { data } = await api.put('/settings', { settings: values });
            setSettings(data);
            setError(null);
            return true;
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to save settings');
            return false;
        } finally {
            setSaving(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    return { settings, loading, error, saving, saveSettings, refetch: fetchSettings };
}

/* ─── useAuditLogs ───────────────────────────────────────── */

export function useAuditLogs(params?: { page?: number; limit?: number; action?: string }) {
    const [data, setData] = useState<{ data: AuditLogEntry[]; meta: any }>({ data: [], meta: {} });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        try {
            setLoading(true);
            const query = new URLSearchParams();
            if (params?.page) query.set('page', String(params.page));
            if (params?.limit) query.set('limit', String(params.limit));
            if (params?.action) query.set('action', params.action);
            const { data: resp } = await api.get(`/audit-logs?${query.toString()}`);
            setData(resp);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load audit logs');
        } finally {
            setLoading(false);
        }
    }, [params?.page, params?.limit, params?.action]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    return { logs: data.data, meta: data.meta, loading, error, refetch: fetchLogs };
}

/* ─── useSecurityStats ───────────────────────────────────── */

export function useSecurityStats() {
    const [stats, setStats] = useState<SecurityStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get<SecurityStats>('/audit-logs/stats');
            setStats(data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load security stats');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetch();
    }, [fetch]);

    return { stats, loading, error, refetch: fetch };
}
