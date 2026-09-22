---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
reviewed: 2026-09-22T17:40:00Z
depth: standard
files_reviewed: 59
files_reviewed_list:
  - .gitignore
  - harness/scenarios/manual/speech-analytics-uat-live.cjs
  - packages/backend/database/migrations/0023-sa-multi-run-charges.sql
  - packages/backend/database/migrations/postgres/0023-sa-multi-run-charges.sql
  - packages/backend/src/main.ts
  - packages/backend/src/modules/integration-credentials/integration-credentials.service.ts
  - packages/backend/src/modules/routes/dialplan-webhooks.service.ts
  - packages/backend/src/modules/routes/route-recording.util.ts
  - packages/backend/src/modules/routes/routes-ai.adapter.ts
  - packages/backend/src/modules/routes/routes.module.ts
  - packages/backend/src/modules/routes/routes.service.ts
  - packages/backend/src/modules/speech-analytics/charging/sa-charge-insights.ts
  - packages/backend/src/modules/speech-analytics/charging/sa-charge-run.ts
  - packages/backend/src/modules/speech-analytics/dashboard/dashboard.service.ts
  - packages/backend/src/modules/speech-analytics/dashboard/insights.service.ts
  - packages/backend/src/modules/speech-analytics/eval/run-golden.ts
  - packages/backend/src/modules/speech-analytics/ingest/upload.service.ts
  - packages/backend/src/modules/speech-analytics/ingest/url-download.ts
  - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.ts
  - packages/backend/src/modules/speech-analytics/journal/excel-export.ts
  - packages/backend/src/modules/speech-analytics/journal/journal.service.ts
  - packages/backend/src/modules/speech-analytics/module-settings.service.ts
  - packages/backend/src/modules/speech-analytics/pipeline.ts
  - packages/backend/src/modules/speech-analytics/pipeline/channel-diarize.ts
  - packages/backend/src/modules/speech-analytics/pipeline/run-analysis.ts
  - packages/backend/src/modules/speech-analytics/pipeline/score.ts
  - packages/backend/src/modules/speech-analytics/pipeline/stt.ts
  - packages/backend/src/modules/speech-analytics/projects/budget.ts
  - packages/backend/src/modules/speech-analytics/projects/event-webhooks.ts
  - packages/backend/src/modules/speech-analytics/projects/project-editor.service.ts
  - packages/backend/src/modules/speech-analytics/reporting/capture-policy.ts
  - packages/backend/src/modules/speech-analytics/reporting/internal-admission.ts
  - packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts
  - packages/backend/src/modules/speech-analytics/speech-analytics-jwt.controller.ts
  - packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.ts
  - packages/backend/src/modules/speech-analytics/speech-analytics.models.ts
  - packages/backend/src/modules/speech-analytics/speech-analytics.module.ts
  - packages/backend/src/modules/speech-analytics/speech-analytics.service.ts
  - packages/backend/src/shared/utils/dialplan-subroutines.util.ts
  - packages/backend/src/skills/speech-analytics/SKILL.md
  - packages/frontend/src/app/router/router.tsx
  - packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.tsx
  - packages/frontend/src/features/cdr/ui/CdrTable/CdrTable.tsx
  - packages/frontend/src/features/cdr/ui/CdrTable/useCdrTableColumns.tsx
  - packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.tsx
  - packages/frontend/src/features/routes/ui/RouteFormModal/RouteGeneralTab.tsx
  - packages/frontend/src/features/speechAnalytics/api/speechAnalyticsApi.ts
  - packages/frontend/src/features/speechAnalytics/ui/ConversationSheet/ConversationSheet.tsx
  - packages/frontend/src/features/speechAnalytics/ui/ConversationsTable/ConversationsTable.tsx
  - packages/frontend/src/features/speechAnalytics/ui/MetricEditor.tsx
  - packages/frontend/src/features/speechAnalytics/ui/ModuleSettings/ModuleSettings.tsx
  - packages/frontend/src/features/speechAnalytics/ui/TokensTable/TokensTable.tsx
  - packages/frontend/src/features/speechAnalytics/ui/UploadForm/UploadForm.tsx
  - packages/frontend/src/pages/SpeechAnalyticsDashboardPage/SpeechAnalyticsDashboardPage.tsx
  - packages/frontend/src/pages/SpeechAnalyticsJournalPage/SpeechAnalyticsJournalPage.tsx
  - packages/frontend/src/pages/SpeechAnalyticsProjectPage/SpeechAnalyticsProjectPage.tsx
  - packages/frontend/src/pages/SpeechAnalyticsProjectsPage/SpeechAnalyticsProjectsPage.tsx
  - packages/frontend/src/pages/SpeechAnalyticsReportsPage/SpeechAnalyticsReportsPage.tsx
  - packages/shared/src/types/speech-analytics.types.ts
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues
---

