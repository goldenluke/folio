import { useMemo, useState, type JSX, type KeyboardEvent, type ReactNode } from 'react';

export interface VirtualWindow {
  readonly start: number;
  readonly end: number;
  readonly totalHeight: number;
}

/** Computes the slice of a fixed-height collection which is currently visible. */
export const virtualWindow = (
  total: number,
  scrollTop: number,
  viewportHeight: number,
  itemHeight: number,
  overscan = 5,
): VirtualWindow => {
  const start = Math.min(total, Math.max(0, Math.floor(scrollTop / itemHeight) - overscan));
  const visible = Math.ceil(viewportHeight / itemHeight) + overscan * 2;
  return { start, end: Math.min(total, start + visible), totalHeight: total * itemHeight };
};

/** Keyboard scroll semantics shared by every virtualized collection. */
export const virtualScrollTarget = (
  key: string,
  scrollTop: number,
  totalHeight: number,
  viewportHeight: number,
  itemHeight: number,
): number | undefined => {
  const page = Math.max(itemHeight, viewportHeight - itemHeight);
  if (key === 'ArrowDown') return scrollTop + itemHeight;
  if (key === 'ArrowUp') return Math.max(0, scrollTop - itemHeight);
  if (key === 'PageDown') return scrollTop + page;
  if (key === 'PageUp') return Math.max(0, scrollTop - page);
  if (key === 'Home') return 0;
  if (key === 'End') return Math.max(0, totalHeight - viewportHeight);
  return undefined;
};

export function VirtualizedList<Item>({
  ariaLabel,
  className = '',
  height,
  viewportHeight,
  itemHeight,
  items,
  getKey,
  renderItem,
  overscan,
}: {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly height: number | string;
  /** Required when CSS, rather than a pixel value, controls the visible height. */
  readonly viewportHeight?: number;
  readonly itemHeight: number;
  readonly items: readonly Item[];
  readonly getKey: (item: Item, index: number) => string;
  readonly renderItem: (item: Item, index: number) => ReactNode;
  readonly overscan?: number;
}): JSX.Element {
  const [scrollTop, setScrollTop] = useState(0);
  const numericHeight = typeof height === 'number' ? height : viewportHeight ?? 520;
  const window = useMemo(
    () => virtualWindow(items.length, scrollTop, numericHeight, itemHeight, overscan),
    [itemHeight, items.length, numericHeight, overscan, scrollTop],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const target = virtualScrollTarget(event.key, event.currentTarget.scrollTop, window.totalHeight, numericHeight, itemHeight);
    if (target === undefined) return;
    event.preventDefault();
    event.currentTarget.scrollTo({ top: target, behavior: 'auto' });
  };

  return <div role="list" aria-label={ariaLabel} tabIndex={0} className={`overflow-y-auto ${className}`} style={{ height }} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)} onKeyDown={onKeyDown}>
    <div style={{ height: window.totalHeight, position: 'relative' }}>
      {items.slice(window.start, window.end).map((item, offset) => {
        const index = window.start + offset;
        return <div role="listitem" key={getKey(item, index)} className="absolute left-0 w-full" style={{ top: index * itemHeight, height: itemHeight }}>{renderItem(item, index)}</div>;
      })}
    </div>
  </div>;
}
