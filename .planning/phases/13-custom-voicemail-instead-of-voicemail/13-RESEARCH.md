# Phase 13: Custom voicemail instead of VoiceMail - Research

**Researched:** 2026-09-02
**Domain:** Asterisk `Record()` + hangup handlers, NestJS ingest/scanner, tenant STT/LLM, CDR Surface L, opaque token links
**Confidence:** HIGH (in-repo seams + official Asterisk 22 docs); MEDIUM (Telegram/OpenAI HTTP shapes); LOW (live Asterisk hangup-during-Record on this host)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Inherited (D-54…D-59) — now tracked

Текст не дублировать — канон в `12-CONTEXT.md`. Кратко для планировщика:

- **D-54:** Кастомное приложение полностью заменяет `VoiceMail()`. Hard-remove старого `voicemail` + миграция шагов. Состав: опциональное приветствие → запись → notify → STT/саммари. Отдельный шаг beep не нужен (`Record()` играет beep, глушится `q`).
- **D-55:** Опция `k` обязательна. Перед `Record()` обязателен `Set(CHANNEL(hangup_handler_push)=…)` — `k` спасает файл, но не возвращает управление в цепочку. Порядок строк — обязательный тест фазы.
- **D-56:** UI выносит опции `Record()` (`o`, `x`, `y`, `n`/`s`, лимит, тишина, `u`). `RECORD_STATUS` — все **7** значений включая `OPERATOR`. `RECORDED_FILE` в payload notify.
- **D-57:** Расшифровка/саммари — интеграция `stt-engines` + провайдеры `ai-agents`. LLM-клиента в проекте нет — нужен тонкий OpenAI-совместимый клиент с AES-ключом по паттерну `CcAiProvider.encrypted_api_key`.
- **D-58:** Доступ — вкладка/фильтр в CDR, кнопка «Детализация», плеер. Корреляция по `${UNIQUEID}`. Реюз `hasRecording` / access-scope / Range; резолвер пути `safeRecordFilePath` (`.mp3`) **не** переиспользовать.
- **D-59:** Ссылка в notify — аутентифицированная, истекающая. `cdr-public.controller.ts` **запрещён**. Прецедент: `cc_display_tokens` + `DisplayTokenGuard`.

Полный текст D-54…D-59 (не переписывать в планах своими словами): `.planning/phases/12-dialplan-apps-editor-refactor-reusable-route-chain-builder/12-CONTEXT.md` строки 236–276.

#### Триггер STT/LLM

- **D-60:** После сохранения сообщения hangup_handler **не** вызывает STT/LLM. Сканер забирает строки `status=pending`. — **Reversibility:** costly — меняет контракт handler vs worker
- **D-61:** Сканер — Nest `@Interval` в voicemail-сервисе, пачками. Без BullMQ/Redis (их нет в проекте). Строки переживают рестарт Nest.
- **D-62:** Notify уходит **сразу** из hangup_handler (файл или ссылка). STT/саммари дописывают текст в CDR позже. Вкладка деталей показывает «Расшифровка готовится» (UI-SPEC Surface L).
- **D-63:** STT/LLM **опциональны**. Нет движка у тенанта — файл + notify достаточно, `status=ready` без текста, в CDR «расшифровка не настроена».

#### Вложение vs ссылка

- **D-64:** Порог считается **по размеру файла в байтах**, не по длительности.
- **D-65:** Порог **2 МБ** (~2 мин WAV 8 kHz 16-bit mono). Ниже — вложение; выше — только ссылка с TTL.
- **D-66:** Если файл < 2 МБ, но провайдер отверг вложение — тем же каналом сразу переотправить **ссылкой**. Не считать это исчерпанием ретраев notify.
- **D-67:** TTL токена ссылки — **7 дней**. После истечения 404/410; файл на диске остаётся. Отзыв через существующую модель opaque-токена. — **Reversibility:** reversible

#### Ретраи

- **D-68:** Notify: **3 попытки**, backoff **~1 / 4 / 10 мин**. После 3-й — `status=notify_failed`. Файл и строка CDR остаются.
- **D-69:** Ошибка notify видна **только в деталях сообщения в CDR**. Отдельного admin-алерта нет.
- **D-70:** STT/LLM: **3 попытки**, потом `status=ready` без текста + «расшифровка не удалась» (UI-SPEC backstop). Notify уже ушёл и не откатывается.

#### Формат и хранение

- **D-71:** `Record()` пишет **wav**. `parseWavPcm16` — разбор RIFF-чанков, не «первые 44 байта»; `sampleRate` проверяется вызывающим (ожидаем 8 kHz). — **Reversibility:** costly — трогает генератор, стример, STT
- **D-72:** Тот же том, что записи разговоров (`records_base_path` / `/usr/records`), подкаталог `voicemail/`. Access-scope и бэкапы те же. — **Reversibility:** one-way — путь на диске и в БД после первого ingest
- **D-73:** Retention/cleanup файлов ВП — **как у записей разговоров**. Своей политики нет.
- **D-74:** Дефолт лимита длительности в UI шага — **120 сек** (переопределяется на шаге).

### Claude's Discretion

- Точный период `@Interval` (секунды) — лишь бы backoff D-68 соблюдался по `next_attempt_at` / эквиваленту.
- Имя колонок статусов (`pending` / `ready` / `notify_failed`) — планировщик может уточнить, семантика выше обязательна.
- Вложение в Telegram слать как document/audio, не как `sendVoice` (лимит 1 МБ).
- Имя подкаталога `voicemail/` vs `vm/` — `voicemail/` если нет коллизии.

### Deferred Ideas (OUT OF SCOPE)

- Визуальный конструктор, MCP/LLM-построение маршрутов, шаблоны цепочек (D-46), dry-run (D-48), callback (D-50) — **Phase 14**
- MWI и `VoiceMailMain` — вне roadmap этой линии
- Своя политика retention для ВП — отвергнута (D-73)
- BullMQ/Redis — не вводим; если сканер не справится, отдельная фаза

