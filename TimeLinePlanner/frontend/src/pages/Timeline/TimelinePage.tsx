import React, { useState, useMemo, useEffect } from 'react';
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

// Интерфейсы
interface Parameter {
  id: number;
  name: string;
  parentId?: number;
  level: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  paramId: number;
}

// Иерархические mock-данные (3 уровня)
const PARAMETERS: Parameter[] = [
  // Производство (id=1-19)
  { id: 1, name: 'Производство', level: 0 },
  { id: 2, name: 'Сварочный цех', parentId: 1, level: 1 },
  { id: 3, name: 'Сварщик 1', parentId: 2, level: 2 },
  { id: 4, name: 'Сварщик 2', parentId: 2, level: 2 },
  { id: 5, name: 'Сварщик 3', parentId: 2, level: 2 },
  { id: 6, name: 'Сборочный цех', parentId: 1, level: 1 },
  { id: 7, name: 'Слесарь 1', parentId: 6, level: 2 },
  { id: 8, name: 'Слесарь 2', parentId: 6, level: 2 },
  { id: 9, name: 'Проверка качества', parentId: 1, level: 1 },
  { id: 10, name: 'Контролер 1', parentId: 9, level: 2 },
  { id: 11, name: 'Контролер 2', parentId: 9, level: 2 },
  { id: 12, name: 'Упаковка', parentId: 1, level: 1 },
  { id: 13, name: 'Упаковщик 1', parentId: 12, level: 2 },
  { id: 14, name: 'Упаковщик 2', parentId: 12, level: 2 },
  { id: 15, name: 'Малярный цех', parentId: 1, level: 1 },
  { id: 16, name: 'Маляр 1', parentId: 15, level: 2 },
  { id: 17, name: 'Маляр 2', parentId: 15, level: 2 },
  { id: 18, name: 'Сушка', parentId: 15, level: 2 },

  // Логистика (id=20-35)
  { id: 20, name: 'Логистика', level: 0 },
  { id: 21, name: 'Приемка материалов', parentId: 20, level: 1 },
  { id: 22, name: 'Приемщик 1', parentId: 21, level: 2 },
  { id: 23, name: 'Приемщик 2', parentId: 21, level: 2 },
  { id: 24, name: 'Склад готовой продукции', parentId: 20, level: 1 },
  { id: 25, name: 'Кладовщик 1', parentId: 24, level: 2 },
  { id: 26, name: 'Кладовщик 2', parentId: 24, level: 2 },
  { id: 27, name: 'Отгрузка', parentId: 20, level: 1 },
  { id: 28, name: 'Грузчик 1', parentId: 27, level: 2 },
  { id: 29, name: 'Грузчик 2', parentId: 27, level: 2 },

  // Управление (id=30-40)
  { id: 30, name: 'Управление', level: 0 },
  { id: 31, name: 'Планирование', parentId: 30, level: 1 },
  { id: 32, name: 'Плановик 1', parentId: 31, level: 2 },
  { id: 33, name: 'Плановик 2', parentId: 31, level: 2 },
  { id: 34, name: 'Учет', parentId: 30, level: 1 },
  { id: 35, name: 'Бухгалтер 1', parentId: 34, level: 2 },
  { id: 36, name: 'Бухгалтер 2', parentId: 34, level: 2 },
];

const ZOOM_OPTIONS = ['2W', '3W', 'M', 'Q', '2Q'];
const ZOOM_CONFIG: Record<number, number> = {
  0: 120, // 2W
  1: 80,  // 3W
  2: 56,  // M
  3: 18,  // Q
  4: 9,   // 2Q
};

