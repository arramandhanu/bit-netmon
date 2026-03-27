'use client';

import { useState } from 'react';
import {
    Brain, Sparkles, Server, Shield, TrendingUp, AlertTriangle, CheckCircle2,
    Loader2, RefreshCw, ChevronRight, Zap, BarChart3, FileText,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api-client';

/* ─── Types ──────────────────────────────────────────────── */

interface Finding {
    severity: string;
    title: string;
    detail: string;
    servers?: string[];
}

interface Recommendation {
    priority: string;
    title: string;
    action: string;
}

interface ServerAnalysis {
    healthScore?: number;
    status?: string;
    summary?: string;
    findings?: Finding[];
    recommendations?: Recommendation[];
    capacityForecast?: string;
    error?: string;
}

interface FleetAnalysis {
    fleetHealthScore?: number;
    status?: string;
    summary?: string;
    findings?: Finding[];
    recommendations?: Recommendation[];
    riskAreas?: string[];
    error?: string;
}

/* ─── Helpers ────────────────────────────────────────────── */

const severityColors: Record<string, { bg: string; text: string; dot: string }> = {
    critical: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    warning: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    info: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
};

const priorityColors: Record<string, { bg: string; text: string }> = {
    high: { bg: 'bg-red-50', text: 'text-red-700' },
    medium: { bg: 'bg-amber-50', text: 'text-amber-700' },
    low: { bg: 'bg-green-50', text: 'text-green-700' },
};

function HealthScoreRing({ score, size = 120 }: { score: number; size?: number }) {
    const r = (size - 12) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

    return (
        <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8"
                    strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                    className="transition-all duration-1000"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black" style={{ color }}>{score}</span>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Health</span>
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────── */

export default function AiAnalyticsPage() {
    const [fleetData, setFleetData] = useState<FleetAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

    const analyzeFleet = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/ai/analyze/fleet');
            setFleetData(data);
        } catch (err: any) {
            setFleetData({ error: err.response?.data?.message || 'Analysis failed' });
        } finally {
            setLoading(false);
        }
    };

    const checkStatus = async () => {
        try {
            const { data } = await api.get('/ai/status');
            setAiConfigured(data.configured);
            if (data.configured && !fleetData) analyzeFleet();
        } catch {
            setAiConfigured(false);
        }
    };

    // Check AI status on mount
    useState(() => { checkStatus(); });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                        <Brain className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">AI Analytics</h1>
                        <p className="text-sm text-gray-500">AI-powered Infrastructure Insights</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link href="/reports"
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                        <FileText className="h-4 w-4" /> Reports
                    </Link>
                    <button onClick={analyzeFleet} disabled={loading}
                        className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-sm font-semibold shadow-md shadow-purple-600/25 hover:shadow-lg hover:shadow-purple-600/30 transition-all disabled:opacity-50">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {loading ? 'Analyzing...' : 'Analyze Fleet'}
                    </button>
                </div>
            </div>

            {/* Not Configured Warning */}
            {aiConfigured === false && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <h3 className="font-semibold text-amber-800">Groq API Key Not Configured</h3>
                        <p className="text-sm text-amber-700 mt-1">
                            To use AI analytics, add your API key in{' '}
                            <Link href="/admin/settings" className="underline font-medium">Settings → AI / Integrations</Link>.
                        </p>
                    </div>
                </div>
            )}

            {/* Error */}
            {fleetData?.error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <h3 className="font-semibold text-red-800">Analysis Error</h3>
                        <p className="text-sm text-red-700 mt-1">{fleetData.error}</p>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && !fleetData && (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25 mb-4">
                        <Brain className="h-8 w-8 text-white animate-pulse" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Analyzing your infrastructure...</h3>
                    <p className="text-sm text-gray-500 mt-1">AI is reviewing server metrics and generating insights</p>
                    <Loader2 className="h-5 w-5 animate-spin text-purple-600 mt-4" />
                </div>
            )}

            {/* Results */}
            {fleetData && !fleetData.error && (
                <>
                    {/* Top Row: Score + Summary */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center">
                            <HealthScoreRing score={fleetData.fleetHealthScore || 0} />
                            <span className={`mt-3 px-3 py-1 rounded-full text-xs font-bold uppercase ${fleetData.status === 'healthy' ? 'bg-emerald-100 text-emerald-700' :
                                fleetData.status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                }`}>{fleetData.status}</span>
                        </div>
                        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-6">
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="h-4 w-4 text-purple-500" />
                                <h3 className="font-semibold text-gray-900">AI Summary</h3>
                            </div>
                            <p className="text-gray-700 leading-relaxed">{fleetData.summary}</p>
                            {fleetData.riskAreas && fleetData.riskAreas.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {fleetData.riskAreas.map((area, i) => (
                                        <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-100">
                                            {area}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Findings + Recommendations */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Findings */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                <h3 className="font-semibold">Key Findings</h3>
                                <span className="ml-auto text-xs text-gray-400">{fleetData.findings?.length || 0} items</span>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {(fleetData.findings || []).map((f, i) => {
                                    const s = severityColors[f.severity] || severityColors.info;
                                    return (
                                        <div key={i} className={`px-5 py-4 ${s.bg}`}>
                                            <div className="flex items-start gap-2">
                                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${s.dot}`} />
                                                <div>
                                                    <h4 className={`text-sm font-semibold ${s.text}`}>{f.title}</h4>
                                                    <p className="text-sm text-gray-600 mt-0.5">{f.detail}</p>
                                                    {f.servers && f.servers.length > 0 && (
                                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                                            {f.servers.map((srv, j) => (
                                                                <span key={j} className="px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-gray-200 text-gray-600">
                                                                    <Server className="h-2.5 w-2.5 inline mr-0.5" />{srv}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {(!fleetData.findings || fleetData.findings.length === 0) && (
                                    <div className="p-8 text-center text-sm text-gray-400">
                                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
                                        No issues detected
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recommendations */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                                <Zap className="h-4 w-4 text-purple-500" />
                                <h3 className="font-semibold">Recommendations</h3>
                                <span className="ml-auto text-xs text-gray-400">{fleetData.recommendations?.length || 0} items</span>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {(fleetData.recommendations || []).map((r, i) => {
                                    const p = priorityColors[r.priority] || priorityColors.medium;
                                    return (
                                        <div key={i} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
                                            <div className="flex items-start gap-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.bg} ${p.text} flex-shrink-0 mt-0.5`}>
                                                    {r.priority}
                                                </span>
                                                <div>
                                                    <h4 className="text-sm font-semibold text-gray-900">{r.title}</h4>
                                                    <p className="text-sm text-gray-600 mt-0.5">{r.action}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {(!fleetData.recommendations || fleetData.recommendations.length === 0) && (
                                    <div className="p-8 text-center text-sm text-gray-400">No recommendations</div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Quick Actions when no data yet */}
            {!loading && !fleetData && aiConfigured !== false && (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mb-5">
                        <Brain className="h-10 w-10 text-purple-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Ready to analyze your infrastructure</h3>
                    <p className="text-gray-500 mt-2 text-center max-w-md">
                        Click "Analyze Fleet" to get AI-powered insights about your servers, including
                        health scores, findings, and strategic recommendations.
                    </p>
                    <button onClick={analyzeFleet}
                        className="mt-6 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-purple-600/25 hover:shadow-xl transition-all">
                        <Sparkles className="h-4 w-4" /> Start Analysis
                    </button>
                </div>
            )}
        </div>
    );
}
