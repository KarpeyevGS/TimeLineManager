---
name: Sidebar.tsx
type: component
tags: [component, layout, navigation]
source: src/components/layout/Sidebar.tsx
---

# Sidebar.tsx

Сворачиваемая боковая панель навигации. Содержит меню страниц, кнопки импорта/экспорта, управление конфигурациями Timeline (переименование, дублирование, удаление) с контекстным меню и тултипами в свёрнутом состоянии.

## Зависимости

- [[store]] — `useAppStore` (список конфигов, активный конфиг)
- [[electronApi]] — `getElectronAPI` (экспорт/импорт файлов)
- [[ConfirmDialog]] — диалог подтверждения опасных действий
