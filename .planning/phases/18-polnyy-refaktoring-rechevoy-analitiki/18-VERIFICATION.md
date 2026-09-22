---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
verified: 2026-09-22T18:20:00Z
status: gaps_found
score: 14/20 must-haves verified
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 50
  total: 50
  not_honored: []
  note: "gsd check.decision-coverage-verify — soft gate by artifact presence; Nest wiring holes (D-03/D-17/D-39/adapter) still FAIL as must-haves below"
covered_files:
  - .planning/evidence/speech-analytics-uat-live.json
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-01-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-01-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-02-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-02-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-03-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-03-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-04-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-04-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-05-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-05-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-06-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-06-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-07-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-07-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-08-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-08-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-09-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-09-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-10-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-10-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-11-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-11-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-12-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-12-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-13-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-13-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-14-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-14-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-15-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-15-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-CONTEXT.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-REVIEW.md
  - harness/scenarios/manual/speech-analytics-uat-live.cjs
  - packages/backend/database/migrations/0023-sa-multi-run-charges.sql
  - packages/backend/src/modules/ai-platform/module-coverage.registry.ts
  - packages/backend/src/modules/routes/dialplan-webhooks.service.ts
  - packages/backend/src/modules/routes/route-recording.util.ts
  - packages/backend/src/modules/routes/routes-ai.adapter.ts
  - packages/backend/src/modules/routes/routes.module.ts
  - packages/backend/src/modules/speech-analytics/charging/sa-charge-insights.ts
  - packages/backend/src/modules/speech-analytics/charging/sa-charge-run.ts
  - packages/backend/src/modules/speech-analytics/dashboard/insights.service.ts
  - packages/backend/src/modules/speech-analytics/ingest/upload.service.ts
  - packages/backend/src/modules/speech-analytics/ingest/url-download.ts
  - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.ts
  - packages/backend/src/modules/speech-analytics/module-settings.service.ts
  - packages/backend/src/modules/speech-analytics/pipeline/channel-diarize.ts
  - packages/backend/src/modules/speech-analytics/pipeline/run-analysis.ts
  - packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts
  - packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.ts
  - packages/backend/src/modules/speech-analytics/speech-analytics.module.ts
  - packages/frontend/src/app/router/router.tsx
  - packages/frontend/src/features/modules/lib/moduleRegistry.ts
  - packages/frontend/src/features/routes/ui/RouteFormModal/RouteGeneralTab.tsx
  - packages/frontend/src/features/speechAnalytics/ui/MetricEditor.tsx
  - packages/frontend/src/features/speechAnalytics/ui/ModuleSettings/ModuleSettings.tsx
  - packages/frontend/src/features/speechAnalytics/ui/UploadForm/UploadForm.tsx
