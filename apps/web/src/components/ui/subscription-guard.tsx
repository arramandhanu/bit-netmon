'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { api } from '@/lib/api-client';
import Link from 'next/link';
import { AlertTriangle, CreditCard, Clock, ShieldAlert } from 'lucide-react';

export interface SubscriptionStatus {
    status: string;
    canAccessDevices: boolean;
    plan?: any;
    trialEndsAt?: string;
    trialDaysLeft?: number;
    dataRetentionDaysLeft?: number | null;
    currentPeriodEnd?: string;
    dataExpiryDate?: string;
}

const SubscriptionContext = createContext<SubscriptionStatus | null>(null);

export function useSubscriptionStatus() {
    return useContext(SubscriptionContext);
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<SubscriptionStatus | null>(null);

    useEffect(() => {
        api.get('/billing/subscription-status')
            .then(res => setStatus(res.data))
            .catch(() => setStatus({ status: 'active', canAccessDevices: true }));
    }, []);

    return (
        <SubscriptionContext.Provider value={status}>
            {children}
        </SubscriptionContext.Provider>
    );
}

/**
 * Wrap device/monitoring pages with this guard.
 * If trial expired, shows a blocking banner instead of children.
 */
export function SubscriptionGuard({ children }: { children: ReactNode }) {
    const sub = useSubscriptionStatus();

    // Still loading or no subscription context
    if (!sub) return <>{children}</>;

    // Active or trial — show trial banner if applicable
    if (sub.canAccessDevices) {
        return (
            <>
                {sub.status === 'trial' && sub.trialDaysLeft != null && sub.trialDaysLeft <= 7 && (
                    <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-3">
                        <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-amber-800">
                                Trial ending in {sub.trialDaysLeft} day{sub.trialDaysLeft !== 1 ? 's' : ''}
                            </p>
                            <p className="text-xs text-amber-600">
                                Upgrade to a paid plan to keep access to your devices and data.
                            </p>
                        </div>
                        <Link
                            href="/billing"
                            className="shrink-0 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors"
                        >
                            Upgrade Now
                        </Link>
                    </div>
                )}
                {children}
            </>
        );
    }

    // Trial expired — block access
    if (sub.status === 'trial_expired') {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-2xl border-2 border-red-200 shadow-xl p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <ShieldAlert className="h-8 w-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Trial Period Ended</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Your 14-day Business plan trial has ended. Your data is safely preserved
                        for {sub.dataRetentionDaysLeft ?? 0} more days.
                    </p>
                    <p className="text-xs text-gray-400 mb-6">
                        Upgrade now to continue monitoring your devices and access all features.
                    </p>
                    <Link
                        href="/billing"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <CreditCard className="h-4 w-4" />
                        Choose a Plan
                    </Link>
                    <p className="text-xs text-gray-400 mt-4">
                        You can still access <Link href="/team" className="text-blue-500 hover:underline">Team</Link>,{' '}
                        <Link href="/profile" className="text-blue-500 hover:underline">Profile</Link>, and{' '}
                        <Link href="/billing" className="text-blue-500 hover:underline">Billing</Link> pages.
                    </p>
                </div>
            </div>
        );
    }

    // Data expired
    if (sub.status === 'data_expired') {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-2xl border-2 border-gray-200 shadow-xl p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="h-8 w-8 text-gray-400" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Subscription Required</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Your trial and data retention period have ended. Subscribe to a plan to start fresh.
                    </p>
                    <Link
                        href="/billing"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <CreditCard className="h-4 w-4" />
                        Choose a Plan
                    </Link>
                </div>
            </div>
        );
    }

    // Default: show content
    return <>{children}</>;
}
