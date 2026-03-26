---
name: main.tsx
type: entrypoint
tags: [entrypoint, bootstrap]
source: src/main.tsx
---

# main.tsx

Точка входа приложения. Асинхронно инициализирует глобальные данные из хранилища, затем монтирует React-дерево в DOM через `createRoot`.

## Зависимости

- [[store]] — `initGlobalAppData` (инициализация перед рендером)
- [[App]] — корневой компонент приложения
- [[index.css]] — глобальные стили
