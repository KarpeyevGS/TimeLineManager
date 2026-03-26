---
name: DateRangePicker.tsx
type: component
tags: [component, ui, date, input]
source: src/components/ui/DateRangePicker.tsx
---

# DateRangePicker.tsx

Продвинутый выбор диапазона дат с тремя режимами просмотра: дни / месяцы / годы. Построен поверх `react-day-picker` с кастомными стилями. Поддерживает фиксированное и абсолютное позиционирование, автозакрытие при клике вне компонента.

## Зависимости

- `react-day-picker` — базовый календарный компонент
- `date-fns` + `date-fns/locale` — форматирование и навигация дат (RU локаль)

## Используется в

- [[TimelinePage]] — управление диапазоном дат Gantt
- [[TaskModal]] — выбор дат начала/конца задачи
