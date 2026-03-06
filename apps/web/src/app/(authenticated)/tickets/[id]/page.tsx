'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Server, User, Clock, MessageSquare,
    Send, AlertTriangle, CheckCircle2, Edit3,
    Bold, Italic, Code, FileCode, Link as LinkIcon, List,
    Trash2, Save, X, Calendar, Paperclip, FileText, Image, Download,
    ChevronRight, ChevronDown, Lock, ShieldAlert, RefreshCw,
} from 'lucide-react';
import { useTicket, updateTicket, addTicketComment, deleteTicket } from '@/hooks/use-tickets';
import type { TicketComment, TicketAttachment } from '@/hooks/use-tickets';
import { getStoredUser } from '@/hooks/use-auth';
import { api } from '@/lib/api-client';

/* ─── Configs ──────────────────────────────────────────── */

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    open: { label: 'Open', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    in_progress: { label: 'In Progress', bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-500' },
    waiting: { label: 'Waiting', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    escalated: { label: 'Escalated', bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
    on_hold: { label: 'On Hold', bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
    resolved: { label: 'Resolved', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    closed: { label: 'Closed', bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' },
};

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
    critical: { label: 'Critical', color: 'text-red-600', bg: 'bg-red-50' },
    high: { label: 'High', color: 'text-orange-600', bg: 'bg-orange-50' },
    medium: { label: 'Medium', color: 'text-blue-600', bg: 'bg-blue-50' },
    low: { label: 'Low', color: 'text-green-600', bg: 'bg-green-50' },
};

const categoryConfig: Record<string, { label: string; bg: string; text: string; headerBg: string; headerBorder: string; dot: string; border: string }> = {
    incident: { label: 'Incident', bg: 'bg-red-50', text: 'text-red-700', headerBg: 'bg-red-50', headerBorder: 'border-red-200', dot: 'bg-red-500', border: 'border-red-200' },
    problem: { label: 'Problem', bg: 'bg-amber-50', text: 'text-amber-700', headerBg: 'bg-amber-50', headerBorder: 'border-amber-200', dot: 'bg-amber-500', border: 'border-amber-200' },
    change_request: { label: 'Change Request', bg: 'bg-violet-50', text: 'text-violet-700', headerBg: 'bg-violet-50', headerBorder: 'border-violet-200', dot: 'bg-violet-500', border: 'border-violet-200' },
    maintenance: { label: 'Maintenance', bg: 'bg-teal-50', text: 'text-teal-700', headerBg: 'bg-teal-50', headerBorder: 'border-teal-200', dot: 'bg-teal-500', border: 'border-teal-200' },
};

const categoryOptions = Object.entries(categoryConfig).map(([value, cfg]) => ({ value, label: cfg.label }));

const statusOptions = ['open', 'in_progress', 'waiting', 'escalated', 'on_hold', 'resolved', 'closed'];
const priorityOptions = ['low', 'medium', 'high', 'critical'];

/* ─── Markdown Renderer ───────────────────────────────── */

function renderFormattedText(text: string) {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
            const code = part.slice(3, -3).replace(/^\n/, '').replace(/\n$/, '');
            return (
                <pre key={i} className="bg-accent rounded-lg p-3 text-xs font-mono overflow-x-auto my-2">
                    <code>{code}</code>
                </pre>
            );
        }
        const formatted = part
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code class="bg-accent px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
            .replace(/@(\w+)/g, '<span class="text-primary font-bold bg-primary/10 px-1 py-0.5 rounded text-xs">@$1</span>');
        return (
            <span key={i} dangerouslySetInnerHTML={{ __html: formatted.replace(/\n/g, '<br/>') }} />
        );
    });
}

function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─── Component ────────────────────────────────────────── */

export default function TicketDetailPage() {
    const params = useParams();
    const router = useRouter();
    const ticketId = Number(params?.id);
    const { ticket, loading, refetch } = useTicket(ticketId);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const commentRef = useRef<HTMLTextAreaElement>(null);
    const currentUser = getStoredUser();
    const isAdmin = currentUser?.role === 'admin';
    const isOperator = currentUser?.role === 'operator';

    // ─── Assignee picker state
    const [showAssigneePicker, setShowAssigneePicker] = useState(false);
    const [userList, setUserList] = useState<{ id: number; username: string; displayName?: string; role?: string }[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const assigneeRef = useRef<HTMLDivElement>(null);

    // ─── Inline Edit State
    const [editMode, setEditMode] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editPriority, setEditPriority] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [editDueDate, setEditDueDate] = useState('');
    const [saving, setSaving] = useState(false);

    // ─── Delete
    const [deleting, setDeleting] = useState(false);

    // ─── Reply @mention
    const [replyTo, setReplyTo] = useState<{ id: number; userName: string; content: string } | null>(null);

    // ─── Close modal
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [closingReason, setClosingReason] = useState('');
    const [closingSubmitting, setClosingSubmitting] = useState(false);

    // ─── Reopen modal
    const [showReopenModal, setShowReopenModal] = useState(false);
    const [reopenReason, setReopenReason] = useState('');
    const [reopenSubmitting, setReopenSubmitting] = useState(false);

    // Determine permissions
    const isCreator = ticket && currentUser ? ticket.creator?.id === currentUser.id : false;
    const canComment = !ticket || ticket.status !== 'closed';
    const canEdit = isAdmin || isOperator || isCreator;
    const canAssign = isAdmin || isOperator;

    // Fetch users for assignee picker
    const fetchUsers = async () => {
        if (userList.length > 0) return;
        setLoadingUsers(true);
        try {
            const { data } = await api.get('/auth/users');
            setUserList(Array.isArray(data) ? data : data.users || []);
        } catch { /* ignore */ }
        finally { setLoadingUsers(false); }
    };

    const handleAssign = async (userId: number) => {
        if (!ticket) return;
        setAssigning(true);
        try {
            await api.post(`/tickets/${ticket.id}/assign`, { assigneeId: userId });
            setShowAssigneePicker(false);
            refetch();
        } catch { /* ignore */ }
        finally { setAssigning(false); }
    };

    const handleUnassign = async () => {
        if (!ticket) return;
        setAssigning(true);
        try {
            await api.patch(`/tickets/${ticket.id}`, { assigneeId: null });
            setShowAssigneePicker(false);
            refetch();
        } catch { /* ignore */ }
        finally { setAssigning(false); }
    };

    const handleReply = (commentObj: { id: number; userName: string; content: string }) => {
        if (!canComment) return;
        setReplyTo(commentObj);
        setComment(`@${commentObj.userName} `);
        setTimeout(() => commentRef.current?.focus(), 50);
    };

    const startEdit = () => {
        if (!ticket) return;
        setEditTitle(ticket.title);
        setEditDescription(ticket.description);
        setEditPriority(ticket.priority);
        setEditCategory(ticket.category);
        setEditDueDate(ticket.dueDate ? ticket.dueDate.split('T')[0] : '');
        setEditMode(true);
    };

    const cancelEdit = () => setEditMode(false);

    const saveEdit = async () => {
        setSaving(true);
        try {
            const data: Record<string, any> = {};
            if (editTitle !== ticket?.title) data.title = editTitle;
            if (editDescription !== ticket?.description) data.description = editDescription;
            if (editPriority !== ticket?.priority) data.priority = editPriority;
            if (editCategory !== ticket?.category) data.category = editCategory;
            const newDue = editDueDate || undefined;
            const oldDue = ticket?.dueDate ? ticket.dueDate.split('T')[0] : undefined;
            if (newDue !== oldDue) data.dueDate = editDueDate || undefined;

            if (Object.keys(data).length > 0) {
                await updateTicket(ticketId, data);
                refetch();
            }
            setEditMode(false);
        } catch (err) {
            console.error('Save failed', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this ticket? This cannot be undone.')) return;
        setDeleting(true);
        try {
            await deleteTicket(ticketId);
            router.push('/tickets');
        } catch (err) {
            console.error('Delete failed', err);
            setDeleting(false);
        }
    };

    // ─── Comment helpers
    const insertFormat = (prefix: string, suffix: string) => {
        const el = commentRef.current;
        if (!el) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const selected = comment.substring(start, end);
        const before = comment.substring(0, start);
        const after = comment.substring(end);
        const newText = before + prefix + selected + suffix + after;
        setComment(newText);
        setTimeout(() => {
            el.focus();
            const newPos = start + prefix.length + selected.length + suffix.length;
            el.setSelectionRange(newPos, newPos);
        }, 0);
    };

    const handleStatusChange = async (newStatus: string) => {
        // If closing, show modal for required reason
        if (newStatus === 'closed') {
            setShowCloseModal(true);
            return;
        }
        try {
            await updateTicket(ticketId, { status: newStatus });
            refetch();
        } catch (err) {
            console.error('Status update failed', err);
        }
    };

    const handleCloseWithReason = async () => {
        if (!closingReason.trim()) return;
        setClosingSubmitting(true);
        try {
            // Post the closing reason as a comment first
            await addTicketComment(ticketId, `**Ticket closed:** ${closingReason.trim()}`);
            // Then change status to closed
            await updateTicket(ticketId, { status: 'closed' });
            setShowCloseModal(false);
            setClosingReason('');
            refetch();
        } catch (err) {
            console.error('Close failed', err);
        } finally {
            setClosingSubmitting(false);
        }
    };

    const handleReopenWithReason = async () => {
        if (!reopenReason.trim()) return;
        setReopenSubmitting(true);
        try {
            // Post the reopen reason as a comment first
            await addTicketComment(ticketId, `**Ticket reopened:** ${reopenReason.trim()}`);
            // Then change status back to open
            await updateTicket(ticketId, { status: 'open' });
            setShowReopenModal(false);
            setReopenReason('');
            refetch();
        } catch (err) {
            console.error('Reopen failed', err);
        } finally {
            setReopenSubmitting(false);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!comment.trim()) return;
        setSubmitting(true);
        try {
            await addTicketComment(ticketId, comment.trim(), replyTo?.id);
            setComment('');
            setReplyTo(null);
            refetch();
        } catch (err) {
            console.error('Comment failed', err);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="text-center py-20 text-muted-foreground">
                <p>Ticket not found</p>
                <Link href="/tickets" className="text-primary text-sm mt-2 inline-block">← Back to tickets</Link>
            </div>
        );
    }

    const sc = statusConfig[ticket.status] || statusConfig.open;
    const pc = priorityConfig[ticket.priority] || priorityConfig.medium;
    const cc = categoryConfig[ticket.category] || categoryConfig.incident;
    const isOverdue = ticket.dueDate && new Date(ticket.dueDate) < new Date() && !['resolved', 'closed'].includes(ticket.status);

    return (
        <>
            <div className="space-y-6">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Link href="/tickets" className="hover:text-primary">Tickets</Link>
                    <ChevronRight className="h-3 w-3" />
                    <span className="text-foreground font-mono">{ticket.ticketNumber}</span>
                </nav>

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                        <Link href="/tickets" className="rounded-lg border-2 border-gray-200 p-2 hover:bg-accent transition-colors mt-1 shrink-0">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${sc.bg} ${sc.text}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${sc.dot} mr-2`} />
                                    {isOverdue ? 'Overdue' : sc.label}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${pc.bg} ${pc.color}`}>
                                    ● {pc.label}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${cc.bg} ${cc.text}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${cc.dot} mr-1.5`} />
                                    {cc.label}
                                </span>
                            </div>
                            {editMode ? (
                                <input
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="text-2xl font-extrabold tracking-tight w-full px-2 py-1 rounded-lg border border-primary/30 focus:ring-2 focus:ring-primary/20 outline-none bg-background"
                                />
                            ) : (
                                <h1 className="text-2xl font-extrabold tracking-tight">{ticket.title}</h1>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {editMode ? (
                            <>
                                <button onClick={cancelEdit} className="px-4 py-2 rounded-lg border border-border/50 text-sm font-semibold text-muted-foreground hover:bg-accent transition-all">
                                    <X className="h-4 w-4 inline mr-1" />Cancel
                                </button>
                                <button onClick={saveEdit} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50">
                                    <Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </>
                        ) : (
                            <>
                                {canEdit && (
                                    <button onClick={startEdit} className="px-4 py-2 rounded-lg border border-border/30 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-primary transition-all flex items-center gap-1.5">
                                        <Edit3 className="h-3.5 w-3.5" /> Edit
                                    </button>
                                )}
                                {isAdmin && (
                                    <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-lg border border-red-200 text-sm font-semibold text-red-500 hover:bg-red-50 hover:border-red-300 transition-all flex items-center gap-1.5 disabled:opacity-50">
                                        <Trash2 className="h-3.5 w-3.5" /> {deleting ? 'Deleting...' : 'Delete'}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* ─── Main Content (2/3) ──────────────────── */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Description */}
                        <div className={`bg-card rounded-xl border-2 ${cc.border} shadow-sm overflow-hidden`}>
                            <div className={`p-4 border-b-2 ${cc.headerBorder} ${cc.headerBg}`}>
                                <h3 className={`font-bold text-sm ${cc.text}`}>Description</h3>
                            </div>
                            <div className="p-5">
                                {editMode ? (
                                    <textarea
                                        rows={8}
                                        value={editDescription}
                                        onChange={(e) => setEditDescription(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg border border-border/50 bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm resize-y"
                                    />
                                ) : (
                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
                                )}
                            </div>
                        </div>

                        {/* Attachments */}
                        {ticket.attachments && ticket.attachments.length > 0 && (
                            <div className="bg-card rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
                                <div className="p-4 border-b-2 border-gray-200 bg-gray-50 flex items-center gap-2">
                                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                                    <h3 className="font-bold text-sm">Attachments ({ticket.attachments.length})</h3>
                                </div>
                                <div className="p-4 space-y-2.5">
                                    {ticket.attachments.map((att: TicketAttachment) => (
                                        <div key={att.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border-2 border-gray-200 hover:bg-accent transition-colors">
                                            <div className="flex items-center gap-3 min-w-0">
                                                {att.mimeType?.startsWith('image/') ? (
                                                    <Image className="h-4 w-4 text-blue-500 shrink-0" />
                                                ) : (
                                                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold truncate">{att.originalName || att.filename}</p>
                                                    <p className="text-xs text-muted-foreground">{formatFileSize(att.size)} • {new Date(att.createdAt).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            {att.url && (
                                                <a
                                                    href={att.url}
                                                    download
                                                    className="p-2 text-muted-foreground hover:text-primary transition-colors shrink-0"
                                                    title="Download"
                                                >
                                                    <Download className="h-4 w-4" />
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ─── Resolution Card (closed/resolved) ──── */}
                        {['resolved', 'closed'].includes(ticket.status) && (
                            <div className={`rounded-xl border-2 overflow-hidden ${ticket.status === 'closed' ? 'border-slate-200 bg-slate-50/50' : 'border-emerald-200 bg-emerald-50/50'}`}>
                                <div className={`px-5 py-3 flex items-center gap-2 ${ticket.status === 'closed' ? 'bg-slate-100/80' : 'bg-emerald-100/80'}`}>
                                    <CheckCircle2 className={`h-4 w-4 ${ticket.status === 'closed' ? 'text-slate-600' : 'text-emerald-600'}`} />
                                    <h3 className={`font-bold text-sm ${ticket.status === 'closed' ? 'text-slate-700' : 'text-emerald-700'}`}>
                                        Ticket {ticket.status === 'closed' ? 'Closed' : 'Resolved'}
                                    </h3>
                                </div>
                                <div className="p-5 grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Created</span>
                                        <p className="text-sm font-semibold mt-0.5">{new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                            {ticket.status === 'closed' ? 'Closed' : 'Resolved'}
                                        </span>
                                        <p className="text-sm font-semibold mt-0.5">
                                            {ticket.resolvedAt
                                                ? new Date(ticket.resolvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                : ticket.closedAt
                                                    ? new Date(ticket.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                    : new Date(ticket.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resolution Time</span>
                                        <p className="text-sm font-semibold mt-0.5">
                                            {(() => {
                                                const endDate = ticket.resolvedAt ? new Date(ticket.resolvedAt) : ticket.closedAt ? new Date(ticket.closedAt) : new Date(ticket.updatedAt);
                                                const diff = endDate.getTime() - new Date(ticket.createdAt).getTime();
                                                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                                if (days > 0) return `${days}d ${hours}h`;
                                                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                                return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                                            })()}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                            {ticket.status === 'closed' ? 'Closed By' : 'Resolved By'}
                                        </span>
                                        <p className="text-sm font-semibold mt-0.5">
                                            {ticket.assignee?.displayName || ticket.assignee?.username || ticket.creator?.displayName || ticket.creator?.username || 'Unknown'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ─── Activity Timeline ──────────────────── */}
                        <div className={`bg-card rounded-xl border-2 ${cc.border} shadow-sm overflow-hidden`}>
                            <div className={`p-4 border-b-2 ${cc.headerBorder} ${cc.headerBg} flex items-center gap-2`}>
                                <MessageSquare className={`h-4 w-4 ${cc.text}`} />
                                <h3 className={`font-bold text-sm ${cc.text}`}>Activity ({ticket._count?.comments || 0})</h3>
                            </div>

                            <div className="p-5">
                                {/* Timeline list */}
                                <div className="relative">
                                    {/* Vertical connector line */}
                                    {ticket.comments && ticket.comments.length > 0 && (
                                        <div className="absolute left-4 top-4 bottom-4 w-px bg-border/50" />
                                    )}

                                    <div className="space-y-0">
                                        {ticket.comments?.map((c: TicketComment, idx: number) => {
                                            const isSystem = c.isSystem;
                                            const isStatusChange = isSystem && /→|->/.test(c.content);
                                            const userName = c.user.displayName || c.user.username || '?';
                                            const timeStr = new Date(c.createdAt).toLocaleString('en-US', {
                                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            });

                                            /* ── System event (compact) ── */
                                            if (isSystem) {
                                                // Parse "status → closed" style
                                                const statusMatch = c.content.match(/(status)\s*[→\->]+\s*(\w+)/i);
                                                const fieldLabel = statusMatch ? statusMatch[1] : null;
                                                const newValue = statusMatch ? statusMatch[2] : null;
                                                const valueCfg = newValue ? statusConfig[newValue] : null;

                                                return (
                                                    <div key={c.id} className="flex items-center gap-3 py-2.5 relative pl-1">
                                                        {/* Dot on timeline */}
                                                        <div className="h-[9px] w-[9px] rounded-full bg-border border-2 border-background z-10 shrink-0 ml-[11.5px]" />
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap flex-1 min-w-0">
                                                            <span className="font-semibold text-foreground/70">{userName}</span>
                                                            {fieldLabel && newValue ? (
                                                                <>
                                                                    <span>changed {fieldLabel} to</span>
                                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${valueCfg ? `${valueCfg.bg} ${valueCfg.text}` : 'bg-accent'}`}>
                                                                        {valueCfg && <span className={`h-1.5 w-1.5 rounded-full ${valueCfg.dot}`} />}
                                                                        {valueCfg?.label || newValue}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <span className="italic">{c.content}</span>
                                                            )}
                                                            <span className="text-muted-foreground/50 ml-auto shrink-0">{timeStr}</span>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            /* ── User comment (full card) ── */
                                            const parentComment = c.parent;
                                            const parentSnippet = parentComment ? (parentComment.content.length > 80 ? parentComment.content.substring(0, 80) + '…' : parentComment.content) : null;
                                            const parentUser = parentComment?.user?.displayName || parentComment?.user?.username || 'Unknown';
                                            return (
                                                <div key={c.id} className="relative pl-1 py-2">
                                                    <div className="flex gap-3 ml-0">
                                                        {/* Avatar on timeline */}
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary z-10 border-2 border-background">
                                                            {userName[0].toUpperCase()}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            {/* Comment header */}
                                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                                <div className="flex items-center gap-2 text-xs">
                                                                    <span className="font-bold text-foreground">{userName}</span>
                                                                    {parentComment && (
                                                                        <span className="text-muted-foreground/60">replied to <span className="font-semibold text-primary/70">@{parentUser}</span></span>
                                                                    )}
                                                                    <span className="text-muted-foreground/50">{timeStr}</span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleReply({ id: c.id, userName, content: c.content })}
                                                                    className="text-[10px] font-bold text-muted-foreground hover:text-primary px-2 py-0.5 rounded-md hover:bg-primary/5 transition-colors opacity-0 group-hover:opacity-100"
                                                                    style={{ opacity: 1 }}
                                                                    title={`Reply to ${userName}`}
                                                                >
                                                                    ↩ Reply
                                                                </button>
                                                            </div>
                                                            {/* Reply reference card */}
                                                            {parentComment && parentSnippet && (
                                                                <div className="mb-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 flex items-start gap-2">
                                                                    <div className="w-0.5 self-stretch bg-primary/30 rounded-full shrink-0" />
                                                                    <div className="min-w-0">
                                                                        <p className="text-[10px] font-bold text-primary/60 mb-0.5">@{parentUser}</p>
                                                                        <p className="text-xs text-muted-foreground/70 leading-relaxed truncate">{parentSnippet}</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {/* Comment body */}
                                                            <div className="rounded-lg bg-gray-50 border-2 border-gray-200 px-4 py-3">
                                                                <div className="text-sm leading-relaxed">
                                                                    {renderFormattedText(c.content)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {(!ticket.comments || ticket.comments.length === 0) && (
                                            <div className="text-center py-8">
                                                <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
                                                <p className="text-sm text-muted-foreground/50 font-medium">No activity yet</p>
                                                <p className="text-xs text-muted-foreground/30 mt-0.5">Be the first to comment</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ── Comment Editor ── */}
                                {canComment ? (
                                    <form onSubmit={handleAddComment} className="border-t-2 border-gray-200">
                                        <div className="overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                                            {/* Reply indicator */}
                                            {replyTo && (
                                                <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border-b border-primary/10">
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-xs font-bold text-primary">Replying to @{replyTo.userName}</span>
                                                        <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{replyTo.content.length > 60 ? replyTo.content.substring(0, 60) + '…' : replyTo.content}</p>
                                                    </div>
                                                    <button type="button" onClick={() => { setReplyTo(null); setComment((prev: string) => prev.replace(new RegExp(`^@${replyTo.userName}\\s*`), '')); }} className="text-muted-foreground hover:text-foreground shrink-0">
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Formatting Toolbar */}
                                            <div className="flex items-center gap-0.5 px-3 py-2 border-b-2 border-gray-200 bg-gray-50">
                                                <button type="button" onClick={() => insertFormat('**', '**')} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Bold">
                                                    <Bold className="h-3.5 w-3.5" />
                                                </button>
                                                <button type="button" onClick={() => insertFormat('_', '_')} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Italic">
                                                    <Italic className="h-3.5 w-3.5" />
                                                </button>
                                                <div className="w-px h-4 bg-border/50 mx-1" />
                                                <button type="button" onClick={() => insertFormat('`', '`')} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Inline Code">
                                                    <Code className="h-3.5 w-3.5" />
                                                </button>
                                                <button type="button" onClick={() => insertFormat('\n```\n', '\n```\n')} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Code Block">
                                                    <FileCode className="h-3.5 w-3.5" />
                                                </button>
                                                <div className="w-px h-4 bg-border/50 mx-1" />
                                                <button type="button" onClick={() => insertFormat('[', '](url)')} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Link">
                                                    <LinkIcon className="h-3.5 w-3.5" />
                                                </button>
                                                <button type="button" onClick={() => insertFormat('\n- ', '')} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Bullet List">
                                                    <List className="h-3.5 w-3.5" />
                                                </button>
                                                <div className="flex-1" />
                                                <span className="text-[10px] text-muted-foreground font-medium mr-1">Markdown supported</span>
                                            </div>

                                            <textarea
                                                ref={commentRef}
                                                rows={3}
                                                placeholder="Write a comment... Use **bold**, _italic_, or `code`"
                                                value={comment}
                                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
                                                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                                        handleAddComment(e);
                                                    }
                                                    if (e.ctrlKey || e.metaKey) {
                                                        if (e.key === 'b') { e.preventDefault(); insertFormat('**', '**'); }
                                                        if (e.key === 'i') { e.preventDefault(); insertFormat('_', '_'); }
                                                    }
                                                }}
                                                className="w-full px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none resize-y min-h-[80px] bg-transparent"
                                            />

                                            <div className="flex items-center justify-between px-4 py-2.5 border-t-2 border-gray-200 bg-gray-50/80">
                                                <span className="text-[10px] text-muted-foreground">Press ⌘+Enter to submit</span>
                                                <button
                                                    type="submit"
                                                    disabled={!comment.trim() || submitting}
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-all disabled:opacity-50"
                                                >
                                                    <Send className="h-3 w-3" />
                                                    Comment
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="border-t-2 border-gray-200 px-5 py-4 bg-gray-50 flex items-center gap-2 text-muted-foreground">
                                        <Lock className="h-4 w-4 shrink-0" />
                                        <span className="text-xs font-semibold">This ticket is closed. Comments are disabled.{canEdit ? ' You can reopen this ticket from the sidebar.' : ''}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ─── Sidebar (1/3) ──────────────────────── */}
                    <div className="space-y-5">
                        {/* Status Actions */}
                        <div className="bg-card rounded-xl border-2 border-gray-200 shadow-sm p-5">
                            <h3 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-widest">Status</h3>
                            <div className="flex flex-wrap gap-2">
                                {statusOptions.map((s) => {
                                    const cfg = statusConfig[s] || statusConfig.open;
                                    // All buttons disabled when closed; "Closed" only enabled from resolved
                                    const isDisabled = ticket.status === 'closed' || ticket.status === s || (s === 'closed' && ticket.status !== 'resolved');
                                    return (
                                        <button
                                            key={s}
                                            onClick={() => handleStatusChange(s)}
                                            disabled={isDisabled}
                                            title={s === 'closed' && ticket.status !== 'resolved' ? 'Ticket must be resolved before closing' : undefined}
                                            className={`rounded-lg px-3 py-2 text-xs font-bold border-2 transition-all ${ticket.status === s
                                                ? `${cfg.bg} ${cfg.text} border-current`
                                                : isDisabled
                                                    ? 'border-border/20 text-muted-foreground/40 cursor-not-allowed'
                                                    : 'border-border/30 text-muted-foreground hover:bg-accent hover:border-primary/30'
                                                }`}
                                        >
                                            {cfg.label}
                                        </button>
                                    );
                                })}
                            </div>
                            {ticket.status === 'resolved' && (
                                <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                                    <ShieldAlert className="h-3 w-3" /> Ticket is resolved. Click <strong>Closed</strong> to finalize.
                                </p>
                            )}
                            {ticket.status === 'closed' && canEdit && (
                                <button
                                    onClick={() => setShowReopenModal(true)}
                                    className="mt-3 w-full rounded-lg px-3 py-2.5 text-xs font-bold border-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all flex items-center justify-center gap-1.5"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Reopen Ticket
                                </button>
                            )}
                        </div>

                        {/* Ticket Properties */}
                        <div className="bg-card rounded-xl border-2 border-gray-200 shadow-sm p-5 space-y-5">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Properties</h3>
                            <div>
                                <label className="text-xs text-muted-foreground font-semibold">Priority</label>
                                {editMode ? (
                                    <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                                        {priorityOptions.map((p) => {
                                            const cfg = priorityConfig[p] || priorityConfig.medium;
                                            return (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => setEditPriority(p)}
                                                    className={`px-2 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${editPriority === p
                                                        ? `${cfg.bg} ${cfg.color} border-current`
                                                        : 'border-border/30 text-muted-foreground hover:bg-accent'
                                                        }`}
                                                >
                                                    {cfg.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className={`text-sm font-bold mt-1 ${pc.color}`}>● {pc.label}</p>
                                )}
                            </div>

                            {/* Category */}
                            <div>
                                <label className="text-xs text-muted-foreground font-semibold">Category</label>
                                {editMode ? (
                                    <select
                                        value={editCategory}
                                        onChange={(e) => setEditCategory(e.target.value)}
                                        className="mt-1.5 w-full px-3 py-2 rounded-lg border border-border/50 bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                    >
                                        {categoryOptions.map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className={`inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cc.bg} ${cc.text}`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${cc.dot}`} />
                                        {cc.label}
                                    </div>
                                )}
                            </div>

                            {/* Due Date */}
                            <div>
                                <label className="text-xs text-muted-foreground font-semibold">Due Date</label>
                                {editMode ? (
                                    <input
                                        type="date"
                                        value={editDueDate}
                                        onChange={(e) => setEditDueDate(e.target.value)}
                                        className="mt-1.5 w-full px-3 py-2 rounded-lg border border-border/50 bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
                                    />
                                ) : ticket.dueDate ? (
                                    <div className={`flex items-center gap-1.5 text-sm font-semibold mt-1 ${isOverdue ? 'text-red-500' : ''}`}>
                                        <Calendar className="h-3.5 w-3.5" />
                                        {new Date(ticket.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        {isOverdue && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full font-bold">Overdue</span>}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground/50 mt-1 italic">Not set</p>
                                )}
                            </div>

                            {/* Creator */}
                            <div>
                                <label className="text-xs text-muted-foreground font-semibold">Creator</label>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                        {(ticket.creator?.displayName || ticket.creator?.username || '?')[0].toUpperCase()}
                                    </div>
                                    <span className="text-sm font-semibold">{ticket.creator?.displayName || ticket.creator?.username || 'Unknown'}</span>
                                </div>
                            </div>

                            {/* Assignee */}
                            <div className="relative" ref={assigneeRef}>
                                <label className="text-xs text-muted-foreground font-semibold">Assignee</label>
                                {canAssign ? (
                                    <button
                                        onClick={() => { setShowAssigneePicker(!showAssigneePicker); fetchUsers(); }}
                                        className="w-full flex items-center gap-2 mt-1.5 px-2 py-1.5 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
                                    >
                                        {ticket.assignee ? (
                                            <>
                                                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                                    {(ticket.assignee.displayName || ticket.assignee.username)[0].toUpperCase()}
                                                </div>
                                                <span className="text-sm font-semibold flex-1">{ticket.assignee.displayName || ticket.assignee.username}</span>
                                            </>
                                        ) : (
                                            <>
                                                <User className="h-4 w-4 text-muted-foreground/50" />
                                                <span className="text-sm italic text-muted-foreground/50 flex-1">Click to assign</span>
                                            </>
                                        )}
                                        <ChevronDown className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                                    </button>
                                ) : (
                                    ticket.assignee ? (
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                                {(ticket.assignee.displayName || ticket.assignee.username)[0].toUpperCase()}
                                            </div>
                                            <span className="text-sm font-semibold">{ticket.assignee.displayName || ticket.assignee.username}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 mt-1.5 text-muted-foreground/50">
                                            <User className="h-4 w-4" />
                                            <span className="text-sm italic">Unassigned</span>
                                        </div>
                                    )
                                )}

                                {/* Assignee picker dropdown */}
                                {showAssigneePicker && (
                                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card rounded-xl border-2 border-gray-200 shadow-xl overflow-hidden">
                                        <div className="p-2 border-b border-gray-100">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Assign to</p>
                                        </div>
                                        <div className="max-h-48 overflow-y-auto">
                                            {loadingUsers ? (
                                                <div className="p-3 text-center text-xs text-muted-foreground">Loading users...</div>
                                            ) : (
                                                <>
                                                    {ticket.assignee && (
                                                        <button
                                                            onClick={handleUnassign}
                                                            disabled={assigning}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors border-b border-gray-100"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                            <span className="font-medium">Unassign</span>
                                                        </button>
                                                    )}
                                                    {userList.map(u => (
                                                        <button
                                                            key={u.id}
                                                            onClick={() => handleAssign(u.id)}
                                                            disabled={assigning || u.id === ticket.assignee?.id}
                                                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${u.id === ticket.assignee?.id
                                                                ? 'bg-primary/5 text-primary font-semibold'
                                                                : 'hover:bg-accent text-foreground'
                                                                }`}
                                                        >
                                                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                                                {(u.displayName || u.username)[0].toUpperCase()}
                                                            </div>
                                                            <div className="flex-1 text-left">
                                                                <span className="font-medium">{u.displayName || u.username}</span>
                                                                {u.role && <span className="ml-1.5 text-[10px] text-muted-foreground/60 uppercase">{u.role}</span>}
                                                            </div>
                                                            {u.id === ticket.assignee?.id && (
                                                                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                                            )}
                                                        </button>
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Device */}
                            {
                                ticket.device && (
                                    <div>
                                        <label className="text-xs text-muted-foreground font-semibold">Device</label>
                                        <Link href={`/devices/${ticket.device.id}`} className="flex items-center gap-2 mt-1.5 text-sm text-primary hover:underline font-semibold">
                                            <Server className="h-3.5 w-3.5" />
                                            {ticket.device.displayName || ticket.device.hostname}
                                        </Link>
                                    </div>
                                )
                            }

                            {/* Linked Alert */}
                            {
                                ticket.alert && (
                                    <div>
                                        <label className="text-xs text-muted-foreground font-semibold">Linked Alert</label>
                                        <div className="flex items-center gap-2 mt-1.5 text-sm">
                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                            <span className="line-clamp-2">{ticket.alert.message}</span>
                                        </div>
                                    </div>
                                )
                            }

                            {/* Tags */}
                            {
                                ticket.tags && ticket.tags.length > 0 && (
                                    <div>
                                        <label className="text-xs text-muted-foreground font-semibold">Tags</label>
                                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                                            {ticket.tags.map((tag: string) => (
                                                <span key={tag} className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                )
                            }
                        </div >

                        {/* Timestamps */}
                        < div className="bg-card rounded-xl border-2 border-gray-200 shadow-sm p-5 space-y-2" >
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                Created {new Date(ticket.createdAt).toLocaleString()}
                            </div>
                            {
                                ticket.updatedAt !== ticket.createdAt && (
                                    <div className="text-xs text-muted-foreground">
                                        Updated {new Date(ticket.updatedAt).toLocaleString()}
                                    </div>
                                )
                            }
                            {
                                ticket.resolvedAt && (
                                    <div className="text-xs text-emerald-600 flex items-center gap-2">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Resolved {new Date(ticket.resolvedAt).toLocaleString()}
                                    </div>
                                )
                            }
                        </div >
                    </div >
                </div >
            </div >

            {/* ─── Close Reason Modal ─────────────────────── */}
            {
                showCloseModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-card rounded-2xl border border-border/30 shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-border/30 bg-slate-50 flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center">
                                    <Lock className="h-4 w-4 text-slate-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground">Close Ticket</h3>
                                    <p className="text-xs text-muted-foreground">Please provide a reason for closing this ticket</p>
                                </div>
                                <button onClick={() => { setShowCloseModal(false); setClosingReason(''); }} className="ml-auto p-1.5 rounded-lg hover:bg-accent transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-sm font-semibold text-foreground block mb-1.5">
                                        Closing Reason <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={closingReason}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setClosingReason(e.target.value)}
                                        rows={4}
                                        placeholder="Describe why this ticket is being closed..."
                                        className="w-full px-4 py-3 rounded-xl border border-border/50 bg-background text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 outline-none resize-y min-h-[100px]"
                                        autoFocus
                                    />
                                    {closingReason.trim().length === 0 && (
                                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" /> A closing reason is required
                                        </p>
                                    )}
                                </div>

                                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                                    <p className="text-xs text-amber-800 font-medium flex items-center gap-1.5">
                                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                        Once closed, only administrators and the ticket creator can add comments.
                                    </p>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 border-t border-border/30 bg-accent/20 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => { setShowCloseModal(false); setClosingReason(''); }}
                                    className="px-4 py-2 rounded-lg border border-border/50 text-sm font-semibold text-muted-foreground hover:bg-accent transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCloseWithReason}
                                    disabled={!closingReason.trim() || closingSubmitting}
                                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white text-sm font-bold shadow-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    <Lock className="h-3.5 w-3.5" />
                                    {closingSubmitting ? 'Closing...' : 'Close Ticket'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ─── Reopen Reason Modal ───────────────────── */}
            {
                showReopenModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-card rounded-2xl border border-border/30 shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-border/30 bg-blue-50 flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
                                    <RefreshCw className="h-4 w-4 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground">Reopen Ticket</h3>
                                    <p className="text-xs text-muted-foreground">Please provide a reason for reopening this ticket</p>
                                </div>
                                <button onClick={() => { setShowReopenModal(false); setReopenReason(''); }} className="ml-auto p-1.5 rounded-lg hover:bg-accent transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-sm font-semibold text-foreground block mb-1.5">
                                        Reopen Reason <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={reopenReason}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReopenReason(e.target.value)}
                                        rows={4}
                                        placeholder="Describe why this ticket is being reopened..."
                                        className="w-full px-4 py-3 rounded-xl border border-border/50 bg-background text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 outline-none resize-y min-h-[100px]"
                                        autoFocus
                                    />
                                    {reopenReason.trim().length === 0 && (
                                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" /> A reopen reason is required
                                        </p>
                                    )}
                                </div>

                                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                                    <p className="text-xs text-blue-800 font-medium flex items-center gap-1.5">
                                        <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                                        The ticket will be set back to <strong className="ml-0.5">Open</strong> status and comments will be re-enabled.
                                    </p>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 border-t border-border/30 bg-accent/20 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => { setShowReopenModal(false); setReopenReason(''); }}
                                    className="px-4 py-2 rounded-lg border border-border/50 text-sm font-semibold text-muted-foreground hover:bg-accent transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReopenWithReason}
                                    disabled={!reopenReason.trim() || reopenSubmitting}
                                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm font-bold shadow-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    {reopenSubmitting ? 'Reopening...' : 'Reopen Ticket'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
}
