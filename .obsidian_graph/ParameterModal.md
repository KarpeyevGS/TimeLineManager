---
name: ParameterModal.tsx
type: component
tags: [component, modal, timeline, form]
source: src/pages/Timeline/ParameterModal.tsx
---

# ParameterModal.tsx

Модал создания/редактирования параметра Timeline. Поддерживает иерархический выбор родителя и построитель фильтров по кастомным полям задач. Валидирует уникальность полей и генерирует конфиг фильтра.

## Зависимости

- [[store]] — `type TimelineParameter`, `type Task`, `type CustomFieldType`
- [[Autocomplete]] — выбор родительского параметра

## Используется в

- [[TimelinePage]] — открывается для создания/редактирования параметра в левой панели
