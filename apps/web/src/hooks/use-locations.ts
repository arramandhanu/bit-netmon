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
    province: string | null;
    latitude: number | null;
    longitude: number | null;
    _count?: { devices: number; serverMonitors: number; urlMonitors: number };
    createdAt: string;
}

export interface LocationListResult {
    items: Location[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export interface CreateLocationPayload {
    name: string;
    code: string;
    address?: string;
    city?: string;
    province?: string;
    latitude?: number;
    longitude?: number;
}

export type UpdateLocationPayload = Partial<CreateLocationPayload>;

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

/* ─── Mutation Helpers ───────────────────────────────────── */

export async function createLocation(dto: CreateLocationPayload): Promise<Location> {
    const { data } = await api.post<Location>('/locations', dto);
    return data;
}

export async function updateLocation(id: number, dto: UpdateLocationPayload): Promise<Location> {
    const { data } = await api.patch<Location>(`/locations/${id}`, dto);
    return data;
}

export async function deleteLocation(id: number): Promise<{ message: string }> {
    const { data } = await api.delete<{ message: string }>(`/locations/${id}`);
    return data;
}
