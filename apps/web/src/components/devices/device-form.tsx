'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Save, Loader2, CheckCircle, XCircle, Zap,
    Settings, Wifi, Clock, SlidersHorizontal, Trash2, ChevronRight, Eye, EyeOff,
    Shield, Server,
} from 'lucide-react';
import { api } from '@/lib/api-client';

/* ─── Constants ──────────────────────────────────────────── */

export const DEVICE_TYPES = [
    { value: 'router', label: 'Router' },
    { value: 'switch', label: 'Switch' },
    { value: 'access_point', label: 'Access Point' },
    { value: 'firewall', label: 'Firewall' },
    { value: 'server', label: 'Server' },
    { value: 'unknown', label: 'Unknown' },
];

export const SNMP_VERSIONS = [
    { value: 'v1', label: 'SNMPv1' },
    { value: 'v2c', label: 'SNMPv2c' },
    { value: 'v3', label: 'SNMPv3' },
];

/* ─── Types ──────────────────────────────────────────────── */

export interface DeviceFormData {
    hostname: string;
    ipAddress: string;
    displayName: string;
    deviceType: string;
    snmpVersion: string;
    snmpCommunity: string;
    snmpPort: string;
    pollingInterval: string;
    pollingEnabled: boolean;
    snmpV3User: string;
    snmpV3AuthProto: string;
    snmpV3AuthPass: string;
    snmpV3PrivProto: string;
    snmpV3PrivPass: string;
}

export const DEFAULT_FORM_DATA: DeviceFormData = {
    hostname: '',
    ipAddress: '',
    displayName: '',
    deviceType: 'router',
    snmpVersion: 'v2c',
    snmpCommunity: 'public',
    snmpPort: '161',
    pollingInterval: '300',
    pollingEnabled: true,
    snmpV3User: '',
    snmpV3AuthProto: 'SHA',
    snmpV3AuthPass: '',
    snmpV3PrivProto: 'AES',
    snmpV3PrivPass: '',
};

interface DeviceFormProps {
    mode: 'create' | 'edit';
    formData: DeviceFormData;
    setFormData: React.Dispatch<React.SetStateAction<DeviceFormData>>;
    onSubmit: (e: React.FormEvent) => void;
    saving: boolean;
    error: string | null;
    /** Breadcrumb pieces: for edit, includes device name */
    breadcrumbs: { label: string; href?: string }[];
    title: string;
    subtitle: string;
    cancelHref: string;
    submitLabel: string;
    submittingLabel: string;
    /** For edit mode: last updated timestamp */
    lastUpdated?: string;
    /** For edit mode: delete handler */
    onDelete?: () => void;
}

/* ─── Sidebar Sections ───────────────────────────────────── */

const SECTIONS = [
    { id: 'general', label: 'General Settings', icon: Settings },
    { id: 'snmp', label: 'SNMP Configuration', icon: Wifi },
    { id: 'polling', label: 'Polling Settings', icon: Clock },
];

/* ─── Component ──────────────────────────────────────────── */

