---
name: Overview
type: index
tags: [index, overview]
---

# TimeLine Planner — Карта проекта

> Открой **Graph View** (`Ctrl+G`) чтобы увидеть граф связей.

## Архитектурные слои

### Ядро (Core)
- [[main]] → точка входа, инициализация
- [[App]] → роутер страниц
- [[store]] → глобальное состояние (singleton + subscribers + undo)
- [[electronApi]] → мост к Electron main process

### Страницы (Pages)
- [[TimelinePage]] → Gantt-диаграмма ⭐ (самый сложный компонент)
- [[TasksPage]] → таблица задач
- [[ResourcesPage]] → ресурсы (заглушка)

### Компоненты Layout
- [[Sidebar]] → навигация + управление конфигами

### Компоненты UI
- [[DateRangePicker]] → выбор диапазона дат
- [[ConfirmDialog]] → модал подтверждения
- [[Autocomplete]] → поле с подсказками
- [[ParameterRow]] → строка параметра в Gantt

### Модалы Timeline
- [[TaskModal]] → создание/редактирование задачи
- [[ParameterModal]] → создание/редактирование параметра

### Визуальные компоненты Timeline
- [[TaskBar]] → полоса задачи на гриде
- [[SelectionHighlightLayer]] → подсветка дат

### Хуки Timeline
- [[useScrollSync]] → синхронизация скролла
- [[useTaskDragResize]] → drag & resize задач
- [[useParamDnD]] → drag & drop параметров

### Утилиты
- [[parameters]] → работа с деревом параметров
- [[validateUrl]] → валидация HTTPS-ссылок

### Стили
- [[index.css]] → глобальная тема Tailwind v4

---

## Легенда тегов

| Тег | Цвет (настрой в Obsidian) | Значение |
|---|---|---|
| `#core` / `#store` | 🔴 Красный | Ядро, критические модули |
| `#page` | 🟠 Оранжевый | Страницы приложения |
| `#component` | 🔵 Синий | Переиспользуемые компоненты |
| `#modal` | 🟣 Фиолетовый | Модальные окна |
| `#hook` | 🟡 Жёлтый | Кастомные хуки |
| `#util` | ⚪ Серый | Утилиты без зависимостей |
| `#style` | 🟢 Зелёный | Стили |
| `#api` / `#electron` | 🟤 Коричневый | Внешние API |

---

*Граф сгенерирован автоматически на основе анализа импортов проекта.*
