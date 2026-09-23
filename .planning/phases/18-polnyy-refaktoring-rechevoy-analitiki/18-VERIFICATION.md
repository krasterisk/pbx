---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
verified: 2026-09-23T05:00:39Z
status: human_needed
score: 23/23 must-haves verified
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 50
  total: 50
  not_honored: []
  note: "Soft gate from prior pass; CR-01/CR-02/CR-03 now VERIFIED in source + named tests"
re_verification:
  previous_status: gaps_found
  previous_score: 20/23
  gaps_closed:
    - "AI apply partial config wipes draft (CR-01 / D-27) — 18-20"
    - "Hangup Nest audioMs = file bytes (CR-02 / D-46) — 18-21"
    - "Public accepted batch awaits scored analysis on HTTP thread (CR-03 / D-17) — 18-22"
  gaps_remaining: []
  regressions: []
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
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-16-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-16-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-17-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-17-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-18-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-18-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-19-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-19-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-20-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-20-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-21-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-21-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-22-PLAN.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-22-SUMMARY.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-CONTEXT.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-REVIEW.md
  - .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-UAT-API-RECHECK.md
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
  - packages/backend/src/modules/speech-analytics/hangup-analytics.port.ts
  - packages/backend/src/modules/speech-analytics/ingest/public-ingest.wiring.ts
  - packages/backend/src/modules/speech-analytics/ingest/upload.service.ts
  - packages/backend/src/modules/speech-analytics/ingest/url-download.ts
  - packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.nest.ts
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
covered_digest: "v1:sha256:de91f6ba66941f12defe3becdad8b1571c32187687e37e86502eb4cd52945b3c"
advisory:
  - finding: "Production public + hangup Nest STT/score default to null (WR-01)"
    category: architectural
    reason: "defaultPipelineDeps и createSaAnalysisWorker подставляют stt/score → null warn; UUID/enqueue есть, scored completion без реальных провайдеров недостижим. Не falsifies locked must_have D-46 (audio_ms units) и не в prior gaps."
    evidence_status: "source defaults observed; advisory review eb832466 — warning only"
  - finding: "moduleRegistry still lists speech-analytics-reports nav id"
    category: other
    reason: "Router redirects /reports → conversations (D-37); leftover nav id is UX noise, not product Reports surface"
    evidence_status: "grep moduleRegistry.ts id speech-analytics-reports"
human_verification:
  - test: "Выполнить 18-UAT-API-RECHECK.md: один SA API-токен, POST uploads/batch с одним mono и одним stereo sample (не полный Z:\\temp\\speech-analytics-samples), подтвердить UUID в sa_recordings/sa_analysis_runs без префикса journal:, charged=false"
    expected: "recordingId/runId/journalId — UUID в sa_*; charged false; без wallet debit"
    why_human: "Живой HTTP/БД после деплоя; automated verify запрещён оркестратором; старый evidence live.api с journal: stubs не считается proof нового public path"
---

# Phase 18: Полный рефакторинг речевой аналитики — Verification Report

**Phase Goal:** Заново собрать модуль речевой аналитики до паритета с aiPBX и удобнее текущего кабинета: проекты и редактор метрик, загрузка записей через интерфейс и API, дашборды и отчёты, диаризация stereo/mono, включение анализа на маршруте, внешний API для чужих АТС, модели из каталога platform/тенанта, биллинг Krasterisk, эталонные оценки, настройка через AI-чат и живой UAT.

**Verified:** 2026-09-23T05:00:39Z  
**Status:** human_needed  
**Re-verification:** Yes — after second gap-closure slice (18-20, 18-21, 18-22)

SUMMARY.md не принимались как доказательство. Проверены исходники и именованные unit-тесты. Три critical из предыдущего `gaps_found` (CR-01/02/03) **закрыты в коде** и подтверждены green named tests. Живой refresh API / полный `Z:\temp\speech-analytics-samples` / wallet debit **не** запускались. Старый `speech-analytics-uat-live.json` `live.api` с `journal:` stubs **не** считается proof нового public path.

