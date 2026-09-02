# Phase 13: Custom voicemail instead of VoiceMail - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

> Исторически эта фаза называлась **12b**. GSD 1.12 принимает только числовые id (`\d[\d.]*`), поэтому в ROADMAP она перенумерована в Phase 13. Визуальный конструктор / MCP / D-46/D-48/D-50 — **Phase 14**.

<domain>
## Phase Boundary

Заменить приложение Asterisk `VoiceMail()` собственной голосовой почтой: опциональное приветствие → `Record()` с обязательной `k` и `hangup_handler_push` до записи → notify → расшифровка/саммаризация через существующие `stt-engines` + тонкий OpenAI-совместимый LLM-клиент. Доступ к сообщениям — вкладка/фильтр в CDR (Surface L из `12-UI-SPEC.md`), не отдельный раздел. Старый тип действия `voicemail` — hard-remove с миграцией шагов.

Scope (in): **D-54…D-59** (залочены в `12-CONTEXT.md`, здесь снова отслеживаемые) + решения этого discuss (D-60…D-73).

Scope (out): MWI, прослушивание с трубки (`VoiceMailMain`), блок-схема/MCP/шаблоны/dry-run/callback (Phase 14), отдельный том/retention для ВП.

</domain>

<decisions>
## Implementation Decisions

### Inherited (D-54…D-59) — now tracked

Текст не дублировать — канон в `12-CONTEXT.md`. Кратко для планировщика:

- **D-54:** Кастомное приложение полностью заменяет `VoiceMail()`. Hard-remove старого `voicemail` + миграция шагов. Состав: опциональное приветствие → запись → notify → STT/саммари. Отдельный шаг beep не нужен (`Record()` играет beep, глушится `q`).
- **D-55:** Опция `k` обязательна. Перед `Record()` обязателен `Set(CHANNEL(hangup_handler_push)=…)` — `k` спасает файл, но не возвращает управление в цепочку. Порядок строк — обязательный тест фазы.
- **D-56:** UI выносит опции `Record()` (`o`, `x`, `y`, `n`/`s`, лимит, тишина, `u`). `RECORD_STATUS` — все **7** значений включая `OPERATOR`. `RECORDED_FILE` в payload notify.
- **D-57:** Расшифровка/саммари — интеграция `stt-engines` + провайдеры `ai-agents`. LLM-клиента в проекте нет — нужен тонкий OpenAI-совместимый клиент с AES-ключом по паттерну `CcAiProvider.encrypted_api_key`.
- **D-58:** Доступ — вкладка/фильтр в CDR, кнопка «Детализация», плеер. Корреляция по `${UNIQUEID}`. Реюз `hasRecording` / access-scope / Range; резолвер пути `safeRecordFilePath` (`.mp3`) **не** переиспользовать.
- **D-59:** Ссылка в notify — аутентифицированная, истекающая. `cdr-public.controller.ts` **запрещён**. Прецедент: `cc_display_tokens` + `DisplayTokenGuard`.

### Триггер STT/LLM

- **D-60:** После сохранения сообщения hangup_handler **не** вызывает STT/LLM. Сканер забирает строки `status=pending`. — **Reversibility:** costly — меняет контракт handler vs worker
- **D-61:** Сканер — Nest `@Interval` в voicemail-сервисе, пачками. Без BullMQ/Redis (их нет в проекте). Строки переживают рестарт Nest.
- **D-62:** Notify уходит **сразу** из hangup_handler (файл или ссылка). STT/саммари дописывают текст в CDR позже. Вкладка деталей показывает «Расшифровка готовится» (UI-SPEC Surface L).
- **D-63:** STT/LLM **опциональны**. Нет движка у тенанта — файл + notify достаточно, `status=ready` без текста, в CDR «расшифровка не настроена».

### Вложение vs ссылка

- **D-64:** Порог считается **по размеру файла в байтах**, не по длительности.
- **D-65:** Порог **2 МБ** (~2 мин WAV 8 kHz 16-bit mono). Ниже — вложение; выше — только ссылка с TTL.
- **D-66:** Если файл < 2 МБ, но провайдер отверг вложение — тем же каналом сразу переотправить **ссылкой**. Не считать это исчерпанием ретраев notify.
- **D-67:** TTL токена ссылки — **7 дней**. После истечения 404/410; файл на диске остаётся. Отзыв через существующую модель opaque-токена. — **Reversibility:** reversible

### Ретраи

- **D-68:** Notify: **3 попытки**, backoff **~1 / 4 / 10 мин**. После 3-й — `status=notify_failed`. Файл и строка CDR остаются.
- **D-69:** Ошибка notify видна **только в деталях сообщения в CDR**. Отдельного admin-алерта нет.
- **D-70:** STT/LLM: **3 попытки**, потом `status=ready` без текста + «расшифровка не удалась» (UI-SPEC backstop). Notify уже ушёл и не откатывается.

### Формат и хранение

