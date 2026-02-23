'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */

export interface Device {
    id: number;
    hostname: string;
    ipAddress: string;
    displayName: string | null;
    deviceType: string;
    vendor: string | null;
    model: string | null;
    osVersion: string | null;
    status: string;
    snmpVersion: string;
    pollingInterval: number;
    lastPolledAt: string | null;
    uptime: number | null;
    locationId: number | null;
    location?: { id: number; name: string; code: string } | null;
    _count?: { interfaces: number };
    interfaces?: DeviceInterface[];
    createdAt: string;
    updatedAt: string;
}

/** Fields accepted on device create/update that are write-only (not returned in GET) */
export interface DeviceWriteFields {
    snmpCommunity?: string;
    snmpPort?: number;
    pollingEnabled?: boolean;
    snmpV3User?: string;
    snmpV3AuthProto?: string;
    snmpV3AuthPass?: string;
    snmpV3PrivProto?: string;
    snmpV3PrivPass?: string;
}

export type CreateDeviceDto = Partial<Device> & DeviceWriteFields;

export interface DeviceInterface {
    id: number;
    deviceId: number;
    ifIndex: number;
    ifName: string;
    ifAlias: string | null;
    ifType: string | null;
    ifSpeed: number | null;
    ifOperStatus: string;
    ifAdminStatus: string;
    ifInOctets: string | null;
    ifOutOctets: string | null;
}

export interface DeviceListResult {
    items: Device[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export interface DeviceQuery {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    locationId?: number;
    search?: string;
}

/* ─── useDevices (list) ──────────────────────────────────── */

export function useDevices(initialQuery: DeviceQuery = {}) {
    const [data, setData] = useState<DeviceListResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState<DeviceQuery>(initialQuery);

    const fetchDevices = useCallback(async (q?: DeviceQuery) => {
        const params = q || query;
        try {
            setLoading(true);
            const { data: result } = await api.get<DeviceListResult>('/devices', { params });
            setData(result);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load devices');
        } finally {
            setLoading(false);
        }
    }, [query]);

    useEffect(() => {
        fetchDevices();
    }, [fetchDevices]);

    const updateQuery = useCallback((newQuery: Partial<DeviceQuery>) => {
        setQuery(prev => ({ ...prev, ...newQuery }));
    }, []);

    return { data, loading, error, refetch: fetchDevices, query, updateQuery };
}

/* ─── useDevice (single) ─────────────────────────────────── */

export function useDevice(id: number | string) {
    const [device, setDevice] = useState<Device | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDevice = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get<Device>(`/devices/${id}`);
            setDevice(data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load device');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchDevice();
    }, [fetchDevice]);

    return { device, loading, error, refetch: fetchDevice };
}

/* ─── Mutations ──────────────────────────────────────────── */

export async function createDevice(dto: CreateDeviceDto) {
    const { data } = await api.post<Device>('/devices', dto);
    return data;
}

export async function updateDevice(id: number, dto: Partial<Device> & DeviceWriteFields) {
    const { data } = await api.patch<Device>(`/devices/${id}`, dto);
    return data;
}

export async function deleteDevice(id: number) {
    await api.delete(`/devices/${id}`);
}

export async function bulkDeleteDevices(ids: number[]) {
    const { data } = await api.post<{ deleted: number; message: string }>('/devices/bulk-delete', { ids });
    return data;
}
