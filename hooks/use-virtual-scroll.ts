"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const OVERSCAN_PX = 560;
const FALLBACK_ROW_HEIGHT = 180;
const MIN_ROW_HEIGHT = 48;

type VirtualWindow = {
  start: number;
  end: number;
  paddingTop: number;
  paddingBottom: number;
};

type Options = {
  itemCount: number;
  enabled: boolean;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  getItemId: (index: number) => string;
};

/**
 * Lightweight virtual scroll — tracks measured row heights and computes
 * which slice of items should be rendered based on the current scroll position.
 */
export function useVirtualScroll({ itemCount, enabled, viewportRef, getItemId }: Options) {
  const heightsRef = useRef<Map<string, number>>(new Map());
  const rafRef = useRef<number | null>(null);
  const [window_, setWindow] = useState<VirtualWindow>({ start: 0, end: 0, paddingTop: 0, paddingBottom: 0 });

  const getMeasuredHeight = useCallback(
    (id: string) => heightsRef.current.get(id) ?? FALLBACK_ROW_HEIGHT,
    []
  );

  const compute = useCallback((): VirtualWindow => {
    const total = itemCount;
    if (!enabled) return { start: 0, end: total, paddingTop: 0, paddingBottom: 0 };
    if (!total) return { start: 0, end: 0, paddingTop: 0, paddingBottom: 0 };

    const viewport = viewportRef.current;
    if (!viewport) return { start: Math.max(0, total - 12), end: total, paddingTop: 0, paddingBottom: 0 };

    const targetTop = Math.max(0, viewport.scrollTop - OVERSCAN_PX);
    const targetBottom = viewport.scrollTop + viewport.clientHeight + OVERSCAN_PX;

    let start = 0;
    let offset = 0;
    while (start < total) {
      const h = getMeasuredHeight(getItemId(start));
      if (offset + h >= targetTop) break;
      offset += h;
      start += 1;
    }

    let end = start;
    let rendered = 0;
    while (end < total && offset + rendered <= targetBottom) {
      rendered += getMeasuredHeight(getItemId(end));
      end += 1;
    }
    if (end <= start) {
      end = Math.min(total, start + 1);
    }

    let remaining = 0;
    for (let i = end; i < total; i += 1) {
      remaining += getMeasuredHeight(getItemId(i));
    }

    return { start, end, paddingTop: offset, paddingBottom: remaining };
  }, [enabled, getMeasuredHeight, getItemId, itemCount, viewportRef]);

  const sync = useCallback(() => {
    const next = compute();
    setWindow((cur) => {
      if (
        cur.start === next.start &&
        cur.end === next.end &&
        Math.abs(cur.paddingTop - next.paddingTop) < 1 &&
        Math.abs(cur.paddingBottom - next.paddingBottom) < 1
      ) {
        return cur;
      }
      return next;
    });
  }, [compute]);

  const scheduleSync = useCallback(() => {
    if (!enabled || rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      sync();
    });
  }, [enabled, sync]);

  const onRowHeightChange = useCallback(
    (id: string, height: number) => {
      const next = Math.max(MIN_ROW_HEIGHT, Math.round(height));
      if (heightsRef.current.get(id) === next) return;
      heightsRef.current.set(id, next);
      scheduleSync();
    },
    [scheduleSync]
  );

  const clearStaleHeights = useCallback(
    (activeIds: Set<string>) => {
      for (const id of Array.from(heightsRef.current.keys())) {
        if (!activeIds.has(id)) heightsRef.current.delete(id);
      }
    },
    []
  );

  const resetHeights = useCallback(() => {
    heightsRef.current.clear();
    setWindow({ start: 0, end: 0, paddingTop: 0, paddingBottom: 0 });
  }, []);

  // Sync on item count / enabled changes.
  useLayoutEffect(() => {
    sync();
  }, [itemCount, enabled, sync]);

  // Observe viewport resize.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !enabled) return;
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => scheduleSync());
      observer.observe(viewport);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", scheduleSync);
    return () => window.removeEventListener("resize", scheduleSync);
  }, [enabled, scheduleSync, viewportRef]);

  // Cleanup on unmount.
  useEffect(
    () => () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    },
    []
  );

  const renderStart = enabled ? Math.min(itemCount, Math.max(0, window_.start)) : 0;
  const renderEnd = enabled ? Math.min(itemCount, Math.max(renderStart, window_.end)) : itemCount;

  return {
    renderStart,
    renderEnd,
    paddingTop: enabled ? Math.max(0, Math.round(window_.paddingTop)) : 0,
    paddingBottom: enabled ? Math.max(0, Math.round(window_.paddingBottom)) : 0,
    onRowHeightChange,
    onScroll: scheduleSync,
    clearStaleHeights,
    resetHeights,
    syncNow: sync,
  };
}
