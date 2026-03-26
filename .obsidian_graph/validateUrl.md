---
name: validateUrl.ts
type: util
tags: [util, validation, security]
source: src/utils/validateUrl.ts
---

# validateUrl.ts

Утилита валидации URL. Принимает только HTTPS-ссылки — защита от `javascript:` и небезопасных схем в полях задач.

## Зависимости

Нет внешних зависимостей.

## Используется в

- [[store]] — валидация при импорте данных
- [[TaskBar]] — перед рендером иконки ссылки
- [[TaskModal]] — валидация введённого URL