export function DeviceForm({
    mode,
    formData,
    setFormData,
    onSubmit,
    saving,
    error,
    breadcrumbs,
    title,
    subtitle,
    cancelHref,
    submitLabel,
    submittingLabel,
    lastUpdated,
    onDelete,
}: DeviceFormProps) {
    const [activeSection, setActiveSection] = useState('general');
    const [showPassword, setShowPassword] = useState(false);

    // SNMP test
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);

    // Inline validation errors
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    // Refs for scroll-to-section
    const sectionRefs: Record<string, React.RefObject<HTMLDivElement | null>> = {
        general: useRef<HTMLDivElement>(null),
        snmp: useRef<HTMLDivElement>(null),
        polling: useRef<HTMLDivElement>(null),
    };

    const update = (field: keyof DeviceFormData, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        // Clear the error for this field on change
        if (fieldErrors[field]) {
            setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
        }
    };

    /** Returns true if valid, false if there are errors. Populates fieldErrors. */
    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        const hostname = formData.hostname.trim();
        if (!hostname) {
            errs.hostname = 'Hostname is required.';
        } else if (/\s/.test(hostname)) {
            errs.hostname = 'Hostname must not contain spaces.';
        }

        const ip = formData.ipAddress.trim();
        if (!ip) {
            errs.ipAddress = 'IP Address is required.';
        } else {
            // Accept IPv4, IPv6, or FQDN hostname
            const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
            const ipv6 = /^[0-9a-fA-F:]+$/.test(ip) && ip.includes(':');
            const fqdn = /^[a-zA-Z0-9]([a-zA-Z0-9\-\.]*[a-zA-Z0-9])?$/.test(ip);
            if (!ipv4 && !ipv6 && !fqdn) {
                errs.ipAddress = 'Enter a valid IPv4, IPv6, or hostname.';
            }
        }

        const port = parseInt(formData.snmpPort);
        if (isNaN(port) || port < 1 || port > 65535) {
            errs.snmpPort = 'Port must be between 1 and 65535.';
        }

        const interval = parseInt(formData.pollingInterval);
        if (isNaN(interval) || interval < 10) {
            errs.pollingInterval = 'Polling interval must be at least 10 seconds.';
        }

        if (formData.snmpVersion === 'v3' && !formData.snmpV3User.trim()) {
            errs.snmpV3User = 'Security user is required for SNMPv3.';
        }

        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleValidatedSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) {
            // Scroll to the first errored section
            const errorFields = Object.keys(fieldErrors.length ? fieldErrors : {});
            if (errorFields.some(f => ['hostname', 'ipAddress', 'displayName', 'deviceType'].includes(f))) {
                scrollToSection('general');
            } else if (errorFields.some(f => ['snmpPort', 'snmpV3User'].includes(f))) {
                scrollToSection('snmp');
            } else {
                scrollToSection('polling');
            }
            return;
        }
        onSubmit(e);
    };

    const scrollToSection = (id: string) => {
        setActiveSection(id);
        sectionRefs[id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Track active section on scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id);
                    }
                });
            },
            { rootMargin: '-100px 0px -60% 0px', threshold: 0.1 }
        );

        Object.values(sectionRefs).forEach((ref) => {
            if (ref.current) observer.observe(ref.current);
        });

        return () => observer.disconnect();
    }, []);

    const handleTestSnmp = async () => {
        if (!formData.ipAddress.trim()) return;
        setTestResult(null);
        setTesting(true);
        try {
            const payload: Record<string, any> = {
                ipAddress: formData.ipAddress.trim(),
                snmpPort: parseInt(formData.snmpPort) || 161,
                snmpVersion: formData.snmpVersion,
            };
            if (formData.snmpVersion === 'v3') {
                if (formData.snmpV3User) payload.snmpV3User = formData.snmpV3User;
                if (formData.snmpV3AuthProto) payload.snmpV3AuthProto = formData.snmpV3AuthProto;
                if (formData.snmpV3AuthPass) payload.snmpV3AuthPass = formData.snmpV3AuthPass;
                if (formData.snmpV3PrivProto) payload.snmpV3PrivProto = formData.snmpV3PrivProto;
                if (formData.snmpV3PrivPass) payload.snmpV3PrivPass = formData.snmpV3PrivPass;
            } else {
                payload.snmpCommunity = formData.snmpCommunity.trim() || 'public';
            }
            const { data } = await api.post('/devices/test-snmp', payload);
            setTestResult(data);
        } catch (err: any) {
            setTestResult({ success: false, error: err.response?.data?.message || 'Test request failed.' });
        } finally {
            setTesting(false);
        }
    };

    const inputBase = 'w-full h-10 rounded-lg bg-white px-3 text-sm outline-none transition-all placeholder:text-gray-400 border focus:ring-1';
    const inputClass = `${inputBase} border-gray-200 focus:border-blue-400 focus:ring-blue-400`;
    const getInputClass = (field: string) =>
        `${inputBase} ${fieldErrors[field] ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-gray-200 focus:border-blue-400 focus:ring-blue-400'}`;
    const selectBase = 'w-full h-10 rounded-lg bg-white px-3 text-sm outline-none transition-all appearance-none cursor-pointer border focus:ring-1';
    const selectClass = `${selectBase} border-gray-200 focus:border-blue-400 focus:ring-blue-400`;
    const getSelectClass = (field: string) =>
        `${selectBase} ${fieldErrors[field] ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-gray-200 focus:border-blue-400 focus:ring-blue-400'}`;

    return (
        <div className="space-y-6">
            {/* Breadcrumbs + Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <nav className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <Link href={cancelHref} className="p-1 -ml-1 hover:bg-gray-200 rounded-md transition-colors mr-1">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        {breadcrumbs.map((b, i) => (
                            <span key={i} className="flex items-center gap-2">
                                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                                {b.href ? (
                                    <Link href={b.href} className="hover:text-blue-500 transition-colors">{b.label}</Link>
                                ) : (
                                    <span className="text-gray-900 font-medium">{b.label}</span>
                                )}
                            </span>
                        ))}
                    </nav>
                    <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
                    <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href={cancelHref}
                        className="px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </Link>
                    <button
                        onClick={handleValidatedSubmit as any}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-60"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {submittingLabel}
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                {submitLabel}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Sidebar + Content */}
            <form onSubmit={handleValidatedSubmit} className="flex flex-col lg:flex-row gap-6 items-start">
                {/* Left Sidebar */}
                <aside className="w-full lg:w-56 flex-shrink-0 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden lg:sticky lg:top-24">
                    <nav className="flex flex-col py-2">
                        {SECTIONS.map((s) => {
                            const Icon = s.icon;
                            const isActive = activeSection === s.id;
                            return (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => scrollToSection(s.id)}
                                    className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left ${isActive
                                        ? 'bg-blue-50 text-blue-600 border-r-[3px] border-blue-500'
                                        : 'text-gray-600 hover:bg-gray-50 border-r-[3px] border-transparent'
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {s.label}
                                </button>
                            );
                        })}
                        {onDelete && (
                            <>
                                <div className="my-2 border-t border-gray-100" />
                                <button
                                    type="button"
                                    onClick={onDelete}
                                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Delete Device
                                </button>
                            </>
                        )}
                    </nav>
                </aside>

                {/* Right Content */}
                <div className="flex-grow space-y-6 w-full">
                    {/* ── SECTION: Device Information ── */}
                    <div id="general" ref={sectionRefs.general} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden scroll-mt-24">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                            <Server className="h-4 w-4 text-blue-500" />
                            <h3 className="font-bold text-gray-900">Device Information</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700">Hostname <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={formData.hostname}
                                    onChange={(e) => update('hostname', e.target.value)}
                                    placeholder="e.g. router-hq-01"
                                    className={getInputClass('hostname')}
                                />
                                {fieldErrors.hostname && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><span>⚠</span>{fieldErrors.hostname}</p>}
                            </div>
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700">IP Address <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={formData.ipAddress}
                                    onChange={(e) => update('ipAddress', e.target.value)}
                                    placeholder="e.g. 10.0.1.1"
                                    className={getInputClass('ipAddress')}
                                />
                                {fieldErrors.ipAddress && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><span>⚠</span>{fieldErrors.ipAddress}</p>}
                            </div>
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700">Display Name</label>
                                <input
                                    type="text"
                                    value={formData.displayName}
                                    onChange={(e) => update('displayName', e.target.value)}
                                    placeholder="e.g. HQ Core Router"
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700">Device Type</label>
                                <select
                                    value={formData.deviceType}
                                    onChange={(e) => update('deviceType', e.target.value)}
                                    className={selectClass}
                                >
                                    {DEVICE_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* ── SECTION: SNMP Configuration ── */}
                    <div id="snmp" ref={sectionRefs.snmp} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden scroll-mt-24">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                            <Wifi className="h-4 w-4 text-blue-500" />
                            <h3 className="font-bold text-gray-900">SNMP Configuration</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700">SNMP Version</label>
                                <select
                                    value={formData.snmpVersion}
                                    onChange={(e) => update('snmpVersion', e.target.value)}
                                    className={selectClass}
                                >
                                    {SNMP_VERSIONS.map((v) => (
                                        <option key={v.value} value={v.value}>{v.label}</option>
                                    ))}
                                </select>
                            </div>
                            {formData.snmpVersion !== 'v3' && (
                                <div className="space-y-1 md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Community String</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={formData.snmpCommunity}
                                            onChange={(e) => update('snmpCommunity', e.target.value)}
                                            placeholder={mode === 'edit' ? 'Leave blank to keep existing' : 'public'}
                                            className={`${inputClass} pr-10`}
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
                            )}
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700">SNMP Port</label>
                                <input
                                    type="number"
                                    value={formData.snmpPort}
                                    onChange={(e) => update('snmpPort', e.target.value)}
                                    placeholder="161"
                                    className={getInputClass('snmpPort')}
                                />
                                {fieldErrors.snmpPort && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><span>⚠</span>{fieldErrors.snmpPort}</p>}
                            </div>
                        </div>

                        {/* SNMPv3 fields */}
                        {formData.snmpVersion === 'v3' && (
                            <div className="px-6 pb-6">
                                <div className="pt-4 border-t border-gray-100">
                                    <h4 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                                        <Shield className="h-3.5 w-3.5" />
                                        SNMPv3 Security
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="block text-sm font-medium text-gray-700">Security User <span className="text-red-500">*</span></label>
                                            <input type="text" value={formData.snmpV3User} onChange={(e) => update('snmpV3User', e.target.value)} placeholder="snmp-user" className={getInputClass('snmpV3User')} />
                                            {fieldErrors.snmpV3User && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><span>⚠</span>{fieldErrors.snmpV3User}</p>}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-sm font-medium text-gray-700">Auth Protocol</label>
                                            <select value={formData.snmpV3AuthProto} onChange={(e) => update('snmpV3AuthProto', e.target.value)} className={selectClass}>
                                                <option value="MD5">MD5</option>
                                                <option value="SHA">SHA</option>
                                                <option value="SHA256">SHA-256</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-sm font-medium text-gray-700">Auth Password</label>
                                            <input type="password" value={formData.snmpV3AuthPass} onChange={(e) => update('snmpV3AuthPass', e.target.value)} placeholder={mode === 'edit' ? 'Leave blank to keep existing' : '••••••••'} className={inputClass} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-sm font-medium text-gray-700">Privacy Protocol</label>
                                            <select value={formData.snmpV3PrivProto} onChange={(e) => update('snmpV3PrivProto', e.target.value)} className={selectClass}>
                                                <option value="DES">DES</option>
                                                <option value="AES">AES</option>
                                                <option value="AES256">AES-256</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-sm font-medium text-gray-700">Privacy Password</label>
                                            <input type="password" value={formData.snmpV3PrivPass} onChange={(e) => update('snmpV3PrivPass', e.target.value)} placeholder={mode === 'edit' ? 'Leave blank to keep existing' : '••••••••'} className={inputClass} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SNMP Test Connection Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {testResult ? (
                                    <>
                                        <span className={`w-2 h-2 rounded-full ${testResult.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                        <span className={`text-xs font-semibold uppercase ${testResult.success ? 'text-gray-600' : 'text-red-600'}`}>
                                            {testResult.success ? 'SNMP Connection Verified' : 'Connection Failed'}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-gray-300" />
                                        <span className="text-xs font-semibold text-gray-400 uppercase">Not Tested</span>
                                    </>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleTestSnmp}
                                disabled={testing || !formData.ipAddress.trim()}
                                className="text-blue-500 hover:text-blue-600 text-sm font-semibold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {testing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Testing...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="h-4 w-4" />
                                        Test Connection
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Test Result Details */}
                        {testResult && (
                            <div className={`px-6 py-4 border-t ${testResult.success ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                {testResult.error && (
                                    <p className="text-sm text-red-700 mb-2">{testResult.error}</p>
                                )}
                                {testResult.system && (
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                        <div><span className="text-gray-500">System Name:</span> <span className="font-medium text-gray-800">{testResult.system.sysName || '—'}</span></div>
                                        <div><span className="text-gray-500">Location:</span> <span className="font-medium text-gray-800">{testResult.system.sysLocation || '—'}</span></div>
                                        <div className="col-span-2"><span className="text-gray-500">Description:</span> <span className="font-medium text-gray-800">{testResult.system.sysDescr || '—'}</span></div>
                                        <div><span className="text-gray-500">Interfaces:</span> <span className="font-medium text-gray-800">{testResult.interfaceCount ?? '—'} discovered</span></div>
                                        {testResult.responseTime && (
                                            <div><span className="text-gray-500">Response:</span> <span className="font-medium text-gray-800">{testResult.responseTime}ms</span></div>
                                        )}
                                    </div>
                                )}
                                {testResult.interfaces && testResult.interfaces.length > 0 && (
                                    <details className="mt-3">
                                        <summary className="text-xs font-medium text-gray-600 cursor-pointer hover:text-gray-800">Show {testResult.interfaces.length} interfaces</summary>
                                        <div className="mt-2 max-h-48 overflow-auto rounded border border-gray-200 bg-white">
                                            <table className="w-full text-xs">
                                                <thead><tr className="border-b bg-gray-50">
                                                    <th className="px-2 py-1 text-left text-gray-500">Name</th>
                                                    <th className="px-2 py-1 text-left text-gray-500">Admin</th>
                                                    <th className="px-2 py-1 text-left text-gray-500">Oper</th>
                                                    <th className="px-2 py-1 text-left text-gray-500">Speed</th>
                                                </tr></thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {testResult.interfaces.map((iface: any) => (
                                                        <tr key={iface.ifIndex}>
                                                            <td className="px-2 py-1 font-medium">{iface.ifName}</td>
                                                            <td className="px-2 py-1">
                                                                <span className={`inline-block w-2 h-2 rounded-full mr-1 ${iface.ifAdminStatus === 'up' ? 'bg-green-500' : 'bg-gray-400'}`} />
                                                                {iface.ifAdminStatus}
                                                            </td>
                                                            <td className="px-2 py-1">
                                                                <span className={`inline-block w-2 h-2 rounded-full mr-1 ${iface.ifOperStatus === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
                                                                {iface.ifOperStatus}
                                                            </td>
                                                            <td className="px-2 py-1 text-gray-500">
                                                                {iface.ifSpeed >= 1e9 ? (iface.ifSpeed / 1e9).toFixed(0) + ' Gbps' : iface.ifSpeed >= 1e6 ? (iface.ifSpeed / 1e6).toFixed(0) + ' Mbps' : iface.ifSpeed + ' bps'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </details>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── SECTION: Polling Settings ── */}
                    <div id="polling" ref={sectionRefs.polling} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden scroll-mt-24">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                            <h3 className="font-bold text-gray-900">Polling Settings</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700">Polling Interval (seconds)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={formData.pollingInterval}
                                        onChange={(e) => update('pollingInterval', e.target.value)}
                                        className={`${getInputClass('pollingInterval')} pr-12`}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">SEC</span>
                                </div>
                                {fieldErrors.pollingInterval
                                    ? <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><span>⚠</span>{fieldErrors.pollingInterval}</p>
                                    : <p className="text-xs text-gray-500 mt-1">Recommended: 60s for critical core devices.</p>
                                }
                            </div>
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-700">Status</label>
                                <div className="flex items-center gap-3">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.pollingEnabled}
                                            onChange={(e) => update('pollingEnabled', e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-500 peer-focus:ring-2 peer-focus:ring-blue-300 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full after:border-gray-300 after:border" />
                                        <span className="ml-3 text-sm font-medium text-gray-900">
                                            {formData.pollingEnabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500">When disabled, this device will not be polled for statistics, but will remain in the inventory.</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer info */}
                    {lastUpdated && (
                        <div className="text-xs text-gray-400 text-center mt-8">
                            Last updated: {lastUpdated}
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
}