None of these were folded from todos (todo.match-phase 13 empty).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| D-54 | Replace `VoiceMail()` with custom app; hard-remove old `voicemail` emission; migrate existing steps; greeting → Record → notify → STT/summary | Keep ActionType name `voicemail`; change params + generator; migrate 6 JSON columns via `dialplan-actions-migration.util.ts` |
| D-55 | Mandatory `k` + `hangup_handler_push` **before** `Record(`; generator line-order test | Official Record() + hangup handlers; also **pop** handler after normal return (Pitfall 2) |
| D-56 | UI Record options `o/x/y/n/s/u` + duration + silence; all 7 `RECORD_STATUS` including `OPERATOR`; `RECORDED_FILE` in notify payload | Add `record_status` to `CONDITION_SOURCES` (absent today); new Record flags type — do **not** reuse `IMediaOptions` |
| D-57 | STT via existing `stt-engines` + `SttProviderFactory.transcribe`; thin OpenAI-compatible LLM client + AES `CcAiProvider.encrypted_api_key` | No `openai` package; `fetch`/`axios` + `decryptSecret` |
| D-58 | CDR tab/filter Surface L; details Dialog + `AudioPlayer`; correlate `${UNIQUEID}`; reuse access-scope + Range; new `.wav` path resolver | `CdrReportPage` Button-tab pattern; `safeRecordFilePath` hardcodes `.mp3` |
| D-59 | Opaque expiring token links; `cdr-public.controller.ts` forbidden; `cc_display_tokens` + `DisplayTokenGuard` precedent | New `vm_access_tokens` table + dedicated guard; JWT-audience example in 12-RESEARCH is **superseded** |
| D-60 | Hangup handler does **not** run STT/LLM; scanner picks `pending` | Two-axis status recommended so notify retries ≠ STT queue |
| D-61 | Nest `@Interval` batch scanner; no BullMQ/Redis; rows survive Nest restart | Mutex on interval; persist `next_attempt_at` in MySQL |
| D-62 | Notify immediately from ingest triggered by hangup handler; STT later; UI «Расшифровка готовится» | Fire-and-forget CURL (hangup handlers must be fast); first notify attempt in Nest, not on the Asterisk channel |
| D-63 | STT/LLM optional → `ready` without text + «расшифровка не настроена» | `transcript_status=not_configured`; no retry button (Surface L) |
| D-64 | Attach vs link threshold is **file bytes** | `fs.stat` after ingest |
| D-65 | Threshold **2 MiB** | ~2 min 8 kHz 16-bit mono WAV; well under Telegram sendDocument 50 MB |
| D-66 | Attach rejected → same-channel resend as link; does not consume notify retries | Distinct error class `attachment_rejected` vs transport failure |
| D-67 | Token TTL **7 days**; 404/410 after expiry; file remains; revocable | Mirror `CcDisplayToken.expires_at` / `revoked_at` |
| D-68 | Notify 3 attempts, backoff ~1/4/10 min → `notify_failed`; file + row remain | Scanner honors `next_notify_at`; do not share one status with STT |
| D-69 | Notify failure visible only in CDR message details; no admin alert | Surface L meta line; no Telegram/email to admins |
| D-70 | STT/LLM 3 attempts then ready without text + «расшифровка не удалась»; notify not rolled back | Map to Surface L `failed` + retry; keep D-70 semantics via `transcript_status=failed` |
| D-71 | Record format `wav`; RIFF chunk parse; caller checks `sampleRate` (expect 8 kHz) | `parseWavPcm16` from 12-RESEARCH — implement as-is |
| D-72 | Same volume as conversation recordings + `voicemail/` subdir | `{records_base_path}/{vpbx_user_uid}/voicemail/` |
| D-73 | Same retention as conversation recordings; no VM-specific policy | No in-app MP3 cleanup exists — do not invent a VM janitor |
| D-74 | Default max duration **120 s** in step UI | `IVoicemailParams.max_duration` default 120 |
</phase_requirements>

## Summary

Phase 13 replaces Asterisk `VoiceMail()` with a custom step: optional greeting `Playback` → mandatory `Set(CHANNEL(hangup_handler_push)=…)` → `Record(….wav,…,k…)` → fire-and-forget CURL ingest → immediate notify (attach if file < 2 MiB else opaque 7-day link) → Nest `@Interval` scanner for STT (`SttProviderFactory.transcribe` on headerless PCM16) and a thin OpenAI-compatible summary client. Messages are listed as a third Button-tab on `CdrReportPage` (Surface L), not a new section. The old generator arm `VoiceMail(${exten}@default,u)` is deleted; the ActionType name `voicemail` stays and its params expand.

**Primary recommendation:** Keep `type: 'voicemail'`. Split persisted state into **two axes** (`notify_status` + `transcript_status`) so D-60/D-68 cannot starve each other. Ingest via `POST /internal/dialplan/voicemail` with `timingSafeApiKeyEqual`. Generate a dedicated hangup-handler context that ends in `Return()`. After a normal `Record()` return, **pop** the handler before `Goto(done)` so ingest is not double-fired. Do not install new npm packages. Do not reuse `safeRecordFilePath`, `cdr-public.controller.ts`, `IMediaOptions`, or the 12-RESEARCH JWT-audience token sketch.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Greeting + Record + hangup handler | Asterisk (runtime) | API / Backend (generator) | Channel media and hangup path live in dialplan; Nest only emits lines |
| Ingest (row + first notify) | API / Backend | Database / Storage | Hangup handler CURL is fire-and-forget; work happens in Nest |
| Notify attach/link + retries | API / Backend | External (Telegram/email/…) | Providers already in `notifications/`; extend send API for files |
| STT / LLM summary | API / Backend | External STT/LLM | Scanner owns retries; Asterisk must not wait |
| Opaque play token | API / Backend | Database / Storage | TTL + revoke in MySQL; guard sets `req.user` without `sub`/`level` |
| WAV file on disk | Database / Storage | Asterisk (writer) | Same volume as MixMonitor; new subdir + `.wav` resolver |
| CDR tab / details / player | Browser / Client | API / Backend | Surface L; JWT stream in UI; token URL never rendered |
| Step schema / Record options / RECORD_STATUS presets | Browser / Client | API / Backend (DTO + generator) | Schema-driven editor; shared condition table |
| MCP / AI-webhook for messages | API / Backend | — | Backend ARCHITECTURE §6–7: new entity → tools + webhook |

## Standard Stack

### Core

| Library | Version (repo) | Purpose | Why Standard |
|---------|----------------|---------|--------------|
| NestJS | `^11.0.10` (`packages/backend/package.json`) | Module, controllers, `@Interval` | Existing backend |
| `@nestjs/schedule` | `^6.1.3` | D-61 scanner | Already used (`CallCenterZombieService` `@Interval(ZOMBIE_POLL_INTERVAL_MS)`) |
| Sequelize 6 | `^6.37.6` | `voicemail_messages` + token table | Project ORM; `synchronize: false` |
| axios | `^1.16.0` | Telegram multipart + LLM HTTP | Existing notify providers |
| Node `crypto` | runtime | Opaque tokens + AES | `randomBytes(32)` like display tokens; `encryptSecret`/`decryptSecret` |
| nodemailer | `^8.0.5` | Email attach | `MailerService` already has `attachments[]` for report mail |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-validator` / `class-transformer` | `^0.14.1` / `^0.5.1` | Expand `VoicemailParamsDto` | Every new step field |
| Vitest | `^4.1.4` (frontend) | Surface L + schema tests | `npm run test:frontend` |
| Jest | backend default | Generator / wav-pcm / ingest / scanner | `npm run test:backend` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@Interval` + MySQL `next_attempt_at` | BullMQ (`bullmq` `^5.76.5` is in `package.json`) | **Forbidden by D-61.** `webhook-queue.service.ts` documents BullMQ was **removed from use** because importing it blocked Nest boot when Redis was unset |
| Thin `fetch`/`axios` LLM client | `openai` SDK | New dependency + supply-chain gate; seed already stores OpenAI-compatible HTTP URL |
| Opaque token table | JWT `audience: 'voicemail-link'` (12-RESEARCH sketch) | **Superseded by D-59.** Second JWT audience is not how `auth.module` works; leaked JWT is a session |
| `sendVoice` | `sendDocument` | WAV is not OGG/OPUS; discretion forbids `sendVoice` |
| New `ffmpeg` convert | `parseWavPcm16` | No ffmpeg on the research host (12-RESEARCH Env table); D-71 locks chunk parse |

**Installation:** none. Do not `npm install` for this phase.

**Version verification:** versions above are from `packages/backend/package.json` and `packages/frontend/package.json` read this session. No new registry packages.

## Package Legitimacy Audit

> No external packages are added this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | No installs |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

`bullmq` / `ioredis` / `@nestjs/bullmq` are already in `package.json` but **must not** be wired for voicemail (D-61 + `webhook-queue.service.ts` removal note).

## Architecture Patterns

### System Architecture Diagram

