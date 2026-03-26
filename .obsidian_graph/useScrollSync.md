---
name: useScrollSync.ts
type: hook
tags: [hook, scroll, timeline, logic]
source: src/pages/Timeline/hooks/useScrollSync.ts
---

# useScrollSync.ts

Кастомный хук синхронизации скролла между секциями Timeline: левая панель (параметры), основной грид, шапка временной оси, закреплённые строки и полоса прокрутки. Использует `useLayoutEffect` для синхронного применения позиций.

## Зависимости

- [[store]] — `type TimelineViewState`

## Используется в

- [[TimelinePage]]
