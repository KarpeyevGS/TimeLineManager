import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DateRange } from 'react-day-picker';
import {
  format,
  eachDayOfInterval,
  getWeek,
  startOfWeek,
  isWeekend,
  isToday
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { Plus, Minus, Pin } from 'lucide-react';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { TaskModal } from './TaskModal';
import { ParameterModal } from './ParameterModal';
import { useAppStore, type Task, type TimelineParameter } from '../../store';

interface ContextMenuState {
  x: number;
  y: number;
  paramId: string;  // ← Теперь строка (ID параметра)
}

interface TimelineRowMenuState {
  x: number;
  y: number;
  paramId: string;  // ← Теперь строка (ID параметра)
  date: Date;
}

interface TaskModalState {
  mode: 'add' | 'edit';
  task?: Task;
  paramId?: string;  // ← Теперь строка (ID параметра)
  initialDate?: Date;
}

interface ParameterModalState {
  isOpen: boolean;
}

const ZOOM_OPTIONS = ['2W', '3W', 'M', 'Q', '2Q'];
const ZOOM_CONFIG: Record<number, number> = {
  0: 120, // 2W
  1: 80,  // 3W
  2: 56,  // M
  3: 18,  // Q
  4: 9,   // 2Q
};

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

export const TimelinePage: React.FC = () => {
  console.log('📊 TimelinePage rendering');
  // Store
  const store = useAppStore();
  console.log('🎯 Store initialized:', store);

  // Рефы
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const timelineRef = React.useRef<HTMLDivElement>(null);
  const timeHeaderRef = React.useRef<HTMLDivElement>(null);
  const frozenTimelineRef = React.useRef<HTMLDivElement>(null);
  const isSyncing = React.useRef(false);
  const contextMenuRef = React.useRef<HTMLDivElement>(null);
  const timelineRowMenuRef = React.useRef<HTMLDivElement>(null);

  // Состояния
  const [zoomIndex, setZoomIndex] = React.useState(2);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(2026, 0, 1),
    to: new Date(2026, 0, 31),
  });
  // Выбранная конфигурация timeline — берём первую из store
  const selectedTimelineId = store.appData.timelineConfigs?.[0]?.id ?? 'timeline_default';
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [frozenIds, setFrozenIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [timelineRowMenu, setTimelineRowMenu] = useState<TimelineRowMenuState | null>(null);
  const [taskModal, setTaskModal] = useState<TaskModalState | null>(null);
  const [parameterModal, setParameterModal] = useState<ParameterModalState>({ isOpen: false });
  const [dragPreview, setDragPreview] = useState<Task | null>(null);

  const dayWidth = ZOOM_CONFIG[zoomIndex] || 56;

  // Загружаем конфигурацию выбранной timeline
  const timelineConfig = useMemo(
    () => store.timelines.getConfig(selectedTimelineId),
    [store.appData.timelineConfigs, selectedTimelineId]
  );

  // Параметры текущей timeline
  const PARAMETERS = useMemo(() => timelineConfig?.parameters ?? [], [timelineConfig]);

  // Группируем задачи по параметрам
  const tasksGroupedByParam = useMemo(
    () => store.timelines.groupTasksForTimeline(selectedTimelineId),
    [store.appData.tasks, store.appData.timelineConfigs, selectedTimelineId]
  );

  // Вычисляемые данные для иерархии
  const parentIds = useMemo(
    () => new Set(PARAMETERS.filter(p => p.parentId !== undefined).map(p => p.parentId!)),
    [PARAMETERS]
  );

  const visibleRows = useMemo(() => {
    return PARAMETERS.filter(p => {
      let cur = p.parentId;
      while (cur !== undefined) {
        if (collapsedIds.has(cur)) return false;
        cur = PARAMETERS.find(x => x.id === cur)?.parentId;
      }
      return true;
    });
  }, [PARAMETERS, collapsedIds]);

  const frozenRows = useMemo(
    () => visibleRows.filter(p => frozenIds.has(p.id)),
    [visibleRows, frozenIds]
  );

  const scrollableRows = useMemo(
    () => visibleRows.filter(p => !frozenIds.has(p.id)),
    [visibleRows, frozenIds]
  );

  // Проверка перекрытия двух задач
  const tasksOverlap = (task1: Task, task2: Task): boolean => {
    return !(task1.endDate < task2.startDate || task2.endDate < task1.startDate);
  };

  // Применяем dragPreview к задачам если идет перетаскивание
  const getDisplayTasks = useCallback((paramTasks: Task[]): Task[] => {
    if (!dragPreview) return paramTasks;
    return paramTasks.map(t => t.id === dragPreview.id ? dragPreview : t);
  }, [dragPreview]);

  // Распределение задач по слоям (для стекирования при перекрытии)
  const getTaskLayers = (paramId: string): Task[][] => {
    const paramTasks = tasksGroupedByParam.get(paramId) ?? [];
    const displayTasks = getDisplayTasks(paramTasks);
    const layers: Task[][] = [];

    displayTasks.forEach(task => {
      let placed = false;

      for (let i = 0; i < layers.length; i++) {
        const canPlace = !layers[i].some(t => tasksOverlap(task, t));
        if (canPlace) {
          layers[i].push(task);
          placed = true;
          break;
        }
      }

      if (!placed) {
        layers.push([task]);
      }
    });

    return layers;
  };

  // Расчет позиции и ширины задачи
  const getTaskBarPosition = (task: Task) => {
    if (!dateRange?.from || !dateRange?.to) return null;

    const taskStart = task.startDate;
    const taskEnd = task.endDate;
    const rangeStart = dateRange.from;
    const rangeEnd = dateRange.to;

    // Если задача полностью вне диапазона
    if (taskEnd < rangeStart || taskStart > rangeEnd) {
      return null;
    }

    // Вычисляем смещение от начала диапазона
    const effectiveStart = taskStart < rangeStart ? rangeStart : taskStart;
    const effectiveEnd = taskEnd > rangeEnd ? rangeEnd : taskEnd;

    const daysFromRangeStart = Math.floor((effectiveStart.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
    const taskDurationDays = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return {
      left: daysFromRangeStart * dayWidth,
      width: Math.max(taskDurationDays * dayWidth, 20), // Минимальная ширина 20px
    };
  };

  // Динамический расчет дней на основе диапазона
  const { days, totalWidth, weeks, months, quarters, startOffsetDays } = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return { days: [], totalWidth: 0, weeks: [], months: [], quarters: [], startOffsetDays: 0 };
    }

    const allDays = eachDayOfInterval({
      start: dateRange.from,
      end: dateRange.to,
    });

    const daysCount = allDays.length;

    // Расчет смещения первого дня относительно начала его недели (для синхронизации градиента)
    const firstDay = allDays[0];
    const startOfFirstWeek = startOfWeek(firstDay, { weekStartsOn: 1 });
    const startOffsetDays = Math.floor((firstDay.getTime() - startOfFirstWeek.getTime()) / (1000 * 60 * 60 * 24));

    // Группировка по неделям
    const weekMap = new Map();
    allDays.forEach(day => {
      const startOfWk = startOfWeek(day, { weekStartsOn: 1 });
      const wNumber = getWeek(day, { weekStartsOn: 1, locale: ru });
      const year = startOfWk.getFullYear();
      const key = `W${wNumber}-${year}-${startOfWk.getTime()}`;

      if (!weekMap.has(key)) {
        weekMap.set(key, {
          number: wNumber,
          months: new Set([format(day, 'LLLL', { locale: ru })]),
          daysCount: 0,
          year: year
        });
      } else {
        weekMap.get(key).months.add(format(day, 'LLLL', { locale: ru }));
      }
      weekMap.get(key).daysCount += 1;
    });

    // Группировка по месяцам для верхней строки
    const monthMap = new Map();
    allDays.forEach(day => {
      const monthKey = format(day, 'yyyy-MM');
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          year: day.getFullYear(),
          monthName: format(day, 'LLLL', { locale: ru }),
          daysCount: 0
        });
      }
      monthMap.get(monthKey).daysCount += 1;
    });

    // Группировка по кварталам для верхней строки (режим 2Q)
    const quarterMap = new Map();
    allDays.forEach(day => {
      const quarter = Math.floor(day.getMonth() / 3) + 1;
      const year = day.getFullYear();
      const key = `Q${quarter}-${year}`;
      if (!quarterMap.has(key)) {
        quarterMap.set(key, {
          year,
          quarter,
          daysCount: 0
        });
      }
      quarterMap.get(key).daysCount += 1;
    });

    return {
      days: allDays,
      totalWidth: daysCount * dayWidth,
      weeks: Array.from(weekMap.values()).map(w => ({
        ...w,
        monthLabel: Array.from(w.months).join('/')
      })),
      months: Array.from(monthMap.values()),
      quarters: Array.from(quarterMap.values()),
      startOffsetDays
    };
  }, [dateRange, dayWidth]);

  // Синхронизация скролла
  const syncFromTimeline = () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    const tl = timelineRef.current;
    if (sidebarRef.current && tl) sidebarRef.current.scrollTop = tl.scrollTop;
    if (timeHeaderRef.current && tl) timeHeaderRef.current.scrollLeft = tl.scrollLeft;
    if (frozenTimelineRef.current && tl) frozenTimelineRef.current.scrollLeft = tl.scrollLeft;
    isSyncing.current = false;
  };

  const syncFromSidebar = () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    if (timelineRef.current && sidebarRef.current) {
      timelineRef.current.scrollTop = sidebarRef.current.scrollTop;
    }
    isSyncing.current = false;
  };

  const syncFromFrozenTimeline = () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    const ft = frozenTimelineRef.current;
    if (timelineRef.current && ft) timelineRef.current.scrollLeft = ft.scrollLeft;
    if (timeHeaderRef.current && ft) timeHeaderRef.current.scrollLeft = ft.scrollLeft;
    isSyncing.current = false;
  };

  // Управление состоянием иерархии
  const toggleCollapse = (id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Получить всех потомков параметра (рекурсивно)
  const getAllDescendants = (paramId: string): string[] => {
    const descendants: string[] = [];
    const traverse = (pid: string) => {
      PARAMETERS.filter(p => p.parentId === pid).forEach(child => {
        descendants.push(child.id);
        traverse(child.id);
      });
    };
    traverse(paramId);
    return descendants;
  };

  const toggleFreeze = (id: string) => {
    setFrozenIds(prev => {
      const next = new Set(prev);
      const allDescendants = getAllDescendants(id);
      const allRelated = [id, ...allDescendants];

      if (next.has(id)) {
        // Открепляем этот параметр и всех его потомков
        allRelated.forEach(paramId => next.delete(paramId));
      } else {
        // Закрепляем этот параметр и всех его потомков
        allRelated.forEach(paramId => next.add(paramId));
      }
      return next;
    });
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, paramId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, paramId });
  };

  // ПКМ по пустой ячейке timeline — меню «Добавить задачу»
  const handleTimelineRowContextMenu = (e: React.MouseEvent, paramId: string) => {
    e.preventDefault();
    const containerLeft = timelineRef.current?.getBoundingClientRect().left ?? 0;
    const scrollLeft = timelineRef.current?.scrollLeft ?? 0;
    const clickX = e.clientX - containerLeft + scrollLeft;
    const dayOffset = Math.max(0, Math.floor(clickX / dayWidth));
    const clickDate = new Date(dateRange?.from ?? new Date());
    clickDate.setDate(clickDate.getDate() + dayOffset);
    setTimelineRowMenu({ x: e.clientX, y: e.clientY, paramId, date: clickDate });
  };

  // ПКМ по task-бару — открывает Edit modal напрямую
  const handleTaskBarContextMenu = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();
    setTaskModal({ mode: 'edit', task });
  };

  // Сохранение задачи (add / edit)
  const handleSaveTask = (data: Omit<Task, 'id'> & { id?: string }) => {
    if (taskModal?.mode === 'edit' && data.id) {
      store.tasks.update(data.id, data);
    } else {
      store.tasks.add(data);
    }
    setTaskModal(null);
  };

  // Удаление задачи из Edit modal
  const handleDeleteTask = () => {
    if (taskModal?.task) {
      store.tasks.delete(taskModal.task.id);
    }
    setTaskModal(null);
  };

  // Сохранение параметра
  const handleSaveParameter = (parameter: Omit<TimelineParameter, 'id'>) => {
    console.log('💾 Saving parameter:', parameter);
    if (Object.keys(parameter.filters).length === 0) {
      console.warn('⚠️ Parameter has no filters, rejecting');
      return;
    }
    store.timelines.addParameter(selectedTimelineId, parameter);
    setParameterModal({ isOpen: false });
    console.log('✅ Parameter saved and modal closed');
  };

  // Обработчики drag and drop
  const handleTaskMouseDown = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    setDragState({
      taskId: task.id,
      startX: e.clientX,
      startDate: task.startDate,
      endDate: task.endDate,
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, task: Task, side: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    setResizeState({
      taskId: task.id,
      side,
      startX: e.clientX,
      startDate: task.startDate,
      endDate: task.endDate,
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const allTasks = store.tasks.getAll();
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
  }, [dragState, resizeState, dateRange, dayWidth, store.tasks]);

  const handleMouseUp = useCallback(() => {
    if (dragPreview && dragState) {
      store.tasks.update(dragState.taskId, {
        startDate: dragPreview.startDate,
        endDate: dragPreview.endDate,
      });
    } else if (dragPreview && resizeState) {
      store.tasks.update(resizeState.taskId, {
        startDate: dragPreview.startDate,
        endDate: dragPreview.endDate,
      });
    }
    setDragState(null);
    setResizeState(null);
    setDragPreview(null);
  }, [dragPreview, dragState, resizeState, store.tasks]);

  // Закрытие контекстных меню по клику вне
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
      if (timelineRowMenuRef.current && !timelineRowMenuRef.current.contains(event.target as Node)) {
        setTimelineRowMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Обработчики mouse events для drag and drop / resize
  useEffect(() => {
    if (!dragState && !resizeState) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, resizeState, dayWidth, dateRange, handleMouseMove, handleMouseUp]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Заголовок страницы - фиксирован */}
      <div className="px-4 py-2 bg-app-surface z-50 flex-shrink-0 border-b border-app-border flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-app-text-head">График Timeline</h2>
          <button
            onClick={() => {
              console.log('🔘 Параметр button clicked');
              setParameterModal({ isOpen: true });
            }}
            className="flex items-center gap-1.5 h-7 px-3 text-xs font-semibold rounded bg-app-primary text-white hover:bg-app-primary-hover transition-colors"
            title="Добавить новый параметр в timeline"
          >
            <Plus size={14} />
            Параметр
          </button>
        </div>

        <div className="flex items-center gap-6">
          {/* Календарь выбора диапазона */}
          <DateRangePicker range={dateRange} onRangeChange={setDateRange} />

          {/* Блок масштабирования */}
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max={ZOOM_OPTIONS.length - 1}
              step="1"
              value={zoomIndex}
              onChange={(e) => setZoomIndex(parseInt(e.target.value))}
              className="w-32 h-1.5 bg-app-border rounded-lg appearance-none cursor-pointer accent-app-primary"
            />
            <div className="bg-app-primary/10 rounded shadow-sm border border-app-primary/20 min-w-[36px] h-6 overflow-hidden relative">
              <div
                className="flex flex-col transition-transform duration-300 ease-in-out"
                style={{ transform: `translateY(-${zoomIndex * 24}px)` }}
              >
                {ZOOM_OPTIONS.map((opt) => (
                  <div key={opt} className="h-6 flex items-center justify-center text-[10px] font-bold text-app-primary">
                    {opt}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ШАПКА ДАТ + ПАРАМЕТРЫ (72px, flex-row, z-40) */}
      <div className="flex flex-row flex-shrink-0 border-b border-app-border bg-app-surface z-40">
        <div className="w-52 min-w-[13rem] flex-shrink-0 border-r border-app-border h-[72px] flex flex-col justify-between pl-2 font-semibold text-app-text-main py-2">
          <span>Параметры</span>
          {/* Кнопки уровней вложенности (как в Excel) */}
          <div className="flex items-center gap-1">
            {[0, 1].map((levelIdx) => {
              // Для каждой кнопки — родители на этом уровне
              const levelParents = PARAMETERS.filter(p => parentIds.has(p.id) && p.level === levelIdx).map(p => p.id);

              const isCollapsed = levelParents.some(id => collapsedIds.has(id));

              return (
                <button
                  key={levelIdx}
                  onClick={() => {
                    setCollapsedIds(prev => {
                      const next = new Set(prev);
                      if (isCollapsed) {
                        // Раскрыть: убрать всех родителей этого уровня (и ниже для видимости)
                        PARAMETERS.forEach(p => {
                          if (parentIds.has(p.id) && p.level <= levelIdx) {
                            next.delete(p.id);
                          }
                        });
                      } else {
                        // Свернуть: добавить родителей этого уровня
                        levelParents.forEach(id => next.add(id));
                      }
                      return next;
                    });
                  }}
                  className="w-4 h-4 flex items-center justify-center text-app-text-muted hover:text-app-primary transition-colors"
                  title={`Уровень ${levelIdx + 1}`}
                >
                  {isCollapsed ? <Plus size={10} /> : <Minus size={10} />}
                </button>
              );
            })}
          </div>
        </div>
        <div
          ref={timeHeaderRef}
          className="flex-1 overflow-auto hide-scrollbar h-[72px]"
        >
          <div style={{ width: totalWidth }} className="flex flex-col h-full">
            {/* Строка 1: Год или Квартал (в режиме 2Q) */}
            <div className="h-[24px] min-h-[24px] shadow-[inset_0_-1px_0_0_var(--color-app-border)] flex text-app-text-main bg-app-surface relative">
              {dayWidth < 12 ? (
                quarters.map((q, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: dayWidth * q.daysCount,
                      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    className="shadow-[inset_-1px_0_0_0_var(--color-app-border)] flex-shrink-0 flex items-center justify-center px-2 text-[10px] font-bold uppercase tracking-wider relative z-10"
                  >
                    {q.year}
                  </div>
                ))
              ) : (
                months.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: dayWidth * m.daysCount,
                      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    className="shadow-[inset_-1px_0_0_0_var(--color-app-border)] flex-shrink-0 flex items-center justify-center px-2 text-[10px] font-bold uppercase tracking-wider relative z-10"
                  >
                    {dayWidth < 40 ? (
                      <span className="flex gap-1">
                        <span>{m.monthName}</span>
                        <span>{m.year}</span>
                      </span>
                    ) : (
                      m.year
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Строка 2: Недели или Месяцы */}
            <div className="h-[24px] min-h-[24px] shadow-[inset_0_-1px_0_0_var(--color-app-border)] flex text-app-text-main bg-app-surface relative">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `linear-gradient(to right, var(--color-app-border) 1px, transparent 1px)`,
                  backgroundSize: `${dayWidth * 7}px 100%`,
                  backgroundPosition: `${-(startOffsetDays * dayWidth)}px 0`,
                  transition: 'background-size 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-position 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s',
                  opacity: dayWidth < 12 ? 0 : 0.4
                }}
              />
              {dayWidth < 12 ? (
                months.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: dayWidth * m.daysCount,
                      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    className="shadow-[inset_-1px_0_0_0_var(--color-app-border)] flex-shrink-0 flex items-center justify-center px-2 text-[10px] font-bold uppercase relative z-10"
                  >
                    {m.monthName}
                  </div>
                ))
              ) : (
                weeks.map((w, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: dayWidth * w.daysCount,
                      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    className="flex-shrink-0 flex items-center justify-center px-2 text-[10px] font-bold relative z-10"
                  >
                    W{w.number}
                    {dayWidth >= 40 && (
                      <span className="capitalize ml-1">— {w.monthLabel}</span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Строка 3: Дни или Номера недель */}
            <div className="h-[24px] min-h-[24px] shadow-[inset_0_-1px_0_0_var(--color-app-border)] flex text-app-text-main bg-app-surface relative">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `linear-gradient(to right, var(--color-app-border) 1px, transparent 1px)`,
                  backgroundSize: `${dayWidth < 12 ? dayWidth * 7 : dayWidth}px 100%`,
                  backgroundPosition: `${dayWidth < 12 ? -(startOffsetDays * dayWidth) : 0}px 0`,
                  opacity: 0.4
                }}
              />
              {dayWidth < 12 ? (
                weeks.map((w, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: dayWidth * w.daysCount,
                      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    className="flex-shrink-0 flex items-center justify-center text-[9px] font-bold bg-app-primary/5 relative z-10"
                  >
                    W{w.number}
                  </div>
                ))
              ) : (
                days.map((day, idx) => {
                  const isWknd = isWeekend(day);
                  const isTdy = isToday(day);

                  return (
                    <div
                      key={idx}
                      style={{
                        width: dayWidth,
                        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                      className={`flex-shrink-0 flex flex-col items-center justify-center text-[9px] leading-none relative z-10 ${
                        isTdy ? 'bg-pink-500/10 text-pink-600 font-black' :
                        isWknd ? 'bg-app-primary/10 text-app-primary font-bold' : ''
                      }`}
                    >
                      <span className={`font-bold ${dayWidth < 12 ? 'hidden' : ''}`}>{format(day, 'dd')}</span>
                      {dayWidth > 45 && (
                        <span className="text-[7px] opacity-70 uppercase">{format(day, 'eeeeee', { locale: ru })}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ЗАМОРОЖЕННЫЕ СТРОКИ (если есть) */}
      {frozenRows.length > 0 && (
        <div className="flex flex-row flex-shrink-0 border-b-2 border-app-primary/30 bg-app-surface">
          <div className="w-52 min-w-[13rem] flex-shrink-0 border-r border-app-border bg-app-surface">
            {frozenRows.map((param) => {
              const layers = getTaskLayers(param.id);
              const rowHeight = Math.max(24, layers.length * 24);

              return (
                <div
                  key={param.id}
                  className={`flex items-center gap-1 shadow-[0_1px_0_0_var(--color-app-border)] select-none hover:bg-app-bg/10 relative border-l-2 border-app-primary px-0 py-0`}
                  style={{
                    paddingLeft: `${4 + param.level * 16}px`,
                    height: `${rowHeight}px`,
                    minHeight: `${rowHeight}px`,
                  }}
                  onContextMenu={(e) => handleContextMenu(e, param.id)}
                >
                  {parentIds.has(param.id) ? (
                    <button
                      onClick={() => toggleCollapse(param.id)}
                      className="w-4 h-4 flex items-center justify-center text-app-text-muted hover:text-app-primary flex-shrink-0"
                    >
                      {collapsedIds.has(param.id) ? <Plus size={10} /> : <Minus size={10} />}
                    </button>
                  ) : (
                    <span className="w-4 flex-shrink-0" />
                  )}

                  <span className={`text-xs truncate flex-1 ${param.level === 0 ? 'font-bold text-app-text-head' : 'font-semibold text-app-text-main'}`}>
                    {param.name}
                  </span>

                  {/* Pin иконка для frozen параметров */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFreeze(param.id);
                    }}
                    className={`p-0.5 rounded flex-shrink-0 transition-colors ${
                      frozenIds.has(param.id)
                        ? 'bg-app-primary/20 text-app-primary opacity-100'
                        : 'opacity-0 hover:opacity-100 text-app-text-muted hover:text-app-primary hover:bg-app-primary/10'
                    }`}
                    title={frozenIds.has(param.id) ? 'Открепить' : 'Закрепить'}
                  >
                    <Pin size={12} />
                  </button>
                </div>
              );
            })}
          </div>
          <div
            ref={frozenTimelineRef}
            onScroll={syncFromFrozenTimeline}
            className="flex-1 overflow-auto hide-scrollbar"
          >
            <div style={{ width: totalWidth }} className="relative">
              {/* Слой вертикальных линий */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `linear-gradient(to right, var(--color-app-border) 1px, transparent 1px)`,
                  backgroundSize: `${dayWidth < 12 ? dayWidth * 7 : dayWidth}px 100%`,
                  backgroundPosition: `${dayWidth < 12 ? -(startOffsetDays * dayWidth) : 0}px 0`,
                  transition: 'background-size 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-position 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  opacity: 0.4
                }}
              />

              {/* Слой подсветки (выходные и сегодня) */}
              <div className="absolute inset-0 pointer-events-none flex">
                {dayWidth < 12 ? (
                  weeks.map((w, i) => {
                    const today = new Date();
                    const isCurrentWeek = w.number === getWeek(today, { weekStartsOn: 1, locale: ru }) && w.year === today.getFullYear();
                    return (
                      <div
                        key={i}
                        style={{ width: dayWidth * w.daysCount, transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        className={`flex-shrink-0 ${isCurrentWeek ? 'bg-pink-500/[0.08]' : ''}`}
                      />
                    );
                  })
                ) : (
                  days.map((day, i) => {
                    const isTdy = isToday(day);
                    const isWknd = isWeekend(day);
                    let bgColor = 'bg-transparent';
                    if (isTdy) bgColor = 'bg-pink-500/[0.08]';
                    else if (isWknd) bgColor = 'bg-app-primary/[0.08]';
                    return (
                      <div
                        key={i}
                        style={{ width: dayWidth, transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        className={`flex-shrink-0 ${bgColor}`}
                      />
                    );
                  })
                )}
              </div>

              {/* Строки frozen параметров */}
              <div className="relative z-10">
                {frozenRows.map((param) => {
                  const layers = getTaskLayers(param.id);
                  const rowHeight = Math.max(24, layers.length * 24);

                  return (
                    <div
                      key={param.id}
                      className={`shadow-[0_1px_0_0_var(--color-app-border)] w-full hover:bg-app-bg/10 relative ${
                        param.level === 0 ? 'bg-app-primary/5' : ''
                      }`}
                      style={{ height: `${rowHeight}px`, minHeight: `${rowHeight}px` }}
                      onContextMenu={(e) => handleTimelineRowContextMenu(e, param.id)}
                    >
                      {/* Задачи по слоям */}
                      {layers.map((layerTasks, layerIndex) =>
                        layerTasks.map(task => {
                          const position = getTaskBarPosition(task);
                          if (!position) return null;

                          const topOffset = layerIndex * 24 + 2;
                          const isDragging = dragState?.taskId === task.id;
                          const isResizing = resizeState?.taskId === task.id;

                          return (
                            <div
                              key={task.id}
                              onMouseDown={(e) => handleTaskMouseDown(e, task)}
                              onContextMenu={(e) => handleTaskBarContextMenu(e, task)}
                              className={`absolute h-[20px] bg-app-primary rounded-sm shadow-md text-white text-[10px] flex items-center font-medium transition-all select-none overflow-hidden ${
                                isDragging ? 'shadow-2xl opacity-75 scale-105 cursor-grabbing' :
                                isResizing ? 'shadow-2xl opacity-75 cursor-ew-resize' :
                                'hover:shadow-lg cursor-grab'
                              }`}
                              style={{
                                left: `${position.left}px`,
                                width: `${position.width}px`,
                                top: `${topOffset}px`,
                              }}
                              title={task.name}
                            >
                              <div
                                className="absolute left-0 top-0 h-full w-[5px] z-10 cursor-ew-resize hover:bg-white/30"
                                onMouseDown={(e) => handleResizeMouseDown(e, task, 'left')}
                              />
                              <span className="px-2 truncate w-full">{task.name}</span>
                              <div
                                className="absolute right-0 top-0 h-full w-[5px] z-10 cursor-ew-resize hover:bg-white/30"
                                onMouseDown={(e) => handleResizeMouseDown(e, task, 'right')}
                              />
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ПРОКРУЧИВАЕМЫЙ РАЗДЕЛ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ЛЕВАЯ ПАНЕЛЬ - ПАРАМЕТРЫ */}
        <div
          ref={sidebarRef}
          onScroll={syncFromSidebar}
          className="w-52 min-w-[13rem] flex-shrink-0 bg-app-surface border-r border-app-border flex flex-col overflow-y-auto overflow-x-hidden hide-scrollbar select-none"
        >
          <div className="min-w-[13rem]">
            {scrollableRows.map((param) => {
              const layers = getTaskLayers(param.id);
              const rowHeight = Math.max(24, layers.length * 24);

              return (
                <div
                  key={param.id}
                  className={`flex items-center gap-1 shadow-[0_1px_0_0_var(--color-app-border)] select-none hover:bg-app-bg/10 relative px-0 py-0 leading-none ${
                    param.level === 0 ? 'bg-app-primary/5' : ''
                  }`}
                  style={{
                    paddingLeft: `${4 + param.level * 16}px`,
                    height: `${rowHeight}px`,
                    minHeight: `${rowHeight}px`,
                  }}
                  onContextMenu={(e) => handleContextMenu(e, param.id)}
                >
                {parentIds.has(param.id) ? (
                  <button
                    onClick={() => toggleCollapse(param.id)}
                    className="w-4 h-4 flex items-center justify-center text-app-text-muted hover:text-app-primary flex-shrink-0"
                  >
                    {collapsedIds.has(param.id) ? <Plus size={10} /> : <Minus size={10} />}
                  </button>
                ) : (
                  <span className="w-4 flex-shrink-0" />
                )}

                  <span className={`text-xs truncate flex-1 ${param.level === 0 ? 'font-bold text-app-text-head' : 'font-semibold text-app-text-main'}`}>
                    {param.name}
                  </span>

                  {/* Pin иконка для freeze параметров */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFreeze(param.id);
                    }}
                    className={`p-0.5 rounded flex-shrink-0 transition-colors ${
                      frozenIds.has(param.id)
                        ? 'bg-app-primary/20 text-app-primary opacity-100'
                        : 'opacity-0 hover:opacity-100 text-app-text-muted hover:text-app-primary hover:bg-app-primary/10'
                    }`}
                    title={frozenIds.has(param.id) ? 'Открепить' : 'Закрепить'}
                  >
                    <Pin size={12} />
                  </button>
                </div>
              );
            })}
            {/* Компенсатор скроллбара */}
            <div className="h-[13px] min-h-[13px] w-full bg-app-surface shadow-[0_1px_0_0_var(--color-app-border)]" />
          </div>
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ - TIMELINE GRID */}
        <div
          ref={timelineRef}
          onScroll={syncFromTimeline}
          className="flex-1 overflow-auto bg-app-surface relative"
        >
          <div
            style={{
              width: totalWidth,
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            className="flex flex-col min-h-full relative"
          >
            {/* СЕТКА */}
            <div className="flex-1 relative bg-app-surface">
              {/* Слой вертикальных линий */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `linear-gradient(to right, var(--color-app-border) 1px, transparent 1px)`,
                  backgroundSize: `${dayWidth < 12 ? dayWidth * 7 : dayWidth}px 100%`,
                  backgroundPosition: `${dayWidth < 12 ? -(startOffsetDays * dayWidth) : 0}px 0`,
                  transition: 'background-size 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-position 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  opacity: 0.4
                }}
              />

              {/* Слой подсветки (выходные и сегодня) */}
              <div className="absolute inset-0 pointer-events-none flex">
                {dayWidth < 12 ? (
                  weeks.map((w, i) => {
                    const today = new Date();
                    const isCurrentWeek = w.number === getWeek(today, { weekStartsOn: 1, locale: ru }) && w.year === today.getFullYear();

                    return (
                      <div
                        key={i}
                        style={{
                          width: dayWidth * w.daysCount,
                          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        className={`flex-shrink-0 ${isCurrentWeek ? 'bg-pink-500/[0.08]' : ''}`}
                      />
                    );
                  })
                ) : (
                  days.map((day, i) => {
                    const isTdy = isToday(day);
                    const isWknd = isWeekend(day);

                    let bgColor = 'bg-transparent';
                    if (isTdy) bgColor = 'bg-pink-500/[0.08]';
                    else if (isWknd) bgColor = 'bg-app-primary/[0.08]';

                    return (
                      <div
                        key={i}
                        style={{
                          width: dayWidth,
                          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        className={`flex-shrink-0 ${bgColor}`}
                      />
                    );
                  })
                )}
              </div>

              {/* Строки параметров */}
              <div className="relative z-10">
                {scrollableRows.map((param) => {
                  const layers = getTaskLayers(param.id);
                  const rowHeight = Math.max(24, layers.length * 24);

                  return (
                    <div
                      key={param.id}
                      className={`shadow-[0_1px_0_0_var(--color-app-border)] w-full hover:bg-app-bg/10 relative ${
                        param.level === 0 ? 'bg-app-primary/5' : ''
                      }`}
                      style={{ height: `${rowHeight}px`, minHeight: `${rowHeight}px` }}
                      onContextMenu={(e) => handleTimelineRowContextMenu(e, param.id)}
                    >
                      {/* Задачи по слоям */}
                      {layers.map((layerTasks, layerIndex) =>
                        layerTasks.map(task => {
                          const position = getTaskBarPosition(task);
                          if (!position) return null;

                          const topOffset = layerIndex * 24 + 2;
                          const isDragging = dragState?.taskId === task.id;
                          const isResizing = resizeState?.taskId === task.id;

                          return (
                            <div
                              key={task.id}
                              onMouseDown={(e) => handleTaskMouseDown(e, task)}
                              onContextMenu={(e) => handleTaskBarContextMenu(e, task)}
                              className={`absolute h-[20px] bg-app-primary rounded-sm shadow-md text-white text-[10px] flex items-center font-medium transition-all select-none overflow-hidden ${
                                isDragging ? 'shadow-2xl opacity-75 scale-105 cursor-grabbing' :
                                isResizing ? 'shadow-2xl opacity-75 cursor-ew-resize' :
                                'hover:shadow-lg cursor-grab'
                              }`}
                              style={{
                                left: `${position.left}px`,
                                width: `${position.width}px`,
                                top: `${topOffset}px`,
                              }}
                              title={task.name}
                            >
                              <div
                                className="absolute left-0 top-0 h-full w-[5px] z-10 cursor-ew-resize hover:bg-white/30"
                                onMouseDown={(e) => handleResizeMouseDown(e, task, 'left')}
                              />
                              <span className="px-2 truncate w-full">{task.name}</span>
                              <div
                                className="absolute right-0 top-0 h-full w-[5px] z-10 cursor-ew-resize hover:bg-white/30"
                                onMouseDown={(e) => handleResizeMouseDown(e, task, 'right')}
                              />
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* КОНТЕКСТНОЕ МЕНЮ */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[200] bg-app-surface border border-app-border rounded-xl shadow-2xl py-1 min-w-[200px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => toggleFreeze(contextMenu.paramId)}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-app-text-main hover:bg-app-bg/50 transition-colors flex items-center gap-2"
          >
            <Pin size={12} />
            {frozenIds.has(contextMenu.paramId) ? 'Открепить строку' : 'Закрепить строку'}
          </button>
          {parentIds.has(contextMenu.paramId) && (
            <button
              onClick={() => {
                toggleCollapse(contextMenu.paramId);
                setContextMenu(null);
              }}
              className="w-full text-left px-4 py-2 text-xs font-semibold text-app-text-main hover:bg-app-bg/50 transition-colors flex items-center gap-2"
            >
              {collapsedIds.has(contextMenu.paramId) ? (
                <>
                  <Plus size={12} />
                  Развернуть группу
                </>
              ) : (
                <>
                  <Minus size={12} />
                  Свернуть группу
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* КОНТЕКСТНОЕ МЕНЮ СТРОКИ TIMELINE (добавить задачу) */}
      {timelineRowMenu && (
        <div
          ref={timelineRowMenuRef}
          className="fixed z-[200] bg-app-surface border border-app-border rounded-xl shadow-2xl py-1 min-w-[160px]"
          style={{ top: timelineRowMenu.y, left: timelineRowMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setTaskModal({ mode: 'add', paramId: timelineRowMenu.paramId, initialDate: timelineRowMenu.date });
              setTimelineRowMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-app-text-main hover:bg-app-bg/50 transition-colors flex items-center gap-2"
          >
            <Plus size={12} />
            Добавить задачу
          </button>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО ADD / EDIT TASK */}
      {taskModal && (
        <TaskModal
          mode={taskModal.mode}
          task={taskModal.task}
          paramId={taskModal.paramId}
          initialDate={taskModal.initialDate}
          customFieldTypes={store.customFieldTypes.getAll().map(t => t.name)}
          onSave={handleSaveTask}
          onDelete={taskModal.mode === 'edit' ? handleDeleteTask : undefined}
          onClose={() => setTaskModal(null)}
        />
      )}

      {/* МОДАЛЬНОЕ ОКНО ADD PARAMETER */}
      <ParameterModal
        isOpen={parameterModal.isOpen}
        existingParameters={PARAMETERS}
        availableTasks={store.appData.tasks}
        onSave={handleSaveParameter}
        onClose={() => {
          console.log('🚪 ParameterModal onClose called');
          setParameterModal({ isOpen: false });
        }}
      />
    </div>
  );
};