```
Caller
  │
  ▼
Asterisk route step (voicemail)
  │  optional Playback(greeting)          ◄── hangup here: no message
  │  Set(CHANNEL(hangup_handler_push)=krsk-vm-done-{uid},s,1)
  │  Record({base}/{uid}/voicemail/${UNIQUEID}-%d.wav, silence, maxdur, k[qoxynsu])
  │     ├─ # / silence / timeout / 0 → RECORD_STATUS=DTMF|SILENCE|TIMEOUT|OPERATOR
  │     │     Set(CHANNEL(hangup_handler_pop)=)
  │     │     Goto(krsk-vm-done-{uid},s,1)
  │     └─ hangup → RECORD_STATUS=HANGUP, file kept by k, handler runs
  ▼
[krsk-vm-done-{uid}]
  CURL POST /api/internal/dialplan/voicemail   (DIALPLAN_API_KEY, fire-and-forget)
  Return()
  ▼
VoicemailDialplanController  →  200 {accepted:true} immediately
  ▼
VoicemailService.ingest (async)
  ├─ INSERT voicemail_messages (uniqueid UNIQUE)
  ├─ stat(file) → attach if size < 2 MiB else mint opaque token (TTL 7d)
  └─ NotificationDispatcher.send(+attachment|link)   ◄── D-62 first attempt NOW
        ├─ success → notify_status=sent
        └─ fail    → notify_status=pending, next_notify_at = now+1min
  ▼
@Interval scanner (mutex, batch)
  ├─ notify_status=pending AND next_notify_at<=now → retry (1/4/10 min; 3rd fail → notify_failed)
  └─ transcript_status=pending
        ├─ no tenant STT → not_configured, status ready (D-63)
        ├─ parseWavPcm16 → SttProviderFactory.transcribe → optional LlmSummaryService
        └─ 3 fails → transcript_status=failed, overall ready (D-70)
  ▼
CdrReportPage tab «Голосовые сообщения»  (same filter as checkbox)
  └─ Dialog details: AudioPlayer (JWT stream) + summary + transcript states
Notify link (Telegram/email only): GET /api/voicemail/play?token=  (DisplayToken-style guard)
```

### Recommended Project Structure

```
packages/shared/src/types/
├── voicemail.types.ts              # IVoicemailMessage, status unions, RECORD_STATUS_VALUES
├── dialplan-params.types.ts        # expand IVoicemailParams (keep name)
└── dialplan-condition.types.ts     # + 'record_status' + RECORD_STATUS_VALUES

packages/backend/src/modules/voicemail/
├── voicemail-message.model.ts
├── voicemail-access-token.model.ts # opaque TTL + revoked_at (D-59/D-67)
├── voicemail.module.ts             # analog: notifications.module.ts
├── voicemail.service.ts            # ingest + list/detail + stream
├── voicemail-scanner.service.ts    # @Interval + in-memory running flag
├── voicemail-dialplan.controller.ts
├── voicemail.controller.ts         # JWT list/detail/stream/retry-stt
├── voicemail-link.controller.ts    # token guard only — NOT under public/reports/cdr
├── voicemail-link.guard.ts         # copy DisplayTokenGuard: no sub/level
├── wav-pcm.util.ts + .spec.ts
├── llm-summary.service.ts + .spec.ts
└── migrate-voicemail.ts            # analog: migrate-notifications-phase6.ts

packages/backend/src/shared/utils/dialplan.util.ts   # replace VoiceMail() arm
packages/backend/src/modules/notifications/          # optional attach on send()
packages/frontend/src/features/dialplan-apps/model/schemas/voicemail.tsx
packages/frontend/src/features/cdr/                  # tab + filter + details Dialog
packages/frontend/src/shared/api/endpoints/voicemailApi.ts
```

### Pattern 1: Keep ActionType `voicemail`, expand params

**What:** Hard-remove is the **Asterisk app** `VoiceMail()`, not the registry key. Existing steps already have `type: 'voicemail'`.
**When to use:** D-54 migration.
**Do not** introduce `custom_voicemail` / `kvm` — that doubles migration and breaks `Record<ActionType, …>`.

Current params (verbatim):

```200:204:packages/shared/src/types/dialplan-params.types.ts
export interface IVoicemailParams {
  target?: ValueSource;
  /** @deprecated Wave 0 — read when `target` is absent */
  exten?: string;
}
```

Recommended expansion (planner names may vary; fields are locked by D-54/D-56/D-74):

- `greeting?` — prompt filename for `emitPlayback({ mode: 'plain', files })`
- `max_duration` — number, default **120**
- `silence_timeout?` — seconds for Record arg 2
- `record_options` — `{ q?, o?, x?, y?, n?, s?, u? }` — **`k` is not a user flag** (always emitted)
- `notify` — reuse `INotifyActionParams` (`integration_uid`, `body`, `target`, `subject`)
- `stt_engine_uid?` / `llm_provider_uid?` — optional; empty → D-63

### Pattern 2: Two-axis status (discretion on column names)

D-60 scanner picks `status=pending` for STT. D-68 sets `status=notify_failed` after notify exhaustion. A **single** `status` column cannot express “notify failed but STT still pending” or “notify sent, STT pending”.

| Axis | Values | Scanner predicate |
|------|--------|-------------------|
| `notify_status` | `pending` \| `sent` \| `failed` | `pending AND next_notify_at <= now` |
| `transcript_status` | `pending` \| `ready` \| `failed` \| `not_configured` | `pending` |

Overall D-60/D-63/D-68/D-70 mapping:

| Event | notify_status | transcript_status | UI Surface L |
|-------|---------------|-------------------|--------------|
| Ingest, STT configured | pending or sent | pending | `pending` — «Расшифровка готовится» |
| Ingest, no STT engine | pending or sent | `not_configured` | `not-configured` — link to STT settings, **no** retry |
| Notify 3rd fail | `failed` | unchanged | details-only destructive text (D-69) |
| STT/LLM 3rd fail | unchanged | `failed` | `failed` + «Повторить расшифровку» |
| STT+LLM ok | unchanged | `ready` | `done` |

D-70 wording `status=ready` without text is the **overall** “processing finished”; Surface L `failed` is `transcript_status=failed`. Discretion allows this rename.

### Pattern 3: Fire-and-forget ingest (hangup handlers must be fast)

Official hangup-handler warning: handlers “need to execute quickly because they are in the hangup sequence path”. [CITED: docs.asterisk.org/Configuration/Dialplan/Subroutines/Hangup-Handlers/]

Do **not** `CURL` Telegram from Asterisk. Mirror `DialplanNotifyController`:

```32:49:packages/backend/src/modules/notifications/dialplan-notify.controller.ts
  @Post('notify')
  @HttpCode(200)
  async notify(
    @Headers('x-api-key') headerKey: string,
    @Body() body: NotifyDialplanDto & { api_key?: string },
  ) {
    const providedKey = headerKey || body.api_key;
    // …
    this.dispatcher
      .dispatch(body)
      .catch((e) =>
        this.logger.error(`notify dispatch failed: ${e?.message ?? e}`),
      );
    return { accepted: true };
  }
```

Use `timingSafeApiKeyEqual` from `packages/backend/src/modules/dialplan-bridge/dialplan-api-key.ts` (verbatim):

```3:13:packages/backend/src/modules/dialplan-bridge/dialplan-api-key.ts
export function timingSafeApiKeyEqual(expected: string, provided?: string): boolean {
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided ?? '');
  const len = Math.max(a.length, b.length, 1);
  const ka = Buffer.alloc(len);
  const kb = Buffer.alloc(len);
  a.copy(ka);
  b.copy(kb);
  return crypto.timingSafeEqual(ka, kb) && a.length === b.length;
}
```

`DialplanNotifyController` still uses `!==` — **do not copy that**. Copy the bridge/directory-lookup pattern.

Hangup-handler context **must** end with `Return()`. [CITED: Hangup Handlers docs]

### Pattern 4: Pop handler after normal Record() return

If the generator both pushes a handler **and** `Goto(done)` after `Record()`, a `#`/silence/timeout/operator completion ingest **and** the later channel hangup ingest the same `UNIQUEID` twice.

