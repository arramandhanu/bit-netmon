'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Loader2, User, X, Upload, ChevronRight, Info,
    FileText, Image, Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { createTicket, fetchTeamMembers } from '@/hooks/use-tickets';
import { api } from '@/lib/api-client';

/* ─── Types ────────────────────────────────────────────── */

interface UserOption {
    id: number;
    username: string;
    displayName?: string;
    role: string;
}

/* ─── Component ────────────────────────────────────────── */

export default function CreateTicketPage() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // ─── Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('medium');
    const [category, setCategory] = useState('incident');
    const [deviceId, setDeviceId] = useState('');
    const [tags, setTags] = useState('');
    const [dueDate, setDueDate] = useState('');

    // ─── Assignee autocomplete
    const [users, setUsers] = useState<UserOption[]>([]);
    const [assigneeSearch, setAssigneeSearch] = useState('');
    const [selectedAssignee, setSelectedAssignee] = useState<UserOption | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // ─── File attachments
    const [files, setFiles] = useState<File[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch team members (same tenant only)
    useEffect(() => {
        fetchTeamMembers()
            .then(members => setUsers(members))
            .catch(() => { });
    }, []);

    // Close assignee dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filteredUsers = users.filter(u => {
        const q = assigneeSearch.toLowerCase();
        return u.username.toLowerCase().includes(q) || (u.displayName || '').toLowerCase().includes(q);
    });

    // File handling
    const handleFiles = useCallback((newFiles: FileList | null) => {
        if (!newFiles) return;
        const arr = Array.from(newFiles).filter(f => f.size <= 10 * 1024 * 1024); // 10MB max
        setFiles(prev => [...prev, ...arr]);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
    }, [handleFiles]);

    const removeFile = (idx: number) => {
        setFiles(prev => prev.filter((_, i) => i !== idx));
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) {
            setError('Title and description are required');
            return;
        }

        setSubmitting(true);
        setError('');
        try {
            const payload: any = {
                title: title.trim(),
                description: description.trim(),
                priority,
                category,
            };
            if (deviceId) payload.deviceId = Number(deviceId);
            if (selectedAssignee) payload.assigneeId = selectedAssignee.id;
            if (tags) payload.tags = tags.split(',').map((t: string) => t.trim()).filter(Boolean);
            if (dueDate) payload.dueDate = dueDate;

            const ticket = await createTicket(payload);

            // Upload attachments if any
            if (files.length > 0) {
                const formData = new FormData();
                files.forEach(f => formData.append('files', f));
                try {
                    await api.post(`/tickets/${ticket.id}/attachments`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                } catch {
                    // Attachments upload failed but ticket was created
                }
            }

            router.push(`/tickets/${ticket.id}`);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Failed to create ticket');
        } finally {
            setSubmitting(false);
        }
    };

    const priorityOptions = [
        { value: 'low', label: 'Low', color: 'bg-green-500' },
        { value: 'medium', label: 'Medium', color: 'bg-blue-500' },
        { value: 'high', label: 'High', color: 'bg-orange-500' },
        { value: 'critical', label: 'Critical', color: 'bg-red-500' },
    ];

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Link href="/dashboard" className="hover:text-primary">Dashboard</Link>
                <ChevronRight className="h-3 w-3" />
                <Link href="/tickets" className="hover:text-primary">Tickets</Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground">New Ticket</span>
            </nav>

            {/* Title */}
            <div>
                <h2 className="text-3xl font-extrabold tracking-tight">Create New Ticket</h2>
                <p className="mt-1 text-muted-foreground">Submit a support request to your team. If no assignee is selected, it will be auto-assigned to your team lead.</p>
            </div>

            {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive font-medium">
                    {error}
                </div>
            )}

            {/* 2-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ─── Main Form (2/3) ──────────────────────── */}
                <div className="lg:col-span-2 space-y-6">
                    {/* General Information */}
                    <div className="bg-card rounded-xl border border-border/30 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-border/30 bg-accent/30">
                            <h3 className="font-bold">General Information</h3>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold" htmlFor="title">Ticket Title</label>
                                <input
                                    id="title"
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Brief summary of the issue..."
                                    className="w-full px-4 py-3 rounded-lg border border-border/50 bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground text-sm"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold" htmlFor="description">Detailed Description</label>
                                <textarea
                                    id="description"
                                    rows={6}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Provide as much detail as possible. Include steps to reproduce if applicable."
                                    className="w-full px-4 py-3 rounded-lg border border-border/50 bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground text-sm resize-y"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold" htmlFor="deviceId">Device ID</label>
                                    <input
                                        id="deviceId"
                                        type="number"
                                        value={deviceId}
                                        onChange={(e) => setDeviceId(e.target.value)}
                                        placeholder="e.g. 1"
                                        className="w-full px-4 py-3 rounded-lg border border-border/50 bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold" htmlFor="tags">Tags</label>
                                    <input
                                        id="tags"
                                        type="text"
                                        value={tags}
                                        onChange={(e) => setTags(e.target.value)}
                                        placeholder="Press enter to add tags"
                                        className="w-full px-4 py-3 rounded-lg border border-border/50 bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Attachments */}
                    <div className="bg-card rounded-xl border border-border/30 shadow-sm p-6">
                        <h3 className="font-bold mb-4">Attachments</h3>

                        {/* Drop zone */}
                        <div
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${dragOver
                                ? 'border-primary bg-primary/5'
                                : 'border-border/50 hover:border-primary/50'
                                }`}
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors ${dragOver ? 'bg-primary/10 text-primary' : 'bg-accent text-muted-foreground'
                                }`}>
                                <Upload className="h-5 w-5" />
                            </div>
                            <p className="text-sm font-semibold">Click to upload or drag and drop</p>
                            <p className="text-xs text-muted-foreground mt-1">PNG, JPG, PDF up to 10MB</p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".png,.jpg,.jpeg,.gif,.pdf,.doc,.docx,.txt,.log"
                            onChange={(e) => handleFiles(e.target.files)}
                            className="hidden"
                        />

                        {/* File list */}
                        {files.length > 0 && (
                            <div className="mt-4 space-y-2.5">
                                {files.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border/30">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {file.type.startsWith('image/') ? (
                                                <Image className="h-4 w-4 text-blue-500 shrink-0" />
                                            ) : (
                                                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate">{file.name}</p>
                                                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeFile(idx)}
                                            className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── Sidebar Properties (1/3) ─────────────── */}
                <div className="space-y-6">
                    <div className="bg-card rounded-xl border border-border/30 shadow-sm p-6">
                        <h3 className="font-bold mb-6">Ticket Properties</h3>

                        <div className="space-y-6">
                            {/* Priority Level */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Priority Level</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {priorityOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setPriority(opt.value)}
                                            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${priority === opt.value
                                                ? opt.value === 'high' || opt.value === 'critical'
                                                    ? 'border-orange-300 bg-orange-50 text-orange-600 font-bold'
                                                    : 'border-primary/30 bg-primary/10 text-primary font-bold'
                                                : 'border-border/50 hover:border-primary/30'
                                                }`}
                                        >
                                            <span className={`h-2 w-2 rounded-full ${opt.color}`} />
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Category */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground" htmlFor="category">Category</label>
                                <select
                                    id="category"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-border/50 bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm appearance-none cursor-pointer"
                                >
                                    <option value="incident">Incident</option>
                                    <option value="problem">Problem</option>
                                    <option value="change_request">Change Request</option>
                                    <option value="maintenance">Maintenance</option>
                                    <option value="support_request">Support Request</option>
                                </select>
                            </div>

                            {/* Due Date */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground" htmlFor="dueDate">Due Date</label>
                                <input
                                    id="dueDate"
                                    type="date"
                                    value={dueDate}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDueDate(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-border/50 bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm cursor-pointer"
                                />
                            </div>

                            {/* Assignee */}
                            <div className="space-y-2" ref={dropdownRef}>
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assignee</label>
                                {selectedAssignee ? (
                                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/50 bg-background text-sm">
                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                            {(selectedAssignee.displayName || selectedAssignee.username)[0].toUpperCase()}
                                        </div>
                                        <span className="flex-1 truncate font-medium">
                                            {selectedAssignee.displayName || selectedAssignee.username}
                                        </span>
                                        <button type="button" onClick={() => { setSelectedAssignee(null); setAssigneeSearch(''); }} className="text-muted-foreground hover:text-foreground">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            value={assigneeSearch}
                                            onChange={(e) => { setAssigneeSearch(e.target.value); setShowDropdown(true); }}
                                            onFocus={() => setShowDropdown(true)}
                                            placeholder="Search users..."
                                            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border/50 bg-background text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        />
                                    </div>
                                )}

                                {showDropdown && !selectedAssignee && (
                                    <div className="absolute z-50 w-[calc(100%-3rem)] max-w-[280px] rounded-lg border border-border/50 bg-card shadow-lg max-h-48 overflow-y-auto mt-1">
                                        {filteredUsers.length === 0 ? (
                                            <div className="px-3 py-2.5 text-sm text-muted-foreground">No users found</div>
                                        ) : (
                                            filteredUsers.map((u) => (
                                                <button
                                                    key={u.id}
                                                    type="button"
                                                    onClick={() => { setSelectedAssignee(u); setAssigneeSearch(''); setShowDropdown(false); }}
                                                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left"
                                                >
                                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                                        {(u.displayName || u.username)[0].toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium truncate">{u.displayName || u.username}</div>
                                                        <div className="text-xs text-muted-foreground">{u.username} • {u.role}</div>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Cancel / Submit Buttons */}
                    <div className="flex gap-3">
                        <Link
                            href="/tickets"
                            className="flex-1 text-center px-5 py-2.5 rounded-lg border border-border/50 font-semibold text-muted-foreground hover:bg-accent transition-all text-sm"
                        >
                            Cancel
                        </Link>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="flex-1 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-600/20 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                        >
                            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                            Submit Ticket
                        </button>
                    </div>

                    {/* System Status Info */}
                    <div className="bg-primary/5 rounded-xl border border-primary/20 p-5">
                        <div className="flex items-center gap-3 mb-3 text-primary">
                            <Info className="h-5 w-5" />
                            <h4 className="font-bold">System Status</h4>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            All systems are currently <span className="text-emerald-600 font-bold">Operational</span>.
                            Estimated response time for high-priority tickets is <strong>2 hours</strong>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
