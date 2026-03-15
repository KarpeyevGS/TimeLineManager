import React from 'react';
import { format, isToday, isWeekend, getWeek } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Week {
  number: number;
  year: number;
  daysCount: number;
  dateStrings: string[];
}

interface SelectionHighlightLayerProps {
  dayWidth: number;
  days: Date[];
  weeks: Week[];
  selectedColumnDates: Set<string>;
}

export const SelectionHighlightLayer: React.FC<SelectionHighlightLayerProps> = ({
  dayWidth,
  days,
  weeks,
  selectedColumnDates,
}) => {
  return (
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
  );
};
