---
name: store.ts
type: store
tags: [store, core, logic]
source: src/store.ts
---

# store.ts

**Центральное хранилище данных** — синглтон с подписчиками и стеком undo. Управляет задачами, кастомными полями, конфигами timeline, ресурсами, проектами. Персистентность — через `localStorage` или Electron API.

## Экспортируемые сущности

| Хук / функция | Назначение |
|---|---|
| `useAppStore` | Подписка на данные из любого компонента |
| `useTimelineViewState` | Состояние вида Timeline (зум, диапазон дат) |
| `initGlobalAppData` | Инициализация при старте |
| `undoAppData` | Откат последнего действия |
| `type Task` | Тип задачи |
| `type TimelineParameter` | Тип параметра в Gantt |
| `type CustomFieldType` | Тип кастомного поля |

## Зависимости

- [[electronApi]] — доступ к Electron API для сохранения/загрузки
- [[validateUrl]] — валидация URL при импорте данных
