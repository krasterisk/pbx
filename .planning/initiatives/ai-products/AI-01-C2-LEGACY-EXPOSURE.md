# AI-01-C2 — inventory публичных legacy API в full-PBX

Дата: 2026-09-19. Это review существующего production состава, не разрешение экспонировать его наружу. Standalone `analytics-api` и `robot-api` не импортируют эти контроллеры; это подтверждает только их состав, не защищает `full-pbx`.

| Surface | Наблюдение в коде | Последствие |
|---|---|---|
| `GET/POST/PUT/DELETE /api/public/voice-robots/**` | `VoiceRobotsPublicController` зарегистрирован в `VoiceRobotsModule`, без JWT/API key; tenant всегда `DEFAULT_VPBX_USER_UID` (по умолчанию `1`). CRUD роботов, keyword/data lists, CDR и logs доступны через одни маршруты. | Внешняя публикация full-PBX API раскрывает и меняет данные фиксированного tenant. Это legacy v3 integration; нельзя молча удалить без проверки клиента. |
| `/api/internal/dialplan/{custom-webhook,before-dial,on-answer,on-hangup}` | `DialplanWebhooksController.validateKey` проверяет `DIALPLAN_API_KEY` только если он задан; принимает ключ из body. `user_uid` берётся из запроса. | При незаданном ключе любой достижимый HTTP-клиент может послать событие. Ключ не является tenant-aware identity для аналитического ingestion. |
| `/api/internal/dialplan/{notify,sendmail}` и `/api/internal/ivr/play-phrase` | Аналогичная проверка `if (this.apiKey && ...)`; при пустом ключе отказа нет. | Side-effect запросы доступны по сети, если ingress не ограничен. |
| Остальные dialplan handlers (bridge, voicemail, directory lookup, callback, autodial) | `timingSafeApiKeyEqual` возвращает false при пустом configured key; эти handlers fail-closed. | Отличаются от предыдущих; единый network/auth contract отсутствует. |

**Текущее решение C2:** не подключать legacy controllers в standalone API. Для full-PBX перед внешним выпуском нужен конкретный compatibility rollout: установить обязательный secret для всех internal handlers; разделить Asterisk-only ingress и public API на уровне deployment; перевести v3 voice-robot client на scoped credential/JWT с tenant binding и проверить его E2E, после чего убрать безусловный fixed-tenant CRUD. Простая смена frontend клиента не закрывает старые URL. До выполнения rollout `full-pbx` нельзя считать безопасно готовым к внешней публикации всех `/api/*`.

Следующий code assignment для remediation должен владеть `voice-robots-public.controller.ts`, всеми перечисленными internal controllers, dialplan URL/key generation и reverse-proxy/deployment config; добавить отрицательные HTTP tests с пустым/чужим ключом, v3 compatibility fixture и tenant A/B. Не использовать optional `DIALPLAN_API_KEY` как trusted identity для AI analytics ingestion.
