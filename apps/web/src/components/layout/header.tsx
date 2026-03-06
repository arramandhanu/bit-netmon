'use client';

import { Bell, Search, User, LogOut, Ticket, AlertTriangle, CheckCircle2, Clock, ArrowRight, X, MessageSquare, Settings } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getStoredUser } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

/* ─── Notification Types ──────────────────────────────────── */

interface NotificationTicket {
    id: number;
    ticketNumber: string;
    title: string;
    status: string;
    priority: string;
    category: string;
    updatedAt: string;
    createdAt: string;
    creator?: { id: number; username: string; displayName?: string };
    assignee?: { id: number; username: string; displayName?: string };
    _count?: { comments: number };
}

const statusStyles: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    open: { label: 'Open', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    in_progress: { label: 'In Progress', bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-500' },
    waiting: { label: 'Waiting', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    escalated: { label: 'Escalated', bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
    on_hold: { label: 'On Hold', bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
    resolved: { label: 'Resolved', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    closed: { label: 'Closed', bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' },
};

const priorityStyles: Record<string, { label: string; color: string }> = {
    critical: { label: 'Critical', color: 'text-red-600' },
    high: { label: 'High', color: 'text-orange-600' },
    medium: { label: 'Medium', color: 'text-blue-600' },
    low: { label: 'Low', color: 'text-green-600' },
};

const categoryStyles: Record<string, { label: string; color: string }> = {
    incident: { label: 'Incident', color: 'text-red-600' },
    problem: { label: 'Problem', color: 'text-amber-600' },
    change_request: { label: 'Change Request', color: 'text-violet-600' },
    maintenance: { label: 'Maintenance', color: 'text-teal-600' },
};

function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ─── Component ───────────────────────────────────────────── */

export function Header() {
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<NotificationTicket[]>([]);
    const [loading, setLoading] = useState(false);
    const [readIds, setReadIds] = useState<Set<number>>(new Set());
    const notifRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const user = getStoredUser();

    // Load read IDs from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem('netmon_read_notifications');
            if (stored) setReadIds(new Set(JSON.parse(stored)));
        } catch { /* ignore */ }
    }, []);

    // Fetch recent ticket activity
    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/tickets?limit=10&sortBy=updatedAt&sortOrder=desc');
            const tickets = res.data?.data || res.data || [];
            setNotifications(tickets);
        } catch (err) {
            console.error('Failed to load notifications', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch on mount & on open
    useEffect(() => {
        fetchNotifications();
        // Poll every 60s
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    useEffect(() => {
        if (showNotifications) fetchNotifications();
    }, [showNotifications, fetchNotifications]);

    // Click outside to close
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setShowNotifications(false);
            }
        }
        if (showNotifications) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showNotifications]);

    const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

    const markAsRead = (id: number) => {
        setReadIds(prev => {
            const next = new Set(prev);
            next.add(id);
            localStorage.setItem('netmon_read_notifications', JSON.stringify([...next]));
            return next;
        });
    };

    const markAllRead = () => {
        const allIds = new Set(notifications.map(n => n.id));
        setReadIds(allIds);
        localStorage.setItem('netmon_read_notifications', JSON.stringify([...allIds]));
    };

    const handleNotifClick = (ticket: NotificationTicket) => {
        markAsRead(ticket.id);
        setShowNotifications(false);
        router.push(`/tickets/${ticket.id}`);
    };

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
                <div className="relative" ref={notifRef}>
                    <button
                        onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
                        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                        <Bell className="h-[18px] w-[18px]" />
                        {unreadCount > 0 && (
                            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Notification Dropdown */}
                    {showNotifications && (
                        <div className="absolute right-0 top-full mt-2 z-50 w-[420px] rounded-xl border-2 border-gray-200 bg-card shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-gray-100 bg-gray-50/80">
                                <div className="flex items-center gap-2">
                                    <Bell className="h-4 w-4 text-primary" />
                                    <h3 className="text-sm font-bold text-foreground">Notifications</h3>
                                    {unreadCount > 0 && (
                                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                                            {unreadCount}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={markAllRead}
                                            className="text-[11px] font-semibold text-primary hover:text-primary/80 px-2 py-1 rounded-md hover:bg-primary/5 transition-colors"
                                        >
                                            Mark all read
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowNotifications(false)}
                                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Notification List */}
                            <div className="max-h-[400px] overflow-y-auto overscroll-contain">
                                {loading && notifications.length === 0 ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className="text-center py-12 px-4">
                                        <Bell className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
                                        <p className="text-sm font-medium text-muted-foreground/60">No notifications yet</p>
                                        <p className="text-xs text-muted-foreground/40 mt-1">Ticket updates will appear here</p>
                                    </div>
                                ) : (
                                    notifications.map((ticket) => {
                                        const isRead = readIds.has(ticket.id);
                                        const sc = statusStyles[ticket.status] || statusStyles.open;
                                        const pc = priorityStyles[ticket.priority] || priorityStyles.medium;
                                        const catCfg = categoryStyles[ticket.category] || categoryStyles.incident;

                                        return (
                                            <button
                                                key={ticket.id}
                                                onClick={() => handleNotifClick(ticket)}
                                                className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-accent/50 transition-all group ${!isRead ? 'bg-blue-50/40' : ''
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    {/* Unread indicator */}
                                                    <div className="mt-2 shrink-0">
                                                        {!isRead ? (
                                                            <div className="h-2 w-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                                                        ) : (
                                                            <div className="h-2 w-2 rounded-full bg-transparent" />
                                                        )}
                                                    </div>

                                                    {/* Icon based on category */}
                                                    <div className={`mt-0.5 shrink-0 flex h-8 w-8 items-center justify-center rounded-lg ${ticket.category === 'incident' ? 'bg-red-100 text-red-600'
                                                        : ticket.category === 'problem' ? 'bg-amber-100 text-amber-600'
                                                            : ticket.category === 'change_request' ? 'bg-violet-100 text-violet-600'
                                                                : 'bg-teal-100 text-teal-600'
                                                        }`}>
                                                        {ticket.category === 'incident' ? <AlertTriangle className="h-4 w-4" /> :
                                                            ticket.category === 'maintenance' ? <Settings className="h-4 w-4" /> :
                                                                <Ticket className="h-4 w-4" />}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">{ticket.ticketNumber}</span>
                                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${sc.bg} ${sc.text}`}>
                                                                <span className={`h-1 w-1 rounded-full ${sc.dot}`} />
                                                                {sc.label}
                                                            </span>
                                                        </div>
                                                        <p className={`text-sm leading-tight truncate ${!isRead ? 'font-bold text-foreground' : 'font-medium text-foreground/80'}`}>
                                                            {ticket.title}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`text-[10px] font-semibold ${catCfg.color}`}>{catCfg.label}</span>
                                                            <span className="text-[10px] text-muted-foreground/40">•</span>
                                                            <span className={`text-[10px] font-semibold ${pc.color}`}>{pc.label}</span>
                                                            {ticket._count?.comments ? (
                                                                <>
                                                                    <span className="text-[10px] text-muted-foreground/40">•</span>
                                                                    <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                                                                        <MessageSquare className="h-2.5 w-2.5" />
                                                                        {ticket._count.comments}
                                                                    </span>
                                                                </>
                                                            ) : null}
                                                        </div>
                                                    </div>

                                                    {/* Time + arrow */}
                                                    <div className="shrink-0 text-right flex flex-col items-end gap-1">
                                                        <span className="text-[10px] text-muted-foreground/50 font-medium whitespace-nowrap">{timeAgo(ticket.updatedAt)}</span>
                                                        <ArrowRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>

                            {/* Footer */}
                            {notifications.length > 0 && (
                                <div className="border-t-2 border-gray-100 bg-gray-50/50 px-4 py-2.5">
                                    <button
                                        onClick={() => { setShowNotifications(false); router.push('/tickets'); }}
                                        className="w-full text-center text-xs font-bold text-primary hover:text-primary/80 py-1 rounded-md hover:bg-primary/5 transition-colors flex items-center justify-center gap-1"
                                    >
                                        View all tickets
                                        <ArrowRight className="h-3 w-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Separator */}
                <div className="mx-2 h-6 w-px bg-border" />

                {/* User menu */}
                <div className="relative">
                    <button
                        onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
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
