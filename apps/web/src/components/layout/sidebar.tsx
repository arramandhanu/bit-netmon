'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useMemo } from 'react';
import {
    LayoutDashboard,
    Server,
    MapPin,
    Bell,
    Users,
    Settings,
    ChevronLeft,
    ChevronRight,
    Activity,
    Map,
    Search,
    Shield,
    Wifi,
    Ticket,
} from 'lucide-react';
import { clsx } from 'clsx';
import { getStoredUser } from '@/hooks/use-auth';

interface NavItem {
    label: string;
    href: string;
    icon: React.ElementType;
    badge?: number;
    /** Which roles can see this item. If omitted, visible to all. */
    roles?: string[];
}

const navigation: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Devices', href: '/devices', icon: Server },
    { label: 'Locations', href: '/locations', icon: MapPin },
    { label: 'Network Map', href: '/map', icon: Map },
    { label: 'Interfaces', href: '/interfaces', icon: Activity },
    { label: 'Wireless', href: '/wireless', icon: Wifi },
    { label: 'Alerts', href: '/alerts', icon: Bell },
    { label: 'Tickets', href: '/tickets', icon: Ticket },
];

const adminNavigation: NavItem[] = [
    { label: 'Users', href: '/admin/users', icon: Users, roles: ['admin'] },
    { label: 'Discovery', href: '/admin/discovery', icon: Search, roles: ['admin', 'operator'] },
    { label: 'Security', href: '/admin/security', icon: Shield, roles: ['admin'] },
    { label: 'Settings', href: '/admin/settings', icon: Settings, roles: ['admin'] },
];

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const currentUser = getStoredUser();
    const userRole = currentUser?.role || 'viewer';

    // Filter admin items by role
    const visibleAdminNav = useMemo(() => {
        return adminNavigation.filter(item => {
            if (!item.roles) return true;
            return item.roles.includes(userRole);
        });
    }, [userRole]);

    return (
        <aside
            className={clsx(
                'fixed left-0 top-0 z-40 h-screen',
                'flex flex-col',
                'bg-card/95 backdrop-blur-xl',
                'border-r border-border/50',
                'transition-all duration-300 ease-out',
                collapsed ? 'w-[68px]' : 'w-[240px]',
            )}
        >
            {/* Floating edge toggle — visible from both sides */}
            <button
                onClick={onToggle}
                className={clsx(
                    'absolute top-[22px] z-50',
                    'flex h-7 w-7 items-center justify-center',
                    'rounded-full border border-border/60 bg-card shadow-md',
                    'text-muted-foreground hover:text-foreground hover:bg-accent hover:shadow-lg',
                    'transition-all duration-200',
                    '-right-3.5',
                )}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                {collapsed
                    ? <ChevronRight className="h-3.5 w-3.5" />
                    : <ChevronLeft className="h-3.5 w-3.5" />
                }
            </button>

            {/* Logo */}
            <div className="flex h-16 items-center gap-3 px-4 border-b border-border/50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg gradient-primary">
                    <Activity className="h-5 w-5 text-white" />
                </div>
                {!collapsed && (
                    <div className="overflow-hidden">
                        <h1 className="text-lg font-bold tracking-tight">NetMon</h1>
                        <p className="text-[10px] text-muted-foreground leading-none">Network Monitoring</p>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                <p className={clsx(
                    'text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2',
                    collapsed ? 'text-center' : 'px-3',
                )}>
                    {collapsed ? '•' : 'Monitor'}
                </p>

                {navigation.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                    return (
                        <Link key={item.href} href={item.href}>
                            <div
                                className={clsx(
                                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                                    'transition-all duration-150',
                                    isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                                    collapsed && 'justify-center px-0',
                                )}
                                title={collapsed ? item.label : undefined}
                            >
                                <item.icon className={clsx('h-[18px] w-[18px] shrink-0', isActive && 'text-primary')} />
                                {!collapsed && <span>{item.label}</span>}
                                {!collapsed && item.badge && (
                                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive/15 px-1.5 text-[10px] font-semibold text-destructive">
                                        {item.badge}
                                    </span>
                                )}
                            </div>
                        </Link>
                    );
                })}

                {/* Only show Admin section if user has any visible admin items */}
                {visibleAdminNav.length > 0 && (
                    <>
                        <div className="my-4 border-t border-border/50" />

                        <p className={clsx(
                            'text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2',
                            collapsed ? 'text-center' : 'px-3',
                        )}>
                            {collapsed ? '•' : 'Admin'}
                        </p>

                        {visibleAdminNav.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link key={item.href} href={item.href}>
                                    <div
                                        className={clsx(
                                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                                            'transition-all duration-150',
                                            isActive
                                                ? 'bg-primary/10 text-primary'
                                                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                                            collapsed && 'justify-center px-0',
                                        )}
                                        title={collapsed ? item.label : undefined}
                                    >
                                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                                        {!collapsed && <span>{item.label}</span>}
                                    </div>
                                </Link>
                            );
                        })}
                    </>
                )}
            </nav>
        </aside>
    );
}
