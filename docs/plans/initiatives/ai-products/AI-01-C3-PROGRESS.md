# AI-01-C3 — Hub, landing и подключения

**Статус:** implemented / live UI not closed. C2 и AI-01 не закрыты. Источник — [AI-01-C](AI-01-C-COMPOSITION-UI-PLAN.md) C3.

## Сделано

- Hub baseline и seed: независимые `speech_analytics` и `ai_voice_robots`. Сценарные роботы остаются `/voice-robots` в Apps. `/ai-robots` — product landing, ссылка с `/ai-agents`.
- Deep-link: landing `/speech-analytics` и `/ai-robots` показывают locked/expired сами; `/connections` остаётся под license gate.
- Landing: pending до server status, состояния locked/expired/not installed/disabled/unavailable/not configured/ready. Switch — optimistic Hub catalog patch + undo, toast с кодом отказа.
- Connections: B3 `/api/v1/integrations`, secret-once dialog (copy/download, clear on close), empty resource copy, 403/503 отличимы, rotate/revoke с подтверждением.
- Logout сбрасывает RTK cache, включая `AiIntegrations`.

## Не закрыто

- Browser 360/1440 и login vs live DB.
- Live create/rotate secret against disposable API.
- Hub DB rows на уже существующих инсталляциях (client baseline показывает продукты как locked).
