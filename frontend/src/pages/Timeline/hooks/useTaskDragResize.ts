import { useState, useCallback, useEffect } from 'react';
import type { DateRange } from 'react-day-picker';
import type { Task } from '../../../store';

interface DragState {
  taskId: string;
  startX: number;
  startDate: Date;
  endDate: Date;
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
}

interface UseTaskDragResizeResult {
  dragState: DragState | null;
  resizeState: ResizeState | null;
  dragPreview: Task | null;
  handleTaskMouseDown: (e: React.MouseEvent, task: Task) => void;
  handleResizeMouseDown: (e: React.MouseEvent, task: Task, side: 'left' | 'right') => void;
}

export const useTaskDragResize = ({
  dayWidth,
  dateRange,
  editingTaskId,
  getAllTasks,
  updateTask,
}: UseTaskDragResizeParams): UseTaskDragResizeResult => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [dragPreview, setDragPreview] = useState<Task | null>(null);

  const handleTaskMouseDown = useCallback((e: React.MouseEvent, task: Task) => {
    if (editingTaskId === task.id) return;
    if (task.fix) return;
    e.preventDefault();
    setDragState({
      taskId: task.id,
      startX: e.clientX,
      startDate: task.startDate,
      endDate: task.endDate,
    });
  }, [editingTaskId]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, task: Task, side: 'left' | 'right') => {
    if (task.fix) return;
    e.preventDefault();
    e.stopPropagation();
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

      const taskToUpdate = allTasks.find(t => t.id === dragState.taskId);
      if (taskToUpdate) {
        const newStartDate = new Date(dragState.startDate);
        const newEndDate = new Date(dragState.endDate);

        newStartDate.setDate(newStartDate.getDate() + daysDelta);
        newEndDate.setDate(newEndDate.getDate() + daysDelta);

        setDragPreview({ ...taskToUpdate, startDate: newStartDate, endDate: newEndDate });
      }
    } else if (resizeState && dateRange?.from) {
      const deltaX = e.clientX - resizeState.startX;
      const daysDelta = Math.round(deltaX / dayWidth);

      const taskToUpdate = allTasks.find(t => t.id === resizeState.taskId);
      if (taskToUpdate) {
        if (resizeState.side === 'right') {
          const newEndDate = new Date(resizeState.endDate);
          newEndDate.setDate(newEndDate.getDate() + daysDelta);
          if (newEndDate >= resizeState.startDate) {
            setDragPreview({ ...taskToUpdate, endDate: newEndDate });
          }
        } else {
          const newStartDate = new Date(resizeState.startDate);
          newStartDate.setDate(newStartDate.getDate() + daysDelta);
          if (newStartDate <= resizeState.endDate) {
            setDragPreview({ ...taskToUpdate, startDate: newStartDate });
          }
        }
      }
    }
  }, [dragState, resizeState, dateRange, dayWidth, getAllTasks]);

  const handleMouseUp = useCallback(() => {
    if (dragPreview && dragState) {
      updateTask(dragState.taskId, {
        startDate: dragPreview.startDate,
        endDate: dragPreview.endDate,
      });
    } else if (dragPreview && resizeState) {
      updateTask(resizeState.taskId, {
        startDate: dragPreview.startDate,
        endDate: dragPreview.endDate,
      });
    }
    setDragState(null);
    setResizeState(null);
    setDragPreview(null);
  }, [dragPreview, dragState, resizeState, updateTask]);

  useEffect(() => {
    if (!dragState && !resizeState) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, resizeState, dayWidth, dateRange, handleMouseMove, handleMouseUp]);

  return { dragState, resizeState, dragPreview, handleTaskMouseDown, handleResizeMouseDown };
};
