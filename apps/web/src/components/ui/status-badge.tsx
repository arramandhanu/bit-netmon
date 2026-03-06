import { cn } from '@/lib/utils';

type StatusType = 'up' | 'down' | 'active' | 'inactive' | 'warning' | 'unknown' | 'info' | 'critical' | 'acknowledged' | 'resolved' | 'triggered';

const config: Record<StatusType, { bg: string; text: string; dot: string }> = {
    up: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    down: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
    active: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    inactive: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
    warning: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
    unknown: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
    info: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
    critical: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
    acknowledged: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
    resolved: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    triggered: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500 animate-pulse' },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
    const cfg = config[status as StatusType] || config.info;
    return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide', cfg.bg, cfg.text, className)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
            {status}
        </span>
    );
}
