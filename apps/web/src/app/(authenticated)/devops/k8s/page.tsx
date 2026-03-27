'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Box, Plus, Search, RefreshCw, Cpu, HardDrive,
    Network, Layers, Shield, Activity, Trash2, Loader2,
    CheckCircle2, XCircle, AlertCircle, RotateCw, Server,
    ChevronDown,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import {
    useK8sClusters, useK8sClusterOverview,
    addK8sCluster, deleteK8sCluster, restartK8sDeployment,
    K8sCluster,
} from '@/hooks/use-devops';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { useToast } from '@/components/ui/toast';

export default function K8sPage() {
    const { data: clusters, loading, refetch } = useK8sClusters();
    const { addToast } = useToast();

    const [showModal, setShowModal] = useState(false);
    const [clusterName, setClusterName] = useState('');
    const [apiUrl, setApiUrl] = useState('');
    const [token, setToken] = useState('');
    const [skipTls, setSkipTls] = useState(true);
    const [saving, setSaving] = useState(false);

    const [selectedCluster, setSelectedCluster] = useState<K8sCluster | null>(null);

    const handleSave = async () => {
        if (!clusterName.trim() || !apiUrl.trim() || !token.trim()) {
            addToast({ type: 'error', title: 'Error', message: 'All fields are required' });
            return;
        }
        setSaving(true);
        try {
            await addK8sCluster({
                name: clusterName.trim(),
                apiUrl: apiUrl.trim(),
                token: token.trim(),
                skipTlsVerify: skipTls,
            });
            addToast({ type: 'success', title: 'Cluster Connected', message: 'Kubernetes cluster added successfully.' });
            setShowModal(false);
            refetch();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Connection Failed', message: err.response?.data?.message || 'Failed to connect to cluster' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteK8sCluster(id);
            addToast({ type: 'success', title: 'Deleted', message: 'Cluster removed' });
            if (selectedCluster?.id === id) setSelectedCluster(null);
            refetch();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed to delete' });
        }
    };

    if (loading && clusters.length === 0) return <DashboardSkeleton />;

    return (
        <div className="space-y-6">
            <PageHeader title="Kubernetes" subtitle="Monitor and manage Kubernetes clusters">
                <div className="flex items-center gap-2">
                    <button onClick={() => { setClusterName(''); setApiUrl(''); setToken(''); setShowModal(true); }}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                        <Plus className="h-3.5 w-3.5" /> Add Cluster
                    </button>
                    <Link href="/devops" className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to DevOps
                    </Link>
                </div>
            </PageHeader>

            {clusters.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gradient-to-br from-blue-50/50 to-white p-8 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                        <Box className="h-8 w-8 text-blue-700" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Connect Your Kubernetes Cluster</h2>
                    <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                        Add your Kubernetes cluster to monitor pods, deployments, and services. Manage scaling and rollouts directly from NetMon.
                    </p>
                    <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm">
                        <Plus className="h-4 w-4" /> Add Cluster
                    </button>
                </div>
            ) : (
                <>
                    {/* Cluster Tabs */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {clusters.map(cl => (
                            <div
                                key={cl.id}
                                className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 cursor-pointer transition-all ${
                                    selectedCluster?.id === cl.id ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:bg-gray-50'
                                }`}
                                onClick={() => setSelectedCluster(cl)}
                            >
                                <div className="rounded-md bg-blue-600 p-1.5 text-white">
                                    <Box className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{cl.name}</p>
                                    <p className="text-xs text-gray-500 truncate max-w-[200px]">{cl.api_url}</p>
                                </div>
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Connected
                                </span>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(cl.id); }}
                                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Remove cluster">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {selectedCluster ? (
                        <ClusterOverview clusterId={selectedCluster.id} />
                    ) : (
                        <div className="text-center py-12">
                            <Box className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Select a cluster above to view overview</p>
                        </div>
                    )}
                </>
            )}

            {/* Add Cluster Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 mx-4">
                        <h3 className="text-lg font-bold text-gray-900">Add Kubernetes Cluster</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cluster Name <span className="text-red-500">*</span></label>
                            <input type="text" value={clusterName} onChange={e => setClusterName(e.target.value)} placeholder="Production Cluster"
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">API Server URL <span className="text-red-500">*</span></label>
                            <input type="text" value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="https://k8s-api.example.com:6443"
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Service Account Token <span className="text-red-500">*</span></label>
                            <textarea value={token} onChange={e => setToken(e.target.value)} placeholder="eyJhbGciOiJSUzI1NiIs..."
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 h-24 resize-none" />
                            <p className="text-xs text-gray-400 mt-1">kubectl create token default -n kube-system</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="skipTls" checked={skipTls} onChange={e => setSkipTls(e.target.checked)}
                                className="rounded border-gray-300" />
                            <label htmlFor="skipTls" className="text-sm text-gray-600">Skip TLS verification (self-signed certs)</label>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5">
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

/* ─── Cluster Overview Component ─────────────────────── */

function ClusterOverview({ clusterId }: { clusterId: number }) {
    const { data, loading, error, refetch } = useK8sClusterOverview(clusterId);
    const { addToast } = useToast();
    const [tab, setTab] = useState<'pods' | 'deployments' | 'nodes'>('pods');
    const [nsFilter, setNsFilter] = useState('_all');
    const [search, setSearch] = useState('');
    const [restarting, setRestarting] = useState<string | null>(null);

    if (loading) return <div className="py-8 text-center text-sm text-gray-500"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Loading cluster data...</div>;
    if (error || !data) return <div className="py-8 text-center text-sm text-red-500"><AlertCircle className="h-5 w-5 mx-auto mb-2" />{error || 'Failed to load'}</div>;

    const { stats, pods, deployments, nodes, namespaces } = data;

    const handleRestart = async (namespace: string, name: string) => {
        setRestarting(`${namespace}/${name}`);
        try {
            await restartK8sDeployment(clusterId, namespace, name);
            addToast({ type: 'success', title: 'Restarting', message: `Deployment ${name} is restarting` });
            setTimeout(refetch, 3000);
        } catch (err: any) {
            addToast({ type: 'error', title: 'Failed', message: err.response?.data?.message || 'Restart failed' });
        } finally {
            setRestarting(null);
        }
    };

    const filteredPods = pods.filter(p => {
        if (nsFilter !== '_all' && p.namespace !== nsFilter) return false;
        if (!search) return true;
        return p.name.toLowerCase().includes(search.toLowerCase());
    });

    const filteredDeps = deployments.filter(d => {
        if (nsFilter !== '_all' && d.namespace !== nsFilter) return false;
        if (!search) return true;
        return d.name.toLowerCase().includes(search.toLowerCase());
    });

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
                <MetricCard label="Nodes" value={stats.nodes} icon={Cpu} />
                <MetricCard label="Nodes Ready" value={stats.nodesReady} icon={CheckCircle2} />
                <MetricCard label="Total Pods" value={stats.pods} icon={Box} />
                <MetricCard label="Running" value={stats.podsRunning} icon={Activity} />
                <MetricCard label="Failed" value={stats.podsFailed} icon={XCircle} />
                <MetricCard label="Deployments" value={stats.deployments} icon={Layers} />
                <MetricCard label="Namespaces" value={stats.namespaces} icon={Network} />
            </div>

            {/* Tabs + Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                    {(['pods', 'deployments', 'nodes'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                            {t}
                        </button>
                    ))}
                </div>
                {tab !== 'nodes' && (
                    <div className="relative">
                        <select value={nsFilter} onChange={e => setNsFilter(e.target.value)}
                            className="appearance-none h-8 rounded-lg border border-gray-200 bg-white pl-3 pr-7 text-xs outline-none focus:ring-2 focus:ring-blue-500/30">
                            <option value="_all">All Namespaces</option>
                            {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
                    </div>
                )}
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                        className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <button onClick={refetch} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                    <RefreshCw className="h-3.5 w-3.5 text-gray-500" />
                </button>
            </div>

            {/* Data Table */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                {tab === 'pods' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                                    <th className="text-left px-5 py-2.5 font-semibold">Name</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Namespace</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Status</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Ready</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Restarts</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Age</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Node</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPods.map(pod => (
                                    <tr key={`${pod.namespace}/${pod.name}`} className="border-b border-gray-50 hover:bg-gray-50/50">
                                        <td className="px-5 py-2 font-mono text-xs text-gray-900 max-w-[250px] truncate">{pod.name}</td>
                                        <td className="px-5 py-2 text-gray-500 text-xs">{pod.namespace}</td>
                                        <td className="px-5 py-2">
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold border ${
                                                pod.status === 'Running' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                                pod.status === 'Failed' ? 'bg-red-50 text-red-600 border-red-200' :
                                                pod.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                'bg-gray-50 text-gray-500 border-gray-200'
                                            }`}>{pod.status}</span>
                                        </td>
                                        <td className="px-5 py-2 text-xs text-gray-500">{pod.ready}</td>
                                        <td className="px-5 py-2 text-xs text-gray-500">{pod.restarts}</td>
                                        <td className="px-5 py-2 text-xs text-gray-400">{pod.age}</td>
                                        <td className="px-5 py-2 text-xs text-gray-400 truncate max-w-[150px]">{pod.nodeName}</td>
                                    </tr>
                                ))}
                                {filteredPods.length === 0 && (
                                    <tr><td colSpan={7} className="py-8 text-center text-sm text-gray-400">No pods found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {tab === 'deployments' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                                    <th className="text-left px-5 py-2.5 font-semibold">Name</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Namespace</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Ready</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Up-to-date</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Available</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Age</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Images</th>
                                    <th className="text-right px-5 py-2.5 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDeps.map(dep => (
                                    <tr key={`${dep.namespace}/${dep.name}`} className="border-b border-gray-50 hover:bg-gray-50/50">
                                        <td className="px-5 py-2 font-mono text-xs text-gray-900">{dep.name}</td>
                                        <td className="px-5 py-2 text-gray-500 text-xs">{dep.namespace}</td>
                                        <td className="px-5 py-2 text-xs font-semibold text-gray-700">{dep.ready}</td>
                                        <td className="px-5 py-2 text-xs text-gray-500">{dep.upToDate}</td>
                                        <td className="px-5 py-2 text-xs text-gray-500">{dep.available}</td>
                                        <td className="px-5 py-2 text-xs text-gray-400">{dep.age}</td>
                                        <td className="px-5 py-2 text-xs text-gray-400 max-w-[200px] truncate">{dep.images.join(', ')}</td>
                                        <td className="px-5 py-2 text-right">
                                            <button onClick={() => handleRestart(dep.namespace, dep.name)}
                                                disabled={restarting !== null}
                                                className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                                                title="Rolling Restart">
                                                {restarting === `${dep.namespace}/${dep.name}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredDeps.length === 0 && (
                                    <tr><td colSpan={8} className="py-8 text-center text-sm text-gray-400">No deployments found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {tab === 'nodes' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                                    <th className="text-left px-5 py-2.5 font-semibold">Name</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Status</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Roles</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Version</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Internal IP</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">OS</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">CPU</th>
                                    <th className="text-left px-5 py-2.5 font-semibold">Memory</th>
                                </tr>
                            </thead>
                            <tbody>
                                {nodes.map(node => (
                                    <tr key={node.name} className="border-b border-gray-50 hover:bg-gray-50/50">
                                        <td className="px-5 py-2 font-mono text-xs text-gray-900">{node.name}</td>
                                        <td className="px-5 py-2">
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold border ${
                                                node.status === 'Ready' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                                            }`}>{node.status}</span>
                                        </td>
                                        <td className="px-5 py-2 text-xs text-gray-500">{node.roles}</td>
                                        <td className="px-5 py-2 text-xs text-gray-500">{node.version}</td>
                                        <td className="px-5 py-2 text-xs font-mono text-gray-400">{node.internalIp || '—'}</td>
                                        <td className="px-5 py-2 text-xs text-gray-400 max-w-[200px] truncate">{node.os}</td>
                                        <td className="px-5 py-2 text-xs text-gray-500">{node.cpu}</td>
                                        <td className="px-5 py-2 text-xs text-gray-500">{node.memory}</td>
                                    </tr>
                                ))}
                                {nodes.length === 0 && (
                                    <tr><td colSpan={8} className="py-8 text-center text-sm text-gray-400">No nodes found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