export const TimelinePage: React.FC = () => {
  // Рефы
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const timelineRef = React.useRef<HTMLDivElement>(null);
  const timeHeaderRef = React.useRef<HTMLDivElement>(null);
  const frozenTimelineRef = React.useRef<HTMLDivElement>(null);
  const isSyncing = React.useRef(false);
  const contextMenuRef = React.useRef<HTMLDivElement>(null);

  // Состояния
  const [zoomIndex, setZoomIndex] = React.useState(2);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(2026, 0, 1),
    to: new Date(2026, 0, 31),
  });
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [frozenIds, setFrozenIds] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const dayWidth = ZOOM_CONFIG[zoomIndex] || 56;

  // Вычисляемые данные для иерархии
  const parentIds = useMemo(
    () => new Set(PARAMETERS.filter(p => p.parentId !== undefined).map(p => p.parentId!)),
    []
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
  }, [collapsedIds]);

  const frozenRows = useMemo(
    () => visibleRows.filter(p => frozenIds.has(p.id)),
    [visibleRows, frozenIds]
  );

  const scrollableRows = useMemo(
    () => visibleRows.filter(p => !frozenIds.has(p.id)),
    [visibleRows, frozenIds]
  );

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
  const toggleCollapse = (id: number) => {
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
  const getAllDescendants = (paramId: number): number[] => {
    const descendants: number[] = [];
    const traverse = (pid: number) => {
      PARAMETERS.filter(p => p.parentId === pid).forEach(child => {
        descendants.push(child.id);
        traverse(child.id);
      });
    };
    traverse(paramId);
    return descendants;
  };

  const toggleFreeze = (id: number) => {
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

  const handleContextMenu = (e: React.MouseEvent, paramId: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, paramId });
  };

  // Закрытие контекстного меню по клику вне
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Синхронизация горизонтального скролла между всеми контейнерами
  useEffect(() => {
    const syncScroll = (source: 'timeline' | 'header' | 'frozen') => {
      const tl = timelineRef.current?.scrollLeft;
      if (tl === undefined) return;

      if (source !== 'timeline' && timelineRef.current) {
        timelineRef.current.scrollLeft = tl;
      }
      if (source !== 'header' && timeHeaderRef.current) {
        timeHeaderRef.current.scrollLeft = tl;
      }
      if (source !== 'frozen' && frozenTimelineRef.current) {
        frozenTimelineRef.current.scrollLeft = tl;
      }
    };

    // Синхронизировать при изменении параметров
    syncScroll('all');
  }, [dayWidth, totalWidth]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Заголовок страницы - фиксирован */}
      <div className="px-4 py-2 bg-app-surface z-50 flex-shrink-0 border-b border-app-border flex justify-between items-center">
        <h2 className="text-xl font-bold text-app-text-head">График Timeline</h2>

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
            {frozenRows.map((param) => (
              <div
                key={param.id}
                className={`h-[28px] min-h-[28px] flex items-center gap-1 shadow-[0_1px_0_0_var(--color-app-border)] select-none hover:bg-app-bg/10 relative border-l-2 border-app-primary px-0 py-0`}
                style={{ paddingLeft: `${4 + param.level * 16}px` }}
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
            ))}
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
                {frozenRows.map((param) => (
                  <div
                    key={param.id}
                    className={`h-[28px] min-h-[28px] shadow-[0_1px_0_0_var(--color-app-border)] w-full hover:bg-app-bg/10 ${
                      param.level === 0 ? 'bg-app-primary/5' : ''
                    }`}
                  >
                    {/* Место для задач */}
                  </div>
                ))}
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
            {scrollableRows.map((param) => (
              <div
                key={param.id}
                className={`h-[28px] min-h-[28px] flex items-center gap-1 shadow-[0_1px_0_0_var(--color-app-border)] select-none hover:bg-app-bg/10 relative px-0 py-0 leading-none ${
                  param.level === 0 ? 'bg-app-primary/5' : ''
                }`}
                style={{ paddingLeft: `${4 + param.level * 16}px` }}
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
            ))}
            {/* Компенсатор скроллбара */}
            <div className="h-[17px] min-h-[17px] w-full bg-app-surface shadow-[0_1px_0_0_var(--color-app-border)]" />
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
                {scrollableRows.map((param) => (
                  <div
                    key={param.id}
                    className={`h-[28px] min-h-[28px] shadow-[0_1px_0_0_var(--color-app-border)] w-full hover:bg-app-bg/10 ${
                      param.level === 0 ? 'bg-app-primary/5' : ''
                    }`}
                  >
                    {/* Место для задач */}
                  </div>
                ))}
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
    </div>
  );
};
