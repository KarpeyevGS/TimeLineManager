import React, { useState, useRef, useEffect } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-day-picker/dist/style.css';

interface DateRangePickerProps {
  range: DateRange | undefined;
  onRangeChange: (range: DateRange | undefined) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ range, onRangeChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) return 'Выберите даты';
    if (!range.to) return format(range.from, 'dd MMM yyyy', { locale: ru });
    return `${format(range.from, 'dd MMM', { locale: ru })} — ${format(range.to, 'dd MMM yyyy', { locale: ru })}`;
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-app-surface border border-app-border rounded-lg hover:bg-app-bg/50 transition-all shadow-sm text-app-text-main group"
      >
        <CalendarIcon size={16} className="text-app-primary group-hover:scale-110 transition-transform" />
        <span className="text-xs font-semibold whitespace-nowrap">
          {formatDateRange(range)}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 p-2 bg-app-surface border border-app-border rounded-xl shadow-2xl z-[100] animate-in fade-in zoom-in duration-200 origin-top-right">
          <style>{`
            .rdp {
              --rdp-cell-size: 32px;
              --rdp-accent-color: var(--color-app-primary);
              --rdp-background-color: var(--color-app-primary-hover);
              --rdp-accent-color-foreground: white;
              margin: 0;
            }
            .rdp-day_selected, .rdp-day_selected:focus-visible, .rdp-day_selected:hover {
              background-color: var(--rdp-accent-color);
              color: var(--rdp-accent-color-foreground);
            }
            .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
              background-color: color-mix(in srgb, var(--color-app-primary), transparent 90%);
              color: var(--color-app-primary);
            }
            .rdp-day_range_middle {
              background-color: color-mix(in srgb, var(--color-app-primary), transparent 90%) !important;
              color: var(--color-app-primary) !important;
              border-radius: 0;
            }
            .rdp-day_range_start {
              border-top-right-radius: 0;
              border-bottom-right-radius: 0;
            }
            .rdp-day_range_end {
              border-top-left-radius: 0;
              border-bottom-left-radius: 0;
            }
            .rdp-head_cell {
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              color: var(--color-app-text-muted);
            }
            .rdp-caption_label {
              font-size: 14px;
              font-weight: 700;
              color: var(--color-app-text-head);
            }
            .rdp-nav_button {
              color: var(--color-app-text-muted);
            }
            .rdp-nav_button:hover {
              color: var(--color-app-primary);
              background-color: var(--color-app-bg);
            }
          `}</style>
          <DayPicker
            mode="range"
            selected={range}
            onSelect={onRangeChange}
            numberOfMonths={2}
            locale={ru}
            showOutsideDays
          />
        </div>
      )}
    </div>
  );
};
