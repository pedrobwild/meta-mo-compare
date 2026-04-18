// ─── VirtualList ───
// Thin wrapper around @tanstack/react-virtual for the common case of a
// vertically scrolling list of fixed (or estimated) height rows. Keeps the
// DOM light by rendering only the visible slice, plus an overscan buffer.
//
// Use this when a list may grow past ~100 rows. For smaller lists, a plain
// `items.map(...)` is fine and avoids the height-measurement overhead.

import { useRef, type ReactNode, type CSSProperties } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

export interface VirtualListProps<T> {
  items: T[];
  rowHeight: number;
  /** Render function for a single row; receives the item + its index. */
  renderRow: (item: T, index: number) => ReactNode;
  /** Unique key per row — enables correct React reconciliation. */
  getKey: (item: T, index: number) => string;
  /** Max height of the scroll container, in px or any CSS length. */
  height: number | string;
  className?: string;
  overscan?: number;
  style?: CSSProperties;
  /** Optional header rendered above the virtualized rows (non-virtualized). */
  header?: ReactNode;
  /** Optional footer rendered below the virtualized rows (non-virtualized). */
  footer?: ReactNode;
}

export function VirtualList<T>({
  items,
  rowHeight,
  renderRow,
  getKey,
  height,
  className,
  overscan = 8,
  style,
  header,
  footer,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  const totalSize = virtualizer.getTotalSize();
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
      style={{ height, ...style }}
    >
      {header}
      <div
        style={{
          height: `${totalSize}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((vi) => {
          const item = items[vi.index];
          return (
            <div
              key={getKey(item, vi.index)}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vi.start}px)`,
              }}
            >
              {renderRow(item, vi.index)}
            </div>
          );
        })}
      </div>
      {footer}
    </div>
  );
}
