'use client';

import { useState, useEffect } from 'react';
import {
    UserCircle, Mail, Phone, Shield, Building2,
    Save, Eye, EyeOff, Lock, Loader2, CheckCircle2,
    CreditCard, Calendar,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { useSubscription } from '@/hooks/use-billing';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { useToast } from '@/components/ui/toast';

interface UserProfile {
    id: number;
    username: string;
    email: string;
    displayName: string | null;
    fullName: string | null;
    phone: string | null;
    role: string;
    tenantId: number | null;
    tenant?: { name: string; slug: string; company: string | null } | null;
    emailVerified: boolean;
    lastLoginAt: string | null;
    createdAt: string;
}

export default function ProfilePage() {
    const { addToast } = useToast();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { data: billing } = useSubscription();

    // Editable fields
    const [displayName, setDisplayName] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');

    // Password change
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    useEffect(() => {
        api.get('/auth/me')
            .then(res => {
                const p = res.data;
                setProfile(p);
                setDisplayName(p.displayName || '');
                setFullName(p.fullName || '');
                setPhone(p.phone || '');
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            const res = await api.patch('/auth/profile', { displayName, fullName, phone });
            setProfile(prev => prev ? { ...prev, ...res.data } : prev);
            addToast({ type: 'success', title: 'Profile Updated', message: 'Your profile has been saved.' });
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to update profile' });
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            addToast({ type: 'error', title: 'Error', message: 'New passwords do not match' });
            return;
        }
        if (newPassword.length < 6) {
            addToast({ type: 'error', title: 'Error', message: 'Password must be at least 6 characters' });
            return;
        }
        setChangingPassword(true);
        try {
            await api.post('/auth/change-password', { currentPassword, newPassword });
            addToast({ type: 'success', title: 'Password Changed', message: 'Your password has been updated.' });
            setShowPasswordForm(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to change password' });
        } finally {
            setChangingPassword(false);
        }
    };

    if (loading) return <DashboardSkeleton />;
    if (!profile) return <div className="p-8 text-center text-muted-foreground">Failed to load profile</div>;

    const plan = billing?.plan;
    const sub = billing?.subscription;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your account settings and subscription</p>
            </div>

            {/* Profile Info Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                            {(profile.displayName || profile.username).charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">{profile.displayName || profile.username}</h2>
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                                <Mail className="h-3.5 w-3.5" /> {profile.email}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                                    <Shield className="h-3 w-3" /> {profile.role}
                                </span>
                                {profile.emailVerified && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                                        <CheckCircle2 className="h-3 w-3" /> Verified
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Display Name</label>
                            <div className="relative">
                                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                                    placeholder="Display name"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                                placeholder="Full name"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                                    placeholder="+62 xxx"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="email"
                                    value={profile.email}
                                    disabled
                                    className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500 cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors shadow-sm disabled:opacity-60"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {saving ? 'Saving...' : 'Save Profile'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Subscription Status */}
            {plan && sub && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-blue-500" /> Subscription
                        </h3>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
                                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Plan</span>
                                <p className="text-lg font-bold text-gray-900 mt-1">{plan.name}</p>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-4">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</span>
                                <p className={`text-lg font-bold mt-1 ${sub.status === 'trial' ? 'text-amber-600' : sub.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                                    {sub.status === 'trial' ? '🔥 Trial' : sub.status === 'active' ? '✅ Active' : sub.status}
                                </p>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-4">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> Period End
                                </span>
                                <p className="text-lg font-bold text-gray-900 mt-1">
                                    {sub.trialEndsAt
                                        ? new Date(sub.trialEndsAt).toLocaleDateString()
                                        : sub.currentPeriodEnd
                                            ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                                            : '-'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Password */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <Lock className="h-4 w-4 text-amber-500" /> Security
                    </h3>
                    {!showPasswordForm && (
                        <button
                            onClick={() => setShowPasswordForm(true)}
                            className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                            Change Password
                        </button>
                    )}
                </div>

                {showPasswordForm && (
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Current Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    className="w-full h-10 pl-10 pr-10 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                                    placeholder="Current password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                                    placeholder="New password"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Confirm New Password</label>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                                    placeholder="Confirm new password"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleChangePassword}
                                disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium text-sm disabled:opacity-60"
                            >
                                {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                                {changingPassword ? 'Changing...' : 'Change Password'}
                            </button>
                        </div>
                    </div>
                )}

                {!showPasswordForm && (
                    <div className="p-6 text-sm text-gray-500">
                        <p>Last login: {profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : 'Never'}</p>
                        <p className="mt-1">Account created: {new Date(profile.createdAt).toLocaleDateString()}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
