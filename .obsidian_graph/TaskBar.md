---
name: TaskBar.tsx
type: component
tags: [component, timeline, task]
source: src/pages/Timeline/TaskBar.tsx
---

# TaskBar.tsx

Рендер одной полосы задачи в Gantt. Поддерживает два вида: обычная полоса и ромб-майлстоун. Обрабатывает события drag/resize/edit, отображает название задачи и иконку URL-ссылки при наличии.

## Зависимости

- [[store]] — `type Task`
- [[validateUrl]] — проверка URL перед рендером иконки ссылки

## Используется в

- [[TimelinePage]] — рендер каждой задачи в гриде
