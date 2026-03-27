'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, GitBranch, GitCommit, GitPullRequest, Plus, Search,
    RefreshCw, ExternalLink, Clock, Check, XCircle, Loader2,
    Trash2, Eye, ChevronRight, Lock, Unlock, Star, AlertCircle,
    Play,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import {
    useGitConnections, useGitRepos, useGitPipelines,
    addGitConnection, deleteGitConnection, triggerGitPipeline,
    GitConnection, GitRepo,
} from '@/hooks/use-devops';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { useToast } from '@/components/ui/toast';

const statusColors: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    completed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    failure: 'bg-red-50 text-red-600 border-red-200',
    failed: 'bg-red-50 text-red-600 border-red-200',
    cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
    skipped: 'bg-gray-50 text-gray-500 border-gray-200',
    running: 'bg-blue-50 text-blue-600 border-blue-200',
    in_progress: 'bg-blue-50 text-blue-600 border-blue-200',
    pending: 'bg-amber-50 text-amber-600 border-amber-200',
    queued: 'bg-amber-50 text-amber-600 border-amber-200',
    created: 'bg-amber-50 text-amber-600 border-amber-200',
};

export default function GitPage() {
    const { data: connections, loading, refetch } = useGitConnections();
    const { addToast } = useToast();

    const [showModal, setShowModal] = useState(false);
    const [modalProvider, setModalProvider] = useState<'github' | 'gitlab'>('github');
    const [token, setToken] = useState('');
    const [name, setName] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [saving, setSaving] = useState(false);

    const [selectedConn, setSelectedConn] = useState<GitConnection | null>(null);
    const [selectedRepo, setSelectedRepo] = useState<GitRepo | null>(null);

    const handleConnect = (provider: 'github' | 'gitlab') => {
        setModalProvider(provider);
        setToken('');
        setName('');
        setBaseUrl('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!token.trim()) {
            addToast({ type: 'error', title: 'Error', message: 'Access token is required' });
            return;
        }
        setSaving(true);
        try {
            await addGitConnection({
                provider: modalProvider,
                token: token.trim(),
                name: name.trim() || undefined,
                baseUrl: modalProvider === 'gitlab' && baseUrl.trim() ? baseUrl.trim() : undefined,
            });
            addToast({ type: 'success', title: 'Connected!', message: `${modalProvider === 'github' ? 'GitHub' : 'GitLab'} account connected.` });
            setShowModal(false);
            refetch();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Connection Failed', message: err.response?.data?.message || 'Invalid token or connection error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteGitConnection(id);
            addToast({ type: 'success', title: 'Deleted', message: 'Connection removed' });
            if (selectedConn?.id === id) { setSelectedConn(null); setSelectedRepo(null); }
            refetch();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed to delete' });
        }
    };

    if (loading && connections.length === 0) return <DashboardSkeleton />;

    return (
        <div className="space-y-6">
            <PageHeader title="Git & CI/CD" subtitle="Manage repositories and CI/CD pipelines">
                <div className="flex items-center gap-2">
                    <Link href="/devops" className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to DevOps
                    </Link>
                </div>
            </PageHeader>

            {connections.length === 0 ? (
                /* ─── No Connections — Setup Card ─── */
                <div className="rounded-xl border border-dashed border-gray-300 bg-gradient-to-br from-purple-50/50 to-white p-8 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                        <GitBranch className="h-8 w-8 text-purple-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Connect Your Git Repository</h2>
                    <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                        Connect your GitHub or GitLab account to manage repositories, view CI/CD pipelines, and trigger deployments.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                        <button onClick={() => handleConnect('github')} className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 hover:shadow transition-all">
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                            Connect GitHub
                        </button>
                        <button onClick={() => handleConnect('gitlab')} className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 hover:shadow transition-all">
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/></svg>
                            Connect GitLab
                        </button>
                    </div>
                </div>
            ) : (
                /* ─── Connected — Show Connections + Repos ─── */
                <>
                    {/* Connection Cards */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {connections.map(conn => (
                            <div
                                key={conn.id}
                                className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 cursor-pointer transition-all ${
                                    selectedConn?.id === conn.id ? 'border-purple-400 bg-purple-50 shadow-sm' : 'border-gray-200 bg-white hover:bg-gray-50'
                                }`}
                                onClick={() => { setSelectedConn(conn); setSelectedRepo(null); }}
                            >
                                <div className={`rounded-md p-1.5 ${conn.provider === 'github' ? 'bg-gray-900 text-white' : 'bg-orange-500 text-white'}`}>
                                    {conn.provider === 'github' ? (
                                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                                    ) : (
                                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/></svg>
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{conn.name}</p>
                                    <p className="text-xs text-gray-500 capitalize">{conn.provider}</p>
                                </div>
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Connected
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(conn.id); }}
                                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                    title="Remove connection"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={() => handleConnect('github')}
                            className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            Add Connection
                        </button>
                    </div>

                    {/* Repos + Pipelines */}
                    {selectedConn && (
                        <RepoSection connectionId={selectedConn.id} selectedRepo={selectedRepo} onSelectRepo={setSelectedRepo} />
                    )}
                    {!selectedConn && connections.length > 0 && (
                        <div className="text-center py-12">
                            <GitBranch className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Select a connection above to view repositories</p>
                        </div>
                    )}
                </>
            )}

            {/* Connect Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 mx-4">
                        <h3 className="text-lg font-bold text-gray-900">
                            Connect {modalProvider === 'github' ? 'GitHub' : 'GitLab'}
                        </h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Connection Name (optional)</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder={`My ${modalProvider === 'github' ? 'GitHub' : 'GitLab'}`}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Personal Access Token <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="password"
                                value={token}
                                onChange={e => setToken(e.target.value)}
                                placeholder={modalProvider === 'github' ? 'ghp_...' : 'glpat-...'}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                            />
                            <p className="text-xs text-gray-400 mt-1">
                                {modalProvider === 'github'
                                    ? 'Settings → Developer settings → Personal access tokens → Fine-grained tokens'
                                    : 'Preferences → Access Tokens → Personal Access Tokens'}
                            </p>
                        </div>
                        {modalProvider === 'gitlab' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">GitLab URL (self-hosted)</label>
                                <input
                                    type="text"
                                    value={baseUrl}
                                    onChange={e => setBaseUrl(e.target.value)}
                                    placeholder="https://gitlab.com"
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                                />
                            </div>
                        )}
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                Connect
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Repo Section Component ────────────────────────── */

function RepoSection({ connectionId, selectedRepo, onSelectRepo }: {
    connectionId: number;
    selectedRepo: GitRepo | null;
    onSelectRepo: (repo: GitRepo | null) => void;
}) {
    const { data: repos, loading, error, refetch } = useGitRepos(connectionId);
    const [search, setSearch] = useState('');

    const filtered = repos.filter(r => {
        if (!search) return true;
        const q = search.toLowerCase();
        return r.name.toLowerCase().includes(q) || r.fullName.toLowerCase().includes(q);
    });

    if (loading) return <div className="py-8 text-center text-sm text-gray-500"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Loading repositories...</div>;
    if (error) return <div className="py-8 text-center text-sm text-red-500"><AlertCircle className="h-5 w-5 mx-auto mb-2" />{error}</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Repo List */}
            <div className="lg:col-span-1 space-y-3">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search repos..."
                            className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-purple-500/30" />
                    </div>
                    <button onClick={refetch} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"><RefreshCw className="h-3.5 w-3.5 text-gray-500" /></button>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden max-h-[600px] overflow-y-auto">
                    {filtered.map(repo => (
                        <div
                            key={repo.id}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 last:border-0 ${
                                selectedRepo?.id === repo.id ? 'bg-purple-50' : 'hover:bg-gray-50'
                            }`}
                            onClick={() => onSelectRepo(repo)}
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{repo.name}</p>
                                <p className="text-xs text-gray-500 truncate">{repo.fullName}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {repo.isPrivate ? <Lock className="h-3 w-3 text-amber-500" /> : <Unlock className="h-3 w-3 text-gray-400" />}
                                {repo.language && <span className="text-xs text-gray-400">{repo.language}</span>}
                                {typeof repo.stars === 'number' && repo.stars > 0 && (
                                    <span className="flex items-center gap-0.5 text-xs text-gray-400">
                                        <Star className="h-3 w-3" />{repo.stars}
                                    </span>
                                )}
                                <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                            </div>
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <div className="py-8 text-center text-sm text-gray-400">No repositories found</div>
                    )}
                </div>
            </div>

            {/* Pipeline/Details Panel */}
            <div className="lg:col-span-2">
                {selectedRepo ? (
                    <PipelinePanel connectionId={connectionId} repo={selectedRepo} />
                ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
                        <GitCommit className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">Select a repository to view pipelines</p>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Pipeline Panel Component ───────────────────────── */

function PipelinePanel({ connectionId, repo }: { connectionId: number; repo: GitRepo }) {
    const { data: pipelines, loading, refetch } = useGitPipelines(connectionId, repo.fullName);
    const { addToast } = useToast();
    const [triggering, setTriggering] = useState(false);

    const handleTrigger = async () => {
        setTriggering(true);
        try {
            await triggerGitPipeline(connectionId, repo.fullName, repo.defaultBranch);
            addToast({ type: 'success', title: 'Pipeline Triggered', message: `Workflow dispatched on ${repo.defaultBranch}` });
            setTimeout(refetch, 3000);
        } catch (err: any) {
            addToast({ type: 'error', title: 'Failed', message: err.response?.data?.message || 'Failed to trigger pipeline' });
        } finally {
            setTriggering(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">{repo.name}</h3>
                    <p className="text-xs text-gray-500">{repo.description || repo.fullName}</p>
                </div>
                <div className="flex items-center gap-2">
                    <a href={repo.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                        <ExternalLink className="h-3 w-3" /> Open
                    </a>
                    <button onClick={handleTrigger} disabled={triggering}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50">
                        {triggering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                        Run Pipeline
                    </button>
                    <button onClick={refetch} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"><RefreshCw className="h-3.5 w-3.5 text-gray-500" /></button>
                </div>
            </div>

            {/* Pipeline Runs */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pipeline Runs / Workflows</h4>
                </div>
                {loading ? (
                    <div className="py-8 text-center text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />Loading...</div>
                ) : pipelines.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-400">No pipeline runs found</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                                    <th className="text-left px-5 py-2.5 font-semibold">Status</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Branch</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Message</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">SHA</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Duration</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">When</th>
                                    <th className="text-right px-5 py-2.5 font-semibold"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {pipelines.map(pl => (
                                    <tr key={pl.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-2.5">
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold capitalize border ${statusColors[pl.status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                                {pl.status === 'running' || pl.status === 'in_progress' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                                                 pl.status === 'success' || pl.status === 'completed' ? <Check className="h-3 w-3" /> :
                                                 pl.status === 'failure' || pl.status === 'failed' ? <XCircle className="h-3 w-3" /> : null}
                                                {pl.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-2.5 text-gray-600">
                                            <span className="inline-flex items-center gap-1">
                                                <GitBranch className="h-3 w-3" />{pl.ref}
                                            </span>
                                        </td>
                                        <td className="px-5 py-2.5 text-gray-600 max-w-[200px] truncate">{pl.message || '—'}</td>
                                        <td className="px-5 py-2.5 font-mono text-xs text-gray-400">{pl.sha}</td>
                                        <td className="px-5 py-2.5 text-gray-400 text-xs">{pl.duration ? `${pl.duration}s` : '—'}</td>
                                        <td className="px-5 py-2.5 text-gray-400 text-xs">{new Date(pl.createdAt).toLocaleString()}</td>
                                        <td className="px-5 py-2.5 text-right">
                                            {pl.webUrl && (
                                                <a href={pl.webUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-purple-600 transition-colors">
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