```
Set(CHANNEL(hangup_handler_push)=krsk-vm-done-{uid},s,1)
Record(...,k...)
Set(CHANNEL(hangup_handler_pop)=)
Goto(krsk-vm-done-{uid},s,1)
```

Also enforce `UNIQUE(vpbx_user_uid, uniqueid)` (or uniqueid globally if already unique) and upsert ingest.

### Pattern 5: Opaque token, not JWT, not cdr-public

`DisplayTokenGuard` sets `req.user` **without** `level`/`sub`:

```46:50:packages/backend/src/modules/callcenter/guards/display-token.guard.ts
    req.user = {
      vpbx_user_uid: row.user_uid,
      isDisplayToken: true,
    };
```

Copy that. New table (do not overload `cc_display_tokens` — those are TV wallboard tokens). Columns analog: `token STRING(64)`, `expires_at`, `revoked_at`, `vpbx_user_uid`, `message_uid`. Mint with `randomBytes(32).toString('hex')`. TTL 7 days (D-67). Expired → 410/404; file stays.

`CdrPublicController` (`packages/backend/src/modules/reports/cdr/cdr-public.controller.ts:10-35`) streams recordings with `DEFAULT_VPBX_USER_UID` and **no JWT**. D-59 forbids reuse.

UI: token URL is generated **only** inside notify payload. Never render it as copyable text (Surface L). In-app play uses JWT `GET /api/voicemail/:uniqueid/play` + Range.

### Pattern 6: Attach API — extend providers, do not invent a second dispatcher

`INotificationProvider.send` is `(integration, target, message)` only — no file. `TelegramProvider` posts `sendMessage`. `EmailProvider` calls `mailer.sendNotification` without attachments. `MailerService` already has report attach (`attachments: [{ filename, content, contentType }]`).

Extend send with optional `{ filename, content, contentType }` for **telegram** (`sendDocument` multipart) and **email**. WhatsApp / MAX / VK / webhook: **link only** (no attach API in those providers). D-66: if attach HTTP fails and size < 2 MiB, immediately resend as text+link on the same channel; do not increment `notify_attempts`.

Telegram official: `sendDocument` — “files of any type of up to 50 MB”; `sendAudio` requires MP3/M4A; `sendVoice` requires OGG/OPUS (or MP3/M4A) — WAV must be `sendDocument`. [CITED: core.telegram.org/bots/api] Discretion: not `sendVoice`.

### Pattern 7: `.wav` resolver — copy the guard, not the suffix

```303:310:packages/backend/src/modules/reports/cdr/cdr.service.ts
  private safeRecordFilePath(basePath: string, record: string): string | null {
    const rel = record.replace(/^\/+/, '').replace(/\\/g, '/');
    if (!rel || rel.includes('..')) return null;
    const baseResolved = path.resolve(basePath);
    const fileResolved = path.resolve(baseResolved, `${rel}.mp3`);
    if (!fileResolved.startsWith(baseResolved)) return null;
    return fs.existsSync(fileResolved) ? fileResolved : null;
  }
```

New `safeVoicemailFilePath(base, rel)`: same `..` + `startsWith(baseResolved)` check; extension from DB (always `.wav` this phase); `Content-Type: audio/wav`. Reuse Range logic from `streamRecording` (`cdr.service.ts:433-492`: `Accept-Ranges`, `bytes=`, 416). Reuse `buildCdrLinkedidAccessClause` for list/detail tenancy.

On-disk path (D-72, no `vm/` collision found): `{records_base_path}/{vpbx_user_uid}/voicemail/{UNIQUEID}-%d.wav`. `records_base_path` priority: `system_settings` > `RECORDS_BASE_PATH` > `/usr/records` (`system-settings.service.ts:79`). Prod fact M9: `RECORDS_BASE_PATH=/usr/records`.

### Pattern 8: Schema-driven voicemail step UI

Registry stub today has **no** schema/defaultParams/summarize:

```331:331:packages/frontend/src/features/dialplan-apps/model/registry.ts
  voicemail: { type: 'voicemail', labelKey: 'routes.action.voicemail', category: 'notification' },
```

`StepSheet` falls back to `config?.schema ?? EMPTY_SCHEMA` — the step is a blank sheet. Add `schemas/voicemail.tsx` like `notify.tsx` (`integration_uid` `optionsSource: 'notifications'`). Record flags are **not** `IMediaOptions` (`noanswer`/`skip`/`p`/`mixMode` — Playback). New flag set: `o x y n s u q`. Never expose `k` as a checkbox.

`terminal` stays `'conditional'` (`dialplan-action-meta.ts:32`) — OPERATOR/next-step after Record is a chain, not `Hangup()`.

### Pattern 9: `RECORD_STATUS` condition source (Phase 12 gap)

`CONDITION_SOURCES` today (verbatim):

```6:12:packages/shared/src/types/dialplan-condition.types.ts
export const CONDITION_SOURCES = [
  'dialstatus',
  'queuestatus',
  'device_state',
  'variable',
  'http_result',
] as const;
```

`RECORD_STATUS` does not appear anywhere under `packages/`. D-56 requires all **7** values. Add `'record_status'` + `RECORD_STATUS_VALUES`. Official list on the Record() page: `DTMF`, `SILENCE`, `SKIP`, `TIMEOUT`, `HANGUP`, `ERROR`; option `o` sets `OPERATOR` instead of `DTMF`. [CITED: docs.asterisk.org/Asterisk_22_Documentation/API_Documentation/Dialplan_Applications/Record/]

`ConditionEditor` MultiSelect currently only encodes `dial:` / `queue:` (`ConditionEditor.tsx:17-18`). Add `record:` group the same way. `conditionMap.ts` already handles `device_state` / `http_result` — add `record_status` there too.

### Pattern 10: Scanner `@Interval` + mutex

`@Interval` is `setInterval` and **overlaps** if a tick runs longer than the period. `@Cron` has `waitForCompletion`; `@Interval` does not. [CITED: nestjs/schedule Interval docs / community]

Copy zombie-service shape: extract `scanOnce()` for tests; wrap `@Interval` in `if (this.running) return; this.running = true; try/finally`.

Discretion: interval period in seconds is free. Recommend **30s** so D-68 1/4/10 min backoff is driven by `next_notify_at`, not by the tick. Batch `LIMIT 20` `FOR UPDATE SKIP LOCKED` if MySQL version allows; otherwise `status` flip to `processing` with a lease timestamp so two Nest replicas do not double-send (single-process is the current deploy assumption).

### Pattern 11: STT + LLM

`ISttProvider.transcribe` expects “PCM16 8kHz mono audio” (`stt-provider.interface.ts:30-33`). `SttProviderFactory.transcribe(engine, audioBuffer, language)` already routes `custom` → HTTP batch and `yandex` → temp stream (`provider-factory.ts:59-81`).

`SttEnginesService` has no “pick default for tenant” — only `findAll(userUid)`. Voicemail step should store `stt_engine_uid`; if unset, `findAll` and take first, or D-63 if empty.

LLM: `CcAiProvider` with `capabilities` containing `'llm'`, `user_uid IN (tenant, 0)`, `enabled=true`. Seed already has HTTP chat completions:

```37:45:packages/backend/src/modules/ai-agents/seed/providers.seed.ts
  {
    name: 'OpenAI Cascade (gpt-4o-mini)',
    kind: 'online',
    vendor: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    auth_type: 'bearer',
    capabilities: ['llm'],
    defaults: { model: 'gpt-4o-mini', temperature: 0.3 },
    pricing: { inputTokenUsd: 0.15e-6, outputTokenUsd: 0.6e-6, currency: 'USD' },
  },
```