covered_digest: "v1:sha256:3fbd80456a3f3a2fd39230a752fcd866952630fb9fc6d08ef2e27eda199bce9c"
gaps:
  - truth: "После звонка hangup handler ставит задание анализа в Nest production (D-03)"
    status: failed
    reason: "HANGUP_ANALYTICS_PORT optional; в RoutesModule и SpeechAnalyticsModule провайдер не зарегистрирован — maybeEnqueueHangupAnalysis сразу return"
    artifacts:
      - path: packages/backend/src/modules/routes/dialplan-webhooks.service.ts
        issue: "@Optional() HANGUP_ANALYTICS_PORT; без порта enqueue — no-op"
      - path: packages/backend/src/modules/routes/routes.module.ts
        issue: "Нет provide: HANGUP_ANALYTICS_PORT"
    missing:
      - "Nest-провайдер HangupAnalyticsPort + регистрация без цикла Routes↔SA"
  - truth: "Worker после wait-for-file вызывает pipeline runAnalysis в production Nest (D-03, D-23, D-46)"
    status: failed
    reason: "SaAnalysisWorker не Nest provider; runAnalysis только если deps.runAnalysis инжектирован, иначе legacy handoffPipeline"
    artifacts:
      - path: packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.ts
        issue: "Условный вызов runAnalysis / handoffPipeline!; класс не в SpeechAnalyticsModule.providers"
    missing:
      - "Factory provider: waitForFile + runAnalysis из Nest deps"
  - truth: "Внешний API upload/URL пишет sa_* journal и запускает реальный разбор (D-14…D-17, D-39…D-42)"
    status: failed
    reason: "speech-analytics-public.controller uploadBatch/analyzeUrl — in-handler stub createJournalRow + fake runAnalysis; HTTP 202 без sa_* UUID"
    artifacts:
      - path: packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.ts
        issue: "createJournalRow → journal:filename:ts; runAnalysis → summary analyzed:…"
      - path: .planning/evidence/speech-analytics-uat-live.json
        issue: "api mono/stereo: journalId вида journal:…, runId/recordingId null"
    missing:
      - "Проброс createRun/SaJournalService + реальный enqueue/runAnalysis как у JWT cabinet path"
  - truth: "SpeechAnalyticsAiAdapter зарегистрирован в Nest и доступен AI-чату (D-27, D-33, Phase 15 pairing)"
    status: failed
    reason: "Адаптер и ModuleSettingsService отсутствуют в SpeechAnalyticsModule.providers; OnModuleInit не поднимается"
    artifacts:
      - path: packages/backend/src/modules/speech-analytics/speech-analytics.module.ts
        issue: "providers без SpeechAnalyticsAiAdapter / ModuleSettingsService"
      - path: packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts
        issue: "Класс есть; registry.register только при DI"
    missing:
      - "Добавить адаптер + порты в providers; убедиться что AiPlatform видит регистрацию"
  - truth: "HTTP insights persist SA-CHARGE-INSIGHTS с charged=false (D-47)"
    status: failed
    reason: "requestForTenant передаёт updateInsightsRequest: async () => undefined и findLatestRates: [] — invoke вызывается без записи в sa_insights_requests"
    artifacts:
      - path: packages/backend/src/modules/speech-analytics/dashboard/insights.service.ts
        issue: "Строки ~225–226 stub deps на HTTP entry"
    missing:
      - "Реальный updateInsightsRequest / depot rates на HTTP path"
  - truth: "Live UAT API-канал доказывает sa_* строки (D-50 / REQ-SA-UAT)"
    status: failed
    reason: "Evidence api-mono 58/58 и api-stereo 49/49 — HTTP ok со stub journalId; recordingId/runId null. Web-канал и doubleUpload (journalMatchCount 2) — реальные UUID"
    artifacts:
      - path: .planning/evidence/speech-analytics-uat-live.json
        issue: "API success ≠ sa_* journal rows"
    missing:
      - "После фикса public controller — повторный API UAT с UUID recordingId"
---

# Phase 18: Полный рефакторинг речевой аналитики — Verification Report

**Phase Goal:** Заново собрать модуль речевой аналитики до паритета с aiPBX и удобнее текущего кабинета: проекты и редактор метрик, загрузка записей через интерфейс и API, дашборды и отчёты, диаризация stereo/mono, включение анализа на маршруте, внешний API для чужих АТС, модели из каталога platform/тенанта, биллинг Krasterisk, эталонные оценки, настройка через AI-чат и живой UAT.

**Verified:** 2026-09-22T18:20:00Z  
**Status:** gaps_found  
**Re-verification:** No — initial verification

SUMMARY.md не принимались как доказательство. Проверены исходники `packages/backend/src/modules/speech-analytics/**`, `routes/dialplan-webhooks*`, `routes.module.ts`, фронт маршрутов/журнала/загрузки, `18-REVIEW.md`, evidence `.planning/evidence/speech-analytics-uat-live.json`. Живой `npm test` / `eval:speech-analytics` против провайдера **не** запускались (запрет оркестратора).

