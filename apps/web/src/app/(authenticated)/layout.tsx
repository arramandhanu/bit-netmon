'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useRequireAuth, getStoredUser } from '@/hooks/use-auth';
import { ToastProvider } from '@/components/ui/toast';
import { EmailVerificationBanner } from '@/components/ui/email-verification-banner';
import { OnboardingTour } from '@/components/ui/onboarding-tour';
import { SubscriptionProvider } from '@/components/ui/subscription-guard';

/**
 * Authenticated layout shell — sidebar + header + content area.
 * All pages inside (authenticated)/ route group use this layout.
 * Redirects to /login if no valid token is found.
 * Redirects 'user' role away from /admin/* routes.
 */
export default function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const isAuthenticated = useRequireAuth();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    // Role-based route guard: redirect 'user' away from /admin/* routes
    useEffect(() => {
        if (!isAuthenticated) return;
        const user = getStoredUser();
        if (user?.role === 'user' && pathname?.startsWith('/admin')) {
            router.replace('/dashboard');
        }
    }, [isAuthenticated, pathname, router]);

    // Show nothing while checking auth — prevents flash of content
    if (!isAuthenticated) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            </div>
        );
    }

    return (
        <ToastProvider>
            <SubscriptionProvider>
                <div className="flex min-h-screen">
                    <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
                    <main
                        className="flex-1 transition-all duration-300 ease-out flex flex-col"
                        style={{ marginLeft: sidebarCollapsed ? 68 : 240 }}
                    >
                        <Header />
                        <EmailVerificationBanner />
                        <div className="p-6 flex-1">{children}</div>
                    </main>
                    <OnboardingTour />
                </div>
            </SubscriptionProvider>
        </ToastProvider>
    );
}

