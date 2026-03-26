---
name: App.tsx
type: router
tags: [router, core]
source: src/App.tsx
---

# App.tsx

Корневой компонент приложения. Управляет навигацией между страницами (`Tasks`, `Timeline`, `Resources`) через локальный `activePage` state и глобальным undo/redo по `Ctrl+Z`.

## Зависимости

- [[Sidebar]] — боковое меню навигации
- [[TimelinePage]] — страница Gantt-диаграммы
- [[TasksPage]] — страница таблицы задач
- [[ResourcesPage]] — страница ресурсов
- [[store]] — `undoAppData`
