'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Save, Bell, Server, Clock, Shield, Mail, MessageSquare, Globe, Loader2,
    LayoutDashboard, Wifi, MapPin, AlertTriangle, Ticket, Database, Search,
    Network, BarChart3, HardDrive, Eye, Zap, RefreshCw, MonitorDot, Lock, Brain, CheckCircle2
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useSettings } from '@/hooks/use-admin';
import { getStoredUser } from '@/hooks/use-auth';

/* ─── Sidebar Navigation Items ─────────────────────────────── */

const NAV_ITEMS = [
    { id: 'snmp', label: 'SNMP Defaults', icon: Server },
    { id: 'polling', label: 'Polling', icon: Clock },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'alerts', label: 'Alerts & Thresholds', icon: AlertTriangle },
    { id: 'tickets', label: 'Ticketing', icon: Ticket },
    { id: 'discovery', label: 'Discovery', icon: Search },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'retention', label: 'Data Retention', icon: Database },
    { id: 'interfaces', label: 'Interfaces', icon: Network },
    { id: 'wireless', label: 'Wireless', icon: Wifi },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'ai', label: 'AI / Integrations', icon: Brain },
];

/* ─── Helper: get setting value with fallback ────────────── */

function sv(settings: Record<string, Record<string, string>>, key: string, fallback: string): string {
    const [cat] = key.split('.');
    return settings[cat]?.[key] ?? fallback;
}

/* ─── Input Component ─────────────────────────────────────── */

const INPUT_CLS = 'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';
const SELECT_CLS = INPUT_CLS;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">{label}</label>
            {children}
            {hint && <p className="text-xs text-gray-400">{hint}</p>}
        </div>
    );
}

/* ─── Section Wrapper ─────────────────────────────────────── */

function Section({ id, icon: Icon, title, description, children }: {
    id: string;
    icon: any;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <section id={id} className="scroll-mt-6">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50">
                            <Icon className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
                            <p className="text-xs text-gray-500">{description}</p>
                        </div>
                    </div>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </section>
    );
}

/* ─── Main Component ─────────────────────────────────────── */

