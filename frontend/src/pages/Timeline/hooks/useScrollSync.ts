import React, { useEffect, useLayoutEffect, useCallback } from 'react';
import { saveTimelineViewState, loadTimelineViewState } from '../../../store';

interface UseScrollSyncParams {
  sidebarRef: React.RefObject<HTMLDivElement | null>;
  timelineRef: React.RefObject<HTMLDivElement | null>;
  timeHeaderRef: React.RefObject<HTMLDivElement | null>;
  frozenTimelineRef: React.RefObject<HTMLDivElement | null>;
  scrollbarRef: React.RefObject<HTMLDivElement | null>;
  frozenRowsCount: number;
  initialScrollLeft: number;
}

interface UseScrollSyncResult {
  syncFromTimeline: () => void;
  syncFromScrollbar: () => void;
  syncFromSidebar: () => void;
  syncFromFrozenTimeline: () => void;
}

export const useScrollSync = ({
  sidebarRef,
  timelineRef,
  timeHeaderRef,
  frozenTimelineRef,
  scrollbarRef,
  frozenRowsCount,
  initialScrollLeft,
}: UseScrollSyncParams): UseScrollSyncResult => {
  const isSyncing = React.useRef(false);
  const scrollSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore horizontal scroll on mount
  useEffect(() => {
    if (initialScrollLeft > 0) {
      if (scrollbarRef.current) scrollbarRef.current.scrollLeft = initialScrollLeft;
      if (timelineRef.current) timelineRef.current.scrollLeft = initialScrollLeft;
      if (timeHeaderRef.current) timeHeaderRef.current.scrollLeft = initialScrollLeft;
      if (frozenTimelineRef.current) frozenTimelineRef.current.scrollLeft = initialScrollLeft;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync frozen timeline scrollLeft when frozen section appears/changes
  useLayoutEffect(() => {
    if (frozenRowsCount > 0 && frozenTimelineRef.current) {
      const sl = scrollbarRef.current?.scrollLeft ?? timelineRef.current?.scrollLeft ?? 0;
      frozenTimelineRef.current.scrollLeft = sl;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozenRowsCount]);

  const syncFromTimeline = useCallback(() => {
    if (isSyncing.current) return;
    const tl = timelineRef.current;
    const sb = sidebarRef.current;
    if (!tl || !sb || sb.scrollTop === tl.scrollTop) return;
    isSyncing.current = true;
    sb.scrollTop = tl.scrollTop;
    requestAnimationFrame(() => { isSyncing.current = false; });
  }, [sidebarRef, timelineRef]);

  const syncFromScrollbar = useCallback(() => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    const sb = scrollbarRef.current;
    if (timelineRef.current && sb) timelineRef.current.scrollLeft = sb.scrollLeft;
    if (timeHeaderRef.current && sb) timeHeaderRef.current.scrollLeft = sb.scrollLeft;
    if (frozenTimelineRef.current && sb) frozenTimelineRef.current.scrollLeft = sb.scrollLeft;
    requestAnimationFrame(() => { isSyncing.current = false; });

    if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
    scrollSaveTimer.current = setTimeout(() => {
      if (scrollbarRef.current) {
        saveTimelineViewState({ ...loadTimelineViewState(), scrollLeft: scrollbarRef.current.scrollLeft });
      }
    }, 300);
  }, [scrollbarRef, timelineRef, timeHeaderRef, frozenTimelineRef]);

  const syncFromSidebar = useCallback(() => {
    if (isSyncing.current) return;
    const tl = timelineRef.current;
    const sb = sidebarRef.current;
    if (!tl || !sb || tl.scrollTop === sb.scrollTop) return;
    isSyncing.current = true;
    tl.scrollTop = sb.scrollTop;
    requestAnimationFrame(() => { isSyncing.current = false; });
  }, [sidebarRef, timelineRef]);

  const syncFromFrozenTimeline = useCallback(() => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    const ft = frozenTimelineRef.current;
    if (scrollbarRef.current && ft) scrollbarRef.current.scrollLeft = ft.scrollLeft;
    if (timelineRef.current && ft) timelineRef.current.scrollLeft = ft.scrollLeft;
    if (timeHeaderRef.current && ft) timeHeaderRef.current.scrollLeft = ft.scrollLeft;
    isSyncing.current = false;
  }, [scrollbarRef, timelineRef, timeHeaderRef, frozenTimelineRef]);

  return { syncFromTimeline, syncFromScrollbar, syncFromSidebar, syncFromFrozenTimeline };
};
