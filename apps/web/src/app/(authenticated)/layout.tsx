'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useRequireAuth } from '@/hooks/use-auth';
import { ToastProvider } from '@/components/ui/toast';

/**
 * Authenticated layout shell — sidebar + header + content area.
 * All pages inside (authenticated)/ route group use this layout.
 * Redirects to /login if no valid token is found.
 */
export default function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const isAuthenticated = useRequireAuth();

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
            <div className="flex min-h-screen">
                <Sidebar />
                <main className="flex-1 ml-[240px]">
                    <Header />
                    <div className="p-6">{children}</div>
                </main>
            </div>
        </ToastProvider>
    );
}