**Skip** `kind=online` + `endpoint` starting with `wss:` (Realtime seed). POST JSON `{ model, temperature, messages:[{role:'system'},{role:'user'}] }`, read `choices[0].message.content`. [CITED: developers.openai.com/api/reference/resources/chat] Decrypt via `decryptSecret` (`secret-cipher.util.ts:33-43`). `AbortSignal.timeout(30_000)`. Cap transcript chars before send. No `openai` package.

### Pattern 12: Surface L on existing CDR chrome

`CdrReportPage` uses **Button** tabs `journal` | `analytics` (`CdrReportPage.tsx:41, 123-138`). UI-SPEC: third button «Голосовые сообщения», icon `Voicemail`; do **not** migrate the page to `shared/ui/Tabs`. Tab and `CdrFilter` checkbox «Только с голосовым сообщением» are **one** state (`CdrUiFilters` has no such field today — add `voicemail?: '1'`).

Journal `RecordingButton` opens a popup player for **conversation** MP3 (`RecordingButton.tsx:27-34`). Voicemail icon on a journal row must be a **different** Lucide icon (`Voicemail`, `info` tint). Details: `Dialog` (not Sheet), `scrollBody` shell like `TimeGroupFormModal`, `AudioPlayer` **not** `compact`, download via JWT `?download=1` with `.wav` filename.

### Pattern 13: MCP + AI webhook (ARCHITECTURE MUST)

New user-facing entity → `McpToolsService.registerAll` + `AiWebhookController` (`/api/ai-tools/*`). Minimum: `list_voicemail_messages`, `get_voicemail_message` (read). Skip create/delete unless product wants AI to wipe messages — if delete is added, mark `destructive: true`.

### Anti-Patterns to Avoid

- **Sequential `Record()` then `notify` in the same extension without a hangup handler** — hangup never reaches notify (D-55).
- **Goto(done) without `hangup_handler_pop`** — double ingest.
- **Synchronous Telegram/STT inside the hangup handler** — blocks SIP hangup.
- **Reusing `safeRecordFilePath` / `audio/mpeg`** — 404 on `.wav`.
- **Reusing `cdr-public.controller.ts`** — unauthenticated stream (D-59).
- **JWT voicemail-link audience** — superseded; leaked token becomes a session.
- **`sendVoice` for WAV** — wrong format; discretion forbids it.
- **Strip first 44 bytes of WAV** — RIFF `LIST`/`fact` chunks shift PCM (D-71).
- **Reuse `IMediaOptions` for Record flags** — those flags are Playback.
- **Single `status` column for both notify retries and STT** — D-68 starves D-60.
- **New BullMQ queue** — D-61 + known boot hang.
- **`npm install openai` / `wav` / `ffmpeg`** — hand-roll parse + existing HTTP.
- **Tailwind in `features/cdr` / `pages/CdrReportPage`** — SCSS + tokens only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tenant notify fan-out | Second dispatcher | `NotificationDispatcherService` + attach option | Channels, decrypt, fire-and-forget already exist |
| AES for LLM keys | New cipher | `encryptSecret` / `decryptSecret` | Same `CC_AI_KEY_SECRET` as `CcAiProvider` |
| Timing-safe API key | `===` / `!==` | `timingSafeApiKeyEqual` | Bridge/directory already correct |
| Playback greeting paths | New path builder | `emitPlayback` (`dialplan-playback.util.ts:110`) | Tenant sound path + Progress/lang already solved |
| Token revoke/TTL | Second JWT audience | Display-token table + guard | D-59 locked |
| WAV→PCM16 | `buf.subarray(44)` or ffmpeg | `parseWavPcm16` chunk walk | D-71 |
| Range streaming | New streamer | Copy `streamRecording` Range block | Proven 416/`Accept-Ranges` |
| CDR access | New ACL | `buildCdrLinkedidAccessClause` | D-58 |
| Email attach | New mailer | `MailerService` report-attach shape | Already `attachments[]` |
| Batch STT | New gRPC client | `SttProviderFactory.transcribe` | custom + yandex already wired |

**Key insight:** Almost every hard problem already has an analog. The phase is **composition + two new utilities** (wav-pcm, thin LLM) and **one new module**, not a new stack.

## Runtime State Inventory

This phase hard-removes `VoiceMail()` emission and migrates stored `type: 'voicemail'` steps — treat as migration.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Six JSON action columns still hold `type: 'voicemail'` with `{target\|exten}`: `routes.actions`, `route_phonebook_bindings.actions`, `ivrs.menu_items[].actions`, `vr_keywords.actions`, `voice_robots.fallback_action`, `voice_robots.max_retries_action` (12-RESEARCH inventory; `dialplan-actions-migration.util.ts` already lists `voicemail` in `KNOWN_TYPES` and maps `exten`→`target`) | **Data migration:** rewrite params to new shape (keep `type: 'voicemail'`); fill defaults `max_duration=120`, empty greeting, no notify/STT. `raw_dialplan` containing `VoiceMail(` — **log only**, do not rewrite (user text, Phase 12 rule) |
| Live service config | Host `voicemail.conf` still unused by this repo (passive PJSIP `mailboxes` / `incoming_mwi_mailbox`) | Docs note only: after deploy, `VoiceMail()` is no longer generated. No code change |
| OS-registered state | None verified this session | None |
| Secrets/env vars | `DIALPLAN_API_KEY`, `RECORDS_BASE_PATH`, `CC_AI_KEY_SECRET`, `APP_URL` (`mailer.service.ts:114`) | Code reads existing names; add `APP_URL` to token links. Do not invent new secret names |
| Build artifacts | `packages/shared/dist` stale after `IVoicemailParams` change | `npm run build -w @krasterisk/shared` before backend tests (Pitfall 8 from Phase 12) |

**Nothing found in category:** OS-registered state — none verified (no VM-specific systemd/Task Scheduler names). Conversation-recording file janitor — **none in repo** (only avatar `unlink` in `users.service.ts`). D-73 = follow that same “ops/disk, not a Nest job” policy.

## Common Pitfalls

### Pitfall 1: `k` keeps the file, not the dialplan
**What goes wrong:** Notify/STT never run on the common “caller hung up” path.
**Why:** Official Record(): “If the user hangs up during a recording, all data will be lost and the application will terminate.” Option `k`: “Keep recorded file upon hangup.” [CITED: Asterisk 22 Record()]
**How to avoid:** `hangup_handler_push` **before** `Record(`; unit test asserts index(`hangup_handler_push`) < index(`Record(`) and options always contain `k`.
**Warning signs:** Files on disk, empty `voicemail_messages`.

### Pitfall 2: Double ingest (handler + Goto)
**What goes wrong:** Two notify, two STT bills, unique-key errors.
**Why:** Handler follows the channel after a normal `#` completion.
**How to avoid:** `hangup_handler_pop` after `Record()` returns; UNIQUE(uniqueid); ingest upsert.
**Warning signs:** Duplicate Telegram messages.

### Pitfall 3: Slow hangup handler
**What goes wrong:** SIP BYE timeouts, “messages sometimes missing”.
**Why:** Official: handlers must execute quickly (ISDN/SIP hangup path).
**How to avoid:** CURL + `{accepted:true}`; work async in Nest.
**Warning signs:** Asterisk `full` logs showing long CURL in `krsk-vm-done-*`.

### Pitfall 4: Single status starves STT or notify
**What goes wrong:** `notify_failed` never transcribed; or STT `ready` hides notify failure.
**Why:** D-60 and D-68 overload one column.
**How to avoid:** Pattern 2 two-axis; scanner has two queries.
**Warning signs:** `notify_failed` rows with empty transcript and a configured engine.

