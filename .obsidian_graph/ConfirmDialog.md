---
name: ConfirmDialog.tsx
type: component
tags: [component, ui, modal]
source: src/components/ui/ConfirmDialog.tsx
---

# ConfirmDialog.tsx

Модальный диалог подтверждения/отмены действия с опциональной третьей кнопкой. Рендерится через React Portal прямо в `document.body`, поверх всего контента.

## Зависимости

Нет внешних зависимостей (только React + ReactDOM).

## Используется в

- [[Sidebar]] — подтверждение удаления конфигурации
- [[TasksPage]] — подтверждение удаления задачи
- [[TimelinePage]] — подтверждение опасных действий
