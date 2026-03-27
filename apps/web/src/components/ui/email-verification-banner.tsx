'use client';

import { useState, useCallback } from 'react';
import { Mail, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { getStoredUser } from '@/hooks/use-auth';

/**
 * Email verification banner — shown at the top of the dashboard
 * when the user has not yet verified their email address.
 */
export function EmailVerificationBanner() {
    const [dismissed, setDismissed] = useState(false);
    const [resending, setResending] = useState(false);
    const [resendMsg, setResendMsg] = useState('');
    const user = getStoredUser();

    // Don't show if verified, dismissed, or no user
    if (!user || user.emailVerified !== false || dismissed) return null;

    const handleResend = async () => {
        setResending(true);
        setResendMsg('');
        try {
            const res = await fetch('/api/v1/billing/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Gagal mengirim ulang');
            setResendMsg('✅ Email verifikasi berhasil dikirim ulang!');
        } catch (err: any) {
            setResendMsg(`❌ ${err.message}`);
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="relative bg-gradient-to-r from-amber-50 to-orange-50 border-b-2 border-amber-300 px-6 py-3.5">
            <div className="flex items-center gap-3 max-w-7xl mx-auto">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 flex-shrink-0">
                    <AlertTriangle className="h-4.5 w-4.5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-900">
                        Email Anda belum terverifikasi
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                        Verifikasi email <strong>{user.email}</strong> untuk mengakses semua fitur.
                        Cek inbox atau folder spam Anda.
                    </p>
                    {resendMsg && (
                        <p className="text-xs text-amber-800 mt-1 font-medium">{resendMsg}</p>
                    )}
                </div>
                <button
                    onClick={handleResend}
                    disabled={resending}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-all shadow-sm disabled:opacity-50 flex-shrink-0"
                >
                    {resending ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Mail className="h-3.5 w-3.5" />
                    )}
                    {resending ? 'Mengirim...' : 'Kirim Ulang'}
                </button>
                <button
                    onClick={() => setDismissed(true)}
                    className="p-1.5 text-amber-400 hover:text-amber-600 transition-colors rounded-lg hover:bg-amber-100 flex-shrink-0"
                    title="Tutup"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
