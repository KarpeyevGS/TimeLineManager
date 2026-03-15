import React, { useState, useCallback, useEffect } from 'react';
import {
  useSensors, useSensor, PointerSensor,
  type DragEndEvent, type DragMoveEvent,
} from '@dnd-kit/core';
import { verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { TimelineParameter } from '../../../store';

type DropScenario = 'above' | 'below';

interface UseParamDnDParams {
  parameters: TimelineParameter[];
  selectedTimelineId: string;
  setDragActiveId: (id: string | null) => void;
  setDragLevelDelta: (delta: number) => void;
  reorderAndReparent: (configId: string, activeId: string, overId: string, newLevel: number, newParentId: string | undefined) => void;
  insertAfter: (configId: string, activeId: string, overId: string, newLevel: number, newParentId: string | undefined) => void;
}

interface UseParamDnDResult {
  dndSensors: ReturnType<typeof useSensors>;
  dropScenario: DropScenario | null;
  dropTargetId: string | null;
  activeDescendantsRef: React.MutableRefObject<Set<string>>;
  handleParamDragStart: (activeId: string) => void;
  handleParamDragEnd: (event: DragEndEvent) => void;
  handleParamDragOver: (event: DragMoveEvent) => void;
  handleParamDragMove: (event: DragMoveEvent) => void;
  dndSortingStrategy: typeof verticalListSortingStrategy;
}

export const useParamDnD = ({
  parameters,
  selectedTimelineId,
  setDragActiveId,
  setDragLevelDelta,
  reorderAndReparent,
  insertAfter,
}: UseParamDnDParams): UseParamDnDResult => {
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [dropState, setDropState] = useState<{ scenario: DropScenario | null; targetId: string | null }>(
    { scenario: null, targetId: null }
  );
  const dropScenario = dropState.scenario;
  const dropTargetId = dropState.targetId;

  const dropScenarioRef = React.useRef<DropScenario | null>(null);
  const dropTargetIdRef = React.useRef<string | null>(null);
  const pointerYRef = React.useRef(0);
  const overRectRef = React.useRef<{ top: number; height: number } | null>(null);
  const overIdRef = React.useRef<string | null>(null);
  const activeDescendantsRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    const handler = (e: MouseEvent) => { pointerYRef.current = e.clientY; };
    document.addEventListener('mousemove', handler, { passive: true });
    return () => document.removeEventListener('mousemove', handler);
  }, []);

  const dndSortingStrategy = useCallback(
    (args: Parameters<typeof verticalListSortingStrategy>[0]) => {
      return verticalListSortingStrategy(args);
    },
    []
  );

  const setScenario = useCallback((s: DropScenario | null, targetId: string | null) => {
    if (dropScenarioRef.current === s && dropTargetIdRef.current === targetId) return;
    dropScenarioRef.current = s;
    dropTargetIdRef.current = targetId;
    setDropState({ scenario: s, targetId });
  }, []);

  const updateDropScenario = useCallback((
    overId: string,
    overRect: { top: number; height: number },
    activeId: string,
  ) => {
    if (overId === activeId) { setScenario(null, null); return; }

    if (!parameters.find(p => p.id === activeId) || !parameters.find(p => p.id === overId)) {
      setScenario(null, null); return;
    }

    const relY = (pointerYRef.current - overRect.top) / overRect.height;

    if (relY < 0.50) {
      setScenario('above', overId);
    } else {
      setScenario('below', overId);
    }
  }, [parameters, setScenario]);

  const handleParamDragStart = useCallback((activeId: string) => {
    setDragActiveId(activeId);
    setDragLevelDelta(0);
    setScenario(null, null);
    const descendants = new Set<string>();
    const walk = (pid: string) => {
      parameters.forEach(p => { if (p.parentId === pid) { descendants.add(p.id); walk(p.id); } });
    };
    walk(activeId);
    activeDescendantsRef.current = descendants;
  }, [parameters, setDragActiveId, setDragLevelDelta, setScenario]);

  const getVisualRect = (id: string, fallback: { top: number; height: number }) => {
    const el = document.querySelector(`[data-param-id="${id}"]`) as HTMLElement | null;
    if (el) {
      const vr = el.getBoundingClientRect();
      return { top: vr.top, height: vr.height };
    }
    return fallback;
  };

  const handleParamDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const scenario = dropScenario;
    const targetId = dropTargetId;

    setDragActiveId(null);
    setDragLevelDelta(0);
    setScenario(null, null);
    overIdRef.current = null;
    overRectRef.current = null;
    activeDescendantsRef.current = new Set();

    if (!over || !targetId) return;
    const activeId = active.id as string;
    if (activeId === targetId) return;

    if (scenario === 'above') {
      const targetParam = parameters.find(p => p.id === targetId);
      if (!targetParam) return;
      reorderAndReparent(
        selectedTimelineId, activeId, targetId,
        targetParam.level, targetParam.parentId
      );
    } else if (scenario === 'below') {
      const targetParam = parameters.find(p => p.id === targetId);
      if (!targetParam) return;
      insertAfter(
        selectedTimelineId, activeId, targetId,
        targetParam.level, targetParam.parentId
      );
    }
  }, [dropScenario, dropTargetId, selectedTimelineId, reorderAndReparent, insertAfter, parameters, setScenario, setDragActiveId, setDragLevelDelta]);

  const handleParamDragOver = useCallback((event: DragMoveEvent) => {
    if (!event.over) { setScenario(null, null); return; }
    const overId = event.over.id as string;
    overIdRef.current = overId;
    const visualRect = getVisualRect(overId, event.over.rect);
    overRectRef.current = visualRect;
    updateDropScenario(overId, visualRect, event.active.id as string);
  }, [updateDropScenario, setScenario]);

  const handleParamDragMove = useCallback((event: DragMoveEvent) => {
    if (!overIdRef.current) return;
    const el = document.querySelector(`[data-param-id="${overIdRef.current}"]`) as HTMLElement | null;
    if (el) {
      const vr = el.getBoundingClientRect();
      overRectRef.current = { top: vr.top, height: vr.height };
    }
    if (!overRectRef.current) return;
    updateDropScenario(overIdRef.current, overRectRef.current, event.active.id as string);
  }, [updateDropScenario]);

  return {
    dndSensors,
    dropScenario,
    dropTargetId,
    activeDescendantsRef,
    handleParamDragStart,
    handleParamDragEnd,
    handleParamDragOver,
    handleParamDragMove,
    dndSortingStrategy,
  };
};
