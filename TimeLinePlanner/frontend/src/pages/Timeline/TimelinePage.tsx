import React, { useState, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { 
  format, 
  eachDayOfInterval,
  getWeek,
  isWeekend,
  isToday
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { DateRangePicker } from '../../components/ui/DateRangePicker';

const PARAMETERS = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `Ресурс ${i + 1} (${
    [
      'Станок А',
      'Сварка',
      'Сборка',
      'Упаковка',
      'Логистика',
      'Тестирование',
      'Склад',
      'Контроль качества',
      'Малярный цех',
      'Термообработка',
    ][i % 10]
  })`,
}));

const dayWidth = 56; // Ширина одного дня в пикселях

const ZOOM_OPTIONS = ['2W', '3W', 'M', 'Q', '2Q'];

export const TimelinePage: React.FC = () => {
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const timelineRef = React.useRef<HTMLDivElement>(null);
  const isSyncing = React.useRef(false);
  const [zoomIndex, setZoomIndex] = React.useState(2); // По умолчанию '1M' (индекс 2)
  
  // Состояние диапазона дат (по умолчанию Январь 2026)
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(2026, 0, 1),
    to: new Date(2026, 0, 31),
  });

  // Динамический расчет дней на основе диапазона
  const { days, totalWidth, weeks, months } = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return { days: [], totalWidth: 0, weeks: [], months: [] };
    }

    const allDays = eachDayOfInterval({
      start: dateRange.from,
      end: dateRange.to,
    });

    const daysCount = allDays.length;
    
    // Группировка по неделям
    const weekMap = new Map();
    allDays.forEach(day => {
      const wNumber = getWeek(day, { weekStartsOn: 1, locale: ru });
      const year = day.getFullYear();
      const key = `W${wNumber}-${year}`;
      
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
          daysCount: 0 
        });
      }
      monthMap.get(monthKey).daysCount += 1;
    });

    return {
      days: allDays,
      totalWidth: daysCount * dayWidth,
      weeks: Array.from(weekMap.values()).map(w => ({
        ...w,
        monthLabel: Array.from(w.months).join('/')
      })),
      months: Array.from(monthMap.values())
    };
  }, [dateRange]);

  const syncScroll = (source: 'sidebar' | 'timeline') => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    
    if (source === 'timeline' && sidebarRef.current && timelineRef.current) {
      sidebarRef.current.scrollTop = timelineRef.current.scrollTop;
    }
    if (source === 'sidebar' && sidebarRef.current && timelineRef.current) {
      timelineRef.current.scrollTop = sidebarRef.current.scrollTop;
    }
    
    isSyncing.current = false;
  };

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

      {/* ГЛАВНЫЙ КОНТЕЙНЕР - занимает все оставшееся место */}
      <div className="flex-1 flex overflow-hidden">
        
                {/* 1. СТОЛБИК ПАРАМЕТРОВ */}
                <div 
                  ref={sidebarRef} 
                  onScroll={() => syncScroll('sidebar')} 
                  className="w-52 min-w-[13rem] flex-shrink-0 bg-app-surface border-r border-app-border flex flex-col overflow-y-auto overflow-x-hidden hide-scrollbar select-none"
                >
                  {/* Шапка параметров - липкая */}
                  <div className="sticky top-0 h-[72px] min-h-[72px] flex-shrink-0 border-b border-app-border flex items-center pl-4 bg-app-surface font-semibold text-app-text-main z-40">
                    Параметры
                  </div>
                  
                  {/* Список параметров */}
                  <div className="min-w-[13rem]">
                    {PARAMETERS.map((param) => (
                      <div 
                        key={param.id} 
                        className="h-[28px] min-h-[28px] py-0 pl-4 pr-1 border-b border-app-border flex items-center text-xs font-semibold text-app-text-main hover:bg-app-bg/10"
                      >
                        {param.name}
                      </div>
                    ))}
                    {/* Компенсатор скроллбара */}
                    <div className="h-[17px] min-h-[17px] w-full bg-app-surface border-t border-app-border"></div>
                  </div>
                </div>

        {/* 2. ОКНО ТАЙМЛАЙНА */}
        <div 
          ref={timelineRef} 
          onScroll={() => syncScroll('timeline')} 
          className="flex-1 overflow-auto bg-app-surface flex flex-col relative"
        >
          {/* Обертка с динамической шириной */}
          <div style={{ width: totalWidth }} className="flex flex-col min-h-full">
            
                    {/* ХЕДЕР ВРЕМЕНИ - липкий */}
                    <div className="sticky top-0 h-[72px] min-h-[72px] flex-shrink-0 bg-app-surface flex flex-col z-30">
                      
                      {/* Строка 1: Год (повторяется каждый месяц) */}
                      <div className="h-[24px] min-h-[24px] border-b border-app-border flex text-app-text-main bg-app-surface">
                        {months.map((m, idx) => (
                          <div 
                            key={idx} 
                            style={{ width: dayWidth * m.daysCount }} 
                            className="border-r border-app-border flex-shrink-0 flex items-center justify-center px-2 text-[10px] font-bold uppercase tracking-wider"
                          >
                            {m.year}
                          </div>
                        ))}
                      </div>
                      
                    {/* Строка 2: Недели */}
                      <div className="h-[24px] min-h-[24px] border-b border-app-border flex text-app-text-main bg-app-surface">
                        {weeks.map((w, idx) => (
                          <div 
                            key={idx} 
                            style={{ width: dayWidth * w.daysCount }} 
                            className="border-r border-app-border flex-shrink-0 flex items-center justify-center px-2 text-[10px] font-bold"
                          >
                            W{w.number} — <span className="capitalize ml-1">{w.monthLabel}</span>
                          </div>
                        ))}
                      </div>
                      
                      {/* Строка 3: Дни */}
                      <div className="h-[24px] min-h-[24px] border-b border-app-border flex text-app-text-main bg-app-surface">
                        {days.map((day, idx) => {
                          const isWknd = isWeekend(day);
                          const isTdy = isToday(day);
                          
                          return (
                            <div 
                              key={idx} 
                              style={{ width: dayWidth }} 
                              className={`border-r border-app-border flex-shrink-0 flex flex-col items-center justify-center text-[9px] leading-none transition-colors ${
                                isTdy ? 'bg-pink-500/10 text-pink-600 font-black' : 
                                isWknd ? 'bg-app-primary/10 text-app-primary font-bold' : ''
                              }`}
                            >
                              <span className="font-bold">{format(day, 'dd')}</span>
                              <span className="text-[7px] opacity-70 uppercase">{format(day, 'eeeeee', { locale: ru })}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* СЕТКА */}
                    <div className="flex-1 relative bg-app-surface">
                      {/* Слой вертикальных линий (сетка) */}
                      <div className="absolute inset-0 pointer-events-none flex">
                        {days.map((_, i) => (
                          <div 
                            key={i} 
                            style={{ width: dayWidth }} 
                            className="flex-shrink-0 border-r border-app-border/30 h-full"
                          />
                        ))}
                      </div>

                      {/* Слой подсветки (выходные и сегодня) */}
                      <div className="absolute inset-0 pointer-events-none flex">
                        {days.map((day, i) => {
                          const isTdy = isToday(day);
                          const isWknd = isWeekend(day);
                          
                          let bgColor = 'bg-transparent';
                          if (isTdy) bgColor = 'bg-pink-500/[0.08]';
                          else if (isWknd) bgColor = 'bg-app-primary/[0.08]';
                          
                          if (bgColor === 'bg-transparent') return <div key={i} style={{ width: dayWidth }} className="flex-shrink-0" />;
                          
                          return (
                            <div 
                              key={i} 
                              style={{ width: dayWidth }} 
                              className={`flex-shrink-0 ${bgColor}`}
                            />
                          );
                        })}
                      </div>

                      {/* Строки параметров */}
                      <div className="relative z-10">
                        {PARAMETERS.map((param) => (
                          <div 
                            key={param.id} 
                            className="h-[28px] min-h-[28px] border-b border-app-border/50 w-full hover:bg-app-bg/10"
                          >
                            {/* Место для задач */}
                          </div>
                        ))}
                      </div>
                    </div>
          </div>
        </div>

      </div>
    </div>
  );
};
