// ─── ViewSkeleton ───
// Consistent loading placeholders so switching tabs / refetching never shows a
// blank area — the skeleton blocks out the layout, signals "something's
// coming", and doesn't jump once real content arrives.

import { Skeleton } from '@/components/ui/skeleton';

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-meta-card border border-border bg-card p-4 space-y-2"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-2 w-full" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      className="rounded-meta-card border border-border bg-card overflow-hidden"
      aria-hidden="true"
    >
      <div className="px-4 py-2 border-b border-border">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div
      className="rounded-meta-card border border-border bg-card p-4 space-y-3"
      style={{ minHeight: height + 48 }}
      aria-hidden="true"
    >
      <Skeleton className="h-4 w-32" />
      <Skeleton style={{ height }} className="w-full" />
    </div>
  );
}

export function ViewSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando conteúdo">
      <CardsSkeleton count={4} />
      <ChartSkeleton height={280} />
      <TableSkeleton rows={6} />
    </div>
  );
}