### Pitfall 5: `.mp3` resolver / `audio/mpeg`
**What goes wrong:** 404 on a real `.wav`.
**Why:** `safeRecordFilePath` appends `.mp3` (`cdr.service.ts:307`); stream sets `audio/mpeg` (`:457`).
**How to avoid:** Parallel resolver + MIME.
**Warning signs:** Player duration 0.

### Pitfall 6: WAV header “first 44 bytes”
**What goes wrong:** STT returns noise.
**Why:** RIFF may insert `LIST`/`fact` before `data`.
**How to avoid:** `parseWavPcm16`; reject `bits !== 16`; caller rejects `sampleRate !== 8000`.
**Warning signs:** Transcript garbage on G.722 16 kHz — treat as `transcript_status=failed`, not silent success.

### Pitfall 7: `@Interval` overlap
**What goes wrong:** Two ticks send two Telegram attaches.
**Why:** `setInterval` does not wait.
**How to avoid:** `running` flag; persist attempts in MySQL so restart is safe.
**Warning signs:** Scanner logs overlapping `scanOnce`.

### Pitfall 8: `RECORD_STATUS` missing `OPERATOR`
**What goes wrong:** Press-0 looks like `#`.
**Why:** Official `o` sets `OPERATOR` instead of `DTMF`.
**How to avoid:** Shared 7-value table; UI presets + DTO + generator invariant test.
**Warning signs:** Operator transfer never matches condition.

### Pitfall 9: Shared rebuild
**What goes wrong:** Backend tests green against old `dist`.
**Why:** Phase 12 Pitfall 8.
**How to avoid:** `npm run build -w @krasterisk/shared` first in any task that touches `IVoicemailParams` / `CONDITION_SOURCES`.

### Pitfall 10: Token URL in the UI
**What goes wrong:** Screenshot/clipboard leak of a live 7-day URL.
**Why:** Surface L security rule.
**How to avoid:** JWT stream in Dialog; token only inside outbound notify.

### Pitfall 11: Greeting after hangup_handler_push
**What goes wrong:** Hangup during greeting creates an empty/error message.
**How to avoid:** Playback greeting **first**; push handler **immediately before** `Record()`.

### Pitfall 12: Mass-delete string `telegram`
**What goes wrong:** Notification **channel** deleted with the old action type.
**Why:** Phase 12 Pitfall 6. Voicemail notify **uses** the telegram channel.
**How to avoid:** Delete by symbol (`VoiceMail(` emission, old params), not `grep telegram`.

## Code Examples

### Generator order (D-55 + pop)

```
; greeting optional — BEFORE handler
same => n,Playback(/usr/records/${KRSK_UID}/prompts/vm-greeting)
same => n,Set(CHANNEL(hangup_handler_push)=krsk-vm-done-42,s,1)
same => n,Record(/usr/records/42/voicemail/${UNIQUEID}-%d.wav,3,120,ky)
same => n,Set(CHANNEL(hangup_handler_pop)=)
same => n,Goto(krsk-vm-done-42,s,1)

[krsk-vm-done-42]
exten => s,1,NoOp(VM ${RECORD_STATUS} ${RECORDED_FILE})
same => n,Set(VM_R=${CURL(http://127.0.0.1:3000/api/internal/dialplan/voicemail,uniqueid=${URIENCODE(${UNIQUEID})}&file=${URIENCODE(${RECORDED_FILE})}&status=${RECORD_STATUS}&clid=${URIENCODE(${CALLERID(num)})}&exten=${URIENCODE(${EXTEN})}&user_uid=42&api_key=…)})
same => n,Return()
```

Official push syntax: `Set(CHANNEL(hangup_handler_push)=[[context,]exten,]priority[(arg1[,…])])`. [CITED: docs.asterisk.org Hangup Handlers]

`k` is always in the options string. User `q` suppresses beep (D-54). Default `maxduration` 120 (D-74).

### `parseWavPcm16` (D-71) — implement this, do not “first 44 bytes”

```typescript
// Source: 12-RESEARCH.md (locked by D-71). Official RIFF allows extra chunks.
export function parseWavPcm16(buf: Buffer): { pcm: Buffer; sampleRate: number; channels: number } {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file');
  }
  let offset = 12, sampleRate = 0, channels = 0, bits = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === 'data') {
      if (bits !== 16) throw new Error(`Expected 16-bit PCM, got ${bits}`);
      return { pcm: buf.subarray(body, Math.min(body + size, buf.length)), sampleRate, channels };
    }
    offset = body + size + (size % 2);
  }
  throw new Error('No data chunk');
}
```

Caller: `if (parsed.sampleRate !== 8000 || parsed.channels !== 1) throw …`.

### Thin LLM client (D-57)

```typescript
// Source: 12-RESEARCH LlmSummaryService + CcAiProvider seed endpoint.
// Official chat completions: POST {model, messages} → choices[0].message.content
const key = decryptSecret(provider.encrypted_api_key);
const headers: Record<string, string> = { 'Content-Type': 'application/json' };
if (provider.auth_type === 'bearer') headers.Authorization = `Bearer ${key}`;
else if (provider.auth_type === 'api_key_header') headers['X-API-Key'] = key;

const res = await fetch(provider.endpoint, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    model: provider.defaults?.model,
    temperature: provider.defaults?.temperature ?? 0.2,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_RU },
      { role: 'user', content: transcript.slice(0, MAX_TRANSCRIPT_CHARS) },
    ],
  }),
  signal: AbortSignal.timeout(30_000),
});
if (!res.ok) throw new Error(`LLM ${res.status}`);
const json = await res.json();
return String(json?.choices?.[0]?.message?.content ?? '').trim();
```

Skip `wss:` endpoints. If no LLM provider: store transcript only; summary empty (not `failed`).

### Opaque token mint (D-59/D-67)

```typescript
// Analog: CcDisplayToken.token — 64 hex chars from randomBytes(32)
const token = randomBytes(32).toString('hex');
await VmAccessToken.create({
  token,
  message_uid: row.uid,
  user_uid: vpbxUserUid,
  expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  revoked_at: null,
});
const link = `${appUrl}/api/voicemail/play?token=${encodeURIComponent(token)}`;
// appUrl = ConfigService APP_URL (mailer.service.ts:114)
```

### `@Interval` mutex (D-61)

```typescript
// Analog: CallCenterZombieService.poll — extract scanOnce() for specs
@Interval('vm-scan', 30_000)
async tick() {
  if (this.running) return;
  this.running = true;
  try { await this.scanOnce(); }
  catch (e) { this.logger.warn(`vm scan: ${(e as Error).message}`); }
  finally { this.running = false; }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `VoiceMail(${exten}@default,u)` | `Record()` + hangup handler + Nest ingest | D-54 / this phase | Tenant-scoped; observable; no MWI |
| JWT second audience (12-RESEARCH sketch) | Opaque token + DisplayToken-style guard | D-59 discuss | Revocable; no session escalation |
| Inline STT from hangup handler | `@Interval` scanner on pending | D-60/D-61 | Handler stays fast; rows survive restart |
| Attach vs link by duration | File size 2 MiB | D-64/D-65 | Matches bytes on disk |
| `safeRecordFilePath` + `.mp3` | Dedicated `.wav` resolver | D-58/D-71 | Player works |
| `CONDITION_SOURCES` without record | Add `record_status` (7 values) | D-56 | OPERATOR distinguishable |

**Deprecated/outdated:**

- Generator `VoiceMail(${vmExten}@default,u)` (`dialplan.util.ts:432-435`).
- 12-RESEARCH JWT `audience: 'voicemail-link'` example — do not implement.
- `IRecordParams` / `RecordParamsDto` — leftover media DTO, **not** an ActionType. Do not wire it as a second Record app; fold needed fields into `IVoicemailParams`.
- Host `voicemail.conf` as a product dependency.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Record(….wav)` on this host is 8 kHz 16-bit mono PCM | D-71 / parseWavPcm16 | G.722/wideband → reject in caller; STT would be garbage if we ignore sampleRate |
| A2 | Single Nest process (no multi-replica scanner) | D-61 | Two replicas double-notify unless `SKIP LOCKED` / lease is implemented |
| A3 | Conversation-recording retention is ops/disk, not a Nest job | D-73 | If an undocumented cron deletes `/usr/records/*.mp3` only, `.wav` under `voicemail/` may live forever — confirm with ops at verify |
| A4 | WhatsApp/MAX/VK/webhook stay link-only this phase | Attach API | Product may expect WhatsApp attach; out of current provider capabilities |
| A5 | `APP_URL` is the public origin for token links | D-59 | Wrong origin → dead links; already used by mailer |
| A6 | Keeping ActionType name `voicemail` matches D-54 “migrate steps onto the new app” | D-54 | If product wanted a new type string, migration is larger — discuss already said hard-remove old **VoiceMail()**, not the registry key |

