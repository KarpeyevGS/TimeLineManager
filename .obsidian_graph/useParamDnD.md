---
name: useParamDnD.ts
type: hook
tags: [hook, dnd, timeline, logic]
source: src/pages/Timeline/hooks/useParamDnD.ts
---

# useParamDnD.ts

Кастомный хук для drag-and-drop параметров в панели Timeline. Управляет переупорядочиванием, сменой родителя (reparenting) и определением зоны сброса (выше/ниже целевого элемента).

## Зависимости

- [[store]] — `type TimelineParameter`
- `@dnd-kit/core` — сенсоры и события DnD
- `@dnd-kit/sortable` — стратегия сортировки

## Используется в

- [[TimelinePage]]