# Phase 18: Code Review Report

**Reviewed:** 2026-09-22T17:40:00Z  
**Depth:** standard  
**Files Reviewed:** 59  
**Status:** issues

## Summary

Рефакторинг речевой аналитики в целом соблюдает заблокированные продуктовые решения (sa_* журнал, charge без wallet, dual-STT off, токен-digest, hangup только enqueue). Главный дефект: публичные `uploads/batch` и `analyze-url` отвечают успехом со scored-результатом без строк в sa_*. Подтверждены известные дыры wiring (HANGUP_ANALYTICS_PORT, AI-адаптер, worker fallback). Кабинетный upload через JWT allocate→createRun пишет sa_recordings нормально.

## Critical Issues

### CR-01: Public batch / URL ingest claim scored success without sa_* journal rows

**File:** `packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.ts:130-156` and `:184-209`

**Issue:** В `uploadBatch` и `analyzeUrl` инжектируется in-handler stub: `createJournalRow` возвращает синтетический id (`journal:…` / `journal-url:…`) без записи в sa_*, а `runAnalysis` сразу отдаёт `summary: analyzed:…`. `UploadService` / `UrlIngestService` затем ставят `ok: true` + `scored`, HTTP 202. Аудио через `allocateUpload`/`putUploadContent` может сохраниться, но клиента убеждают, что анализ и journal-row готовы. Live UAT API-канал (`harness/.../speech-analytics-uat-live.cjs` → `/api/v1/speech-analytics/uploads/batch`) опирается на этот путь.

**Why it matters:** Клиенты и UAT получают ложный успех; журнал кабинета не увидит разговоры; повторная загрузка того же файла не создаст две sa_* строки через API.

**Fix:** Пробросить `createJournalRow` в `SaJournalService` / `SpeechAnalyticsService.createRun` (как JWT cabinet path в `speechAnalyticsApi.uploadSaCabinetBatch`) и реальный `runAnalysis`/`admit` job; stub оставить только в unit-тестах.

```typescript
// Пример направления фикса для uploadBatch:
createJournalRow: async (row) => {
  const run = await this.analytics.createRun(ctx, {
    projectId,
    assetId: /* from allocate/complete */,
    externalCallId: randomUUID(),
    idempotencyKey: randomUUID(),
    metadata: { source: 'upload', filename: row.filename, ... },
  });
  return { id: run.recordingId, createsCdr: false as const };
},
runAnalysis: async ({ journalId }) => {
  // enqueue / wait-for-run when sync=true — не fake summary
},
```

## Warnings

### WR-01: HANGUP_ANALYTICS_PORT optional and never registered

**File:** `packages/backend/src/modules/routes/dialplan-webhooks.service.ts:10-11,81-87,258`  
**Also:** `packages/backend/src/modules/routes/routes.module.ts` (нет `provide: HANGUP_ANALYTICS_PORT`); `packages/backend/src/modules/speech-analytics/speech-analytics.module.ts`

**Issue:** Порт `@Optional() @Inject(HANGUP_ANALYTICS_PORT)`; при отсутствии `maybeEnqueueHangupAnalysis` сразу `return`. Ни RoutesModule, ни SpeechAnalyticsModule не регистрируют провайдер. Dialplan всё равно дергает on-hangup (`dialplan-subroutines.util.ts`), но analytics enqueue — no-op.

**Why it matters:** Маршруты с проектом аналитики не ставят ai_jobs после звонка, пока порт не привязан.

**Fix:** Зарегистрировать Nest-провайдер `HANGUP_ANALYTICS_PORT`, реализующий `resolveHangupContext` + `enqueueAnalysisJob`, и экспортировать его из SpeechAnalyticsModule / импортировать в RoutesModule без цикла.

### WR-02: SpeechAnalyticsAiAdapter (and ModuleSettingsService) not in SpeechAnalyticsModule

**File:** `packages/backend/src/modules/speech-analytics/speech-analytics.module.ts:59-68`  
**Also:** `packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts:92-107`; `module-settings.service.ts:90-93`

