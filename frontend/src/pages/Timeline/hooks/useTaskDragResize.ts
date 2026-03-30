import { useState, useCallback, useEffect, useRef } from 'react';
import type { DateRange } from 'react-day-picker';
import type { Task } from '../../../store';

interface DragState {
  taskId: string;
  startX: number;
  startDate: Date;
  endDate: Date;
  groupIds: Set<string>;
  groupOriginalDates: Map<string, { startDate: Date; endDate: Date }>;
}

interface ResizeState {
  taskId: string;
  side: 'left' | 'right';
  startX: number;
  startDate: Date;
  endDate: Date;
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
  // Флаг: мышь двигалась во время drag — подавляем следующий click
  const suppressClickRef = useRef(false);
  // Таймер анимации зажатия (250ms)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTaskMouseDown = useCallback((e: React.MouseEvent, task: Task) => {
    if (e.button !== 0) return;
    if (e.ctrlKey) return;
    if (editingTaskId === task.id) return;
    if (task.fix) return;
    e.preventDefault();
    suppressClickRef.current = false;
    setDragMoved(false);

    // Показываем анимацию зажатия через 250ms (без движения)
    holdTimerRef.current = setTimeout(() => setDragMoved(true), 100);

    const allTasks = getAllTasks();

    let groupIds: Set<string>;
    if (selectedTaskIds.has(task.id) && selectedTaskIds.size > 1) {
      groupIds = new Set(selectedTaskIds);
    } else {
      groupIds = new Set([task.id]);
      setSelectedTaskIds(new Set([task.id]));
    }

    const groupOriginalDates = new Map<string, { startDate: Date; endDate: Date }>();
    for (const id of groupIds) {
      const t = allTasks.find(t => t.id === id);
      if (t && !t.fix) {
        groupOriginalDates.set(id, { startDate: t.startDate, endDate: t.endDate });
      }
    }

    setDragState({
      taskId: task.id,
      startX: e.clientX,
      startDate: task.startDate,
      endDate: task.endDate,
      groupIds,
      groupOriginalDates,
    });
  }, [editingTaskId, selectedTaskIds, setSelectedTaskIds, getAllTasks]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, task: Task, side: 'left' | 'right') => {
    if (e.button !== 0) return;
    if (task.fix) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClickRef.current = false;
    setDragMoved(false);
    holdTimerRef.current = setTimeout(() => setDragMoved(true), 100);
    setResizeState({
      taskId: task.id,
      side,
      startX: e.clientX,
      startDate: task.startDate,
      endDate: task.endDate,
    });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const allTasks = getAllTasks();
    if (dragState && dateRange?.from) {
      const deltaX = e.clientX - dragState.startX;
      const daysDelta = Math.round(deltaX / dayWidth);

      if (Math.abs(deltaX) > 3) {
        suppressClickRef.current = true;
        setDragMoved(true);
      }

      const previews = new Map<string, Task>();
      for (const [id, orig] of dragState.groupOriginalDates) {
        const t = allTasks.find(t => t.id === id);
        if (t) {
          const newStartDate = new Date(orig.startDate);
          const newEndDate = new Date(orig.endDate);
          newStartDate.setDate(newStartDate.getDate() + daysDelta);
          newEndDate.setDate(newEndDate.getDate() + daysDelta);
          previews.set(id, { ...t, startDate: newStartDate, endDate: newEndDate });
        }
      }
      setDragPreviews(previews);
    } else if (resizeState && dateRange?.from) {
      const deltaX = e.clientX - resizeState.startX;
      const daysDelta = Math.round(deltaX / dayWidth);

      if (Math.abs(deltaX) > 3) {
        suppressClickRef.current = true;
        setDragMoved(true);
      }

      const taskToUpdate = allTasks.find(t => t.id === resizeState.taskId);
      if (taskToUpdate) {
        if (resizeState.side === 'right') {
          const newEndDate = new Date(resizeState.endDate);
          newEndDate.setDate(newEndDate.getDate() + daysDelta);
          if (newEndDate >= resizeState.startDate) {
            setDragPreviews(new Map([[resizeState.taskId, { ...taskToUpdate, endDate: newEndDate }]]));
          }
        } else {
          const newStartDate = new Date(resizeState.startDate);
          newStartDate.setDate(newStartDate.getDate() + daysDelta);
          if (newStartDate <= resizeState.endDate) {
            setDragPreviews(new Map([[resizeState.taskId, { ...taskToUpdate, startDate: newStartDate }]]));
          }
        }
      }
    }
  }, [dragState, resizeState, dateRange, dayWidth, getAllTasks]);

  const handleMouseUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (dragState && dragPreviews.size > 0) {
      if (dragPreviews.size === 1) {
        const [id, preview] = [...dragPreviews][0];
        updateTask(id, { startDate: preview.startDate, endDate: preview.endDate });
      } else {
        batchUpdateTasks([...dragPreviews].map(([taskId, preview]) => ({
          taskId,
          updates: { startDate: preview.startDate, endDate: preview.endDate },
        })));
      }
    } else if (resizeState && dragPreviews.size > 0) {
      const preview = dragPreviews.get(resizeState.taskId);
      if (preview) {
        updateTask(resizeState.taskId, { startDate: preview.startDate, endDate: preview.endDate });
      }
    }

    setDragState(null);
    setResizeState(null);
    setDragPreviews(new Map());
    setDragMoved(false);
  }, [dragPreviews, dragState, resizeState, updateTask, batchUpdateTasks]);

  useEffect(() => {
    if (!dragState && !resizeState) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, resizeState, dayWidth, dateRange, handleMouseMove, handleMouseUp]);

  return { dragState, resizeState, dragPreviews, dragMoved, suppressClickRef, handleTaskMouseDown, handleResizeMouseDown };
};