export default function SettingsPage() {
    const router = useRouter();
    const currentUser = getStoredUser();
    const isAdmin = currentUser?.role === 'admin';
    const { settings, loading, saving, saveSettings } = useSettings();
    const [saved, setSaved] = useState(false);
    const [activeSection, setActiveSection] = useState('snmp');
    const formRef = useRef<HTMLFormElement>(null);
    const [aiTestResult, setAiTestResult] = useState<{ ok?: boolean; error?: string } | null>(null);
    const [aiTesting, setAiTesting] = useState(false);

    useEffect(() => {
        if (!isAdmin) router.replace('/dashboard');
    }, [isAdmin, router]);

    if (!isAdmin) return null;

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

    const switchSection = (id: string) => {
        setActiveSection(id);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader title="Settings" subtitle="Configure system-wide preferences">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
                </button>
            </PageHeader>

            <div className="flex gap-6">
                {/* ─── Sidebar Navigation ─── */}
                <nav className="hidden lg:block w-56 shrink-0">
                    <div className="sticky top-6 space-y-0.5">
                        {NAV_ITEMS.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeSection === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => switchSection(item.id)}
                                    className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </nav>

                {/* ─── Settings Content ─── */}
                <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="flex-1 min-w-0 space-y-5">

                    {/* SNMP Defaults */}
                    {activeSection === 'snmp' && <Section id="snmp" icon={Server} title="SNMP Defaults" description="Default SNMP parameters for device polling">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            <Field label="Default Community" hint="SNMP community string for v1/v2c">
                                <input name="snmp.defaultCommunity" type="text" defaultValue={sv(settings, 'snmp.defaultCommunity', 'public')} className={INPUT_CLS} />
                            </Field>
                            <Field label="SNMP Version">
                                <select name="snmp.defaultVersion" defaultValue={sv(settings, 'snmp.defaultVersion', 'v2c')} className={SELECT_CLS}>
                                    <option value="v1">v1</option>
                                    <option value="v2c">v2c</option>
                                    <option value="v3">v3</option>
                                </select>
                            </Field>
                            <Field label="Timeout (ms)" hint="Max wait time per request">
                                <input name="snmp.timeout" type="number" defaultValue={sv(settings, 'snmp.timeout', '5000')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Retries" hint="Number of retry attempts">
                                <input name="snmp.retries" type="number" defaultValue={sv(settings, 'snmp.retries', '2')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Port" hint="SNMP target port">
                                <input name="snmp.port" type="number" defaultValue={sv(settings, 'snmp.port', '161')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Max Bulk Repetitions" hint="Max repetitions for SNMP GETBULK">
                                <input name="snmp.maxBulkRepetitions" type="number" defaultValue={sv(settings, 'snmp.maxBulkRepetitions', '25')} className={INPUT_CLS} />
                            </Field>
                        </div>
                    </Section>}

                    {/* Polling */}
                    {activeSection === 'polling' && <Section id="polling" icon={Clock} title="Polling" description="Configure SNMP polling intervals and concurrency">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            <Field label="Default Interval (seconds)" hint="How often devices are polled (default: 5 min)">
                                <input name="polling.defaultInterval" type="number" defaultValue={sv(settings, 'polling.defaultInterval', '300')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Concurrent Polls" hint="Max simultaneous SNMP sessions">
                                <input name="polling.concurrentPolls" type="number" defaultValue={sv(settings, 'polling.concurrentPolls', '10')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Interface Polling Interval (seconds)" hint="Frequency for interface traffic stats">
                                <input name="polling.interfaceInterval" type="number" defaultValue={sv(settings, 'polling.interfaceInterval', '300')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Metric Collection Interval (seconds)" hint="CPU, memory, and response time polling">
                                <input name="polling.metricInterval" type="number" defaultValue={sv(settings, 'polling.metricInterval', '300')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Status Check Interval (seconds)" hint="Device up/down status check frequency">
                                <input name="polling.statusCheckInterval" type="number" defaultValue={sv(settings, 'polling.statusCheckInterval', '60')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Polling Timeout (seconds)" hint="Max time for a single poll cycle">
                                <input name="polling.pollingTimeout" type="number" defaultValue={sv(settings, 'polling.pollingTimeout', '30')} className={INPUT_CLS} />
                            </Field>
                        </div>
                    </Section>}

                    {/* Dashboard */}
                    {activeSection === 'dashboard' && <Section id="dashboard" icon={LayoutDashboard} title="Dashboard" description="Customize dashboard display and refresh behavior">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            <Field label="Auto-Refresh Interval (seconds)" hint="Dashboard data refresh rate (0 = disabled)">
                                <input name="dashboard.refreshInterval" type="number" defaultValue={sv(settings, 'dashboard.refreshInterval', '30')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Default Time Range" hint="Default graph time window">
                                <select name="dashboard.defaultTimeRange" defaultValue={sv(settings, 'dashboard.defaultTimeRange', '24h')} className={SELECT_CLS}>
                                    <option value="1h">1 Hour</option>
                                    <option value="6h">6 Hours</option>
                                    <option value="24h">24 Hours</option>
                                    <option value="7d">7 Days</option>
                                    <option value="30d">30 Days</option>
                                </select>
                            </Field>
                            <Field label="Max Devices in Summary" hint="Top N devices shown in overview cards">
                                <input name="dashboard.maxDevicesSummary" type="number" defaultValue={sv(settings, 'dashboard.maxDevicesSummary', '10')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Show Alerts Widget">
                                <select name="dashboard.showAlertsWidget" defaultValue={sv(settings, 'dashboard.showAlertsWidget', 'true')} className={SELECT_CLS}>
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </Field>
                            <Field label="Show Traffic Widget">
                                <select name="dashboard.showTrafficWidget" defaultValue={sv(settings, 'dashboard.showTrafficWidget', 'true')} className={SELECT_CLS}>
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </Field>
                            <Field label="Chart Render Mode">
                                <select name="dashboard.chartMode" defaultValue={sv(settings, 'dashboard.chartMode', 'area')} className={SELECT_CLS}>
                                    <option value="line">Line</option>
                                    <option value="area">Area</option>
                                    <option value="bar">Bar</option>
                                </select>
                            </Field>
                        </div>
                    </Section>}

                    {/* Alerts & Thresholds */}
                    {activeSection === 'alerts' && <Section id="alerts" icon={AlertTriangle} title="Alerts & Thresholds" description="Default alert thresholds and escalation behavior">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            <Field label="CPU Warning Threshold (%)" hint="Trigger warning when CPU exceeds this">
                                <input name="alert.cpuWarning" type="number" defaultValue={sv(settings, 'alert.cpuWarning', '80')} className={INPUT_CLS} />
                            </Field>
                            <Field label="CPU Critical Threshold (%)" hint="Trigger critical alert at this level">
                                <input name="alert.cpuCritical" type="number" defaultValue={sv(settings, 'alert.cpuCritical', '95')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Memory Warning Threshold (%)" hint="Memory usage warning level">
                                <input name="alert.memoryWarning" type="number" defaultValue={sv(settings, 'alert.memoryWarning', '85')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Memory Critical Threshold (%)" hint="Memory usage critical level">
                                <input name="alert.memoryCritical" type="number" defaultValue={sv(settings, 'alert.memoryCritical', '95')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Response Time Warning (ms)" hint="Latency warning threshold">
                                <input name="alert.responseWarning" type="number" defaultValue={sv(settings, 'alert.responseWarning', '200')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Response Time Critical (ms)" hint="Latency critical threshold">
                                <input name="alert.responseCritical" type="number" defaultValue={sv(settings, 'alert.responseCritical', '1000')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Down Alert Delay (seconds)" hint="Wait time before flagging device as down">
                                <input name="alert.downDelay" type="number" defaultValue={sv(settings, 'alert.downDelay', '120')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Auto-Resolve After (minutes)" hint="Auto-close resolved alerts after this period">
                                <input name="alert.autoResolveMinutes" type="number" defaultValue={sv(settings, 'alert.autoResolveMinutes', '30')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Max Active Alerts" hint="Limit max simultaneous alerts (0 = unlimited)">
                                <input name="alert.maxActiveAlerts" type="number" defaultValue={sv(settings, 'alert.maxActiveAlerts', '0')} className={INPUT_CLS} />
                            </Field>
                        </div>
                    </Section>}

                    {/* Ticketing */}
                    {activeSection === 'tickets' && <Section id="tickets" icon={Ticket} title="Ticketing" description="Configure ticketing system preferences and SLA settings">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            <Field label="Auto-Create from Alerts">
                                <select name="ticket.autoCreateFromAlerts" defaultValue={sv(settings, 'ticket.autoCreateFromAlerts', 'false')} className={SELECT_CLS}>
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </Field>
                            <Field label="Default Priority">
                                <select name="ticket.defaultPriority" defaultValue={sv(settings, 'ticket.defaultPriority', 'medium')} className={SELECT_CLS}>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="critical">Critical</option>
                                </select>
                            </Field>
                            <Field label="Auto-Assign">
                                <select name="ticket.autoAssign" defaultValue={sv(settings, 'ticket.autoAssign', 'false')} className={SELECT_CLS}>
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </Field>
                            <Field label="SLA Warning (hours)" hint="Time before SLA breach warning">
                                <input name="ticket.slaWarningHours" type="number" defaultValue={sv(settings, 'ticket.slaWarningHours', '4')} className={INPUT_CLS} />
                            </Field>
                            <Field label="SLA Breach (hours)" hint="Max time before ticket is SLA-breached">
                                <input name="ticket.slaBreachHours" type="number" defaultValue={sv(settings, 'ticket.slaBreachHours', '24')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Auto-Close Resolved (days)" hint="Auto-close resolved tickets after N days">
                                <input name="ticket.autoCloseDays" type="number" defaultValue={sv(settings, 'ticket.autoCloseDays', '7')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Ticket Number Prefix" hint="Prefix for ticket IDs (e.g. TKT-)">
                                <input name="ticket.prefix" type="text" defaultValue={sv(settings, 'ticket.prefix', 'TKT-')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Require Category">
                                <select name="ticket.requireCategory" defaultValue={sv(settings, 'ticket.requireCategory', 'true')} className={SELECT_CLS}>
                                    <option value="true">Required</option>
                                    <option value="false">Optional</option>
                                </select>
                            </Field>
                            <Field label="Allow Reopen Closed">
                                <select name="ticket.allowReopen" defaultValue={sv(settings, 'ticket.allowReopen', 'true')} className={SELECT_CLS}>
                                    <option value="true">Allowed</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </Field>
                        </div>
                    </Section>}

                    {/* Discovery */}
                    {activeSection === 'discovery' && <Section id="discovery" icon={Search} title="Discovery" description="Network device auto-discovery settings">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            <Field label="Auto-Discovery">
                                <select name="discovery.enabled" defaultValue={sv(settings, 'discovery.enabled', 'true')} className={SELECT_CLS}>
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </Field>
                            <Field label="Discovery Interval (hours)" hint="How often the network is scanned">
                                <input name="discovery.interval" type="number" defaultValue={sv(settings, 'discovery.interval', '24')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Subnet Ranges" hint="Comma-separated CIDRs to scan">
                                <input name="discovery.subnets" type="text" defaultValue={sv(settings, 'discovery.subnets', '192.168.0.0/24')} placeholder="192.168.1.0/24, 10.0.0.0/16" className={INPUT_CLS} />
                            </Field>
                            <Field label="Ping Timeout (ms)" hint="ICMP timeout for host detection">
                                <input name="discovery.pingTimeout" type="number" defaultValue={sv(settings, 'discovery.pingTimeout', '2000')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Auto-Add Discovered Devices">
                                <select name="discovery.autoAdd" defaultValue={sv(settings, 'discovery.autoAdd', 'false')} className={SELECT_CLS}>
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled — Review First</option>
                                </select>
                            </Field>
                            <Field label="Excluded IP Ranges" hint="Comma-separated IPs/CIDRs to skip">
                                <input name="discovery.excludedRanges" type="text" defaultValue={sv(settings, 'discovery.excludedRanges', '')} placeholder="192.168.1.1, 10.0.0.0/30" className={INPUT_CLS} />
                            </Field>
                        </div>
                    </Section>}

                    {/* Notification Channels */}
                    {activeSection === 'notifications' && <Section id="notifications" icon={Bell} title="Notification Channels" description="Configure how alerts and events are delivered">
                        {/* Telegram */}
                        <div className="mb-6 pb-6 border-b border-gray-100">
                            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                                <MessageSquare className="h-4 w-4 text-blue-400" />
                                Telegram
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                <Field label="Bot Token" hint="Telegram Bot API token">
                                    <input name="notification.telegramBotToken" type="password" defaultValue={sv(settings, 'notification.telegramBotToken', '')} placeholder="Enter bot token" className={INPUT_CLS} />
                                </Field>
                                <Field label="Chat ID" hint="Group or channel chat ID">
                                    <input name="notification.telegramChatId" type="text" defaultValue={sv(settings, 'notification.telegramChatId', '')} placeholder="-1001234567890" className={INPUT_CLS} />
                                </Field>
                                <Field label="Enabled">
                                    <select name="notification.telegramEnabled" defaultValue={sv(settings, 'notification.telegramEnabled', 'false')} className={SELECT_CLS}>
                                        <option value="true">Enabled</option>
                                        <option value="false">Disabled</option>
                                    </select>
                                </Field>
                            </div>
                        </div>

                        {/* SMTP */}
                        <div className="mb-6 pb-6 border-b border-gray-100">
                            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                                <Mail className="h-4 w-4 text-amber-400" />
                                Email (SMTP)
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                <Field label="SMTP Host" hint="Email server hostname">
                                    <input name="notification.smtpHost" type="text" defaultValue={sv(settings, 'notification.smtpHost', '')} placeholder="smtp.gmail.com" className={INPUT_CLS} />
                                </Field>
                                <Field label="SMTP Port">
                                    <input name="notification.smtpPort" type="number" defaultValue={sv(settings, 'notification.smtpPort', '587')} className={INPUT_CLS} />
                                </Field>
                                <Field label="Encryption">
                                    <select name="notification.smtpEncryption" defaultValue={sv(settings, 'notification.smtpEncryption', 'tls')} className={SELECT_CLS}>
                                        <option value="none">None</option>
                                        <option value="tls">TLS</option>
                                        <option value="ssl">SSL</option>
                                    </select>
                                </Field>
                                <Field label="Username">
                                    <input name="notification.smtpUsername" type="text" defaultValue={sv(settings, 'notification.smtpUsername', '')} placeholder="alerts@netmon.local" className={INPUT_CLS} />
                                </Field>
                                <Field label="Password">
                                    <input name="notification.smtpPassword" type="password" defaultValue={sv(settings, 'notification.smtpPassword', '')} className={INPUT_CLS} />
                                </Field>
                                <Field label="From Address" hint="Sender email address">
                                    <input name="notification.smtpFrom" type="email" defaultValue={sv(settings, 'notification.smtpFrom', '')} placeholder="noreply@netmon.local" className={INPUT_CLS} />
                                </Field>
                            </div>
                        </div>

                        {/* Webhook */}
                        <div>
                            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                                <Globe className="h-4 w-4 text-emerald-400" />
                                Webhook
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                <div className="sm:col-span-2 lg:col-span-2 space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Webhook URL</label>
                                    <input name="notification.webhookUrl" type="url" defaultValue={sv(settings, 'notification.webhookUrl', '')} placeholder="https://hooks.example.com/netmon" className={INPUT_CLS} />
                                </div>
                                <Field label="Webhook Enabled">
                                    <select name="notification.webhookEnabled" defaultValue={sv(settings, 'notification.webhookEnabled', 'false')} className={SELECT_CLS}>
                                        <option value="true">Enabled</option>
                                        <option value="false">Disabled</option>
                                    </select>
                                </Field>
                            </div>
                        </div>
                    </Section>}

                    {/* Data Retention */}
                    {activeSection === 'retention' && <Section id="retention" icon={Database} title="Data Retention" description="Configure how long monitoring data is kept before automatic cleanup">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            <Field label="Metrics Retention (days)" hint="Device CPU, memory, response time data">
                                <input name="retention.metricsDays" type="number" defaultValue={sv(settings, 'retention.metricsDays', '90')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Interface Traffic Retention (days)" hint="Per-interface bandwidth data">
                                <input name="retention.interfaceDays" type="number" defaultValue={sv(settings, 'retention.interfaceDays', '90')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Alert History Retention (days)" hint="Resolved alert records">
                                <input name="retention.alertDays" type="number" defaultValue={sv(settings, 'retention.alertDays', '180')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Ticket History Retention (days)" hint="Closed ticket records">
                                <input name="retention.ticketDays" type="number" defaultValue={sv(settings, 'retention.ticketDays', '365')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Audit Log Retention (days)" hint="User login and action logs">
                                <input name="retention.auditDays" type="number" defaultValue={sv(settings, 'retention.auditDays', '365')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Auto-Cleanup">
                                <select name="retention.autoCleanup" defaultValue={sv(settings, 'retention.autoCleanup', 'true')} className={SELECT_CLS}>
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </Field>
                        </div>
                    </Section>}

                    {/* Interfaces */}
                    {activeSection === 'interfaces' && <Section id="interfaces" icon={Network} title="Interfaces" description="Default settings for network interface monitoring">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            <Field label="Auto-Enable Monitoring">
                                <select name="interface.autoMonitor" defaultValue={sv(settings, 'interface.autoMonitor', 'false')} className={SELECT_CLS}>
                                    <option value="true">All Interfaces</option>
                                    <option value="up_only">Up Interfaces Only</option>
                                    <option value="false">Manual Selection</option>
                                </select>
                            </Field>
                            <Field label="Ignore Loopbacks">
                                <select name="interface.ignoreLoopback" defaultValue={sv(settings, 'interface.ignoreLoopback', 'true')} className={SELECT_CLS}>
                                    <option value="true">Yes — Skip Loopback Interfaces</option>
                                    <option value="false">No — Include All</option>
                                </select>
                            </Field>
                            <Field label="Bandwidth Utilization Warning (%)" hint="Alert when traffic exceeds threshold">
                                <input name="interface.bwWarning" type="number" defaultValue={sv(settings, 'interface.bwWarning', '80')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Track Error Counters">
                                <select name="interface.trackErrors" defaultValue={sv(settings, 'interface.trackErrors', 'true')} className={SELECT_CLS}>
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </Field>
                            <Field label="Show Admin-Down Interfaces">
                                <select name="interface.showAdminDown" defaultValue={sv(settings, 'interface.showAdminDown', 'true')} className={SELECT_CLS}>
                                    <option value="true">Show</option>
                                    <option value="false">Hide</option>
                                </select>
                            </Field>
                            <Field label="Traffic Display Unit">
                                <select name="interface.trafficUnit" defaultValue={sv(settings, 'interface.trafficUnit', 'bps')} className={SELECT_CLS}>
                                    <option value="bps">Bits per second (bps)</option>
                                    <option value="Bps">Bytes per second (Bps)</option>
                                </select>
                            </Field>
                        </div>
                    </Section>}

                    {/* Wireless */}
                    {activeSection === 'wireless' && <Section id="wireless" icon={Wifi} title="Wireless" description="Wireless network and access point monitoring settings">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            <Field label="Wireless Monitoring">
                                <select name="wireless.enabled" defaultValue={sv(settings, 'wireless.enabled', 'true')} className={SELECT_CLS}>
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </Field>
                            <Field label="Client Tracking">
                                <select name="wireless.clientTracking" defaultValue={sv(settings, 'wireless.clientTracking', 'true')} className={SELECT_CLS}>
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </Field>
                            <Field label="Signal Strength Warning (dBm)" hint="Alert below this RSSI value">
                                <input name="wireless.signalWarning" type="number" defaultValue={sv(settings, 'wireless.signalWarning', '-70')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Channel Utilization Warning (%)" hint="Alert when AP channel is congested">
                                <input name="wireless.channelWarning" type="number" defaultValue={sv(settings, 'wireless.channelWarning', '80')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Rogue AP Detection">
                                <select name="wireless.rogueDetection" defaultValue={sv(settings, 'wireless.rogueDetection', 'false')} className={SELECT_CLS}>
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </Field>
                            <Field label="AP Polling Interval (seconds)" hint="Dedicated AP status poll frequency">
                                <input name="wireless.apPollInterval" type="number" defaultValue={sv(settings, 'wireless.apPollInterval', '300')} className={INPUT_CLS} />
                            </Field>
                        </div>
                    </Section>}

                    {/* Security */}
                    {activeSection === 'security' && <Section id="security" icon={Shield} title="Security" description="Authentication, session, and access control settings">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            <Field label="JWT Token Expiry" hint="Session token lifetime (e.g. 24h, 7d)">
                                <input name="security.jwtExpiry" type="text" defaultValue={sv(settings, 'security.jwtExpiry', '24h')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Max Login Attempts" hint="Before temporary lockout">
                                <input name="security.maxLoginAttempts" type="number" defaultValue={sv(settings, 'security.maxLoginAttempts', '5')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Lockout Duration (minutes)" hint="Account lockout after failed attempts">
                                <input name="security.lockoutDuration" type="number" defaultValue={sv(settings, 'security.lockoutDuration', '15')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Session Timeout (minutes)" hint="Idle session auto-logout">
                                <input name="security.sessionTimeout" type="number" defaultValue={sv(settings, 'security.sessionTimeout', '60')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Enforce Strong Passwords">
                                <select name="security.strongPasswords" defaultValue={sv(settings, 'security.strongPasswords', 'true')} className={SELECT_CLS}>
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </Field>
                            <Field label="Two-Factor Authentication">
                                <select name="security.twoFactor" defaultValue={sv(settings, 'security.twoFactor', 'false')} className={SELECT_CLS}>
                                    <option value="optional">Optional</option>
                                    <option value="required">Required</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </Field>
                            <Field label="API Rate Limit (req/min)" hint="Max API requests per user per minute">
                                <input name="security.apiRateLimit" type="number" defaultValue={sv(settings, 'security.apiRateLimit', '120')} className={INPUT_CLS} />
                            </Field>
                            <Field label="Audit Logging">
                                <select name="security.auditLog" defaultValue={sv(settings, 'security.auditLog', 'true')} className={SELECT_CLS}>
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </Field>
                            <Field label="Password Expiry (days)" hint="Force password change after N days (0 = never)">
                                <input name="security.passwordExpiry" type="number" defaultValue={sv(settings, 'security.passwordExpiry', '0')} className={INPUT_CLS} />
                            </Field>
                        </div>
                    </Section>}

                    {/* AI / Integrations */}
                    {activeSection === 'ai' && <Section id="ai" icon={Brain} title="AI / Integrations" description="Configure AI-powered analytics and external integrations">
                        <div className="space-y-6">
                            <div className="pb-6 border-b border-gray-100">
                                <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                                    <Brain className="h-4 w-4 text-purple-500" />
                                    AI-Analytics
                                    <span className="text-xs font-normal text-gray-400">— Powers AI Analytics & Reports</span>
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                    <div className="sm:col-span-2 space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700">Groq API Key</label>
                                        <input name="ai.groqApiKey" type="password" defaultValue={sv(settings, 'ai.groqApiKey', '')} placeholder="gsk_..." className={INPUT_CLS} />
                                        <p className="text-xs text-gray-400">Get your API key from <a href="https://console.groq.com" target="_blank" rel="noopener" className="text-blue-500 underline">console.groq.com</a></p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700">AI Model</label>
                                        <select name="ai.model" defaultValue={sv(settings, 'ai.model', 'llama-3.3-70b-versatile')} className={SELECT_CLS}>
                                            <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
                                            <option value="llama-3.1-8b-instant">Llama 3.1 8B (Fast)</option>
                                            <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <button type="button" onClick={async () => {
                                        setAiTesting(true);
                                        setAiTestResult(null);
                                        try {
                                            const { default: apiClient } = await import('@/lib/api-client').then(m => ({ default: m.api }));
                                            const fd = formRef.current ? new FormData(formRef.current) : null;
                                            const key = fd?.get('ai.groqApiKey') as string || '';
                                            const { data } = await apiClient.post('/ai/test', { apiKey: key || undefined });
                                            setAiTestResult(data);
                                        } catch {
                                            setAiTestResult({ ok: false, error: 'Connection failed' });
                                        } finally {
                                            setAiTesting(false);
                                        }
                                    }} className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors">
                                        {aiTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                                        Test Connection
                                    </button>
                                    {aiTestResult && (
                                        <div className={`mt-2 flex items-center gap-2 text-sm ${aiTestResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {aiTestResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                                            {aiTestResult.ok ? 'Connected successfully!' : aiTestResult.error}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Section>}

                </form>
            </div>
        </div>
    );
}
