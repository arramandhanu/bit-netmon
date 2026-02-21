'use client';

import { useState, useRef } from 'react';
import { Save, Bell, Server, Clock, Shield, Mail, MessageSquare, Globe, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useSettings } from '@/hooks/use-admin';

/* ─── Helper: get setting value with fallback ────────────── */

function sv(settings: Record<string, Record<string, string>>, key: string, fallback: string): string {
    const [cat] = key.split('.');
    return settings[cat]?.[key] ?? fallback;
}

/* ─── Component ──────────────────────────────────────────── */

export default function SettingsPage() {
    const { settings, loading, saving, saveSettings } = useSettings();
    const [saved, setSaved] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    const handleSave = async () => {
        if (!formRef.current) return;
        const fd = new FormData(formRef.current);
        const values: Record<string, string> = {};
        fd.forEach((v, k) => { values[k] = String(v); });

        const ok = await saveSettings(values);
        if (ok) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="space-y-6 max-w-4xl">
            <PageHeader title="Settings" subtitle="Configure system-wide preferences">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg gradient-primary px-4 py-2 text-sm font-medium text-white shadow-lg shadow-primary/25 hover:opacity-90 transition-all disabled:opacity-50"
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
                </button>
            </PageHeader>

            {/* SNMP Defaults */}
            <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Server className="h-4 w-4 text-primary" />
                    SNMP Defaults
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Default Community</label>
                        <input name="snmp.defaultCommunity" type="text" defaultValue={sv(settings, 'snmp.defaultCommunity', 'public')} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 ring-ring" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">SNMP Version</label>
                        <select name="snmp.defaultVersion" defaultValue={sv(settings, 'snmp.defaultVersion', 'v2c')} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 ring-ring">
                            <option value="v1">v1</option>
                            <option value="v2c">v2c</option>
                            <option value="v3">v3</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Timeout (ms)</label>
                        <input name="snmp.timeout" type="number" defaultValue={sv(settings, 'snmp.timeout', '5000')} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 ring-ring" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Retries</label>
                        <input name="snmp.retries" type="number" defaultValue={sv(settings, 'snmp.retries', '2')} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 ring-ring" />
                    </div>
                </div>
            </section>

            {/* Polling */}
            <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Clock className="h-4 w-4 text-primary" />
                    Polling
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Default Interval (seconds)</label>
                        <input name="polling.defaultInterval" type="number" defaultValue={sv(settings, 'polling.defaultInterval', '300')} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 ring-ring" />
                        <p className="text-xs text-muted-foreground">How often devices are polled (default: 5 minutes)</p>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Concurrent Polls</label>
                        <input name="polling.concurrentPolls" type="number" defaultValue={sv(settings, 'polling.concurrentPolls', '10')} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 ring-ring" />
                        <p className="text-xs text-muted-foreground">Max simultaneous SNMP sessions</p>
                    </div>
                </div>
            </section>

            {/* Notifications */}
            <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Bell className="h-4 w-4 text-primary" />
                    Notification Channels
                </h2>

                {/* Telegram */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                        <MessageSquare className="h-4 w-4 text-blue-400" />
                        Telegram
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Bot Token</label>
                            <input name="notification.telegramBotToken" type="password" defaultValue={sv(settings, 'notification.telegramBotToken', '')} placeholder="Enter bot token" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 ring-ring" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Chat ID</label>
                            <input name="notification.telegramChatId" type="text" defaultValue={sv(settings, 'notification.telegramChatId', '')} placeholder="-1001234567890" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 ring-ring" />
                        </div>
                    </div>
                </div>

                {/* SMTP */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                        <Mail className="h-4 w-4 text-amber-400" />
                        Email (SMTP)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">SMTP Host</label>
                            <input name="notification.smtpHost" type="text" defaultValue={sv(settings, 'notification.smtpHost', '')} placeholder="smtp.gmail.com" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 ring-ring" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">SMTP Port</label>
                            <input name="notification.smtpPort" type="number" defaultValue={sv(settings, 'notification.smtpPort', '587')} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 ring-ring" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Username</label>
                            <input name="notification.smtpUsername" type="text" defaultValue={sv(settings, 'notification.smtpUsername', '')} placeholder="alerts@netmon.local" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 ring-ring" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Password</label>
                            <input name="notification.smtpPassword" type="password" defaultValue={sv(settings, 'notification.smtpPassword', '')} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 ring-ring" />
                        </div>
                    </div>
                </div>

                {/* Webhook */}
                <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                        <Globe className="h-4 w-4 text-emerald-400" />
                        Webhook
                    </h3>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Webhook URL</label>
                        <input name="notification.webhookUrl" type="url" defaultValue={sv(settings, 'notification.webhookUrl', '')} placeholder="https://hooks.example.com/netmon" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 ring-ring" />
                    </div>
                </div>
            </section>

            {/* Security */}
            <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
                    <Shield className="h-4 w-4 text-primary" />
                    Security
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">JWT Token Expiry</label>
                        <input name="security.jwtExpiry" type="text" defaultValue={sv(settings, 'security.jwtExpiry', '24h')} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 ring-ring" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Max Login Attempts</label>
                        <input name="security.maxLoginAttempts" type="number" defaultValue={sv(settings, 'security.maxLoginAttempts', '5')} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 ring-ring" />
                    </div>
                </div>
            </section>
        </form>
    );
}
