---
name: SelectionHighlightLayer.tsx
type: component
tags: [component, timeline, visual]
source: src/pages/Timeline/SelectionHighlightLayer.tsx
---

# SelectionHighlightLayer.tsx

Оверлей-слой поверх Gantt-грида. Рендерит подсветку: выделенные даты, текущая неделя, выходные дни, сегодня. Адаптирует отображение в зависимости от уровня зума (вид по неделям vs по дням).

## Зависимости

- `date-fns` — `format`, `isToday`, `isWeekend`, `getWeek`
- `date-fns/locale` — русская локаль

## Используется в

- [[TimelinePage]] — монтируется поверх временной сетки
