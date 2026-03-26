---
name: TimelinePage.tsx
type: page
tags: [page, timeline, gantt, core]
source: src/pages/Timeline/TimelinePage.tsx
---

# TimelinePage.tsx

**Самый сложный компонент проекта** — Gantt-диаграмма с иерархическими параметрами. Возможности: перетаскивание и изменение размера задач, уровни зума (2W/3W/M/Q/2Q), синхронизация скролла, динамическая группировка дат (кварталы/месяцы/недели), управление параметрами через модалы, печать.

## Зависимости

- [[store]] — `useAppStore`, `useTimelineViewState`, `type Task`, `type TimelineParameter`
- [[DateRangePicker]] — выбор диапазона дат Gantt
- [[TaskModal]] — создание/редактирование задач
- [[ParameterModal]] — создание/редактирование параметров
- [[ConfirmDialog]] — подтверждение удалений
- [[TaskBar]] — рендер отдельной полосы задачи
- [[SelectionHighlightLayer]] — подсветка выделенных дат
- [[useScrollSync]] — синхронизация скролла между панелями
- [[useTaskDragResize]] — перетаскивание и изменение размера задач
- [[useParamDnD]] — drag-and-drop параметров
- `@dnd-kit/*` — drag-and-drop движок
- `date-fns` — вычисления дат