- **D-71:** `Record()` пишет **wav**. `parseWavPcm16` — разбор RIFF-чанков, не «первые 44 байта»; `sampleRate` проверяется вызывающим (ожидаем 8 kHz). — **Reversibility:** costly — трогает генератор, стример, STT
- **D-72:** Тот же том, что записи разговоров (`records_base_path` / `/usr/records`), подкаталог `voicemail/`. Access-scope и бэкапы те же. — **Reversibility:** one-way — путь на диске и в БД после первого ingest
- **D-73:** Retention/cleanup файлов ВП — **как у записей разговоров**. Своей политики нет.
- **D-74:** Дефолт лимита длительности в UI шага — **120 сек** (переопределяется на шаге).

### Claude's Discretion

- Точный период `@Interval` (секунды) — лишь бы backoff D-68 соблюдался по `next_attempt_at` / эквиваленту.
- Имя колонок статусов (`pending` / `ready` / `notify_failed`) — планировщик может уточнить, семантика выше обязательна.
- Вложение в Telegram слать как document/audio, не как `sendVoice` (лимит 1 МБ).
- Имя подкаталога `voicemail/` vs `vm/` — `voicemail/` если нет коллизии.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked voicemail decisions (do not fork)
- `.planning/phases/12-dialplan-apps-editor-refactor-reusable-route-chain-builder/12-CONTEXT.md` — **D-54…D-59 полный текст**; не копировать в планы своими словами
- `.planning/ROADMAP.md` — секция Phase 13 (было 12b): ловушки 1–6, workflow включая `/gsd-secure-phase 13`

### Research / UI / patterns from Phase 12
- `.planning/phases/12-dialplan-apps-editor-refactor-reusable-route-chain-builder/12-RESEARCH.md` — `Record()`/`hangup_handler`, `stt-engines`, `safeRecordFilePath`, WAV→PCM16, Open Questions 2–5
- `.planning/phases/12-dialplan-apps-editor-refactor-reusable-route-chain-builder/12-PATTERNS.md` — scaffold модуля (`modules/notifications/`), `cc_display_tokens` + `DisplayTokenGuard`, AES ключей провайдера
- `.planning/phases/12-dialplan-apps-editor-refactor-reusable-route-chain-builder/12-UI-SPEC.md` — **Surface L целиком** (вкладка CDR, плеер, empty/loading/overflow расшифровки)

### Architecture
- `.planning/CANONICAL_REFS.md`
- `packages/backend/.idea/ARCHITECTURE.md` — тенантность, JWT/RBAC, записи, MCP-tool для новых сущностей
- `packages/frontend/.idea/ARCHITECTURE.md` — FSD, `shared/ui/AudioPlayer`, optimistic patterns

### Integration code
- `packages/backend/src/modules/reports/cdr/` — `hasRecording` / `streamRecording` / access-scope (реюз); `safeRecordFilePath` не реюзить
- `packages/backend/src/modules/stt-engines/` — тенантные STT, PCM16
- `packages/backend/src/modules/ai-agents/` — реестр провайдеров, **не** готовый LLM-клиент
- `packages/backend/src/modules/call-center/` — `cc_display_tokens`, `DisplayTokenGuard` (прецедент D-59)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shared/ui/AudioPlayer` — плеер в деталях сообщения (уже для записей разговоров)
- `NotificationDispatcher` / тип `notify` — канал уведомления после записи
- `DisplayTokenGuard` + `cc_display_tokens` — opaque TTL + отзыв, `req.user` без `sub`/`level`
- `SttEngine` / `stt-provider.interface.ts` — `yandex-streaming-stt`, `custom-http-stt`
- AES-паттерн `CcAiProvider.encrypted_api_key` — для нового OpenAI-совместимого клиента

### Established Patterns
- Hangup handler **до** `Record(` — единственный путь уведомления при отбое (D-55)
- Стрим записи: access-scope + `Range`; отдельный резолвер пути под `.wav` + `audio/wav`
- UI-SPEC: две иконки на одной CDR-строке (`Mic` = разговор, `Voicemail` = сообщение)

### Integration Points
- Генератор dialplan (`dialplan.util.ts`) — новый тип действия + hangup_handler context
- CDR report UI — вкладка/фильтр Surface L
- Миграция существующих шагов `type=voicemail`
- MCP-tool + AI-webhook для новой сущности сообщений (канон backend ARCHITECTURE)

</code_context>

<specifics>
## Specific Ideas

- Пользователь изначально: приветствие опционально, beep, запись, notify с вложением или ссылкой, опционально STT/саммари LLM.
- Research-пример генерации: `Record(${KVM_FILE}.wav,3,120,ky)` — дефолт длительности 120 сек подтверждён в discuss.
- Сканер по `status='pending'` был рекомендацией research (очередей задач в репо нет) — пользователь выбрал её явно.

</specifics>

<deferred>
## Deferred Ideas

- Визуальный конструктор, MCP/LLM-построение маршрутов, шаблоны цепочек (D-46), dry-run (D-48), callback (D-50) — **Phase 14**
- MWI и `VoiceMailMain` — вне roadmap этой линии
- Своя политика retention для ВП — отвергнута (D-73)
- BullMQ/Redis — не вводим; если сканер не справится, отдельная фаза

None of these were folded from todos (todo.match-phase 13 empty).

</deferred>

---

*Phase: 13-custom-voicemail-instead-of-voicemail*
*Context gathered: 2026-09-02*
