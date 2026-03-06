import { cn } from '@/lib/utils';

export function MetricCard({
    label,
    value,
    icon: Icon,
    iconBg,
    iconColor,
    trend,
    trendUp,
    detail,
    onClick,
    active,
    className,
}: {
    label: string;
    value: string | number;
    icon?: React.ElementType;
    iconBg?: string;
    iconColor?: string;
    trend?: string;
    trendUp?: boolean;
    detail?: string;
    onClick?: () => void;
    active?: boolean;
    className?: string;
}) {
    const Component = onClick ? 'button' : 'div';

    return (
        <Component
            onClick={onClick}
            className={cn(
                'rounded-xl border-2 border-gray-200 bg-white p-5 text-left transition-all',
                onClick && 'cursor-pointer hover:shadow-md hover:border-gray-300',
                active && 'ring-2 ring-blue-500/30 border-blue-400 bg-blue-50/30 shadow-md',
                className,
            )}
        >
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
                {Icon && (
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', iconBg || 'bg-blue-100')}>
                        <Icon className={cn('h-[18px] w-[18px]', iconColor || 'text-blue-600')} />
                    </div>
                )}
            </div>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {detail && (
                <p className="text-xs text-gray-500 mt-1">{detail}</p>
            )}
            {trend && (
                <p className={cn('text-xs mt-1 font-medium', trendUp ? 'text-emerald-600' : 'text-red-500')}>
                    {trendUp ? '↑' : '↓'} {trend}
                </p>
            )}
        </Component>
    );
}