В ROADMAP нет массива `success_criteria`; контракт = Goal + cross-cutting constraints + уникальные must_haves планов 18-01…18-15, свёрнутые в 20 observable truths. Известные wiring holes из brief оркестратора и CR-01/WR-01…WR-04 в `18-REVIEW.md` подтверждены в коде.

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts (soft gate: 50/50). Наличие символов/файлов **не** отменяет FAILED ниже по Nest-binding и stub HTTP.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | Журнал sa_* отделён от Asterisk CDR; загрузки не создают CDR (D-05) | ✓ VERIFIED | Модели/миграции sa_*; JWT createRun; review IN: cabinet path пишет recordingId |
| 2 | SA-CHARGE-RUN persist amount с charged=false; settleShadow/BillingBalance не вызываются (D-46…D-48) | ✓ VERIFIED | `sa-charge-run.ts` + specs; wallet запрет в seam |
| 3 | Селект проекта на маршруте; hangup_handler при projectId (D-01, D-02) | ✓ VERIFIED | `RouteGeneralTab` + `route-recording.util.ts` specs |
| 4 | Hangup в Nest production ставит задание анализа (D-03) | ✗ FAILED | `HANGUP_ANALYTICS_PORT` optional, не в `RoutesModule` / `SpeechAnalyticsModule`; enqueue no-op |
| 5 | Worker wait nonempty → `runAnalysis` в Nest (D-03/D-23) | ✗ FAILED | `SaAnalysisWorker` не provider; `runAnalysis` только если deps переданы |
| 6 | Stereo energy / mono LLM; dual-stt off (D-23) | ✓ VERIFIED | `channel-diarize.ts` + `run-analysis.spec.ts` |
| 7 | Журнал + sheet + вкладки Cost «не списано» (D-05…D-08) | ✓ VERIFIED | Journal/ConversationSheet pages + services |
| 8 | Редактор метрик + draft/publish (D-25, D-26) | ✓ VERIFIED | `MetricEditor.tsx`, `ProjectEditorService` |
| 9 | Кабинетная загрузка создаёт sa_* (D-14…D-16) | ✓ VERIFIED | UAT web: UUID `recordingId`/`runId`; JWT allocate→createRun |
| 10 | Внешний API upload/URL → sa_* + реальный разбор (D-17, D-39…D-42) | ✗ FAILED | Public controller stub; UAT api `journal:…`, `recordingId: null` |
| 11 | API token: hash-only, один проект, body не override (D-32, D-33) | ✓ VERIFIED | `resolveTokenBoundProject` + credentials digest |
| 12 | Стандартный дашборд без конструктора (D-34) | ✓ VERIFIED | `DashboardService` + Dashboard page |
| 13 | HTTP insights persist SA-CHARGE-INSIGHTS (D-47) | ✗ FAILED | `insights.service.ts` stub `updateInsightsRequest` / empty rates |
| 14 | Excel с панели журнала; Reports не product surface (D-37) | ✓ VERIFIED | Router redirect `/speech-analytics/reports` → conversations; hub seed без Reports. (⚠ `moduleRegistry` ещё держит nav id reports → redirect) |
| 15 | AI-чат маршрута: list/set/clear analytics project (D-04) | ✓ VERIFIED | `routes-ai.adapter.ts` tools + confirm cards |
| 16 | SA AI adapter + skill в Nest DI (D-27/33, Phase 15) | ✗ FAILED | Файл+SKILL есть; не в `SpeechAnalyticsModule.providers`. Registry: `speech-analytics: covered` |
| 17 | Golden eval tooling (D-43…D-45) | ✓ VERIFIED | `run-golden.ts`, 3 fixtures, `eval:speech-analytics` не в npm test |
| 18 | Live UAT web mono 58/58 + stereo 49/49 (D-50) | ✓ VERIFIED | evidence `live.web` |
| 19 | Live UAT API доказывает sa_* (D-50) | ✗ FAILED | evidence `live.api` — HTTP ok без UUID recording |
| 20 | Повторная загрузка того же файла → 2 journal rows (D-50) | ✓ VERIFIED | evidence `doubleUpload.journalMatchCount: 2` (web path) |

**Score:** 14/20 truths verified (0 present, behavior-unverified)

