'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */

export interface TeamMember {
    id: number;
    username: string;
    email: string;
    displayName?: string;
    role: string;
    isActive: boolean;
    lastLoginAt?: string;
    createdAt?: string;
}

export interface PendingInvitation {
    id: number;
    email: string;
    role: string;
    expiresAt: string;
    createdAt: string;
    invitedBy: { username: string; displayName?: string };
}

export interface TenantInfo {
    id: number;
    name: string;
    slug: string;
    contactEmail: string;
    company?: string;
    plan: {
        name: string;
        maxDevices: number;
        maxServers: number;
        maxUrlMonitors: number;
        maxUsers: number;
    } | null;
    usage: {
        users: number;
        devices: number;
        serverMonitors: number;
        urlMonitors: number;
        locations: number;
    };
}

/* ─── useTeam hook ───────────────────────────────────────── */

export function useTeam() {
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMembers = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get<TeamMember[]>('/tenant/team');
            setMembers(data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load team');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    const removeMember = useCallback(async (userId: number) => {
        await api.delete(`/tenant/team/${userId}`);
        setMembers((prev) => prev.filter((m) => m.id !== userId));
    }, []);

    return { members, loading, error, refetch: fetchMembers, removeMember };
}

/* ─── useInvitations hook ────────────────────────────────── */

export function useInvitations() {
    const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchInvitations = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get<PendingInvitation[]>('/tenant/invitations');
            setInvitations(data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load invitations');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInvitations();
    }, [fetchInvitations]);

    const sendInvite = useCallback(async (email: string, role: string) => {
        const { data } = await api.post('/tenant/invite', { email, role });
        await fetchInvitations();
        return data;
    }, [fetchInvitations]);

    const cancelInvite = useCallback(async (invitationId: number) => {
        await api.delete(`/tenant/invitations/${invitationId}`);
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    }, []);

    return { invitations, loading, error, refetch: fetchInvitations, sendInvite, cancelInvite };
}

/* ─── useTenantInfo hook ─────────────────────────────────── */

export function useTenantInfo() {
    const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchInfo = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get<TenantInfo>('/tenant/info');
            setTenantInfo(data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load tenant info');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInfo();
    }, [fetchInfo]);

    return { tenantInfo, loading, error, refetch: fetchInfo };
}
