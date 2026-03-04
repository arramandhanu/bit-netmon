'use client';

import { useState } from 'react';
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
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
                <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
                <main
                    className="flex-1 transition-all duration-300 ease-out"
                    style={{ marginLeft: sidebarCollapsed ? 68 : 240 }}
                >
                    <Header />
                    <div className="p-6">{children}</div>
                </main>
            </div>
        </ToastProvider>
    );
}

