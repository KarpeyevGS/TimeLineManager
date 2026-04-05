import { useState, useCallback, useEffect, useRef } from 'react';
import type { DateRange } from 'react-day-picker';
import type { Task } from '../../../store';

interface DragState {
  taskId: string;
  startX: number;
  startDate: Date;
  endDate: Date;
  groupIds: Set<string>;
  groupOriginalSnapshots: Map<string, Task>;
}

interface ResizeState {
  taskId: string;
  side: 'left' | 'right';
  startX: number;
  startDate: Date;
  endDate: Date;
  taskSnapshot: Task;
}

interface UseTaskDragResizeParams {
  dayWidth: number;
  dateRange: DateRange | undefined;
  editingTaskId: string | null;
  getAllTasks: () => Task[];
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  batchUpdateTasks: (updates: { taskId: string; updates: Partial<Task> }[]) => void;
  selectedTaskIds: Set<string>;
  setSelectedTaskIds: (ids: Set<string>) => void;
}

interface UseTaskDragResizeResult {
  dragState: DragState | null;
  resizeState: ResizeState | null;
  dragPreviews: Map<string, Task>;
  dragMoved: boolean;
  suppressClickRef: React.MutableRefObject<boolean>;
  handleTaskMouseDown: (e: React.MouseEvent, task: Task) => void;
  handleResizeMouseDown: (e: React.MouseEvent, task: Task, side: 'left' | 'right') => void;
}

export const useTaskDragResize = ({
  dayWidth,
  dateRange,
  editingTaskId,
  getAllTasks,
  updateTask,
  batchUpdateTasks,
  selectedTaskIds,
  setSelectedTaskIds,
}: UseTaskDragResizeParams): UseTaskDragResizeResult => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [dragPreviews, setDragPreviews] = useState<Map<string, Task>>(new Map());
  const [dragMoved, setDragMoved] = useState(false);
  const suppressClickRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against redundant re-renders when pixel delta hasn't crossed a day boundary
  const lastDaysDeltaRef = useRef<number | null>(null);
  // Mirrors dragPreviews so handleMouseUp doesn't re-subscribe listeners on every move
  const dragPreviewsRef = useRef<Map<string, Task>>(new Map());

  const handleTaskMouseDown = useCallback((e: React.MouseEvent, task: Task) => {
    if (e.button !== 0) return;
    if (e.ctrlKey) return;
    if (editingTaskId === task.id) return;
    if (task.fix) return;
    // Второй mousedown двойного клика — отменяем drag и даём dblclick сработать
    if (e.detail >= 2) {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      setDragState(null);
      setDragMoved(false);
      setDragPreviews(new Map());
      return;
    }
    e.preventDefault();
    suppressClickRef.current = false;
    lastDaysDeltaRef.current = null;
    setDragMoved(false);

    holdTimerRef.current = setTimeout(() => setDragMoved(true), 100);

    const allTasks = getAllTasks();

    let groupIds: Set<string>;
    if (selectedTaskIds.has(task.id) && selectedTaskIds.size > 1) {
      groupIds = new Set(selectedTaskIds);
    } else {
      groupIds = new Set([task.id]);
      setSelectedTaskIds(new Set([task.id]));
    }

    const groupOriginalSnapshots = new Map<string, Task>();
    for (const id of groupIds) {
      const t = allTasks.find(t => t.id === id);
      if (t && !t.fix) groupOriginalSnapshots.set(id, t);
    }

    setDragState({
      taskId: task.id,
      startX: e.clientX,
      startDate: task.startDate,
      endDate: task.endDate,
      groupIds,
      groupOriginalSnapshots,
    });
  }, [editingTaskId, selectedTaskIds, setSelectedTaskIds, getAllTasks]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, task: Task, side: 'left' | 'right') => {
    if (e.button !== 0) return;
    if (task.fix) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClickRef.current = false;
    lastDaysDeltaRef.current = null;
    setDragMoved(false);
    holdTimerRef.current = setTimeout(() => setDragMoved(true), 100);
    setResizeState({
      taskId: task.id,
      side,
      startX: e.clientX,
      startDate: task.startDate,
      endDate: task.endDate,
      taskSnapshot: task,
    });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragState && dateRange?.from) {
      const deltaX = e.clientX - dragState.startX;
      const daysDelta = Math.round(deltaX / dayWidth);

      if (Math.abs(deltaX) > 3) {
        suppressClickRef.current = true;
        setDragMoved(true);
      }
      if (daysDelta === lastDaysDeltaRef.current) return;
      lastDaysDeltaRef.current = daysDelta;

      const previews = new Map<string, Task>();
      for (const [id, origTask] of dragState.groupOriginalSnapshots) {
        const newStartDate = new Date(origTask.startDate);
        const newEndDate = new Date(origTask.endDate);
        newStartDate.setDate(newStartDate.getDate() + daysDelta);
        newEndDate.setDate(newEndDate.getDate() + daysDelta);
        previews.set(id, { ...origTask, startDate: newStartDate, endDate: newEndDate });
      }
      dragPreviewsRef.current = previews;
      setDragPreviews(previews);
    } else if (resizeState && dateRange?.from) {
      const deltaX = e.clientX - resizeState.startX;
      const daysDelta = Math.round(deltaX / dayWidth);

      if (Math.abs(deltaX) > 3) {
        suppressClickRef.current = true;
        setDragMoved(true);
      }
      if (daysDelta === lastDaysDeltaRef.current) return;
      lastDaysDeltaRef.current = daysDelta;

      const taskSnapshot = resizeState.taskSnapshot;
      if (resizeState.side === 'right') {
        const newEndDate = new Date(resizeState.endDate);
        newEndDate.setDate(newEndDate.getDate() + daysDelta);
        if (newEndDate >= resizeState.startDate) {
          const previews = new Map([[resizeState.taskId, { ...taskSnapshot, endDate: newEndDate }]]);
          dragPreviewsRef.current = previews;
          setDragPreviews(previews);
        }
      } else {
        const newStartDate = new Date(resizeState.startDate);
        newStartDate.setDate(newStartDate.getDate() + daysDelta);
        if (newStartDate <= resizeState.endDate) {
          const previews = new Map([[resizeState.taskId, { ...taskSnapshot, startDate: newStartDate }]]);
          dragPreviewsRef.current = previews;
          setDragPreviews(previews);
        }
      }
    }
  }, [dragState, resizeState, dateRange, dayWidth]);

  const handleMouseUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    const previews = dragPreviewsRef.current;
    if (dragState && previews.size > 0) {
      if (previews.size === 1) {
        const [id, preview] = [...previews][0];
        updateTask(id, { startDate: preview.startDate, endDate: preview.endDate });
      } else {
        batchUpdateTasks([...previews].map(([taskId, preview]) => ({
          taskId,
          updates: { startDate: preview.startDate, endDate: preview.endDate },
        })));
      }
    } else if (resizeState && previews.size > 0) {
      const preview = previews.get(resizeState.taskId);
      if (preview) {
        updateTask(resizeState.taskId, { startDate: preview.startDate, endDate: preview.endDate });
      }
    }

    dragPreviewsRef.current = new Map();
    setDragState(null);
    setResizeState(null);
    setDragPreviews(new Map());
    setDragMoved(false);
  }, [dragState, resizeState, updateTask, batchUpdateTasks]);

  useEffect(() => {
    if (!dragState && !resizeState) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, resizeState, handleMouseMove, handleMouseUp]);

  return { dragState, resizeState, dragPreviews, dragMoved, suppressClickRef, handleTaskMouseDown, handleResizeMouseDown };
};
