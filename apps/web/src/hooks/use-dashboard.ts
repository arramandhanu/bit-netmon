'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */

export interface DeviceMetricSnapshot {
    device_id: number;
    time: string;
    cpu_utilization: number | null;
    memory_percent: number | null;
    response_time_ms: number | null;
    device_status: string;
    uptime: number | null;
}

export interface DashboardData {
    metrics: DeviceMetricSnapshot[];
    totalDevices: number;
    devicesUp: number;
    devicesDown: number;
    devicesWarning: number;
    avgCpu: number;
    avgMemory: number;
    topCpuDevices: DeviceMetricSnapshot[];

    // Extended Metrics
    totalLocations: number;
    activeLocations: number;
    totalInterfaces: number;
    interfacesDown: number;
    totalAps: number;
    clientsConnected: number;
    openTickets: number;
    recentTickets: any[];
    recentDiscovery: any[];
    recentSecurityEvents: any[];
}

/* ─── Hook ───────────────────────────────────────────────── */

export function useDashboard(refreshInterval = 30000) {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboard = useCallback(async () => {
        try {
            const [dashboardRes, devicesRes] = await Promise.all([
                api.get('/metrics/dashboard'),
                api.get('/devices', { params: { limit: 1 } }), // for total count
            ]);

            // The API now returns { metrics: [...], totalLocations: ..., ... }
            const dashboardPayload = dashboardRes.data;
            const metrics = dashboardPayload.metrics || [];
            const totalDevices = devicesRes.data?.total || devicesRes.data?.data?.length || metrics.length;

            const devicesUp = metrics.filter((m: any) => m.device_status === 'up').length;
            const devicesDown = metrics.filter((m: any) => m.device_status === 'down').length;
            const devicesWarning = metrics.filter((m: any) => {
                if (m.device_status === 'warning') return true;
                if (m.cpu_utilization && m.cpu_utilization > 80) return true;
                if (m.memory_percent && m.memory_percent > 85) return true;
                return false;
            }).length;

            const cpuValues = metrics.filter((m: any) => m.cpu_utilization != null).map((m: any) => m.cpu_utilization!);
            const memValues = metrics.filter((m: any) => m.memory_percent != null).map((m: any) => m.memory_percent!);

            const avgCpu = cpuValues.length > 0 ? Math.round(cpuValues.reduce((a: number, b: number) => a + b, 0) / cpuValues.length) : 0;
            const avgMemory = memValues.length > 0 ? Math.round(memValues.reduce((a: number, b: number) => a + b, 0) / memValues.length) : 0;

            const topCpuDevices = [...metrics]
                .filter(m => m.cpu_utilization != null)
                .sort((a, b) => (b.cpu_utilization || 0) - (a.cpu_utilization || 0))
                .slice(0, 5);

            setData({
                metrics,
                totalDevices,
                devicesUp,
                devicesDown,
                devicesWarning,
                avgCpu,
                avgMemory,
                topCpuDevices,
                ...dashboardPayload, // Include all the new extended fields
            });
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboard();

        if (refreshInterval > 0) {
            const interval = setInterval(fetchDashboard, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [fetchDashboard, refreshInterval]);

    return { data, loading, error, refetch: fetchDashboard };
}
