---
name: electronApi.ts
type: api
tags: [api, electron, bridge]
source: src/electronApi.ts
---

# electronApi.ts

Мост между React-рендерером и Electron main process. Предоставляет типобезопасный интерфейс для сохранения/загрузки данных, управления состоянием вида, экспорта/импорта и событий жизненного цикла приложения.

## Функции

- `getElectronAPI()` — возвращает объект `window.electronAPI` (или `null` вне Electron)
- `isElectron()` — проверяет, запущено ли приложение в Electron

## Зависимости

Нет внешних зависимостей — чистые интерфейсы и доступ к `window`.

## Используется в

- [[store]] — для персистентности данных
- [[Sidebar]] — для импорта/экспорта файлов
