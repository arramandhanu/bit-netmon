'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────── */

interface Toast {
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message?: string;
    duration?: number;
}

interface ToastContextValue {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/* ─── Hook ───────────────────────────────────────────────── */

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
    return ctx;
}

/* ─── Provider ───────────────────────────────────────────── */

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newToast: Toast = { ...toast, id };
        setToasts((prev) => [...prev, newToast]);

        // Auto dismiss
        const duration = toast.duration ?? (toast.type === 'error' ? 6000 : 4000);
        setTimeout(() => removeToast(id), duration);
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={removeToast} />
        </ToastContext.Provider>
    );
}

/* ─── Container & Item ───────────────────────────────────── */

const iconMap = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle,
};

const styleMap = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
};

const iconColorMap = {
    success: 'text-emerald-500',
    error: 'text-red-500',
    info: 'text-blue-500',
    warning: 'text-amber-500',
};

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
    if (toasts.length === 0) return null;
    return (
        <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-[380px] max-w-[calc(100vw-2rem)]">
            {toasts.map((toast) => {
                const Icon = iconMap[toast.type];
                return (
                    <div
                        key={toast.id}
                        className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm animate-slide-in ${styleMap[toast.type]}`}
                    >
                        <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${iconColorMap[toast.type]}`} />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{toast.title}</p>
                            {toast.message && (
                                <p className="text-xs mt-0.5 opacity-80">{toast.message}</p>
                            )}
                        </div>
                        <button
                            onClick={() => onDismiss(toast.id)}
                            className="flex-shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors"
                        >
                            <X className="h-4 w-4 opacity-50" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