**If this table is empty:** N/A — six assumptions remain.

## Open Questions

1. **Default STT engine when step omits `stt_engine_uid`**
   - What we know: `SttEnginesService.findAll` only; no “default” flag.
   - What's unclear: first engine vs require explicit uid vs D-63.
   - Recommendation: explicit uid in the step; if empty, first tenant engine; if none, D-63.

2. **Which `CcAiProvider` to pick when several have `llm`**
   - What we know: seed has Realtime (wss, skip) and Cascade (HTTP).
   - What's unclear: no “default for voicemail” column.
   - Recommendation: optional `llm_provider_uid` on the step; else first `enabled` HTTP `llm` for tenant+global; none → transcript without summary (not failed).

3. **Live Asterisk: hangup during Record() + `k` + handler**
   - What we know: official docs + Phase 12 research; prod is certified-22.8-cert2 (ARCHITECTURE §8).
   - What's unclear: this host’s `Record()` `k` + handler order not re-proven this session.
   - Recommendation: manual gate M2/M3 (same as 12-RESEARCH) in `/gsd-verify-work 13` / `/gsd-secure-phase 13`.

4. **MySQL `FOR UPDATE SKIP LOCKED`**
   - What we know: project uses MySQL via Sequelize; version not pinned in RESEARCH this session.
   - What's unclear: if SKIP LOCKED is available.
   - Recommendation: lease column (`scan_locked_until`) works on all versions; prefer it over SKIP LOCKED.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | backend/frontend | ✓ | `engines.node >=22` (root `package.json`) | — |
| Nest + `@nestjs/schedule` | scanner | ✓ | in package.json | — |
| MySQL (Sequelize) | rows / tokens | ✓ (project DB) | existing | — |
| `DIALPLAN_API_KEY` | ingest CURL | env (existing) | — | 401 if missing (bridge pattern) |
| `RECORDS_BASE_PATH` | wav files | ✓ prod `/usr/records` (M9) | — | `/usr/records` |
| `CC_AI_KEY_SECRET` | LLM decrypt | env | — | dev fallback in `secret-cipher.util.ts` (must not ship as prod) |
| `APP_URL` | token links | used by mailer | — | `https://pbx.krasterisk.ru` fallback in mailer — **set explicitly** |
| Live Asterisk 22 | M2/M3 hangup+k | ops host | certified-22.8-cert2 (ARCHITECTURE) | Manual-only checklist |
| ffmpeg | — | not required | — | `parseWavPcm16` |
| Redis / BullMQ | — | **do not use** | leftover deps | D-61 Interval |
| ctx7 CLI | docs lookup | not used | — | WebFetch official Asterisk |

**Missing dependencies with no fallback:** live Asterisk for M2/M3 — does not block coding; blocks verify of D-55.

**Missing dependencies with fallback:** none blocking.

Step 2.6: Interval/MySQL/disk only — no new CLI tools.

## Validation Architecture