**Issue:** Провайдеры модуля — Service/Journal/Insights/Dashboard; `SpeechAnalyticsAiAdapter` и `ModuleSettingsService` отсутствуют. Адаптер с `OnModuleInit` → `registry.register(this)` в runtime не поднимается (только unit-тесты new'ят вручную).

**Why it matters:** AI-чат tools pause / edit project / issue token недоступны в production Nest DI.

**Fix:** Добавить оба в `providers` (и порты `SaAiProjectsPort` / `SaAiTokensPort` → существующие сервисы), убедиться что AiPlatformModule видит регистрацию.

### WR-03: SaAnalysisWorker calls runAnalysis only when injected; else legacy handoffPipeline

**File:** `packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.ts:86-94,119-137`

**Issue:** `if (this.deps.runAnalysis) { … } else { await this.deps.handoffPipeline!(…) }`. Класс нигде не зарегистрирован как Nest provider (только specs). Fallback legacy не помечает scored success (хорошо), но production wiring `runAnalysis` отсутствует.

**Why it matters:** Даже после появления HANGUP port очередь не привязана к `pipeline/run-analysis.ts` STT→score→SA-CHARGE-RUN.

**Fix:** Factory provider: `waitForFile` + `runAnalysis` из Nest deps; убрать non-null `handoffPipeline!` из production path.

### WR-04: Insights HTTP path does not persist SA-CHARGE-INSIGHTS rows

**File:** `packages/backend/src/modules/speech-analytics/dashboard/insights.service.ts:202-227`

**Issue:** `requestForTenant` передаёт `updateInsightsRequest: async () => undefined` и `findLatestRates: async () => []`. `invokeSaChargeInsights` вызывается, но patch в `sa_insights_requests` не пишется. Сам seam (`sa-charge-insights.ts`) корректен (`charged: false`, без settleShadow).

**Why it matters:** Контракт D-47 «persist amount» на HTTP entry не выполняется; таблица из migration 0023 остаётся пустой.

**Fix:** Inject Sequelize model `SaInsightsRequest` и реальный `updateInsightsRequest` / depot rates (по аналогии с `invokeSaChargeRun` + `updateRun`).

### WR-05: Upload audio bytes only in process-local Map

**File:** `packages/backend/src/modules/speech-analytics/speech-analytics.service.ts:80-81,444-459`

**Issue:** `putUploadContent` кладёт тело в `this.uploadBodies` Map; durable storage_key есть, но байты не пишутся на диск/object store. Рестарт или другой инстанс → `getStoredUploadBytes` = null.

**Why it matters:** Любой асинхронный worker после createRun не найдёт аудио для STT.

**Fix:** Писать bytes по `storage_key` (локальный FS / media asset store) до `state: ready`.

### WR-06: capabilities maxBytes disagrees with upload hard cap

**File:** `packages/backend/src/modules/speech-analytics/speech-analytics.service.ts:616-620` (`maxBytes: 256 * 1024 * 1024`) vs `ingest/upload.service.ts:8` (`MAX_UPLOAD_BYTES = 50 * 1024 * 1024`) and `putUploadContent` 50MB gate (`speech-analytics.service.ts:441`)

**Issue:** Public/JWT `capabilities()` обещает 256MB; batch/validate и put режут на 50MB.

**Why it matters:** Интеграции планируют размер по capabilities и получают `file_too_large` / `upload_overflow`.

**Fix:** Выравнять одно число (предпочтительно 50MB) во всех трёх местах.

## Info

### IN-01: DiffConfirmCard has no one-time secret UI for SA token apply

**File:** `packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.tsx` (нет обработки `secret` / `secretOnce`)

**Issue:** `SpeechAnalyticsAiAdapter.toChatHistoryProposal` / apply возвращают secret once; кабинетный `TokensTable` показывает секрет, карточка чата — нет. Пока адаптер не в module (WR-02), поведение отложено.

**Fix:** После wiring адаптера — показать secret из apply response один раз (как TokensTable), не писать в history.

### IN-02: ModuleSettingsService is in-memory only

**File:** `packages/backend/src/modules/speech-analytics/module-settings.service.ts:90-102`

**Issue:** `Map<number, SaModuleSettingsState>` без DB; не в Nest module. Pause/models не переживают рестарт и не шарятся между процессами.

**Fix:** Persist в tenant/settings table при регистрации сервиса.

### IN-03: Intentionally deferred hangup→worker production binding

**File:** `packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.ts:102-103` (comment); `routes.module.ts`

**Issue:** Код явно документирует, что `HANGUP_ANALYTICS_PORT` не зарегистрирован в RoutesModule — out of scope для части фаз. Согласуется с WR-01/WR-03; отдельно не блокер поверх них.

---

_Verified known holes still true: HANGUP port optional/unregistered; worker prefers runAnalysis else handoff; AI adapter not in module; public uploadBatch/analyzeUrl stub journal (elevated to critical because response claims success)._

_Reviewed: 2026-09-22T17:40:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
