---
name: TasksPage.tsx
type: page
tags: [page, tasks, table]
source: src/pages/Tasks/TasksPage.tsx
---

# TasksPage.tsx

Страница табличного вида задач. Колонки: название, даты, статус/приоритет, кастомные поля. Поддерживает добавление, редактирование (через модал), копирование и удаление задач через контекстное меню.

## Зависимости

- [[store]] — `useAppStore`, `type Task`
- [[TaskModal]] — модал создания/редактирования задачи
- [[ConfirmDialog]] — подтверждение удаления
- `date-fns` — форматирование дат
