'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */

export interface User {
    id: number;
    username: string;
    email: string;
    role: string;
    tenantId?: number | null;
    emailVerified?: boolean;
    isActive?: boolean;
    lastLoginAt?: string;
    createdAt?: string;
}

interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    user: User;
}

/* ─── Token helpers ──────────────────────────────────────── */

const TOKEN_KEY = 'netmon_access_token';
const REFRESH_KEY = 'netmon_refresh_token';
const USER_KEY = 'netmon_user';

export function getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function storeAuth(data: LoginResponse) {
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
}

/* ─── useAuth hook ───────────────────────────────────────── */

export function useAuth() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Restore user from localStorage on mount
    useEffect(() => {
        const stored = getStoredUser();
        if (stored) setUser(stored);
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.post<LoginResponse>('/auth/login', {
                username,
                password,
            });
            storeAuth(data);
            setUser(data.user);
            router.push('/dashboard');
            return data;
        } catch (err: any) {
            const msg =
                err.response?.data?.message || 'Login failed. Please check your credentials.';
            setError(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [router]);

    const logout = useCallback(() => {
        clearAuth();
        setUser(null);
        router.push('/login');
    }, [router]);

    return { user, login, logout, loading, error };
}

/* ─── useProfile hook ────────────────────────────────────── */

export function useProfile() {
    const [profile, setProfile] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProfile = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get<User>('/auth/me');
            setProfile(data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load profile');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const token = getStoredToken();
        if (token) {
            fetchProfile();
        } else {
            setLoading(false);
        }
    }, [fetchProfile]);

    return { profile, loading, error, refetch: fetchProfile };
}

/* ─── useRequireAuth hook — auth guard ───────────────────── */

export function useRequireAuth() {
    const router = useRouter();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        const token = getStoredToken();
        if (!token) {
            router.replace('/login');
        } else {
            setChecked(true);
        }
    }, [router]);

    return checked;
}
