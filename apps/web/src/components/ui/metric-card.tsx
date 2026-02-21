import { cn } from '@/lib/utils';

export function MetricCard({
    label,
    value,
    icon: Icon,
    trend,
    trendUp,
    className,
}: {
    label: string;
    value: string | number;
    icon?: React.ElementType;
    trend?: string;
    trendUp?: boolean;
    className?: string;
}) {
    return (
        <div className={cn('rounded-xl border border-border bg-card p-5', className)}>
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                {Icon && (
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <Icon className="h-4 w-4" />
                    </div>
                )}
            </div>
            <p className="text-2xl font-bold mt-2 tracking-tight">{value}</p>
            {trend && (
                <p className={cn('text-xs mt-1', trendUp ? 'text-emerald-400' : 'text-red-400')}>
                    {trendUp ? '↑' : '↓'} {trend}
                </p>
            )}
        </div>
    );
}
