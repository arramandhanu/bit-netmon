'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */

export interface TicketUser {
    id: number;
    username: string;
    displayName?: string;
}

export interface TicketDevice {
    id: number;
    hostname: string;
    displayName?: string;
    ipAddress?: string;
    status?: string;
    deviceType?: string;
}

export interface TicketAlert {
    id: number;
    message: string;
    severity: string;
    state?: string;
    triggeredAt?: string;
}

export interface TicketComment {
    id: number;
    ticketId: number;
    userId: number;
    content: string;
    isSystem: boolean;
    parentId?: number | null;
    parent?: {
        id: number;
        content: string;
        user: TicketUser;
    } | null;
    user: TicketUser;
    createdAt: string;
    updatedAt: string;
}

export interface TicketAttachment {
    id: number;
    ticketId: number;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url?: string;
    createdAt: string;
}

export interface Ticket {
    id: number;
    ticketNumber: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    tags: string[];
    deviceId?: number;
    alertId?: number;
    creatorId: number;
    assigneeId?: number;
    dueDate?: string;
    resolvedAt?: string;
    closedAt?: string;
    createdAt: string;
    updatedAt: string;

    device?: TicketDevice;
    creator?: TicketUser;
    assignee?: TicketUser;
    alert?: TicketAlert;
    comments?: TicketComment[];
    attachments?: TicketAttachment[];
    _count?: { comments: number; attachments: number };
}

export interface TicketStats {
    open: number;
    inProgress: number;
    escalated: number;
    onHold: number;
    waiting: number;
    resolved: number;
    closed: number;
    overdue: number;
    total: number;
    byPriority: Record<string, number>;
}

export interface TicketListResponse {
    data: Ticket[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

/* ─── Hooks ──────────────────────────────────────────────── */

export function useTickets(filters?: Record<string, any>) {
    const [data, setData] = useState<TicketListResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters) {
                Object.entries(filters).forEach(([k, v]) => {
                    if (v !== undefined && v !== '' && v !== null) params.set(k, String(v));
                });
            }
            const res = await api.get(`/tickets?${params.toString()}`);
            setData(res.data);
        } catch (err) {
            console.error('Failed to load tickets', err);
        } finally {
            setLoading(false);
        }
    }, [JSON.stringify(filters)]);

    useEffect(() => { fetchTickets(); }, [fetchTickets]);

    return { data, loading, refetch: fetchTickets };
}

export function useTicket(id: number) {
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchTicket = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/tickets/${id}`);
            setTicket(res.data);
        } catch (err) {
            console.error('Failed to load ticket', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchTicket(); }, [fetchTicket]);

    return { ticket, loading, refetch: fetchTicket };
}

export function useTicketStats() {
    const [stats, setStats] = useState<TicketStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/tickets/stats')
            .then(res => setStats(res.data))
            .catch(err => console.error('Failed to load ticket stats', err))
            .finally(() => setLoading(false));
    }, []);

    return { stats, loading };
}

/* ─── Mutation helpers ───────────────────────────────────── */

export async function createTicket(data: {
    title: string;
    description: string;
    priority?: string;
    category?: string;
    deviceId?: number;
    assigneeId?: number;
    dueDate?: string;
    tags?: string[];
}) {
    const res = await api.post('/tickets', data);
    return res.data;
}

export async function updateTicket(id: number, data: Record<string, any>) {
    const res = await api.patch(`/tickets/${id}`, data);
    return res.data;
}

export async function deleteTicket(id: number) {
    const res = await api.delete(`/tickets/${id}`);
    return res.data;
}

export async function addTicketComment(ticketId: number, content: string, parentId?: number) {
    const res = await api.post(`/tickets/${ticketId}/comments`, { content, ...(parentId ? { parentId } : {}) });
    return res.data;
}

export async function assignTicket(ticketId: number, assigneeId: number) {
    const res = await api.post(`/tickets/${ticketId}/assign`, { assigneeId });
    return res.data;
}

export async function createTicketFromAlert(alertId: number) {
    const res = await api.post(`/alerts/${alertId}/create-ticket`);
    return res.data;
}