`workflow.nyquist_validation` is enabled (`config-get` → `true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (backend) + Vitest `^4.1.4` (frontend) |
| Config file | `packages/backend` Jest defaults; frontend Vitest via `package.json` `test` |
| Quick run command | `npm run test:backend -- --testPathPattern="voicemail\|wav-pcm\|dialplan.util" --no-coverage` |
| Full suite command | `npm run lint && npm run test:backend && npm run test:frontend` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-54 | Generator no longer emits `VoiceMail(`; greeting+Record+CURL | unit | `--testPathPattern=dialplan.util` | ❌ Wave 0 (extend existing spec) |
| D-55 | `hangup_handler_push` before `Record(`; options always include `k`; `Return()` in handler context | unit | `--testPathPattern=dialplan.util` | ❌ Wave 0 — **single most important test** |
| D-55b | After Record, `hangup_handler_pop` before Goto(done) | unit | same | ❌ Wave 0 |
| D-56 | All 7 `RECORD_STATUS` in shared table === DTO === UI presets | unit | `--testPathPattern="dialplan-condition\|ConditionEditor"` | ❌ Wave 0 |
| D-57 | `parseWavPcm16`: 44-byte, LIST chunk, non-16-bit throws, truncated data safe; sampleRate returned | unit | `--testPathPattern=wav-pcm` | ❌ Wave 0 |
| D-57b | LLM client: bearer header, skips `wss:`, reads `choices[0].message.content` | unit | `--testPathPattern=llm-summary` | ❌ Wave 0 |
| D-58 | List filter `voicemail=1`; stream MIME `audio/wav`; path `..` rejected | unit | `--testPathPattern=voicemail` | ❌ Wave 0 |
| D-59 | Token guard: missing/revoked/expired → 401; no `sub`/`level` on `req.user`; cdr-public unused | unit | `--testPathPattern=voicemail-link` | ❌ Wave 0 |
| D-60/D-61 | Scanner `scanOnce` picks pending; does not call STT from ingest | unit | `--testPathPattern=voicemail-scanner` | ❌ Wave 0 |
| D-62 | Ingest controller returns `{accepted:true}` before notify settles | unit | `--testPathPattern=voicemail-dialplan` | ❌ Wave 0 |
| D-63 | No engine → `transcript_status=not_configured`, no retry action in UI | unit + RTL | backend scanner + frontend details | ❌ Wave 0 |
| D-64/D-65 | `stat.size < 2*1024*1024` → attach path | unit | `--testPathPattern=voicemail` | ❌ Wave 0 |
| D-66 | Attach fail → link resend, `notify_attempts` unchanged | unit | `--testPathPattern=voicemail` | ❌ Wave 0 |
| D-67 | Expired token 410/404; file still streamable via JWT | unit | `--testPathPattern=voicemail-link` | ❌ Wave 0 |
| D-68 | 3 notify fails → `notify_status=failed`; backoff timestamps | unit | `--testPathPattern=voicemail-scanner` | ❌ Wave 0 |
| D-70 | 3 STT fails → `transcript_status=failed`; notify untouched | unit | `--testPathPattern=voicemail-scanner` | ❌ Wave 0 |
| D-71 | Record filename ends `.wav` | unit | `--testPathPattern=dialplan.util` | ❌ Wave 0 |
| D-72 | Path contains `/voicemail/` under tenant uid | unit | `--testPathPattern=dialplan.util` | ❌ Wave 0 |
| D-74 | defaultParams.max_duration === 120 | unit | frontend registry schema test | ❌ Wave 0 |
| Surface L | Third tab + checkbox same state; Mic ≠ Voicemail icons; four transcript states | RTL | `vitest run src/pages/CdrReportPage src/features/cdr` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** matching `--testPathPattern` / vitest file
- **Per wave merge:** `npm run test:backend && npm run test:frontend`
- **Phase gate:** `npm run lint && npm run test:backend && npm run test:frontend` (AGENTS.md)

### Wave 0 Gaps

- [ ] `packages/backend/src/modules/voicemail/**/*.spec.ts` — ingest, scanner, link guard, wav-pcm, llm-summary
- [ ] Extend `dialplan.util.spec.ts` — D-55 order + pop + no `VoiceMail(` + `.wav` + `k`
- [ ] Shared `RECORD_STATUS_VALUES` + condition invariant test
- [ ] Frontend `schemas/voicemail.test.tsx`, CdrReportPage tab/filter, details Dialog states
- [ ] Framework install: none — Jest + Vitest already present

Manual-only (live Asterisk):

| ID | Behavior | Why manual |
|----|----------|------------|
| M2 | Hang up mid-Record → file exists **and** notify received | Needs SIP call |
| M3 | `asterisk -rvvv` shows enter `krsk-vm-done-*` after Hangup | Needs PBX CLI |

## Security Domain

`workflow.security_enforcement` is enabled (`config-get` → `true`). ROADMAP requires `/gsd-secure-phase 13` (new PII class).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT for UI stream; opaque token for notify links; `timingSafeApiKeyEqual` for ingest |
| V3 Session Management | yes | Token guard **must not** set `sub`/`level` (DisplayToken Pitfall 5) |
| V4 Access Control | yes | `vpbx_user_uid` on every query; `buildCdrLinkedidAccessClause` for CDR join; token scoped to `message_uid` |
| V5 Input Validation | yes | `class-validator` DTO; `sanitizeDialplanInput` / `URIENCODE` on CURL fields; UNIQUEID allow-list |
| V6 Cryptography | yes | `decryptSecret` AES-256-GCM — never log plaintext keys |
| V12 File / Resource | yes | Path traversal guard (`..` + `startsWith`); no user-controlled absolute path |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated voicemail URL | Information disclosure | Opaque TTL token; forbid `cdr-public` |
| Display/token escalation | Elevation of privilege | `req.user` without `sub`/`level` |
| Path traversal `../../` | Tampering | Resolver guard (copy CDR, new suffix) |
| API key timing leak | Information disclosure | `timingSafeApiKeyEqual` |
| Prompt injection via transcript → LLM | Tampering | Treat transcript as untrusted user content; fixed system prompt; cap length |
| SSRF via custom STT URL | Spoofing | Reuse existing custom-http-stt allow-list behavior; do not add a new outbound URL field on the step |
| DoS huge Record | Denial of service | `maxduration` default 120; 2 MiB attach cap; STT size guard before buffer load |
| Token in UI / screenshot | Information disclosure | Surface L: never render token URL |
| Cross-tenant UNIQUEID probe | Information disclosure | Tenant column + access-scope on JWT stream; token bound to `message_uid` + tenant |

## Project Constraints (from .cursor/rules/ и AGENTS.md)

`.cursor/rules/` is **absent** (glob 0 files). Constraints from `AGENTS.md` + ARCHITECTURE files:

- Monorepo: `packages/backend` NestJS, `packages/frontend` React FSD, `packages/shared`
- Verify before done: `npm run lint`, `npm run test:backend`, `npm run test:frontend`
- Frontend: FSD; no Tailwind in `features/`/`pages/`; Stack components; Lucide only (no emoji); no em dash in UI copy; `AudioPlayer` from `shared/ui`; Dialog `scrollBody` shell; table actions via `TableRowActions`
- Optimistic toggles: N/A (no instant-PUT Switch in this phase)
- Backend: tenant via `req.user.vpbx_user_uid`; never trust tenant id from body; `synchronize: false`; new entity → MCP tools + AI webhook
- npm packages: `npm show` + peers + changelog before any install — **this phase installs none**
- Asterisk policy (ARCHITECTURE §8): prefer 22; `Record()` `k` + hangup handlers documented against 22; 16/11 best-effort
- i18n `ru` + `en`; `t(key, fallback)` if locale files are dirty (Phase 12 habit)
- Sketch skill (`sketch-findings-krasterisk-v4`): MOH Phase 2 / Hub Phase 8 only — **not applicable**

## Sources

### Primary (HIGH confidence)

- `packages/backend/src/shared/utils/dialplan.util.ts:432-435` — current `VoiceMail(` emission
- `packages/shared/src/types/dialplan-params.types.ts:200-204` — `IVoicemailParams`
- `packages/shared/src/types/dialplan-condition.types.ts:6-12` — `CONDITION_SOURCES` (no record_status)
- `packages/backend/src/modules/reports/cdr/cdr.service.ts:303-310,433-492` — `.mp3` resolver + Range
- `packages/backend/src/modules/reports/cdr/cdr-public.controller.ts:10-35` — forbidden public stream
- `packages/backend/src/modules/callcenter/guards/display-token.guard.ts:21-56` — opaque token guard
- `packages/backend/src/modules/voice-robots/interfaces/stt-provider.interface.ts:23-33` — PCM16 8 kHz
- `packages/backend/src/modules/voice-robots/providers/provider-factory.ts:59-81` — `transcribe`
- `packages/backend/src/modules/ai-agents/models/ai-provider.model.ts:34-40` — `encrypted_api_key` / `capabilities`
- `packages/backend/src/modules/ai-agents/seed/providers.seed.ts:37-45` — HTTP chat completions endpoint
- `packages/backend/src/modules/notifications/dialplan-notify.controller.ts:32-49` — fire-and-forget ingest analog
- `packages/backend/src/modules/dialplan-bridge/dialplan-api-key.ts:3-13` — timing-safe key
- `packages/backend/.idea/ARCHITECTURE.md` §6–9 — MCP, AI webhook, Asterisk 22.8, M9 `/usr/records`
- Official Asterisk 22 Record() — [CITED: https://docs.asterisk.org/Asterisk_22_Documentation/API_Documentation/Dialplan_Applications/Record/]
- Official Hangup Handlers — [CITED: https://docs.asterisk.org/Configuration/Dialplan/Subroutines/Hangup-Handlers/]

### Secondary (MEDIUM confidence)

- Telegram Bot API sendDocument 50 MB; sendAudio MP3/M4A; sendVoice OGG/OPUS — [CITED: https://core.telegram.org/bots/api]
- OpenAI-compatible `choices[0].message.content` — [CITED: https://developers.openai.com/api/reference/resources/chat]
- Nest `@Interval` overlaps (setInterval); use mutex — [CITED: nestjs/schedule Interval behavior]

### Tertiary (LOW confidence)

- Live `Record()`+`k`+handler on this PBX (M2/M3) — not re-run this session
- Multi-replica scanner locking — [ASSUMED] single process
- Ops retention cron file glob — [ASSUMED] none in repo

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — reuse existing packages; no registry installs
- Architecture: HIGH — seams read this session; two-axis status is a discretion refinement
- Pitfalls: HIGH — D-55/D-58/D-59 traps locked + official hangup-handler “execute quickly” + double-ingest

**Research date:** 2026-09-02
**Valid until:** 2026-10-02 (30 days; Asterisk 22 Record/handlers are stable)

**Graph:** `.planning/graphs/graph.json` absent; `graphify` disabled — no graph queries.

**12-RESEARCH Open Questions 2–5:** Q2 (STT trigger) and Q3 (attach threshold) **resolved by D-60…D-66**. Q1/Q4/Q5 were Phase 12 and stay closed. 12-RESEARCH JWT token snippet is **not** a Phase 13 pattern.