Контракт: Goal + CONTEXT D-* + must_haves планов 18-01…18-22. Все 23 must-have truths по коду ✓; единственный открытый human item — live API UUID re-check (`18-UAT-API-RECHECK.md`).

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts (soft gate: 50/50). CR-01/02/03 теперь закрыты поведенческими тестами.

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | Production STT/score null defaults (WR-01) | architectural | new-scope vs prior gaps; не ломает D-46 units / D-17 accepted |
| 2 | `moduleRegistry` nav id `speech-analytics-reports` | other | redirect exists; leftover nav id |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | Журнал sa_* отделён от Asterisk CDR; загрузки не создают CDR (D-05) | ✓ VERIFIED | createRun / public wiring `createsCdr: false`; cabinet UAT UUID |
| 2 | SA-CHARGE-RUN persist amount с charged=false; settleShadow/BillingBalance не вызываются (D-46…D-48) | ✓ VERIFIED | `sa-charge-run.ts` + specs; seams без wallet |
| 3 | Селект проекта на маршруте; hangup_handler при projectId (D-01, D-02) | ✓ VERIFIED | `RouteGeneralTab` + `route-recording.util` |
| 4 | Hangup в Nest production ставит задание анализа (D-03) — G-18-01 | ✓ VERIFIED | `HangupAnalyticsPortService` + module export; specs enqueue |
| 5 | Worker wait nonempty → `runAnalysis` в Nest (D-03/D-23) — G-18-02 | ✓ VERIFIED | `sa-analysis.worker.nest.ts` always injects `runAnalysis` |
| 6 | Stereo energy / mono LLM; dual-stt off (D-23) | ✓ VERIFIED | `channel-diarize.ts` + specs |
| 7 | Журнал + sheet + вкладки Cost «не списано» (D-05…D-08) | ✓ VERIFIED | Journal/ConversationSheet |
| 8 | Редактор метрик + draft/publish (D-25, D-26) | ✓ VERIFIED | `MetricEditor.tsx`, `ProjectEditorService` |
| 9 | Кабинетная загрузка создаёт sa_* (D-14…D-16) | ✓ VERIFIED | UAT web UUID `recordingId`/`runId` |
| 10 | Внешний API upload/URL → sa_* UUID + путь разбора (G-18-03) | ✓ VERIFIED | `public-ingest.wiring.ts` createRun; unit UUID proof |
| 11 | API token: hash-only, один проект, body не override (D-32, D-33) | ✓ VERIFIED | `resolveTokenBoundProject` |
| 12 | Стандартный дашборд без конструктора (D-34) | ✓ VERIFIED | `DashboardService` |
| 13 | HTTP insights persist SA-CHARGE-INSIGHTS charged=false (D-47) — G-18-05 | ✓ VERIFIED | `insights.service.ts` + specs |
| 14 | Excel с панели журнала; Reports не product surface (D-37) | ✓ VERIFIED | Router redirect `/speech-analytics/reports` |
| 15 | AI-чат маршрута: list/set/clear analytics project (D-04) | ✓ VERIFIED | `routes-ai.adapter.ts` |
| 16 | SA AI adapter + ModuleSettings в Nest DI (G-18-04) | ✓ VERIFIED | module providers include adapter + settings |
| 17 | Golden eval tooling (D-43…D-45) | ✓ VERIFIED | `run-golden.ts`, fixtures, `eval:speech-analytics` |
| 18 | Live UAT web mono 58/58 + stereo 49/49 (D-50) | ✓ VERIFIED | evidence `live.web` |
| 19 | Automated UUID proof public API + UAT re-check checklist (G-18-06) | ✓ VERIFIED | unit UUID specs; checklist approved; **live HTTP refresh deferred → Human Verification** |
| 20 | Повторная загрузка того же файла → 2 journal rows (D-50) | ✓ VERIFIED | evidence `doubleUpload.journalMatchCount: 2` |
| 21 | AI-чат apply сохраняет полный merged draft (D-27 / CR-01) | ✓ VERIFIED | `apply`: `mergeConfig({ ...state.draft, ...args.config })`; test `metric-only apply… (CR-01, D-27)` PASS |
| 22 | Hangup SA-CHARGE-RUN audio_ms = длительность, не bytes (D-46 / CR-02) | ✓ VERIFIED | nest: job `audioMs`/`durationSec`, `_bytes` unused; hangup port `audioMs: durationSec*1000`; STT fallback in `run-analysis`; named CR-02 + STT tests PASS |
| 23 | Public accepted batch не ждёт score на HTTP (D-17 / CR-03) | ✓ VERIFIED | `void runAnalysis` when `!apiWaitsForResult`; upload + url-download CR-03 tests PASS |

