'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */

export interface InterfaceRecord {
    id: number;
    deviceId: number;
    ifIndex: number;
    ifName: string | null;
    ifDescr: string | null;
    ifAlias: string | null;
    ifType: string | null;
    ifSpeed: number | null;
    ifHighSpeed: number | null;
    ifPhysAddress: string | null;
    ifAdminStatus: string | null;
    ifOperStatus: string | null;
    pollingEnabled: boolean;
    createdAt: string;
    updatedAt: string;
    device: {
        id: number;
        hostname: string;
        ipAddress: string;
        status: string;
        locationId: number | null;
    };
}

export interface InterfaceListResult {
    items: InterfaceRecord[];
    total: number;
    page: number;
    limit: number;
    pages: number;
    stats: {
        totalInterfaces: number;
        totalUp: number;
        totalDown: number;
    };
    filterOptions: {
        types: string[];
    };
}

export interface InterfaceFilters {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    adminStatus?: string;
    type?: string;
    deviceId?: number;
    pollingEnabled?: boolean;
}

/* ─── useInterfaces ──────────────────────────────────────── */

export function useInterfaces(params?: InterfaceFilters) {
    const [data, setData] = useState<InterfaceListResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchInterfaces = useCallback(async () => {
        try {
            setLoading(true);
            // Filter out undefined params
            const cleanParams: Record<string, any> = {};
            if (params) {
                Object.entries(params).forEach(([k, v]) => {
                    if (v !== undefined && v !== '' && v !== null) cleanParams[k] = v;
                });
            }
            const { data: result } = await api.get<InterfaceListResult>('/interfaces', { params: cleanParams });
            setData(result);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load interfaces');
        } finally {
            setLoading(false);
        }
    }, [
        params?.page,
        params?.limit,
        params?.search,
        params?.status,
        params?.adminStatus,
        params?.type,
        params?.deviceId,
        params?.pollingEnabled,
    ]);

    useEffect(() => {
        fetchInterfaces();
    }, [fetchInterfaces]);

    return { data, loading, error, refetch: fetchInterfaces };
}

/* ─── Mutation Helpers ───────────────────────────────────── */

export async function updateInterface(
    id: number,
    dto: { ifAdminStatus?: string; ifAlias?: string; pollingEnabled?: boolean },
): Promise<InterfaceRecord> {
    const { data } = await api.patch<InterfaceRecord>(`/interfaces/${id}`, dto);
    return data;
}

export async function bulkUpdateInterfaces(
    ids: number[],
    dto: { ifAdminStatus?: string; pollingEnabled?: boolean },
): Promise<{ updated: number }> {
    const { data } = await api.patch<{ updated: number }>('/interfaces/bulk/update', { ids, update: dto });
    return data;
}
