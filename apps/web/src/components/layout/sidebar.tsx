'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
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
} from 'lucide-react';
import { clsx } from 'clsx';

interface NavItem {
    label: string;
    href: string;
    icon: React.ElementType;
    badge?: number;
}

const navigation: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Devices', href: '/devices', icon: Server },
    { label: 'Locations', href: '/locations', icon: MapPin },
    { label: 'Network Map', href: '/map', icon: Map },
    { label: 'Interfaces', href: '/interfaces', icon: Activity },
    { label: 'Wireless', href: '/wireless', icon: Wifi },
    { label: 'Alerts', href: '/alerts', icon: Bell },
];

const adminNavigation: NavItem[] = [
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Discovery', href: '/admin/discovery', icon: Search },
    { label: 'Security', href: '/admin/security', icon: Shield },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

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

                <div className="my-4 border-t border-border/50" />

                <p className={clsx(
                    'text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2',
                    collapsed ? 'text-center' : 'px-3',
                )}>
                    {collapsed ? '•' : 'Admin'}
                </p>

                {adminNavigation.map((item) => {
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
                            >
                                <item.icon className="h-[18px] w-[18px] shrink-0" />
                                {!collapsed && <span>{item.label}</span>}
                            </div>
                        </Link>
                    );
                })}
            </nav>

            {/* Collapse toggle */}
            <div className="border-t border-border/50 p-3">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex w-full items-center justify-center rounded-lg py-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
            </div>
        </aside>
    );
}