**Score:** 23/23 truths verified (0 present, behavior-unverified)

### Deferred Items

Нет.

### Advisory (New Scope, Unevidenced)

New-scope findings from Step 7 with no deterministic evidence — reported, not blocking.

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | Production STT/score null defaults (WR-01) | architectural | new-scope, no deterministic evidence forcing blocker |
| 2 | `moduleRegistry` nav id leftover | other | redirect covers D-37 |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `hangup-analytics.port.ts` | Nest HangupAnalyticsPort | ✓ VERIFIED | enqueue + `durationSec`/`audioMs` to worker |
| `sa-analysis.worker.nest.ts` | wait → runAnalysis; audioMs from job | ✓ VERIFIED | never `Math.max(0, bytes)` as audioMs |
| `speech-analytics.module.ts` | providers HANGUP/worker/AI | ✓ VERIFIED | G-18-01/02/04 |
| `routes.module.ts` | forwardRef SA | ✓ VERIFIED | HANGUP port injectable |
| `public-ingest.wiring.ts` | createRun UUID | ✓ VERIFIED | G-18-03 |
| `speech-analytics-public.controller.ts` | non-stub batch | ✓ VERIFIED | wiring + UploadService wait contract |
| `insights.service.ts` | persist charge | ✓ VERIFIED | G-18-05 |
| `speech-analytics-ai.adapter.ts` | Nest + merge-on-apply | ✓ VERIFIED | CR-01 fixed |
| `upload.service.ts` / `url-download.ts` | accepted without await | ✓ VERIFIED | CR-03 fixed |
| `18-UAT-API-RECHECK.md` | live checklist | ✓ VERIFIED | approved later manual |
| `speech-analytics-uat-live.json` | UAT evidence | ⚠️ PARTIAL | web OK; api section stale stub ids — not used as proof |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| dialplan-webhooks.service | HangupAnalyticsPort | HANGUP_ANALYTICS_PORT | WIRED | Provided/exported from SA module |
| HangupAnalyticsPort | SaAnalysisWorker | fire-and-forget + duration | WIRED | `audioMs: durationSec * 1000` |
| sa-analysis.worker.nest | run-analysis | runAnalysis after wait | WIRED | audioMs from job, not bytes |
| public.controller | createRun | buildPublicUploadDeps | WIRED | UUID path |
| UploadService / UrlIngest | runAnalysis | void when !wait | WIRED | accepted path non-blocking |
| insights.service | sa-charge-insights | invokeSaChargeInsights | WIRED | Real deps |
| SpeechAnalyticsAiAdapter | apply | merge draft+partial | WIRED | CR-01 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Public uploadBatch journalId | recordingId | SpeechAnalyticsService.createRun | Yes (unit) | ✓ FLOWING |
| Public analyzeUrl | recordingId | same createRun path | Yes (unit) | ✓ FLOWING |
| Old evidence live.api | journalId | stub era `journal:…` | No (stale) | ✗ DISCONNECTED (do not trust) |
| Insights HTTP charge | amount/charged | updateInsightsRequest | Yes | ✓ FLOWING |
| Hangup SA-CHARGE-RUN audio_ms | audioMs | job duration / STT fallback | Yes | ✓ FLOWING |
| AI apply draft | config | `{...state.draft, ...args.config}` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| CR-01 metric-only apply | `jest …speech-analytics-ai.adapter.spec -t "metric-only apply"` | PASS | ✓ PASS |
| CR-02 nest audioMs | `jest …sa-analysis.worker.spec -t "Nest runAnalysis passes audioMs" --testTimeout=60000` | PASS (45_000 ≠ hugeBytes) | ✓ PASS |
| CR-02 STT fallback | `jest …run-analysis.spec -t "STT durationSec\|prefers positive hangup"` | 2 PASS | ✓ PASS |
| CR-03 upload accepted | `jest …upload.service.spec -t "API without sync returns accepted"` | PASS | ✓ PASS |
| CR-03 url accepted | `jest …url-download.spec -t "sync≠true returns accepted"` | PASS | ✓ PASS |
| Hangup duration wiring | `jest …hangup-analytics.port.spec -t "enqueue"` | PASS `audioMs: 45_000` | ✓ PASS |
| Locked: no settleShadow in charge seams | grep sa-charge-*.ts | no settleShadow/BillingBalance imports | ✓ PASS |
| Live API UUID refresh | — | not run (checklist only) | ? SKIP → human |
| Full Z:\temp catalog | — | forbidden | ? SKIP |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | Phase probes not declared as scripts/*/tests/probe-*.sh | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| REQ-SA-PARITY | 18-01…18-22 (most) | Паритет aiPBX | ✓ SATISFIED (code) | Nest/API/AI/hangup/upload paths; CR-01/02/03 closed |
| REQ-SA-ARCH | 18-02,05,08,09,11–16,18,20 | Архитектура кабинета | ✓ SATISFIED (code) | UI/FSD + Nest DI; AI apply merge fixed |
| REQ-SA-UAT | 18-10,17,19,22 | Живой UAT samples | ? NEEDS HUMAN | Web+doubleUpload+unit UUID OK; **live API UUID refresh not executed** |
| REQ-SA-* rows in REQUIREMENTS.md | — | — | ABSENT AS ROWS | В `.planning/REQUIREMENTS.md` **нет** строк `REQ-SA-PARITY` / `REQ-SA-ARCH` / `REQ-SA-UAT` (файл — MOH playlist REQ-001…). IDs живут на ROADMAP и PLAN frontmatter — учтены здесь явно, строки не выдумывались |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| public-ingest / nest worker | defaults | stt/score → null (WR-01) | 📋 Advisory | Scored path needs real providers |
| moduleRegistry.ts | ~282 | reports nav id | 📋 Advisory | Redirected |

Debt markers `TBD`/`FIXME`/`XXX` в ключевых gap-файлах (18-20…18-22) не найдены. Prior CR-01/02/03 blockers **закрыты**.

### Locked Rules Check

| Rule | Status | Evidence |
| ---- | ------ | -------- |
| no settleShadow / wallet debit | ✓ | charge seams + insights HTTP |
| no dual-STT | ✓ | channel-diarize |
| no journal: stubs on new public path | ✓ | public-ingest createRun UUID |
| D-27 AI apply no wipe | ✓ | merge onto live draft |
| D-46 audio_ms duration | ✓ | job/STT, not waitForFile bytes |
| D-17 accepted non-blocking | ✓ | void runAnalysis when !sync single |

### Human Verification Required

### 1. Live API UUID re-check (G-18-06 / D-50)

**Test:** По чеклисту `18-UAT-API-RECHECK.md`: выпустить один SA API-токен; `POST /api/v1/speech-analytics/uploads/batch` с одним маленьким mono и одним stereo (не полный каталог samples); проверить ids в ответе и БД.  
**Expected:** `recordingId` / `runId` / `journalId` — UUID в `sa_recordings` / `sa_analysis_runs`; без префикса `journal:`; `charged === false`; без wallet debit.  
**Why human:** Требует живой деплой/HTTP/БД; automated verify этого прогона запрещён; старый evidence `live.api` со stubs не доказательство.

### Gaps Summary

Кодовых gaps нет: CR-01 (18-20), CR-02 (18-21), CR-03 (18-22) закрыты и подтверждены named tests. Статус `human_needed` только из-за неисполненного live API UUID re-check.

---

_Verified: 2026-09-23T05:00:39Z_  
_Verifier: Claude (gsd-verifier)_
