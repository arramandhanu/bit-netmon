'use client';

import { useState } from 'react';
import { Activity, Eye, EyeOff, Lock, User, Monitor, Shield, Wifi } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export default function LoginPage() {
    const [showPassword, setShowPassword] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login, loading, error } = useAuth();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            await login(username, password);
        } catch {
            // Error is handled in useAuth hook & displayed below
        }
    };

    return (
        <div className="flex min-h-screen" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
            {/* ─── Left Panel (Hero) ────────────────────────── */}
            <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] relative overflow-hidden flex-col justify-between"
                style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)' }}>
                {/* Decorative elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/5 blur-2xl" />
                    <div className="absolute bottom-20 -left-10 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
                    <div className="absolute top-1/3 right-10 h-32 w-32 rounded-full bg-white/10 blur-xl" />
                    {/* Grid pattern */}
                    <div className="absolute inset-0 opacity-[0.04]"
                        style={{
                            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                            backgroundSize: '32px 32px'
                        }}
                    />
                </div>

                {/* Branding */}
                <div className="relative z-10 p-10 pt-12">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm border border-white/10">
                            <Activity className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-white tracking-tight">NetMon</span>
                    </div>
                </div>

                {/* Center content */}
                <div className="relative z-10 px-10 flex-1 flex flex-col justify-center -mt-10">
                    <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight tracking-tight mb-4">
                        Network Monitoring<br />
                        <span className="text-blue-200">Made Simple</span>
                    </h2>
                    <p className="text-blue-100/80 text-sm leading-relaxed max-w-xs">
                        Monitor, manage, and optimize your entire network infrastructure from a single dashboard.
                    </p>

                    {/* Feature pills */}
                    <div className="flex flex-col gap-3 mt-8">
                        <div className="flex items-center gap-3 text-sm text-blue-100/90">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                                <Monitor className="h-4 w-4 text-blue-200" />
                            </div>
                            <span>Real-time device monitoring</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-blue-100/90">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                                <Shield className="h-4 w-4 text-blue-200" />
                            </div>
                            <span>Intelligent alert system</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-blue-100/90">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                                <Wifi className="h-4 w-4 text-blue-200" />
                            </div>
                            <span>SNMP & wireless monitoring</span>
                        </div>
                    </div>
                </div>

                {/* Bottom */}
                <div className="relative z-10 p-10 pb-8">
                    <p className="text-xs text-blue-200/50">© 2026 NetMon. All rights reserved.</p>
                </div>
            </div>

            {/* ─── Right Panel (Form) ──────────────────────── */}
            <div className="flex-1 flex items-center justify-center bg-gray-50 relative">
                {/* Background decorations */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-blue-500/5 blur-3xl" />
                    <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-blue-500/5 blur-3xl" />
                </div>

                <div className="relative w-full max-w-[420px] mx-6">
                    {/* Mobile logo (hidden on desktop where left panel has it) */}
                    <div className="flex flex-col items-center mb-8 lg:hidden">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/25 mb-4">
                            <Activity className="h-7 w-7 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">NetMon</h1>
                        <p className="text-sm text-gray-500 mt-1">Network Monitoring System</p>
                    </div>

                    {/* Welcome text (desktop only) */}
                    <div className="hidden lg:block mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back</h2>
                        <p className="text-sm text-gray-500 mt-1.5">Sign in to your account to continue</p>
                    </div>

                    {/* Login card */}
                    <div className="rounded-2xl border-2 border-gray-200 bg-white p-8 shadow-xl shadow-gray-900/5">
                        {/* Mobile-only heading */}
                        <div className="mb-6 lg:hidden">
                            <h2 className="text-lg font-semibold text-gray-900">Sign in</h2>
                            <p className="text-sm text-gray-500 mt-0.5">Enter your credentials to access the dashboard</p>
                        </div>

                        {/* Error message */}
                        {error && (
                            <div className="mb-4 rounded-xl bg-red-50 border-2 border-red-200 px-4 py-3 text-sm text-red-600 font-medium">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Username */}
                            <div className="space-y-2">
                                <label htmlFor="username" className="text-sm font-semibold text-gray-700">
                                    Username
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                    <input
                                        id="username"
                                        data-testid="username"
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter your username"
                                        required
                                        disabled={loading}
                                        className="h-12 w-full rounded-xl border-2 border-gray-200 bg-gray-50 pl-11 pr-4 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-2">
                                <label htmlFor="password" className="text-sm font-semibold text-gray-700">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                    <input
                                        id="password"
                                        data-testid="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        required
                                        disabled={loading}
                                        className="h-12 w-full rounded-xl border-2 border-gray-200 bg-gray-50 pl-11 pr-12 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white disabled:opacity-50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                data-testid="login-button"
                                disabled={loading}
                                className="h-12 w-full rounded-xl bg-blue-600 text-white font-semibold text-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        Signing in...
                                    </span>
                                ) : (
                                    'Sign in'
                                )}
                            </button>
                        </form>
                    </div>

                    <p className="text-center text-xs text-gray-400 mt-6">
                        NetMon v0.1.0
                    </p>
                </div>
            </div>
        </div>
    );
}
