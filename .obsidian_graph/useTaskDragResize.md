---
name: useTaskDragResize.ts
type: hook
tags: [hook, drag, resize, timeline, logic]
source: src/pages/Timeline/hooks/useTaskDragResize.ts
---

# useTaskDragResize.ts

Кастомный хук обработки перетаскивания и изменения размера задач на Timeline. Пересчитывает даты задачи на основе смещения в пикселях и ширины одного дня (`dayWidth`).

## Зависимости

- [[store]] — `type Task`
- `react-day-picker` — `type DateRange`

## Используется в

- [[TimelinePage]]
