'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */

export interface Location {
    id: number;
    name: string;
    code: string;
    address: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    _count?: { devices: number };
    createdAt: string;
}

export interface LocationListResult {
    items: Location[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

/* ─── useLocations ───────────────────────────────────────── */

export function useLocations(params?: { page?: number; limit?: number; search?: string }) {
    const [data, setData] = useState<LocationListResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLocations = useCallback(async () => {
        try {
            setLoading(true);
            const { data: result } = await api.get<LocationListResult>('/locations', { params });
            setData(result);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load locations');
        } finally {
            setLoading(false);
        }
    }, [params?.page, params?.limit, params?.search]);

    useEffect(() => {
        fetchLocations();
    }, [fetchLocations]);

    return { data, loading, error, refetch: fetchLocations };
}
