---
name: index.css
type: style
tags: [style, theme, global]
source: src/index.css
---

# index.css

Глобальные стили приложения. Подключает Tailwind CSS v4, задаёт кастомную цветовую тему через CSS-переменные (`@theme`), подгружает шрифт Inter Tight (локальные файлы), добавляет стили для печати.

## Кастомные цвета (Tailwind-классы)

| Переменная | Использование |
|---|---|
| `app-bg` | Фон приложения |
| `app-surface` | Поверхности (карточки, панели) |
| `app-border` | Границы |
| `app-text-main` | Основной текст |
| `app-text-muted` | Вторичный текст |
| `app-primary` | Акцентный цвет |
| `app-error` | Ошибки и blocker |

## Зависимости

- `tailwindcss` (v4)

## Используется в

- [[main]] — импортируется при старте