### Required Artifacts (выборка критичных)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `dialplan-webhooks.service.ts` | hangup enqueue branch | ⚠️ HOLLOW | Ветка есть, порт null → no-op; pattern `admitInternalAssetReady` в файле отсутствует (логика через port) |
| `sa-analysis.worker.ts` | wait → pipeline | ⚠️ ORPHANED | Substantive, не Nest-wired |
| `run-analysis.ts` / `channel-diarize.ts` | STT→diarize→charge | ✓ VERIFIED | Unit path |
| `speech-analytics-public.controller.ts` | API ingest | ✗ STUB | In-handler UploadService stub |
| `speech-analytics-ai.adapter.ts` | Nest adapter | ⚠️ ORPHANED | Не в providers |
| `sa-charge-run.ts` / `sa-charge-insights.ts` | charged=false seams | ✓ VERIFIED | Seam OK; insights HTTP hollow |
| `0023-sa-multi-run-charges.sql` | multi-run | ✓ VERIFIED | MySQL+postgres+manifest |
| `MetricEditor` / UploadForm / ModuleSettings | UI | ✓ VERIFIED | Present |
| `speech-analytics-uat-live.json` | UAT evidence | ✓ VERIFIED | Web real; API stub-shaped |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| dialplan-subroutines | dialplan-webhooks.controller | on-hangup CURL | WIRED | Pattern OK |
| dialplan-webhooks.service | HangupAnalyticsPort | enqueue | NOT_WIRED | Port never provided |
| sa-analysis.worker | run-analysis | runAnalysis after wait | PARTIAL | Symbol in worker; Nest factory отсутствует |
| public.controller | UploadService/journal | batch createRun | NOT_WIRED | Stub ids |
| run-analysis | sa-charge-run | invokeSaChargeRun | WIRED | In pipeline code |
| url-download | runAnalysis | complete then analyze | PARTIAL | Deps injectable; public injects fake |
| ModuleSettings UI | speechAnalyticsApi | optimistic Switch | WIRED | Frontend |
| package.json | run-golden | eval:speech-analytics | WIRED | Script exists |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Public uploadBatch | journalId | in-handler literal `journal:…` | No | ✗ DISCONNECTED |
| Public analyzeUrl | journalId | literal `journal-url:…` | No | ✗ DISCONNECTED |
| Cabinet/JWT createRun | recordingId | SaRecording / analytics service | Yes (UAT web) | ✓ FLOWING |
| Insights HTTP | charge row | stub updateInsightsRequest | No | ✗ DISCONNECTED |
| SA-CHARGE-RUN seam | amount/charged | AiPriceRevision + updateRun | Yes when called | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Public controller stub | static read `uploadBatch` | stub createJournalRow + fake runAnalysis | ✓ PASS (proves FAIL truth) |
| RoutesModule providers | grep HANGUP | отсутствует | ✓ PASS (proves FAIL) |
| SA module providers | read module.ts | нет AiAdapter/Worker | ✓ PASS (proves FAIL) |
| UAT evidence API ids | jq/read evidence | `journal:…`, recordingId null | ✓ PASS (proves FAIL) |
| Charge seams no wallet | read sa-charge-*.ts | charged:false; no settleShadow | ✓ PASS |
| Full npm test / live eval | — | skipped by orchestrator order | ? SKIP |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | Phase probes not declared as scripts/*/tests/probe-*.sh | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| REQ-SA-PARITY | 18-01…15 (most) | Паритет aiPBX | ✗ BLOCKED | Hangup/API/adapter gaps |
| REQ-SA-ARCH | 18-02,05,08,09,11–15 | Архитектура кабинета | ? PARTIAL | UI/FSD в основном; registry Reports nav leftover |
| REQ-SA-UAT | 18-10 | Живой UAT samples | ? PARTIAL | Web+doubleUpload OK; API HTTP без sa_* |
| REQ-SA-* in REQUIREMENTS.md | — | — | ORPHANED IDs | В `.planning/REQUIREMENTS.md` строк REQ-SA нет; ids только ROADMAP/plans |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| speech-analytics-public.controller.ts | ~130–141, ~192–195 | In-handler stub journal/analysis | 🛑 Blocker | False HTTP 202 |
| dialplan-webhooks.service.ts | ~81, ~258 | Optional unbound port | 🛑 Blocker | Auto-analysis dead |
| sa-analysis.worker.ts | ~119–129 | Conditional legacy handoff | 🛑 Blocker | Pipeline unbound |
| speech-analytics.module.ts | providers | Missing AiAdapter | 🛑 Blocker | Chat SA tools dead |
| insights.service.ts | ~225–226 | Empty persist deps | 🛑 Blocker | D-47 HTTP hollow |
| moduleRegistry.ts | ~281–285 | Reports nav entry | ⚠️ Warning | Redirected, but still product nav id |
| module-settings.service.ts | Map in-memory | No Nest + no DB | ℹ️ Info | WR/IN from REVIEW |

Согласовано с `18-REVIEW.md` CR-01, WR-01…WR-04.

### Human Verification Required

Не требуются для статуса `gaps_found` (блокирующие gaps уже доказаны статикой + evidence). После закрытия gaps: повторный API UAT с проверкой UUID в `sa_recordings` и hangup smoke на живом Asterisk.

### Gaps Summary

Фаза собрала substantive UI, journal, pipeline, charge seams и web UAT, но **цель паритета с внешним API и авторазбором после звонка не достигнута**: Nest не биндит hangup→worker→runAnalysis, публичный API врёт успех без sa_*, AI-адаптер SA не в DI, insights HTTP не пишет charge. Кабинетный web-путь и `charged=false` seams работают как заявлено.

---

_Verified: 2026-09-22T18:20:00Z_  
_Verifier: Claude (gsd-verifier)_
