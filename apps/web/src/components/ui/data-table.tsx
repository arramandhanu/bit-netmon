'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
    key: string;
    header: string;
    sortable?: boolean;
    className?: string;
    render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    searchKey?: string;
    searchPlaceholder?: string;
    pageSize?: number;
    onRowClick?: (row: T) => void;
    emptyMessage?: string;
}

export function DataTable<T extends Record<string, any>>({
    data,
    columns,
    searchKey,
    searchPlaceholder = 'Search...',
    pageSize = 15,
    onRowClick,
    emptyMessage = 'No data found',
}: DataTableProps<T>) {
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(0);

    const filtered = useMemo(() => {
        let result = data;
        if (search && searchKey) {
            const q = search.toLowerCase();
            result = result.filter((row) => {
                const val = row[searchKey];
                return val && String(val).toLowerCase().includes(q);
            });
        }
        if (sortKey) {
            result = [...result].sort((a, b) => {
                const av = a[sortKey];
                const bv = b[sortKey];
                if (av === bv) return 0;
                const cmp = av < bv ? -1 : 1;
                return sortDir === 'asc' ? cmp : -cmp;
            });
        }
        return result;
    }, [data, search, searchKey, sortKey, sortDir]);

    const totalPages = Math.ceil(filtered.length / pageSize);
    const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Search */}
            {searchKey && (
                <div className="p-4 border-b border-border">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                            placeholder={searchPlaceholder}
                            className="h-9 w-full rounded-lg border border-input bg-background/50 pl-10 pr-4 text-sm outline-none ring-ring transition-shadow placeholder:text-muted-foreground focus:ring-2"
                        />
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/30">
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={cn(
                                        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                                        col.sortable && 'cursor-pointer select-none hover:text-foreground transition-colors',
                                        col.className,
                                    )}
                                    onClick={() => col.sortable && handleSort(col.key)}
                                >
                                    <div className="flex items-center gap-1">
                                        {col.header}
                                        {col.sortable && sortKey === col.key && (
                                            sortDir === 'asc'
                                                ? <ChevronUp className="h-3.5 w-3.5" />
                                                : <ChevronDown className="h-3.5 w-3.5" />
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {paged.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            paged.map((row, idx) => (
                                <tr
                                    key={idx}
                                    onClick={() => onRowClick?.(row)}
                                    className={cn(
                                        'transition-colors hover:bg-muted/30',
                                        onRowClick && 'cursor-pointer',
                                    )}
                                >
                                    {columns.map((col) => (
                                        <td key={col.key} className={cn('px-4 py-3', col.className)}>
                                            {col.render ? col.render(row) : row[col.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                        Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage(Math.max(0, page - 1))}
                            disabled={page === 0}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent disabled:opacity-30 transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            const p = page < 3 ? i : page - 2 + i;
                            if (p >= totalPages) return null;
                            return (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={cn(
                                        'flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors',
                                        p === page ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
                                    )}
                                >
                                    {p + 1}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                            disabled={page >= totalPages - 1}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent disabled:opacity-30 transition-colors"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
