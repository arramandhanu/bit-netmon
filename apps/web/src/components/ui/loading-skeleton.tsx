'use client';

import { cn } from '@/lib/utils';

/** Base animated skeleton pulse */
export function Skeleton({ className }: { className?: string }) {
    return (
        <div className={cn('animate-pulse rounded-lg bg-muted', className)} />
    );
}

/** KPI metric card skeleton */
export function MetricCardSkeleton() {
    return (
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-32" />
        </div>
    );
}

/** Table row skeleton */
export function TableRowSkeleton({ columns = 6 }: { columns?: number }) {
    return (
        <div className="flex items-center gap-4 py-3 px-4 border-b border-border/30">
            {Array.from({ length: columns }).map((_, i) => (
                <Skeleton key={i} className="h-4 flex-1" />
            ))}
        </div>
    );
}

/** Full table skeleton with header + rows */
export function TableSkeleton({ rows = 8, columns = 6 }: { rows?: number; columns?: number }) {
    return (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="flex items-center gap-4 py-3 px-4 bg-muted/30 border-b border-border/50">
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={i} className="h-3 flex-1" />
                ))}
            </div>
            {Array.from({ length: rows }).map((_, i) => (
                <TableRowSkeleton key={i} columns={columns} />
            ))}
        </div>
    );
}

/** Card grid skeleton */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="space-y-1.5 flex-1">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                    <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
            ))}
        </div>
    );
}

/** Dashboard page skeleton */
export function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <MetricCardSkeleton key={i} />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
                    <Skeleton className="h-5 w-32" />
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </div>
                <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
                    <Skeleton className="h-5 w-32" />
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </div>
            </div>
        </div>
    );
}
