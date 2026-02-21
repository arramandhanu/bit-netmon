'use client';

import { Bell, Search, User, LogOut } from 'lucide-react';
import { useState } from 'react';
import { getStoredUser } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

export function Header() {
    const [showUserMenu, setShowUserMenu] = useState(false);
    const router = useRouter();
    const user = getStoredUser();

    const handleLogout = () => {
        localStorage.removeItem('netmon_access_token');
        localStorage.removeItem('netmon_refresh_token');
        localStorage.removeItem('netmon_user');
        router.push('/login');
    };

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-card/80 backdrop-blur-xl px-6">
            {/* Search */}
            <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search devices, locations..."
                    className="h-9 w-full rounded-lg border border-input bg-background/50 pl-10 pr-4 text-sm outline-none ring-ring transition-shadow placeholder:text-muted-foreground focus:ring-2"
                />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                {/* Notifications */}
                <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                    <Bell className="h-[18px] w-[18px]" />
                    <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                </button>

                {/* Separator */}
                <div className="mx-2 h-6 w-px bg-border" />

                {/* User menu */}
                <div className="relative">
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors"
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                            <User className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-medium leading-none">{user?.username || 'User'}</p>
                            <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
                                {user?.role || 'user'}
                            </p>
                        </div>
                    </button>

                    {/* Dropdown */}
                    {showUserMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                            <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-border bg-card shadow-lg py-1">
                                <div className="px-3 py-2 border-b border-border/50">
                                    <p className="text-sm font-medium">{user?.username}</p>
                                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                                >
                                    <LogOut className="h-4 w-4" />
                                    Sign out
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}

