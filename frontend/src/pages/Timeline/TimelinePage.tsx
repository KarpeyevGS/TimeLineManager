import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
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
import { Plus, Minus, Pencil, Trash2, Copy, Globe, GripVertical, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';

const PinIcon: React.FC<{ size?: number; className?: string }> = ({ size = 12, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/>
  </svg>
);
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragMoveEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { TaskModal } from './TaskModal';
import { ParameterModal } from './ParameterModal';
import { useAppStore, useTimelineViewState, saveTimelineViewState, loadTimelineViewState, type Task, type TimelineParameter } from '../../store';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

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
  hasEmptyFilters?: boolean;  // ← Флаг для параметра без фильтров
  isGanttMode?: boolean;  // ← Создание задачи как Gantt-объекта (авто-строка)
}

interface ParameterModalState {
  isOpen: boolean;
  mode?: 'add' | 'edit';
  editingParameter?: TimelineParameter;
  defaultParentId?: string;
}

interface TaskContextMenuState {
  x: number;
  y: number;
  task: Task;
}

interface TooltipState {
  task: Task;
  x: number;        // left: horizontal center
  y: number;        // bottom (above) или top (below/inside) в px от края viewport
  placement: 'above' | 'below' | 'inside';
}

const ZOOM_OPTIONS = ['2W', '3W', 'M', 'Q', '2Q', '3Q', 'Y'];
const ZOOM_CONFIG: Record<number, number> = {
  0: 120, // 2W
  1: 80,  // 3W
  2: 56,  // M
  3: 18,  // Q
  4: 9,   // 2Q
  5: 6,   // 3Q
  6: 4,   // Y
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

interface TimelinePageProps {
  activeTimelineId?: string;
  timelineParameterModalOpen?: boolean;
  onTimelineParameterModalChange?: (open: boolean) => void;
}

// Иерархическая сортировка: родители перед детьми, порядок siblings сохраняется
const sortHierarchically = (params: TimelineParameter[]): TimelineParameter[] => {
  const idSet = new Set(params.map(p => p.id));
  const childrenOf = new Map<string, TimelineParameter[]>();
  const roots: TimelineParameter[] = [];

  for (const p of params) {
    if (p.parentId && idSet.has(p.parentId)) {
      if (!childrenOf.has(p.parentId)) childrenOf.set(p.parentId, []);
      childrenOf.get(p.parentId)!.push(p);
    } else {
      roots.push(p);
    }
  }

  const result: TimelineParameter[] = [];
  const walk = (node: TimelineParameter) => {
    result.push(node);
    (childrenOf.get(node.id) ?? []).forEach(walk);
  };
  roots.forEach(walk);
  return result;
};

// ===== SortableParamRow =====
interface SortableParamRowProps {
  param: TimelineParameter;
  rowHeight: number;
  isSelected: boolean;
  isParent: boolean;
  isCollapsed: boolean;
  isFrozen: boolean;
  previewLevel?: number;
  isDropTarget?: boolean;
  dropZone?: 'above' | 'below';
  onRowClick: (ctrlKey: boolean) => void;
  onToggleCollapse: () => void;
  onToggleFreeze: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const SortableParamRow: React.FC<SortableParamRowProps> = ({
  param, rowHeight, isSelected, isParent, isCollapsed, isFrozen,
  previewLevel,
  isDropTarget,
  dropZone,
  onRowClick, onToggleCollapse, onToggleFreeze, onContextMenu,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: param.id });

  const displayLevel = previewLevel ?? param.level;
  const levelChanged = isDragging && previewLevel !== undefined && previewLevel !== param.level;

  return (
    <div
      ref={setNodeRef}
      data-param-id={param.id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        paddingLeft: `${4 + displayLevel * 16}px`,
        height: `${rowHeight}px`,
        minHeight: `${rowHeight}px`,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : undefined,
      }}
      className={`group flex items-center gap-1 select-none relative px-0 py-0 leading-none
        ${isDropTarget && dropZone === 'above'
          ? 'border-t-2 border-app-primary shadow-[0_1px_0_0_var(--color-app-border)]'
          : isDropTarget && dropZone === 'below'
          ? 'border-b-2 border-app-primary shadow-[0_1px_0_0_var(--color-app-border)]'
          : 'shadow-[0_1px_0_0_var(--color-app-border)]'}
        ${levelChanged ? 'ring-1 ring-inset ring-app-accent' : ''}
        ${isSelected ? 'bg-app-accent/[0.12]' : displayLevel === 0 ? 'bg-app-primary/5 hover:bg-app-primary/10' : 'hover:bg-app-bg/10'}
      `}
      onClick={(e) => { e.stopPropagation(); onRowClick(e.ctrlKey); }}
      onContextMenu={onContextMenu}
    >
      {/* Drag handle — постоянно видимый */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 w-3 h-full flex items-center justify-center cursor-grab active:cursor-grabbing text-app-text-muted hover:text-app-primary transition-colors"
        title="Перетащить • горизонтально — изменить уровень вложенности"
      >
        {isDropTarget && dropZone === 'above' ? (
          <ArrowUp size={10} className="text-app-primary" />
        ) : isDropTarget && dropZone === 'below' ? (
          <ArrowDown size={10} className="text-app-primary" />
        ) : (
          <GripVertical size={10} />
        )}
      </div>

      {/* Collapse toggle */}
      {isParent ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
          className="w-4 h-4 flex items-center justify-center text-app-text-muted hover:text-app-primary flex-shrink-0"
        >
          {isCollapsed ? <Plus size={10} /> : <Minus size={10} />}
        </button>
      ) : (
        <span className="w-4 flex-shrink-0" />
      )}

      {/* Name */}
      <span className={`text-xs flex-1 min-w-0 ${param.level === 0 ? 'font-bold text-app-text-head' : 'font-semibold text-app-text-main'}`}>
        {param.name}
      </span>

      {/* Pin button */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFreeze(); }}
        style={{ opacity: isFrozen ? 1 : 0, transition: 'opacity 0.15s' }}
        onMouseEnter={e => { if (!isFrozen) (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
        onMouseLeave={e => { if (!isFrozen) (e.currentTarget as HTMLButtonElement).style.opacity = '0'; }}
        className={`p-0.5 mr-[5px] rounded flex-shrink-0 transition-colors ${
          isFrozen
            ? 'bg-app-primary/20 text-app-primary'
            : 'text-app-text-muted hover:text-app-primary hover:bg-app-primary/10'
        }`}
        title={isFrozen ? 'Открепить' : 'Закрепить'}
      >
        <PinIcon size={12} />
      </button>
    </div>
  );
};

export const TimelinePage: React.FC<TimelinePageProps> = ({
  activeTimelineId,
  timelineParameterModalOpen = false,
  onTimelineParameterModalChange
}) => {
  // Store
  const store = useAppStore();
  const { viewState, updateViewState } = useTimelineViewState();

  // Рефы
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const timelineRef = React.useRef<HTMLDivElement>(null);
  const addButtonRef = React.useRef<HTMLDivElement>(null);
  const [addButtonHeight, setAddButtonHeight] = useState(26);
  const timeHeaderRef = React.useRef<HTMLDivElement>(null);
  const frozenTimelineRef = React.useRef<HTMLDivElement>(null);
  const isSyncing = React.useRef(false);
  const scrollbarRef = React.useRef<HTMLDivElement>(null);
  const contextMenuRef = React.useRef<HTMLDivElement>(null);
  const timelineRowMenuRef = React.useRef<HTMLDivElement>(null);
  const taskContextMenuRef = React.useRef<HTMLDivElement>(null);
  const scrollSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Состояния из постоянного хранилища
  const zoomIndex = viewState.zoomIndex;
  const setZoomIndex = (idx: number) => updateViewState({ zoomIndex: idx });

  const dateRange: DateRange | undefined = viewState.dateRange
    ? { from: new Date(viewState.dateRange.from), to: new Date(viewState.dateRange.to) }
    : undefined;
  const setDateRange = (range: DateRange | undefined) =>
    updateViewState({
      dateRange: range?.from && range?.to
        ? { from: range.from.toISOString(), to: range.to.toISOString() }
        : null,
    });
  // Выбранная конфигурация timeline — из пропса или первая из store
  const selectedTimelineId = activeTimelineId ?? store.appData.timelineConfigs?.[0]?.id ?? 'timeline_default';
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [frozenIds, setFrozenIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [timelineRowMenu, setTimelineRowMenu] = useState<TimelineRowMenuState | null>(null);
  const [taskModal, setTaskModal] = useState<TaskModalState | null>(null);
  const [parameterModal, setParameterModal] = useState<ParameterModalState>({
    isOpen: timelineParameterModalOpen
  });
  const [dragPreview, setDragPreview] = useState<Task | null>(null);
  const [selectedParamIds, setSelectedParamIds] = useState<Set<string>>(new Set());
  const [selectedColumnDates, setSelectedColumnDates] = useState<Set<string>>(new Set());
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [_dragLevelDelta, setDragLevelDelta] = useState(0);
  const [taskContextMenu, setTaskContextMenu] = useState<TaskContextMenuState | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<Task | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskName, setEditingTaskName] = useState<string>('');
  const [hoveredTask, setHoveredTask] = useState<TooltipState | null>(null);
  const [copyToTimelineModal, setCopyToTimelineModal] = useState<{ rootIds: string[] } | null>(null);
  const tooltipTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ganttNotification, setGanttNotification] = useState<string | null>(null);

  const dayWidth = ZOOM_CONFIG[zoomIndex] || 56;

  // Загружаем конфигурацию выбранной timeline
  const timelineConfig = useMemo(
    () => store.timelines.getConfig(selectedTimelineId),
    [store.appData.timelineConfigs, selectedTimelineId]
  );

  // Параметры текущей timeline, отсортированные иерархически
  const PARAMETERS = useMemo(
    () => sortHierarchically(timelineConfig?.parameters ?? []),
    [timelineConfig]
  );

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

  // Динамическая ширина левой панели: базовые элементы строки + отступ по уровню + ширина текста
  const sidebarWidth = useMemo(() => {
    const FIXED_ELEMENTS = 12 + 4 + 16 + 4 + 20 + 8; // drag + gap + collapse + gap + pin + rightPad
    const CHAR_WIDTH = 7; // ~px на символ для text-xs
    const MIN_WIDTH = 156; // 208 * 0.75 (25% меньше)
    let max = MIN_WIDTH;
    for (const p of PARAMETERS) {
      const rowWidth = (4 + p.level * 16) + FIXED_ELEMENTS + p.name.length * CHAR_WIDTH;
      if (rowWidth > max) max = rowWidth;
    }
    return max;
  }, [PARAMETERS]);

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
          year: year,
          dateStrings: [] as string[]
        });
      } else {
        weekMap.get(key).months.add(format(day, 'LLLL', { locale: ru }));
      }
      weekMap.get(key).daysCount += 1;
      weekMap.get(key).dateStrings.push(format(day, 'yyyy-MM-dd'));
    });

    // Группировка по месяцам для верхней строки
    const monthMap = new Map();
    allDays.forEach(day => {
      const monthKey = format(day, 'yyyy-MM');
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          year: day.getFullYear(),
          monthName: format(day, 'LLLL', { locale: ru }),
          daysCount: 0,
          dateStrings: [] as string[]
        });
      }
      monthMap.get(monthKey).daysCount += 1;
      monthMap.get(monthKey).dateStrings.push(format(day, 'yyyy-MM-dd'));
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
          daysCount: 0,
          dateStrings: [] as string[]
        });
      }
      quarterMap.get(key).daysCount += 1;
      quarterMap.get(key).dateStrings.push(format(day, 'yyyy-MM-dd'));
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

  // Синхронизация состояния ParameterModal с пропсом из App
  useEffect(() => {
    setParameterModal(prev => ({ ...prev, isOpen: timelineParameterModalOpen }));
  }, [timelineParameterModalOpen]);

  // Восстанавливаем горизонтальный scroll при монтировании
  useEffect(() => {
    const savedScroll = viewState.scrollLeft;
    if (savedScroll > 0) {
      if (scrollbarRef.current) scrollbarRef.current.scrollLeft = savedScroll;
      if (timelineRef.current) timelineRef.current.scrollLeft = savedScroll;
      if (timeHeaderRef.current) timeHeaderRef.current.scrollLeft = savedScroll;
      if (frozenTimelineRef.current) frozenTimelineRef.current.scrollLeft = savedScroll;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // После рендера контекстного меню корректируем позицию по фактическому размеру
  useEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;
    const el = contextMenuRef.current;
    const rect = el.getBoundingClientRect();
    const MARGIN = 8;
    let { top, left } = rect;
    if (rect.bottom > window.innerHeight - MARGIN) {
      top = Math.max(MARGIN, contextMenu.y - rect.height);
      el.style.top = `${top}px`;
    }
    if (rect.right > window.innerWidth - MARGIN) {
      left = Math.max(MARGIN, contextMenu.x - rect.width);
      el.style.left = `${left}px`;
    }
  }, [contextMenu]);

  // Измеряем высоту кнопок «Добавить» и синхронизируем с paddingBottom правой панели,
  // чтобы maxScrollTop обеих панелей был одинаков и скролл не расходился снизу.
  useEffect(() => {
    const el = addButtonRef.current;
    if (!el) return;
    const update = () => setAddButtonHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Синхронизация скролла
  const syncFromTimeline = () => {
    if (isSyncing.current) return;
    const tl = timelineRef.current;
    const sb = sidebarRef.current;
    if (!tl || !sb || sb.scrollTop === tl.scrollTop) return;
    isSyncing.current = true;
    sb.scrollTop = tl.scrollTop;
    requestAnimationFrame(() => { isSyncing.current = false; });
  };

  const syncFromScrollbar = () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    const sb = scrollbarRef.current;
    if (timelineRef.current && sb) timelineRef.current.scrollLeft = sb.scrollLeft;
    if (timeHeaderRef.current && sb) timeHeaderRef.current.scrollLeft = sb.scrollLeft;
    if (frozenTimelineRef.current && sb) frozenTimelineRef.current.scrollLeft = sb.scrollLeft;
    requestAnimationFrame(() => { isSyncing.current = false; });

    // Дебаунс сохранения scrollLeft — без setState, чтобы не вызывать ре-рендер
    if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
    scrollSaveTimer.current = setTimeout(() => {
      if (scrollbarRef.current) {
        saveTimelineViewState({ ...loadTimelineViewState(), scrollLeft: scrollbarRef.current.scrollLeft });
      }
    }, 300);
  };

  const syncFromSidebar = () => {
    if (isSyncing.current) return;
    const tl = timelineRef.current;
    const sb = sidebarRef.current;
    if (!tl || !sb || tl.scrollTop === sb.scrollTop) return;
    isSyncing.current = true;
    tl.scrollTop = sb.scrollTop;
    requestAnimationFrame(() => { isSyncing.current = false; });
  };

  const syncFromFrozenTimeline = () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    const ft = frozenTimelineRef.current;
    if (scrollbarRef.current && ft) scrollbarRef.current.scrollLeft = ft.scrollLeft;
    if (timelineRef.current && ft) timelineRef.current.scrollLeft = ft.scrollLeft;
    if (timeHeaderRef.current && ft) timeHeaderRef.current.scrollLeft = ft.scrollLeft;
    isSyncing.current = false;
  };

  // Синхронизация scrollLeft закреплённой области при её появлении/изменении
  useLayoutEffect(() => {
    if (frozenRows.length > 0 && frozenTimelineRef.current) {
      const sl = scrollbarRef.current?.scrollLeft ?? timelineRef.current?.scrollLeft ?? 0;
      frozenTimelineRef.current.scrollLeft = sl;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozenRows.length]);

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
    // Начальная позиция — под курсором; useEffect скорректирует если выйдет за экран
    setContextMenu({ x: e.clientX, y: e.clientY, paramId });
  };

  // ===== Выбор строк / столбцов =====
  const handleRowClick = useCallback((id: string, ctrlKey: boolean) => {
    setSelectedParamIds(prev => {
      if (ctrlKey) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      }
      return prev.has(id) && prev.size === 1 ? new Set<string>() : new Set([id]);
    });
    if (!ctrlKey) setSelectedColumnDates(new Set());
  }, []);

  const handleColumnClick = useCallback((dateStrings: string[], ctrlKey: boolean) => {
    setSelectedColumnDates(prev => {
      if (ctrlKey) {
        const next = new Set(prev);
        const allSelected = dateStrings.every(d => next.has(d));
        if (allSelected) dateStrings.forEach(d => next.delete(d));
        else dateStrings.forEach(d => next.add(d));
        return next;
      }
      const allSelected = dateStrings.every(d => prev.has(d)) && prev.size === dateStrings.length;
      return allSelected ? new Set<string>() : new Set(dateStrings);
    });
    if (!ctrlKey) setSelectedParamIds(new Set());
  }, []);

  // Клик по ячейке грида: без Ctrl — снять всё, с Ctrl — выделить строку + столбец
  const handleCellClick = useCallback((e: React.MouseEvent, paramId: string) => {
    e.stopPropagation();
    if (!e.ctrlKey) {
      setSelectedParamIds(new Set());
      setSelectedColumnDates(new Set());
      return;
    }
    const container = timelineRef.current ?? frozenTimelineRef.current;
    if (!container || days.length === 0) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    const dayIndex = Math.floor(x / dayWidth);
    if (dayIndex < 0 || dayIndex >= days.length) return;
    const dateStr = format(days[dayIndex], 'yyyy-MM-dd');
    setSelectedParamIds(prev => {
      const next = new Set(prev);
      if (next.has(paramId)) next.delete(paramId); else next.add(paramId);
      return next;
    });
    setSelectedColumnDates(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr);
      return next;
    });
  }, [dayWidth, days]);

  // ===== DnD для строк =====
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // 'above' — вставить перед целевой строкой на её уровне (зона: верхние 50%)
  // 'below' — вставить после целевой строки на её уровне (зона: нижние 50%)
  type DropScenario = 'above' | 'below';

  // Единый объект состояния — один setState вместо двух → вдвое меньше рендеров
  const [dropState, setDropState] = useState<{ scenario: DropScenario | null; targetId: string | null }>(
    { scenario: null, targetId: null }
  );
  const dropScenario = dropState.scenario;
  const dropTargetId = dropState.targetId;

  // Ref для кастомной стратегии сортировки (синхронный доступ без closure)
  const dropScenarioRef = React.useRef<DropScenario | null>(null);
  // Ref текущего targetId — для early exit без closure
  const dropTargetIdRef = React.useRef<string | null>(null);

  // Отслеживаем Y-позицию курсора и кэшируем rect over-элемента
  const pointerYRef = React.useRef(0);
  const overRectRef = React.useRef<{ top: number; height: number } | null>(null);
  const overIdRef = React.useRef<string | null>(null);

  // Кэш потомков активного узла — вычисляем один раз при начале перетаскивания
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
    // Early exit: не обновлять состояние если ничего не изменилось
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

    if (!PARAMETERS.find(p => p.id === activeId) || !PARAMETERS.find(p => p.id === overId)) {
      setScenario(null, null); return;
    }

    const relY = (pointerYRef.current - overRect.top) / overRect.height;

    if (relY < 0.50) {
      // Верхние 50% — вставить перед целевой строкой на её уровне
      setScenario('above', overId);
    } else {
      // Нижние 50% — вставить после целевой строки на её уровне
      setScenario('below', overId);
    }
  }, [PARAMETERS, setScenario]);

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
      const targetParam = PARAMETERS.find(p => p.id === targetId);
      if (!targetParam) return;
      store.timelines.reorderAndReparent(
        selectedTimelineId, activeId, targetId,
        targetParam.level, targetParam.parentId
      );
    } else if (scenario === 'below') {
      const targetParam = PARAMETERS.find(p => p.id === targetId);
      if (!targetParam) return;
      store.timelines.insertAfter(
        selectedTimelineId, activeId, targetId,
        targetParam.level, targetParam.parentId
      );
    }
  }, [dropScenario, dropTargetId, selectedTimelineId, store.timelines, PARAMETERS, setScenario]);

  // Получить визуальный rect элемента (с учётом CSS transform/анимации)
  const getVisualRect = (id: string, fallback: { top: number; height: number }) => {
    const el = document.querySelector(`[data-param-id="${id}"]`) as HTMLElement | null;
    if (el) {
      const vr = el.getBoundingClientRect();
      return { top: vr.top, height: vr.height };
    }
    return fallback;
  };

  const handleParamDragOver = useCallback((event: DragMoveEvent) => {
    if (!event.over) { setScenario(null, null); return; }
    const overId = event.over.id as string;
    overIdRef.current = overId;
    // getBoundingClientRect() учитывает transform, event.over.rect — нет
    const visualRect = getVisualRect(overId, event.over.rect);
    overRectRef.current = visualRect;
    updateDropScenario(overId, visualRect, event.active.id as string);
  }, [updateDropScenario, setScenario]);

  const handleParamDragMove = useCallback((event: DragMoveEvent) => {
    if (!overIdRef.current) return;
    // Обновляем rect на каждом mousemove — анимация могла сдвинуть строку
    const el = document.querySelector(`[data-param-id="${overIdRef.current}"]`) as HTMLElement | null;
    if (el) {
      const vr = el.getBoundingClientRect();
      overRectRef.current = { top: vr.top, height: vr.height };
    }
    if (!overRectRef.current) return;
    updateDropScenario(overIdRef.current, overRectRef.current, event.active.id as string);
  }, [updateDropScenario]);

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

  // Проверить, есть ли фильтры у параметра
  const isParameterEmpty = (paramId: string): boolean => {
    const param = PARAMETERS.find(p => p.id === paramId);
    return param ? Object.keys(param.filters).length === 0 : false;
  };

  // Определить цвет плашки задачи (приоритет: done > blocker > цвет задачи > default)
  const getTaskBarColor = (task: Task): string => {
    if (task.status === 'done') {
      return 'bg-green-200 text-green-900';
    }
    if (task.priority === 'blocker') {
      return 'bg-red-300 text-red-950';
    }
    if (task.color) {
      return 'text-gray-800';
    }
    return 'bg-app-primary text-white';
  };

  // Получить стили для task bar (включая цвет фона)
  const getTaskBarStyle = (task: Task): React.CSSProperties => {
    if (task.status !== 'done' && task.priority !== 'blocker' && task.color) {
      return { backgroundColor: task.color };
    }
    return {};
  };

  // ПКМ по task-бару — открывает контекстное меню задачи
  const handleTaskBarContextMenu = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();
    setTaskContextMenu({ x: e.clientX, y: e.clientY, task });
  };

  // Копирование задачи
  const handleCopyTask = (task: Task) => {
    const { id: _id, ...taskData } = task;
    store.tasks.add({ ...taskData, name: `${task.name} (копия)` });
    setTaskContextMenu(null);
  };

  // Удаление задачи из контекстного меню
  const handleDeleteTaskFromMenu = (task: Task) => {
    setTaskContextMenu(null);
    setConfirmDeleteTask(task);
  };

  // Inline-редактирование названия задачи
  const handleTaskBarDoubleClick = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingTaskId(task.id);
    setEditingTaskName(task.name);
  };

  const handleEditingConfirm = (task: Task) => {
    const trimmed = editingTaskName.trim();
    if (trimmed) {
      store.tasks.update(task.id, { name: trimmed });
    }
    setEditingTaskId(null);
    setEditingTaskName('');
  };

  const handleEditingCancel = () => {
    setEditingTaskId(null);
    setEditingTaskName('');
  };

  // ===== Tooltip для task bar =====
  const handleTaskBarMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>, task: Task) => {
    const barRect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - barRect.left) / barRect.width;
    const relY = (e.clientY - barRect.top) / barRect.height;

    let placement: 'above' | 'below' | 'inside' = 'inside';
    if (relX < 0.3) {
      // Левые 30%: вертикальная зона определяет направление
      placement = relY < 0.5 ? 'above' : 'below';
    }
    // Правые 70%: наведение внутрь тела задачи (placement остаётся 'inside')

    const x = barRect.left + barRect.width / 2;
    const y = placement === 'above'
      ? window.innerHeight - barRect.top + 4   // bottom distance от нижнего края
      : barRect.bottom + 4;                    // top distance от верхнего края (below / inside)

    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(() => {
      setHoveredTask({ task, x, y, placement });
    }, 150);
  }, []);

  const handleTaskBarMouseLeave = useCallback(() => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setHoveredTask(null);
  }, []);

  // Сохранение задачи (add / edit)
  const handleSaveTask = (data: Omit<Task, 'id'> & { id?: string }) => {
    if (taskModal?.mode === 'edit' && data.id) {
      store.tasks.update(data.id, data);
    } else {
      const newTask = store.tasks.add(data);
      if (taskModal?.isGanttMode) {
        store.timelines.addParameter(selectedTimelineId, {
          name: newTask.name,
          level: 0,
          filters: { id: newTask.id },
        });
        setGanttNotification(`Задача "${newTask.name}" создана. Строка добавлена в Timeline.`);
        setTimeout(() => setGanttNotification(null), 4000);
      }
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

  // Сохранение параметра (add)
  const handleSaveParameter = (parameter: Omit<TimelineParameter, 'id'>) => {
    store.timelines.addParameter(selectedTimelineId, parameter);
    handleCloseParameterModal();
  };

  // Обновление параметра (edit)
  const handleUpdateParameter = (updates: Omit<TimelineParameter, 'id'>) => {
    if (parameterModal.editingParameter) {
      store.timelines.updateParameter(selectedTimelineId, parameterModal.editingParameter.id, updates);
    }
    handleCloseParameterModal();
  };

  // Обработчик закрытия ParameterModal
  const handleCloseParameterModal = () => {
    setParameterModal({ isOpen: false });
    onTimelineParameterModalChange?.(false);
  };

  // Удаление параметра из контекстного меню
  const handleDeleteParameter = (paramId: string) => {
    store.timelines.deleteParameter(selectedTimelineId, paramId);
    setContextMenu(null);
  };

  // Открыть модалку выбора целевого timeline для копирования
  const handleOpenCopyToTimeline = () => {
    if (!contextMenu) return;
    const isMultiSelect = selectedParamIds.size > 1 && selectedParamIds.has(contextMenu.paramId);
    const rootIds = isMultiSelect ? Array.from(selectedParamIds) : [contextMenu.paramId];
    setCopyToTimelineModal({ rootIds });
    setContextMenu(null);
  };

  // Выполнить копирование строк в целевой timeline
  const handleCopyToTimeline = (targetConfigId: string) => {
    if (!copyToTimelineModal) return;
    const idMap = new Map<string, string>();

    // Собираем список (param, levelOffset) в иерархическом порядке
    const toCopy: Array<{ param: TimelineParameter; levelOffset: number }> = [];
    const seenIds = new Set<string>();

    for (const rootId of copyToTimelineModal.rootIds) {
      if (seenIds.has(rootId)) continue;
      const rootParam = PARAMETERS.find(p => p.id === rootId);
      if (!rootParam) continue;
      const levelOffset = rootParam.level;
      seenIds.add(rootId);
      toCopy.push({ param: rootParam, levelOffset });

      if (collapsedIds.has(rootId)) {
        const descendants = getAllDescendants(rootId);
        for (const descId of descendants) {
          if (!seenIds.has(descId)) {
            const descParam = PARAMETERS.find(p => p.id === descId);
            if (descParam) {
              seenIds.add(descId);
              toCopy.push({ param: descParam, levelOffset });
            }
          }
        }
      }
    }

    for (const { param, levelOffset } of toCopy) {
      const newParentId = param.parentId && idMap.has(param.parentId)
        ? idMap.get(param.parentId)
        : undefined;
      const newParam = store.timelines.addParameter(targetConfigId, {
        name: param.name,
        level: param.level - levelOffset,
        parentId: newParentId,
        filters: { ...param.filters },
      });
      idMap.set(param.id, newParam.id);
    }

    setCopyToTimelineModal(null);
  };

  // Импорт данных из JSON файла

  // Обработчики drag and drop
  const handleTaskMouseDown = (e: React.MouseEvent, task: Task) => {
    if (editingTaskId === task.id) return;
    if (task.fix) return;
    e.preventDefault();
    setDragState({
      taskId: task.id,
      startX: e.clientX,
      startDate: task.startDate,
      endDate: task.endDate,
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, task: Task, side: 'left' | 'right') => {
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
      if (taskContextMenuRef.current && !taskContextMenuRef.current.contains(event.target as Node)) {
        setTaskContextMenu(null);
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
          <h2 className="text-xl font-bold text-app-text-head">{timelineConfig?.name ?? 'Timeline'}</h2>
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
        <div className="flex-shrink-0 border-r border-app-border h-[72px] flex flex-col justify-between pl-2 font-semibold text-app-text-main py-2" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
          <div className="flex items-center gap-1">
            <span>Параметры</span>
            {selectedParamIds.size === 1 && (() => {
              const selectedId = Array.from(selectedParamIds)[0];
              const selectedParam = PARAMETERS.find(p => p.id === selectedId);
              const canLift = !!selectedParam?.parentId;
              const prevSibling = (() => {
                if (!selectedParam) return null;
                const idx = PARAMETERS.findIndex(p => p.id === selectedId);
                for (let i = idx - 1; i >= 0; i--) {
                  const p = PARAMETERS[i];
                  if (p.level === selectedParam.level && p.parentId === selectedParam.parentId) return p;
                }
                return null;
              })();
              return (
                <div className="flex items-center gap-0.5 ml-1">
                  <button
                    disabled={!canLift}
                    onClick={() => canLift && store.timelines.liftAboveParent(selectedTimelineId, selectedId)}
                    className="w-5 h-5 flex items-center justify-center text-app-text-muted hover:text-app-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Поднять на уровень выше"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {prevSibling && (
                    <button
                      onClick={() => store.timelines.reparentUnder(selectedTimelineId, selectedId, prevSibling.id)}
                      className="w-5 h-5 flex items-center justify-center text-app-text-muted hover:text-app-primary transition-colors"
                      title="Вложить в предыдущий элемент"
                    >
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
          {/* Нижняя строка: кнопки уровней + стрелки навигации */}
          <div className="flex items-center justify-between pr-2">
            {/* Кнопки уровней вложенности — абсолютное позиционирование для точного выравнивания с кнопками строк */}
            {/* Кнопка уровня N: left = 12 + N*16 px (от края justify-between) = 8(pl-2) + 4(row-pl) + N*16 + 12(drag) + 4(gap) от края sidebar */}
            {(() => {
              const maxLevel = parentIds.size > 0
                ? Math.max(...Array.from(parentIds).map(id => (PARAMETERS.find(p => p.id === id)?.level ?? 0)))
                : -1;
              if (maxLevel < 0) return <div />;
              const containerWidth = 12 + maxLevel * 16 + 16;
              return (
                <div className="relative flex-shrink-0 h-4" style={{ width: containerWidth }}>
                  {Array.from({ length: maxLevel + 1 }, (_, levelIdx) => {
                    const levelParents = PARAMETERS.filter(p => parentIds.has(p.id) && p.level === levelIdx).map(p => p.id);
                    if (levelParents.length === 0) return null;
                    const isCollapsed = levelParents.some(id => collapsedIds.has(id));
                    return (
                      <button
                        key={levelIdx}
                        style={{ position: 'absolute', left: 12 + levelIdx * 16, top: 0 }}
                        onClick={() => {
                          setCollapsedIds(prev => {
                            const next = new Set(prev);
                            if (isCollapsed) {
                              PARAMETERS.forEach(p => {
                                if (parentIds.has(p.id) && p.level <= levelIdx) next.delete(p.id);
                              });
                            } else {
                              levelParents.forEach(id => next.add(id));
                            }
                            return next;
                          });
                        }}
                        className="w-4 h-4 flex items-center justify-center text-app-text-muted hover:text-app-primary transition-colors"
                        title={`${isCollapsed ? 'Развернуть' : 'Свернуть'} уровень ${levelIdx + 1}`}
                      >
                        {isCollapsed ? <Plus size={10} /> : <Minus size={10} />}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

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
                    className="shadow-[inset_-1px_0_0_0_var(--color-app-border)] flex-shrink-0 flex items-center justify-center px-1 text-[10px] font-bold uppercase relative z-10 overflow-hidden"
                  >
                    <span className="truncate">{m.monthName}</span>
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
                weeks.map((w, idx) => {
                  const isWSelected = w.dateStrings.some((d: string) => selectedColumnDates.has(d));
                  const today = new Date();
                  const isCurrentWeek = w.number === getWeek(today, { weekStartsOn: 1, locale: ru }) && w.year === today.getFullYear();
                  return (
                    <div
                      key={idx}
                      style={{
                        width: dayWidth * w.daysCount,
                        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        fontSize: dayWidth <= 4 ? '7px' : dayWidth <= 6 ? '8px' : '9px',
                        letterSpacing: dayWidth <= 4 ? '-0.05em' : undefined,
                      }}
                      onClick={(e) => handleColumnClick(w.dateStrings, e.ctrlKey)}
                      className={`flex-shrink-0 flex items-center justify-center font-bold relative z-10 overflow-hidden leading-none px-0 cursor-pointer select-none ${isWSelected ? 'bg-app-accent/20 text-app-accent' : isCurrentWeek ? 'bg-pink-500/20 text-pink-600 hover:bg-pink-500/25' : 'hover:bg-app-accent/10'}`}
                    >
                      {`W${w.number}`}
                    </div>
                  );
                })
              ) : (
                days.map((day, idx) => {
                  const isWknd = isWeekend(day);
                  const isTdy = isToday(day);
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isColSelected = selectedColumnDates.has(dateStr);

                  return (
                    <div
                      key={idx}
                      style={{
                        width: dayWidth,
                        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                      onClick={(e) => handleColumnClick([dateStr], e.ctrlKey)}
                      className={`flex-shrink-0 flex flex-col items-center justify-center text-[9px] leading-none relative z-10 cursor-pointer select-none ${
                        isColSelected ? 'bg-app-accent/20 text-app-accent font-black' :
                        isTdy ? 'bg-pink-500/20 text-pink-600 font-black' :
                        isWknd ? 'bg-app-primary/10 text-app-primary font-bold' : 'hover:bg-app-primary/5'
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
          <div className="flex-shrink-0 border-r border-app-border bg-app-surface" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
            {frozenRows.map((param) => {
              const layers = getTaskLayers(param.id);
              const rowHeight = Math.max(24, layers.length * 24);

              return (
                <div
                  key={param.id}
                  className={`group flex items-center gap-1 shadow-[0_1px_0_0_var(--color-app-border)] select-none relative border-l-2 border-app-primary px-0 py-0
                    ${selectedParamIds.has(param.id) ? 'bg-app-accent/[0.12]' : 'hover:bg-app-bg/10'}
                  `}
                  style={{
                    paddingLeft: `${4 + param.level * 16}px`,
                    height: `${rowHeight}px`,
                    minHeight: `${rowHeight}px`,
                  }}
                  onClick={(e) => { e.stopPropagation(); handleRowClick(param.id, e.ctrlKey); }}
                  onContextMenu={(e) => handleContextMenu(e, param.id)}
                >
                  {/* Drag handle placeholder (frozen rows не перемещаются) */}
                  <span className="flex-shrink-0 w-3" />

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

                  <span className={`text-xs flex-1 min-w-0 ${param.level === 0 ? 'font-bold text-app-text-head' : 'font-semibold text-app-text-main'}`}>
                    {param.name}
                  </span>

                  {/* Pin иконка для frozen параметров */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFreeze(param.id);
                    }}
                    className={`p-0.5 mr-[5px] rounded flex-shrink-0 transition-colors ${
                      frozenIds.has(param.id)
                        ? 'bg-app-primary/20 text-app-primary opacity-100'
                        : 'opacity-0 group-hover:opacity-100 text-app-text-muted hover:text-app-primary hover:bg-app-primary/10'
                    }`}
                    title={frozenIds.has(param.id) ? 'Открепить' : 'Закрепить'}
                  >
                    <PinIcon size={12} />
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

              {/* Строки frozen параметров */}
              <div className="relative z-10">
                {frozenRows.map((param) => {
                  const layers = getTaskLayers(param.id);
                  const rowHeight = Math.max(24, layers.length * 24);
                  const isRowSelected = selectedParamIds.has(param.id);

                  return (
                    <div
                      key={param.id}
                      className={`shadow-[0_1px_0_0_var(--color-app-border)] w-full relative ${
                        isRowSelected ? 'bg-app-accent/[0.12]' : param.level === 0 ? 'bg-app-primary/5' : ''
                      }`}
                      style={{ height: `${rowHeight}px`, minHeight: `${rowHeight}px` }}
                      onClick={(e) => handleCellClick(e, param.id)}
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

                          if (task.milestone) {
                            const cx = position.left + position.width / 2;
                            const size = 14;
                            return (
                              <div
                                key={task.id}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => handleTaskMouseDown(e, task)}
                                onContextMenu={(e) => handleTaskBarContextMenu(e, task)}
                                onMouseEnter={(e) => handleTaskBarMouseEnter(e, task)}
                                onMouseLeave={handleTaskBarMouseLeave}
                                className={`absolute flex items-center select-none transition-all ${isDragging ? 'opacity-75 cursor-grabbing' : 'cursor-grab hover:opacity-80'}`}
                                style={{
                                  left: `${cx - size / 2}px`,
                                  top: `${topOffset}px`,
                                  height: '20px',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${size}px`,
                                    height: `${size}px`,
                                    flexShrink: 0,
                                    backgroundColor: '#1a1a1a',
                                    transform: 'rotate(45deg)',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                                  }}
                                />
                                <span className="ml-2 text-[10px] font-medium text-app-text-head whitespace-nowrap">
                                  {task.name}
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={task.id}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => handleTaskMouseDown(e, task)}
                              onDoubleClick={(e) => handleTaskBarDoubleClick(e, task)}
                              onContextMenu={(e) => handleTaskBarContextMenu(e, task)}
                              onMouseEnter={(e) => handleTaskBarMouseEnter(e, task)}
                              onMouseLeave={handleTaskBarMouseLeave}
                              className={`absolute h-[20px] rounded-sm shadow-md text-[10px] flex items-center font-medium transition-all select-none overflow-hidden ${getTaskBarColor(task)} ${
                                editingTaskId === task.id ? 'cursor-text' :
                                isDragging ? 'shadow-2xl opacity-75 scale-105 cursor-grabbing' :
                                isResizing ? 'shadow-2xl opacity-75 cursor-ew-resize' :
                                'hover:shadow-lg cursor-grab'
                              }`}
                              style={{
                                left: `${position.left}px`,
                                width: `${position.width}px`,
                                top: `${topOffset}px`,
                                ...getTaskBarStyle(task),
                              }}
                            >
                              <div
                                className="absolute left-0 top-0 h-full w-[5px] z-10 cursor-ew-resize hover:bg-white/30"
                                onMouseDown={(e) => handleResizeMouseDown(e, task, 'left')}
                              />
                              {editingTaskId === task.id ? (
                                <input
                                  autoFocus
                                  type="text"
                                  value={editingTaskName}
                                  onChange={(e) => setEditingTaskName(e.target.value)}
                                  onBlur={() => handleEditingConfirm(task)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); handleEditingConfirm(task); }
                                    if (e.key === 'Escape') { e.preventDefault(); handleEditingCancel(); }
                                    e.stopPropagation();
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="px-2 flex-1 min-w-0 h-full bg-transparent outline-none text-[10px] font-medium"
                                />
                              ) : (
                                <span className="px-2 truncate flex-1 min-w-0">{task.name}</span>
                              )}
                              {task.link && (
                                <a
                                  href={task.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-shrink-0 mr-2 opacity-70 hover:opacity-100 transition-opacity"
                                >
                                  <Globe size={10} />
                                </a>
                              )}
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

              {/* Слой подсветки колонок и строк (поверх строк) */}
              <div className="absolute inset-0 z-20 pointer-events-none flex">
                {dayWidth < 12 ? (
                  weeks.map((w, i) => {
                    const today = new Date();
                    const isCurrentWeek = w.number === getWeek(today, { weekStartsOn: 1, locale: ru }) && w.year === today.getFullYear();
                    const isWkSelected = w.dateStrings.some((d: string) => selectedColumnDates.has(d));
                    return (
                      <div
                        key={i}
                        style={{ width: dayWidth * w.daysCount, transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        className={`flex-shrink-0 ${isWkSelected ? 'bg-app-accent/[0.12]' : isCurrentWeek ? 'bg-pink-500/[0.15]' : ''}`}
                      />
                    );
                  })
                ) : (
                  days.map((day, i) => {
                    const isTdy = isToday(day);
                    const isWknd = isWeekend(day);
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isColSelected = selectedColumnDates.has(dateStr);
                    let bgColor = 'bg-transparent';
                    if (isColSelected) bgColor = 'bg-app-accent/[0.12]';
                    else if (isTdy) bgColor = 'bg-pink-500/[0.15]';
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
            </div>
          </div>
        </div>
      )}

      {/* ПРОКРУЧИВАЕМЫЙ РАЗДЕЛ */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* ЛЕВАЯ КОЛОНКА */}
        <div className="flex-shrink-0 border-r border-app-border" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
          <div
            ref={sidebarRef}
            onScroll={syncFromSidebar}
            className="h-full bg-app-surface overflow-y-auto overflow-x-hidden hide-scrollbar select-none"
          >
            <DndContext
              sensors={dndSensors}
              modifiers={[restrictToVerticalAxis]}
              collisionDetection={closestCenter}
              onDragStart={(e) => {
                const activeId = e.active.id as string;
                setDragActiveId(activeId);
                setDragLevelDelta(0);
                setScenario(null, null);
                // Кэшируем потомков один раз — избегаем O(n²) на каждый mousemove
                const descendants = new Set<string>();
                const walk = (pid: string) => {
                  PARAMETERS.forEach(p => { if (p.parentId === pid) { descendants.add(p.id); walk(p.id); } });
                };
                walk(activeId);
                activeDescendantsRef.current = descendants;
              }}
              onDragMove={handleParamDragMove}
              onDragOver={handleParamDragOver}
              onDragEnd={handleParamDragEnd}
            >
              <SortableContext items={scrollableRows.map(r => r.id)} strategy={dndSortingStrategy}>
                {scrollableRows.map((param) => {
                  const layers = getTaskLayers(param.id);
                  const rowHeight = Math.max(24, layers.length * 24);
                  const isTarget = dropTargetId === param.id;
                  return (
                    <SortableParamRow
                      key={param.id}
                      param={param}
                      rowHeight={rowHeight}
                      isSelected={selectedParamIds.has(param.id)}
                      isParent={parentIds.has(param.id)}
                      isCollapsed={collapsedIds.has(param.id)}
                      isFrozen={frozenIds.has(param.id)}
                      previewLevel={(() => {
                        if (dragActiveId !== param.id) return undefined;
                        if ((dropScenario === 'above' || dropScenario === 'below') && dropTargetId) {
                          const target = PARAMETERS.find(p => p.id === dropTargetId);
                          return target ? target.level : param.level;
                        }
                        return undefined;
                      })()}
                      isDropTarget={isTarget && dropScenario !== null}
                      dropZone={isTarget ? (dropScenario ?? undefined) : undefined}
                      onRowClick={(ctrlKey) => handleRowClick(param.id, ctrlKey)}
                      onToggleCollapse={() => toggleCollapse(param.id)}
                      onToggleFreeze={() => toggleFreeze(param.id)}
                      onContextMenu={(e) => handleContextMenu(e, param.id)}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
            <div ref={addButtonRef} className="flex sticky bottom-0 z-10 border-t border-app-border bg-app-surface">
              <button
                onClick={() => { onTimelineParameterModalChange?.(true); }}
                className="flex items-center gap-1 px-2 py-1 font-semibold text-app-text-main hover:text-app-primary transition-colors"
                style={{ fontSize: 10 }}
                title="Добавить новую строку параметра"
              >
                <Plus size={10} />
                Добавить строку
              </button>
              <button
                onClick={() => setTaskModal({ mode: 'add', isGanttMode: true })}
                className="flex items-center gap-1 px-2 py-1 font-semibold text-app-text-main hover:text-app-primary transition-colors"
                style={{ fontSize: 10 }}
                title="Создать задачу как объект диаграммы Ганта"
              >
                <Plus size={10} />
                Добавить задачу
              </button>
            </div>
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА - TIMELINE GRID */}
        <div
          ref={timelineRef}
          onScroll={syncFromTimeline}
          className="flex-1 overflow-y-auto overflow-x-hidden bg-app-surface relative"
        >
          <div
            style={{
              width: totalWidth,
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              paddingBottom: addButtonHeight
            }}
            className="flex flex-col min-h-full relative"
          >
            {/* СЕТКА */}
            <div className="flex-1 relative bg-app-surface" onClick={() => { setSelectedParamIds(new Set()); setSelectedColumnDates(new Set()); }}>
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

              {/* Строки параметров */}
              <div className="relative z-10">
                {scrollableRows.map((param) => {
                  const layers = getTaskLayers(param.id);
                  const rowHeight = Math.max(24, layers.length * 24);
                  const isRowSelected = selectedParamIds.has(param.id);

                  return (
                    <div
                      key={param.id}
                      className={`shadow-[0_1px_0_0_var(--color-app-border)] w-full relative ${
                        isRowSelected ? 'bg-app-accent/[0.12]' : param.level === 0 ? 'bg-app-primary/5' : ''
                      }`}
                      style={{ height: `${rowHeight}px`, minHeight: `${rowHeight}px` }}
                      onClick={(e) => handleCellClick(e, param.id)}
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

                          if (task.milestone) {
                            const cx = position.left + position.width / 2;
                            const size = 14;
                            return (
                              <div
                                key={task.id}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => handleTaskMouseDown(e, task)}
                                onContextMenu={(e) => handleTaskBarContextMenu(e, task)}
                                onMouseEnter={(e) => handleTaskBarMouseEnter(e, task)}
                                onMouseLeave={handleTaskBarMouseLeave}
                                className={`absolute flex items-center select-none transition-all ${isDragging ? 'opacity-75 cursor-grabbing' : 'cursor-grab hover:opacity-80'}`}
                                style={{
                                  left: `${cx - size / 2}px`,
                                  top: `${topOffset}px`,
                                  height: '20px',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${size}px`,
                                    height: `${size}px`,
                                    flexShrink: 0,
                                    backgroundColor: '#1a1a1a',
                                    transform: 'rotate(45deg)',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                                  }}
                                />
                                <span className="ml-2 text-[10px] font-medium text-app-text-head whitespace-nowrap">
                                  {task.name}
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={task.id}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => handleTaskMouseDown(e, task)}
                              onDoubleClick={(e) => handleTaskBarDoubleClick(e, task)}
                              onContextMenu={(e) => handleTaskBarContextMenu(e, task)}
                              onMouseEnter={(e) => handleTaskBarMouseEnter(e, task)}
                              onMouseLeave={handleTaskBarMouseLeave}
                              className={`absolute h-[20px] rounded-sm shadow-md text-[10px] flex items-center font-medium transition-all select-none overflow-hidden ${getTaskBarColor(task)} ${
                                editingTaskId === task.id ? 'cursor-text' :
                                isDragging ? 'shadow-2xl opacity-75 scale-105 cursor-grabbing' :
                                isResizing ? 'shadow-2xl opacity-75 cursor-ew-resize' :
                                'hover:shadow-lg cursor-grab'
                              }`}
                              style={{
                                left: `${position.left}px`,
                                width: `${position.width}px`,
                                top: `${topOffset}px`,
                                ...getTaskBarStyle(task),
                              }}
                            >
                              <div
                                className="absolute left-0 top-0 h-full w-[5px] z-10 cursor-ew-resize hover:bg-white/30"
                                onMouseDown={(e) => handleResizeMouseDown(e, task, 'left')}
                              />
                              {editingTaskId === task.id ? (
                                <input
                                  autoFocus
                                  type="text"
                                  value={editingTaskName}
                                  onChange={(e) => setEditingTaskName(e.target.value)}
                                  onBlur={() => handleEditingConfirm(task)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); handleEditingConfirm(task); }
                                    if (e.key === 'Escape') { e.preventDefault(); handleEditingCancel(); }
                                    e.stopPropagation();
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="px-2 flex-1 min-w-0 h-full bg-transparent outline-none text-[10px] font-medium"
                                />
                              ) : (
                                <span className="px-2 truncate flex-1 min-w-0">{task.name}</span>
                              )}
                              {task.link && (
                                <a
                                  href={task.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-shrink-0 mr-2 opacity-70 hover:opacity-100 transition-opacity"
                                >
                                  <Globe size={10} />
                                </a>
                              )}
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

              {/* Слой подсветки колонок и строк (поверх строк) */}
              <div className="absolute inset-0 z-20 pointer-events-none flex">
                {dayWidth < 12 ? (
                  weeks.map((w, i) => {
                    const today = new Date();
                    const isCurrentWeek = w.number === getWeek(today, { weekStartsOn: 1, locale: ru }) && w.year === today.getFullYear();
                    const isWkSelected = w.dateStrings.some((d: string) => selectedColumnDates.has(d));
                    return (
                      <div
                        key={i}
                        style={{ width: dayWidth * w.daysCount, transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        className={`flex-shrink-0 ${isWkSelected ? 'bg-app-accent/[0.12]' : isCurrentWeek ? 'bg-pink-500/[0.15]' : ''}`}
                      />
                    );
                  })
                ) : (
                  days.map((day, i) => {
                    const isTdy = isToday(day);
                    const isWknd = isWeekend(day);
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isColSelected = selectedColumnDates.has(dateStr);
                    let bgColor = 'bg-transparent';
                    if (isColSelected) bgColor = 'bg-app-accent/[0.12]';
                    else if (isTdy) bgColor = 'bg-pink-500/[0.15]';
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
            </div>
          </div>
          </div>
      </div>

      {/* НИЖНЯЯ ПАНЕЛЬ: горизонтальный скроллбар */}
      <div className="flex flex-shrink-0 border-t border-app-border">
        <div className="flex-shrink-0 border-r border-app-border bg-app-surface" style={{ width: sidebarWidth, minWidth: sidebarWidth }} />
        <div
          ref={scrollbarRef}
          onScroll={syncFromScrollbar}
          className="flex-1 overflow-x-auto"
          style={{ height: 13 }}
        >
          <div style={{ width: totalWidth, height: 1 }} />
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
            <PinIcon size={12} />
            {frozenIds.has(contextMenu.paramId) ? 'Открепить' : 'Закрепить'}
          </button>
          <button
            onClick={() => {
              const param = PARAMETERS.find(p => p.id === contextMenu.paramId);
              if (param) {
                setParameterModal({ isOpen: true, mode: 'edit', editingParameter: param });
                setContextMenu(null);
              }
            }}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-app-text-main hover:bg-app-bg/50 transition-colors flex items-center gap-2"
          >
            <Pencil size={12} />
            Редактировать
          </button>
          <button
            onClick={() => {
              setParameterModal({ isOpen: true, mode: 'add', defaultParentId: contextMenu.paramId });
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-app-text-main hover:bg-app-bg/50 transition-colors flex items-center gap-2"
          >
            <Plus size={12} />
            Добавить вложенную
          </button>
          <button
            onClick={handleOpenCopyToTimeline}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-app-text-main hover:bg-app-bg/50 transition-colors flex items-center gap-2"
          >
            <Copy size={12} />
            {selectedParamIds.size > 1 && selectedParamIds.has(contextMenu.paramId)
              ? 'Копировать выбранные'
              : 'Копировать'}
          </button>
          <button
            onClick={() => handleDeleteParameter(contextMenu.paramId)}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-app-error hover:bg-app-error/10 transition-colors flex items-center gap-2"
          >
            <Trash2 size={12} />
            Удалить
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
              const hasEmpty = isParameterEmpty(timelineRowMenu.paramId);
              setTaskModal({
                mode: 'add',
                paramId: timelineRowMenu.paramId,
                initialDate: timelineRowMenu.date,
                hasEmptyFilters: hasEmpty
              });
              setTimelineRowMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-app-text-main hover:bg-app-bg/50 transition-colors flex items-center gap-2"
          >
            <Plus size={12} />
            Добавить задачу
          </button>
        </div>
      )}

      {/* КОНТЕКСТНОЕ МЕНЮ ЗАДАЧИ (ПКМ по task-bar) */}
      {taskContextMenu && (
        <div
          ref={taskContextMenuRef}
          className="fixed z-[200] bg-app-surface border border-app-border rounded-xl shadow-2xl py-1 min-w-[160px]"
          style={{ top: taskContextMenu.y, left: taskContextMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setTaskModal({ mode: 'edit', task: taskContextMenu.task });
              setTaskContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-app-text-main hover:bg-app-bg/50 transition-colors flex items-center gap-2"
          >
            <Pencil size={12} />
            Изменить
          </button>
          <button
            onClick={() => handleCopyTask(taskContextMenu.task)}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-app-text-main hover:bg-app-bg/50 transition-colors flex items-center gap-2"
          >
            <Copy size={12} />
            Копировать
          </button>
          <button
            onClick={() => handleDeleteTaskFromMenu(taskContextMenu.task)}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-app-error hover:bg-app-error/10 transition-colors flex items-center gap-2"
          >
            <Trash2 size={12} />
            Удалить
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
          hasEmptyFilters={taskModal.hasEmptyFilters}
          ganttMode={taskModal.isGanttMode}
          customFieldTypes={store.customFieldTypes.getAll()}
          onAddCustomFieldType={(name) => store.customFieldTypes.add(name)}
          onSave={handleSaveTask}
          onDelete={taskModal.mode === 'edit' ? handleDeleteTask : undefined}
          onEditParameter={() => {
            // Открыть ParameterModal в режиме edit для текущего параметра
            if (taskModal.paramId) {
              const param = PARAMETERS.find(p => p.id === taskModal.paramId);
              if (param) {
                setTaskModal(null);
                setParameterModal({ isOpen: true, mode: 'edit', editingParameter: param });
              }
            }
          }}
          onClose={() => setTaskModal(null)}
        />
      )}

      {/* МОДАЛЬНОЕ ОКНО ADD / EDIT PARAMETER */}
      <ParameterModal
        isOpen={parameterModal.isOpen}
        mode={parameterModal.mode ?? 'add'}
        editingParameter={parameterModal.editingParameter}
        defaultParentId={parameterModal.defaultParentId}
        existingParameters={PARAMETERS}
        availableTasks={store.appData.tasks}
        customFieldTypes={store.customFieldTypes.getAll()}
        onSave={parameterModal.mode === 'edit' ? handleUpdateParameter : handleSaveParameter}
        onClose={handleCloseParameterModal}
      />

      {/* МОДАЛ КОПИРОВАНИЯ СТРОК В ДРУГОЙ TIMELINE */}
      {copyToTimelineModal && ReactDOM.createPortal(
        <div
          className="fixed inset-0 z-[9990] flex items-center justify-center"
          onMouseDown={() => setCopyToTimelineModal(null)}
        >
          <div
            className="bg-app-surface border border-app-border rounded-2xl shadow-2xl p-5 min-w-[260px] max-w-xs w-full"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-app-text-head mb-3">
              Копировать в Timeline
            </p>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {(() => {
                const currentCfg = store.appData.timelineConfigs.find(c => c.id === selectedTimelineId);
                return currentCfg ? (
                  <>
                    <button
                      onClick={() => handleCopyToTimeline(selectedTimelineId)}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-app-primary hover:bg-app-primary/10 rounded-lg transition-colors"
                    >
                      {currentCfg.name} (текущий)
                    </button>
                    {store.appData.timelineConfigs.filter(cfg => cfg.id !== selectedTimelineId).length > 0 && (
                      <div className="border-t border-app-border my-1" />
                    )}
                  </>
                ) : null;
              })()}
              {store.appData.timelineConfigs
                .filter(cfg => cfg.id !== selectedTimelineId)
                .map(cfg => (
                  <button
                    key={cfg.id}
                    onClick={() => handleCopyToTimeline(cfg.id)}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-app-text-main hover:bg-app-bg rounded-lg transition-colors"
                  >
                    {cfg.name}
                  </button>
                ))}
            </div>
            <button
              onClick={() => setCopyToTimelineModal(null)}
              className="mt-3 w-full text-center text-xs font-semibold text-app-text-muted hover:text-app-text-main transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* УВЕДОМЛЕНИЕ GANTT MODE (portal) */}
      {ganttNotification && ReactDOM.createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-app-text-head text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl whitespace-nowrap">
          {ganttNotification}
        </div>,
        document.body
      )}

      {/* TOOLTIP ЗАДАЧИ (portal) */}
      {hoveredTask && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            left: hoveredTask.x,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 9999,
            ...(hoveredTask.placement === 'above'
              ? { bottom: hoveredTask.y }
              : { top: hoveredTask.y }   // 'below' | 'inside'
            ),
          }}
          className="bg-app-text-head text-white rounded-lg px-3 py-2 shadow-xl max-w-[260px] min-w-[120px]"
        >
          <div className="text-[11px] font-bold leading-tight truncate">{hoveredTask.task.name}</div>
          <div className="text-[10px] text-white/65 mt-1 leading-tight">
            {format(hoveredTask.task.startDate, 'dd.MM.yyyy')}
            {' → '}
            {format(hoveredTask.task.endDate, 'dd.MM.yyyy')}
          </div>
        </div>,
        document.body
      )}

      {confirmDeleteTask && (
        <ConfirmDialog
          title={`Удалить задачу «${confirmDeleteTask.name}»?`}
          message="Задача будет безвозвратно удалена."
          confirmLabel="Удалить"
          confirmVariant="danger"
          onConfirm={() => {
            store.tasks.delete(confirmDeleteTask.id);
            setConfirmDeleteTask(null);
          }}
          onCancel={() => setConfirmDeleteTask(null)}
        />
      )}
    </div>
  );
};
