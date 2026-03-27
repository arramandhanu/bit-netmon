'use client';

import { useState } from 'react';
import {
    FileText, Brain, Loader2, Download, Copy, CheckCircle2,
    Server, Shield, TrendingUp, BarChart3, Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { useServerMonitorOverview } from '@/hooks/use-server-monitors';

const REPORT_TYPES = [
    { id: 'health', label: 'Server Health', icon: Server, desc: 'Comprehensive health analysis of your servers' },
    { id: 'capacity', label: 'Capacity Planning', icon: TrendingUp, desc: 'Growth trends & scaling recommendations' },
    { id: 'security', label: 'Security Audit', icon: Shield, desc: 'Security posture & vulnerability assessment' },
    { id: 'executive', label: 'Executive Summary', icon: BarChart3, desc: 'Business-focused infrastructure overview' },
];

export default function ReportsPage() {
    const [reportType, setReportType] = useState('health');
    const [selectedServer, setSelectedServer] = useState<number | undefined>();
    const [report, setReport] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const { data: overview } = useServerMonitorOverview(0);

    const generateReport = async () => {
        setLoading(true);
        setError(null);
        setReport(null);
        try {
            const { data } = await api.post('/ai/report', {
                type: reportType,
                serverId: selectedServer,
            });
            if (data.error) {
                setError(data.error);
            } else {
                setReport(data.report);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const copyReport = () => {
        if (report) {
            navigator.clipboard.writeText(report);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                        <FileText className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">AI Reports</h1>
                        <p className="text-sm text-gray-500">Generate AI-powered infrastructure reports</p>
                    </div>
                </div>
            </div>

            {/* Report Configuration */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {REPORT_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isActive = reportType === type.id;
                    return (
                        <button
                            key={type.id}
                            onClick={() => setReportType(type.id)}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${isActive
                                ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-500/10'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                        >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${isActive ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                <Icon className="h-5 w-5" />
                            </div>
                            <h3 className={`text-sm font-semibold ${isActive ? 'text-blue-700' : 'text-gray-900'}`}>{type.label}</h3>
                            <p className="text-xs text-gray-500 mt-1">{type.desc}</p>
                        </button>
                    );
                })}
            </div>

            {/* Server selector + Generate */}
            <div className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex-1">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Scope</label>
                    <select
                        value={selectedServer ?? ''}
                        onChange={(e) => setSelectedServer(e.target.value ? Number(e.target.value) : undefined)}
                        className="h-10 w-full max-w-xs rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Servers (Fleet)</option>
                        {overview?.servers?.map((s: any) => (
                            <option key={s.server_id} value={s.server_id}>{s.name}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={generateReport}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg text-sm font-semibold shadow-md shadow-blue-600/25 hover:shadow-lg transition-all disabled:opacity-50"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {loading ? 'Generating...' : 'Generate Report'}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
            )}

            {/* Loading state */}
            {loading && (
                <div className="flex flex-col items-center py-16">
                    <Brain className="h-12 w-12 text-blue-500 animate-pulse mb-4" />
                    <h3 className="text-lg font-semibold">Generating your report...</h3>
                    <p className="text-sm text-gray-500 mt-1">AI is analyzing metrics and creating the report</p>
                </div>
            )}

            {/* Report Output */}
            {report && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-semibold">{REPORT_TYPES.find(t => t.id === reportType)?.label} Report</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={copyReport}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors">
                                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                    </div>
                    <div className="p-6 prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-gray-900">
                        <div dangerouslySetInnerHTML={{
                            __html: report
                                .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                                .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                                .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                .replace(/^- (.*$)/gm, '<li>$1</li>')
                                .replace(/\n/g, '<br/>')
                        }} />
                    </div>
                </div>
            )}
        </div>
    );
}
