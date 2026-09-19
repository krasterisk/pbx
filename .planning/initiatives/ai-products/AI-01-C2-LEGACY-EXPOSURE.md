# AI-01-C2 — inventory публичных legacy API в full-PBX

Дата: 2026-09-19. Это review существующего production состава, не разрешение экспонировать его наружу. Standalone `analytics-api` и `robot-api` не импортируют эти контроллеры; это подтверждает только их состав, не защищает `full-pbx`.

| Surface | Наблюдение в коде | Последствие |
|---|---|---|
| `GET/POST/PUT/DELETE /api/public/voice-robots/**` | `VoiceRobotsPublicController` URLs unchanged. `VoiceRobotsPublicKeyGuard` requires `VOICE_ROBOTS_PUBLIC_API_KEY` or `DIALPLAN_API_KEY` via `x-api-key` / `api_key`; empty configured key fails closed. Tenant is still `DEFAULT_VPBX_USER_UID`. | v3 clients keep the same paths but must send the key. Unauthenticated CRUD is closed. Compatibility evidence vs a live v3 client is still pending. |
| `/api/internal/dialplan/{custom-webhook,before-dial,on-answer,on-hangup}` | `DialplanWebhooksController` now uses `timingSafeApiKeyEqual`: empty configured key and wrong/missing request key both 401. | Asterisk CURL must send the configured `DIALPLAN_API_KEY`. Installations without a key fail closed instead of accepting anyone. |
| `/api/internal/dialplan/{notify,sendmail}` и `/api/internal/ivr/play-phrase` | Same fail-closed helper as directory/bridge/voicemail/callback. | Единый contract: missing env key is not an open network. |
| Остальные dialplan handlers (bridge, voicemail, directory lookup, callback, autodial) | `timingSafeApiKeyEqual` возвращает false при пустом configured key; эти handlers fail-closed. | Internal dialplan contract is now the same helper. Autodial files were not edited in this assignment. |

**Текущее решение C2:** standalone analytics/robot API по-прежнему не импортируют эти контроллеры. Internal dialplan/IVR notify/sendmail/webhooks/`play-phrase` fail-closed через `timingSafeApiKeyEqual` (пустой env key = 401). `community-pbx` / `full-pbx` всё ещё регистрируют `VoiceRobotsPublicController`: unauthenticated fixed-tenant CRUD остаётся, его нельзя молча удалить без v3 client E2E. Перед внешним выпуском: обязательный `DIALPLAN_API_KEY` в установке и Asterisk CURL; network isolation `/internal/*`; перевод v3 voice-robot client на scoped credential/JWT. До этого `full-pbx` нельзя считать безопасно готовым к внешней публикации всех `/api/*`. `DIALPLAN_API_KEY` не является tenant-aware identity для AI analytics ingestion.
