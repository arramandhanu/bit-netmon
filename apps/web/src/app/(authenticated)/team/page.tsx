'use client';

import { useState } from 'react';
import {
    Users,
    UserPlus,
    Mail,
    Shield,
    Clock,
    Trash2,
    X,
    Loader2,
    Crown,
    Eye,
    Wrench,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    BarChart3,
    Server,
    Globe,
    Monitor,
    MapPin,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useTeam, useInvitations, useTenantInfo, type TeamMember, type PendingInvitation } from '@/hooks/use-tenant';

/* ─── Role Badge ─────────────────────────────────────────── */

function RoleBadge({ role }: { role: string }) {
    const config: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
        admin: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: Crown },
        operator: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: Wrench },
        viewer: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-700', icon: Eye },
        user: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: Users },
    };
    const c = config[role] || config.viewer;
    const Icon = c.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.bg} ${c.text}`}>
            <Icon className="h-3 w-3" />
            {role.charAt(0).toUpperCase() + role.slice(1)}
        </span>
    );
}

/* ─── Invite Modal ───────────────────────────────────────── */

function InviteModal({
    open,
    onClose,
    onInvite,
}: {
    open: boolean;
    onClose: () => void;
    onInvite: (email: string, role: string) => Promise<void>;
}) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('viewer');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!open) return null;

    const handleSubmit = async () => {
        if (!email.trim() || !email.includes('@')) {
            setError('Please enter a valid email address');
            return;
        }
        setError(null);
        setSending(true);
        try {
            await onInvite(email.trim(), role);
            setEmail('');
            setRole('viewer');
            onClose();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Failed to send invitation');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">Invite Team Member</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Send an invitation to join your team</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Email Address <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                                placeholder="colleague@company.com"
                                className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all"
                        >
                            <option value="viewer">Viewer — Read-only access</option>
                            <option value="operator">Operator — Can manage devices</option>
                            <option value="admin">Admin — Full access</option>
                            <option value="user">User — Basic access</option>
                        </select>
                    </div>

                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 border border-red-200 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            {error}
                        </p>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={sending}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 transition-colors"
                        >
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                            {sending ? 'Sending...' : 'Send Invitation'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────── */

export default function TeamPage() {
    const { addToast } = useToast();
    const { members, loading: membersLoading, error: membersError, refetch: refetchMembers, removeMember } = useTeam();
    const { invitations, loading: invLoading, sendInvite, cancelInvite, refetch: refetchInvitations } = useInvitations();
    const { tenantInfo, loading: tenantLoading } = useTenantInfo();

    const [showInvite, setShowInvite] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
    const [removing, setRemoving] = useState(false);

    const handleInvite = async (email: string, role: string) => {
        await sendInvite(email, role);
        addToast({ type: 'success', title: 'Invitation Sent', message: `Invitation sent to ${email}` });
    };

    const handleRemove = async () => {
        if (!removeTarget) return;
        setRemoving(true);
        try {
            await removeMember(removeTarget.id);
            addToast({ type: 'success', title: 'Member Removed', message: `${removeTarget.username} has been removed from the team` });
            setRemoveTarget(null);
        } catch (err: any) {
            addToast({ type: 'error', title: 'Failed', message: err?.response?.data?.message || 'Could not remove member' });
        } finally {
            setRemoving(false);
        }
    };

    const handleCancelInvite = async (inv: PendingInvitation) => {
        try {
            await cancelInvite(inv.id);
            addToast({ type: 'success', title: 'Invitation Cancelled', message: `Invitation to ${inv.email} cancelled` });
        } catch (err: any) {
            addToast({ type: 'error', title: 'Failed', message: err?.response?.data?.message || 'Could not cancel invitation' });
        }
    };

    if (membersLoading && tenantLoading) return <DashboardSkeleton />;
    if (membersError) return <ErrorState message={membersError} onRetry={refetchMembers} />;

    const plan = tenantInfo?.plan;
    const usage = tenantInfo?.usage;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Team Management"
                subtitle="Manage your team members, invitations, and plan usage"
            >
                <button
                    onClick={() => setShowInvite(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors shadow-sm shadow-blue-500/20"
                >
                    <UserPlus className="h-4 w-4" />
                    Invite Member
                </button>
            </PageHeader>

            {/* Plan Usage Cards */}
            {plan && usage && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <UsageCard icon={Users} label="Users" used={usage.users} max={plan.maxUsers} />
                    <UsageCard icon={Server} label="Devices" used={usage.devices} max={plan.maxDevices} />
                    <UsageCard icon={Monitor} label="Servers" used={usage.serverMonitors} max={plan.maxServers} />
                    <UsageCard icon={Globe} label="URL Monitors" used={usage.urlMonitors} max={plan.maxUrlMonitors} />
                    <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 flex flex-col justify-between">
                        <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Plan</span>
                        <span className="text-lg font-bold text-gray-900 mt-1">{plan.name}</span>
                    </div>
                </div>
            )}

            {/* Team Members Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        Team Members ({members.length})
                    </h2>
                </div>
                <div className="divide-y divide-gray-50">
                    {members.map((member) => (
                        <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                    {(member.displayName || member.username).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-gray-900">{member.displayName || member.username}</span>
                                        <RoleBadge role={member.role} />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">{member.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right hidden md:block">
                                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${member.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                                        {member.isActive ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                        {member.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                    {member.lastLoginAt && (
                                        <p className="text-[10px] text-gray-400 mt-0.5">Last seen {new Date(member.lastLoginAt).toLocaleDateString()}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setRemoveTarget(member)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remove member"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {members.length === 0 && (
                        <div className="px-6 py-12 text-center text-gray-400">
                            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No team members yet. Invite someone to get started!</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                            <Mail className="h-4 w-4 text-amber-500" />
                            Pending Invitations ({invitations.length})
                        </h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {invitations.map((inv) => (
                            <div key={inv.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                                        <Mail className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-900">{inv.email}</span>
                                            <RoleBadge role={inv.role} />
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            Expires {new Date(inv.expiresAt).toLocaleDateString()}
                                            {inv.invitedBy && <span> · Invited by {inv.invitedBy.displayName || inv.invitedBy.username}</span>}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleCancelInvite(inv)}
                                    className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modals */}
            <InviteModal open={showInvite} onClose={() => setShowInvite(false)} onInvite={handleInvite} />
            <ConfirmDialog
                open={!!removeTarget}
                title="Remove Team Member"
                message={`Are you sure you want to remove "${removeTarget?.username}" from your team? They will lose access to all team resources.`}
                confirmLabel={removing ? 'Removing...' : 'Remove Member'}
                loading={removing}
                onConfirm={handleRemove}
                onCancel={() => setRemoveTarget(null)}
            />
        </div>
    );
}

/* ─── Usage Card ─────────────────────────────────────────── */

function UsageCard({ icon: Icon, label, used, max }: { icon: React.ElementType; label: string; used: number; max: number }) {
    const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
    const isNearLimit = pct >= 80;
    const isAtLimit = pct >= 100;

    return (
        <div className="rounded-xl border border-gray-100 bg-white p-4 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
                <Icon className={`h-4 w-4 ${isAtLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-gray-300'}`} />
            </div>
            <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${isAtLimit ? 'text-red-600' : 'text-gray-900'}`}>{used}</span>
                <span className="text-sm text-gray-400">/ {max}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-400' : 'bg-blue-500'}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}
