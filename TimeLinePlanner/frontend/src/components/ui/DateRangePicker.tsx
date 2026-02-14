import React, { useState, useRef, useEffect } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { format, setMonth, setYear, addYears, subYears, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-day-picker/dist/style.css';

interface DateRangePickerProps {
  range: DateRange | undefined;
  onRangeChange: (range: DateRange | undefined) => void;
}

type ViewMode = 'days' | 'months' | 'years';

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ range, onRangeChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('days');
  const [currentMonth, setCurrentMonth] = useState<Date>(range?.from || new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Закрытие и сброс режима при клике вне
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Сбрасываем режим до дней с небольшой задержкой после закрытия анимации
        setTimeout(() => setViewMode('days'), 300);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(prev => !prev);
  };

  const toggleViewMode = () => {
    if (viewMode === 'days') setViewMode('months');
    else if (viewMode === 'months') setViewMode('years');
    else setViewMode('days');
  };

  const selectMonth = (monthIdx: number) => {
    setCurrentMonth(setMonth(currentMonth, monthIdx));
    setViewMode('days');
  };

  const selectYear = (year: number) => {
    setCurrentMonth(setYear(currentMonth, year));
    setViewMode('months');
  };

  const handlePrev = () => {
    if (viewMode === 'days') setCurrentMonth(subMonths(currentMonth, 1));
    else if (viewMode === 'months') setCurrentMonth(subYears(currentMonth, 1));
    else setCurrentMonth(subYears(currentMonth, 12));
  };

  const handleNext = () => {
    if (viewMode === 'days') setCurrentMonth(addMonths(currentMonth, 1));
    else if (viewMode === 'months') setCurrentMonth(addYears(currentMonth, 1));
    else setCurrentMonth(addYears(currentMonth, 12));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setViewMode('days');
  };

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) return 'Выберите даты';
    
    const formatMonth = (date: Date) => {
      const formatted = format(date, 'dd MMM', { locale: ru }).replace('.', '').toLowerCase();
      // Ограничиваем название месяца 3 буквами (например, "нояб" -> "ноя")
      const parts = formatted.split(' ');
      if (parts.length === 2) {
        return `${parts[0]} ${parts[1].slice(0, 3)}`;
      }
      return formatted;
    };

    if (!range.to) return format(range.from, 'dd MMM yyyy', { locale: ru }).replace('.', '').toLowerCase();
    
    return `${formatMonth(range.from)} — ${formatMonth(range.to)} ${format(range.to, 'yyyy')}`;
  };

  // Генерация сетки лет (12 лет)
  const startYear = Math.floor(currentMonth.getFullYear() / 12) * 12;
  const years = Array.from({ length: 12 }, (_, i) => startYear + i);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2 px-3 py-1.5 bg-app-surface border border-app-border rounded-lg hover:bg-app-bg/50 transition-all shadow-sm text-app-text-main group relative z-10"
      >
        <CalendarIcon size={14} className="text-app-primary group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-bold tracking-tight">
          {formatDateRange(range)}
        </span>
      </button>

      {isOpen && (
        <div 
          className="absolute top-full right-0 mt-2 p-4 bg-app-surface/95 backdrop-blur-md border border-app-border rounded-2xl shadow-2xl z-[100] min-w-[320px] animate-in fade-in zoom-in duration-300 origin-top-right border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <style>{`
            .rdp-root {
              --rdp-accent-color: var(--color-app-primary);
              --rdp-range_middle-background-color: color-mix(in srgb, var(--color-app-primary), transparent 92%);
              --rdp-range_middle-color: var(--color-app-primary);
              margin: 0;
            }
            .rdp-month_grid { width: 100%; }
            .rdp-day {
              font-size: 11px !important;
              width: 40px !important;
              height: 40px !important;
              font-weight: 500;
              position: relative;
            }
            .rdp-today .rdp-day_button {
              border: 1px solid var(--color-app-primary) !important;
              color: var(--color-app-primary) !important;
              font-weight: 900 !important;
            }
            .rdp-weekday {
              font-size: 10px !important;
              font-weight: 800 !important;
              text-transform: uppercase;
              opacity: 0.5;
              padding-bottom: 8px;
            }
            .rdp-day_button {
              border-radius: 10px !important;
              border: none !important;
            }
            .rdp-selected .rdp-day_button {
              background-color: var(--rdp-accent-color) !important;
              color: white !important;
            }
            .rdp-range_middle .rdp-day_button {
              background-color: var(--rdp-range_middle-background-color) !important;
              color: var(--rdp-range_middle-color) !important;
              border-radius: 0 !important;
            }
            .rdp-range_start .rdp-day_button { border-radius: 10px 0 0 10px !important; }
            .rdp-range_end .rdp-day_button { border-radius: 0 10px 10px 0 !important; }
            .rdp-nav { display: none !important; }
          `}</style>

          {/* CUSTOM HEADER (Microsoft Style) */}
          <div className="flex items-center justify-between mb-4 px-1">
            <button 
              onClick={viewMode === 'years' ? goToToday : toggleViewMode}
              className="text-[13px] font-extrabold text-app-text-main hover:text-app-primary transition-all px-3 py-1.5 rounded-xl hover:bg-app-bg flex items-center gap-1 group"
            >
              {viewMode === 'days' && format(currentMonth, 'LLLL yyyy', { locale: ru })}
              {viewMode === 'months' && format(currentMonth, 'yyyy', { locale: ru })}
              {viewMode === 'years' && 'Today'}
            </button>
            
            <div className="flex gap-1">
              <button 
                onClick={handlePrev}
                className="p-2 hover:bg-app-bg rounded-xl text-app-text-muted hover:text-app-primary transition-all border border-transparent hover:border-app-border"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={handleNext}
                className="p-2 hover:bg-app-bg rounded-xl text-app-text-muted hover:text-app-primary transition-all border border-transparent hover:border-app-border"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="relative overflow-hidden min-h-[280px]">
            {/* VIEW: DAYS */}
            {viewMode === 'days' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={onRangeChange}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
            locale={ru}
            showOutsideDays
                  disableNavigation
                  classNames={{
                    month_caption: "hidden",
                    months: "w-full",
                    month: "w-full",
                  }}
                />
              </div>
            )}

            {/* VIEW: MONTHS */}
            {viewMode === 'months' && (
              <div className="grid grid-cols-3 gap-3 animate-in fade-in zoom-in duration-300">
                {Array.from({ length: 12 }).map((_, i) => {
                  const isTodayMonth = new Date().getMonth() === i && new Date().getFullYear() === currentMonth.getFullYear();
                  
                  return (
                    <button
                      key={i}
                      onClick={() => selectMonth(i)}
                      className={`py-4 text-[11px] font-semibold uppercase tracking-widest rounded-2xl transition-all relative border ${
                        isTodayMonth 
                          ? 'border-app-primary text-app-primary' 
                          : 'border-transparent hover:bg-app-bg text-app-text-main'
                      }`}
                    >
                      {format(setMonth(new Date(), i), 'MMMM', { locale: ru })}
                    </button>
                  );
                })}
              </div>
            )}

            {/* VIEW: YEARS */}
            {viewMode === 'years' && (
              <div className="grid grid-cols-3 gap-3 animate-in fade-in zoom-in duration-300">
                {years.map((year) => {
                  const isTodayYear = new Date().getFullYear() === year;

                  return (
                    <button
                      key={year}
                      onClick={() => selectYear(year)}
                      className={`py-4 text-[13px] font-semibold rounded-2xl transition-all relative border ${
                        isTodayYear 
                          ? 'border-app-primary text-app-primary' 
                          : 'border-transparent hover:bg-app-bg text-app-text-main'
                      }`}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
