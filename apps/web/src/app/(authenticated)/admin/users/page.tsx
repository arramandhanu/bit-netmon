'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Shield, UserPlus, UserCheck, UserX, Pencil, Trash2, Loader2, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { DataTable, Column } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { useUsers, User, createUser, updateUser, deactivateUser } from '@/hooks/use-admin';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { getStoredUser } from '@/hooks/use-auth';

const roleConfig: Record<string, { bg: string; text: string }> = {
    admin: { bg: 'bg-red-500/10', text: 'text-red-400' },
    ADMIN: { bg: 'bg-red-500/10', text: 'text-red-400' },
    operator: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
    OPERATOR: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
    viewer: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    VIEWER: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    user: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
    USER: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
};

/* ─── Modal ──────────────────────────────────────────── */

function UserModal({ user, onClose, onSaved }: { user?: User | null; onClose: () => void; onSaved: () => void }) {
    const isEdit = !!user;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSaving(true);
        setError('');
        const fd = new FormData(e.currentTarget);

        try {
            if (isEdit && user) {
                await updateUser(user.id, {
                    email: fd.get('email') as string,
                    displayName: fd.get('displayName') as string,
                    role: fd.get('role') as string,
                    isActive: fd.get('isActive') === 'on',
                });
            } else {
                await createUser({
                    username: fd.get('username') as string,
                    email: fd.get('email') as string,
                    password: fd.get('password') as string,
                    role: fd.get('role') as string,
                });
            }
            onSaved();
            onClose();
        } catch (err: any) {
            setError(err?.response?.data?.message || err.message || 'Failed');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold">{isEdit ? 'Edit User' : 'Add User'}</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                </div>

                {error && <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm text-red-400">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isEdit && (
                        <label className="block">
                            <span className="text-xs font-medium text-muted-foreground">Username</span>
                            <input name="username" required className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                        </label>
                    )}
                    <label className="block">
                        <span className="text-xs font-medium text-muted-foreground">Email</span>
                        <input name="email" type="email" required defaultValue={user?.email || ''} className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                    {isEdit && (
                        <label className="block">
                            <span className="text-xs font-medium text-muted-foreground">Display Name</span>
                            <input name="displayName" defaultValue={user?.displayName || ''} className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                        </label>
                    )}
                    {!isEdit && (
                        <label className="block">
                            <span className="text-xs font-medium text-muted-foreground">Password</span>
                            <input name="password" type="password" required minLength={6} className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                        </label>
                    )}
                    <label className="block">
                        <span className="text-xs font-medium text-muted-foreground">Role</span>
                        <select name="role" defaultValue={user?.role || 'viewer'} className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                            <option value="admin">Admin</option>
                            <option value="operator">Operator</option>
                            <option value="viewer">Viewer</option>
                            <option value="user">User (SaaS)</option>
                        </select>
                    </label>
                    {isEdit && (
                        <label className="flex items-center gap-2">
                            <input type="checkbox" name="isActive" defaultChecked={user?.isActive ?? true} className="rounded border-border" />
                            <span className="text-sm">Active</span>
                        </label>
                    )}
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted/50">Cancel</button>
                        <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isEdit ? 'Save Changes' : 'Create User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────── */

export default function UsersPage() {
    const router = useRouter();
    const currentUser = getStoredUser();
    const isAdmin = currentUser?.role === 'admin';
    const { users, loading, error, refetch } = useUsers();
    const [modal, setModal] = useState<{ open: boolean; user?: User | null }>({ open: false });
    const [deleting, setDeleting] = useState<number | null>(null);

    useEffect(() => {
        if (!isAdmin) router.replace('/dashboard');
    }, [isAdmin, router]);

    if (!isAdmin) return null;

    if (loading && !users.length) return <DashboardSkeleton />;
    if (error) return <ErrorState message={error} onRetry={refetch} />;

    async function handleDeactivate(id: number) {
        if (!confirm('Deactivate this user?')) return;
        setDeleting(id);
        try {
            await deactivateUser(id);
            refetch();
        } finally {
            setDeleting(null);
        }
    }

    const columns: Column<User>[] = [
        {
            key: 'username',
            header: 'User',
            sortable: true,
            render: (r) => (
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold">
                        {r.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-medium">{r.displayName || r.username}</p>
                        <p className="text-xs text-muted-foreground">{r.email}</p>
                    </div>
                </div>
            ),
        },
        {
            key: 'role',
            header: 'Role',
            sortable: true,
            render: (r) => {
                const cfg = roleConfig[r.role] || { bg: 'bg-muted', text: 'text-muted-foreground' };
                return (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${cfg.bg} ${cfg.text}`}>
                        {r.role}
                    </span>
                );
            },
        },
        {
            key: 'isActive',
            header: 'Status',
            render: (r) => <StatusBadge status={r.isActive ? 'active' : 'inactive'} />,
        },
        {
            key: 'lastLoginAt',
            header: 'Last Login',
            sortable: true,
            render: (r) => (
                <span className="text-sm text-muted-foreground">
                    {r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleString() : 'Never'}
                </span>
            ),
        },
        {
            key: 'createdAt',
            header: 'Created',
            sortable: true,
            render: (r) => (
                <span className="text-sm text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()}
                </span>
            ),
        },
        {
            key: 'actions' as any,
            header: '',
            render: (r) => (
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setModal({ open: true, user: r })}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                        title="Edit user"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => handleDeactivate(r.id)}
                        disabled={deleting === r.id}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
                        title="Deactivate user"
                    >
                        {deleting === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader title="User Management" subtitle="Manage users and their access roles">
                <button
                    onClick={() => setModal({ open: true, user: null })}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all"
                >
                    <UserPlus className="h-4 w-4" />
                    Add User
                </button>
            </PageHeader>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Total Users" value={users.length} icon={Users} />
                <MetricCard label="Admins" value={users.filter((u) => u.role === 'admin' || u.role === 'ADMIN').length} icon={Shield} />
                <MetricCard label="Active" value={users.filter((u) => u.isActive).length} icon={UserCheck} />
                <MetricCard label="Inactive" value={users.filter((u) => !u.isActive).length} icon={UserX} />
            </div>

            <DataTable data={users} columns={columns} searchKey="username" searchPlaceholder="Search users..." />

            {modal.open && (
                <UserModal
                    user={modal.user}
                    onClose={() => setModal({ open: false })}
                    onSaved={() => refetch()}
                />
            )}
        </div>
    );
}
