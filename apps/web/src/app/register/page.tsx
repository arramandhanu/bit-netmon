'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    UserPlus, Mail, Lock, Building2, User, Loader2, CheckCircle2,
    ArrowRight, Sparkles, Shield, Activity, Server, RefreshCw,
    Phone, MapPin, Contact,
} from 'lucide-react';

export default function RegisterPage() {
    const router = useRouter();
    const [form, setForm] = useState({
        username: '', email: '', password: '', companyName: '',
        fullName: '', phone: '', address: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [resending, setResending] = useState(false);
    const [resendMsg, setResendMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/v1/billing/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Registration failed');
            setSuccess(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setResending(true);
        setResendMsg('');
        try {
            const res = await fetch('/api/v1/billing/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: form.email }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to resend');
            setResendMsg('Email verifikasi berhasil dikirim ulang!');
        } catch (err: any) {
            setResendMsg(err.message);
        } finally {
            setResending(false);
        }
    };

    const features = [
        { icon: Server, text: 'Monitor up to 5 perangkat gratis' },
        { icon: Activity, text: 'Real-time dashboard & alerts' },
        { icon: Shield, text: 'Encrypted credentials (AES-256)' },
        { icon: Sparkles, text: '14 hari trial gratis untuk semua fitur' },
    ];

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 px-4">
                <div className="max-w-md w-full text-center">
                    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-100 flex items-center justify-center">
                            <Mail className="h-8 w-8 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Cek Email Anda!</h2>
                        <p className="text-gray-500 mt-3 text-sm leading-relaxed">
                            Kami telah mengirim email verifikasi ke{' '}
                            <strong className="text-gray-700">{form.email}</strong>.
                            <br />
                            Klik link di email untuk mengaktifkan akun Anda.
                        </p>

                        <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
                            <p className="text-xs text-amber-700">
                                <strong>💡 Tips:</strong> Periksa juga folder <strong>Spam</strong> atau <strong>Promotions</strong> jika email tidak ada di Inbox.
                            </p>
                        </div>

                        <div className="mt-6 space-y-3">
                            <button
                                onClick={handleResend}
                                disabled={resending}
                                className="w-full h-10 flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
                            >
                                {resending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <RefreshCw className="h-4 w-4" />
                                        Kirim Ulang Email
                                    </>
                                )}
                            </button>

                            {resendMsg && (
                                <p className="text-xs text-emerald-600 font-medium">{resendMsg}</p>
                            )}

                            <Link href="/login"
                                className="block w-full h-10 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-semibold shadow-lg shadow-blue-600/25 hover:shadow-xl transition-all">
                                Ke Halaman Login <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
            {/* Left: Features */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                <div className="max-w-md">
                    <h1 className="text-4xl font-black leading-tight">
                        BitNetMon<br />
                        <span className="text-blue-200">Network Monitoring</span>
                    </h1>
                    <p className="mt-4 text-blue-100 text-lg leading-relaxed">
                        Platform monitoring jaringan, server, dan website berbasis cloud dengan AI analytics.
                    </p>
                    <div className="mt-10 space-y-4">
                        {features.map((f, i) => {
                            const Icon = f.icon;
                            return (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                                        <Icon className="h-5 w-5 text-blue-200" />
                                    </div>
                                    <span className="text-blue-50">{f.text}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-10 p-4 rounded-xl bg-white/10 border border-white/20">
                        <p className="text-sm text-blue-100">
                            <Sparkles className="h-4 w-4 inline mr-1" />
                            <strong>14 hari trial gratis</strong> — akses semua fitur tanpa kartu kredit
                        </p>
                    </div>
                </div>
            </div>

            {/* Right: Form */}
            <div className="flex-1 flex items-center justify-center px-8 py-12">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                            <UserPlus className="h-7 w-7 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Buat Akun Baru</h2>
                        <p className="text-sm text-gray-500 mt-1">Mulai monitoring dalam 5 menit</p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        required
                                        value={form.username}
                                        onChange={e => setForm({ ...form, username: e.target.value })}
                                        className="w-full h-11 pl-10 pr-4 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        placeholder="johndoe"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                                <div className="relative">
                                    <Contact className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={form.fullName}
                                        onChange={e => setForm({ ...form, fullName: e.target.value })}
                                        className="w-full h-11 pl-10 pr-4 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="email"
                                    required
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    className="w-full h-11 pl-10 pr-4 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    placeholder="john@company.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="password"
                                    required
                                    minLength={8}
                                    value={form.password}
                                    onChange={e => setForm({ ...form, password: e.target.value })}
                                    className="w-full h-11 pl-10 pr-4 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    placeholder="Minimal 8 karakter"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="tel"
                                        value={form.phone}
                                        onChange={e => setForm({ ...form, phone: e.target.value })}
                                        className="w-full h-11 pl-10 pr-4 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        placeholder="08123456789"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Perusahaan <span className="text-gray-400">(opsional)</span>
                                </label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={form.companyName}
                                        onChange={e => setForm({ ...form, companyName: e.target.value })}
                                        className="w-full h-11 pl-10 pr-4 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        placeholder="PT Contoh"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Alamat <span className="text-gray-400">(opsional)</span>
                            </label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <textarea
                                    value={form.address}
                                    onChange={e => setForm({ ...form, address: e.target.value })}
                                    rows={2}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                                    placeholder="Alamat lengkap"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-semibold shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 transition-all disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    Daftar Gratis <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-gray-500">
                        Sudah punya akun?{' '}
                        <Link href="/login" className="text-blue-600 font-medium hover:underline">
                            Login di sini
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
