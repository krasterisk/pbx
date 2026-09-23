---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
verified: 2026-09-23T03:55:00Z
status: gaps_found
score: 20/23 must-haves verified
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 50
  total: 50
  not_honored: []
  note: "gsd check.decision-coverage-verify — soft gate by artifact presence; CR-01/CR-02/CR-03 still FAIL D-27/D-46/D-17 as must-haves below"
re_verification:
  previous_status: gaps_found
  previous_score: 14/20
  gaps_closed:
    - "После звонка hangup handler ставит задание анализа в Nest production (D-03) — G-18-01"
    - "Worker после wait-for-file вызывает pipeline runAnalysis в production Nest (D-03, D-23, D-46) — G-18-02"
    - "Внешний API upload/URL пишет sa_* journal и запускает реальный разбор (D-14…D-17, D-39…D-42) — G-18-03 UUID path"
    - "SpeechAnalyticsAiAdapter зарегистрирован в Nest и доступен AI-чату (D-27, D-33) — G-18-04 DI"
    - "HTTP insights persist SA-CHARGE-INSIGHTS с charged=false (D-47) — G-18-05"
    - "Live UAT API-канал доказывает sa_* строки (D-50 / REQ-SA-UAT) — G-18-06 automated UUID gate + 18-UAT-API-RECHECK checklist"
  gaps_remaining:
    - "AI apply partial config wipes draft (CR-01 / D-27)"
    - "Hangup Nest audioMs = file bytes (CR-02 / D-46)"
    - "Public accepted batch awaits scored analysis on HTTP thread (CR-03 / D-17)"
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
covered_digest: "v1:sha256:427e919d6e62abc55b9e8eb50dcb1e5343684814310c86837476518cb59d4d96"
gaps:
  - truth: "Подтверждение AI-чата применяет полный merged draft проекта без wipe остальных полей (D-27 / цель «настройка через AI-чат»)"
    status: failed
    reason: "CR-01: proposeEdit кладёт в applyPayload только partial input.config; apply делает mergeConfig(partial) = defaults+partial — метрик-only confirm сбрасывает topics/webhooks/digest/alerts/budget"
    artifacts:
      - path: packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts
        issue: "applyPayload.config = input.config; apply → mergeConfig(args.config) без {...state.draft, ...}"
    missing:
      - "В apply (или applyPayload) передавать mergeConfig({ ...state.draft, ...args.config })"
  - truth: "Hangup Nest runAnalysis передаёт в SA-CHARGE-RUN корректный audio_ms (длительность), не размер файла в байтах (D-46)"
    status: failed
    reason: "CR-02: createSaAnalysisWorker вызывает pipelineRunAnalysis с audioMs: Math.max(0, bytes) — байты файла как «миллисекунды»"
    artifacts:
      - path: packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.nest.ts
        issue: "audioMs: Math.max(0, bytes) из waitForFile"
    missing:
      - "Проброс durationSec*1000 из HangupAnalysisJobInput / fallback STT duration; никогда не использовать raw file bytes как ms"
  - truth: "Внешний API без sync / пачка сразу возвращает accepted без ожидания scored analysis на HTTP-потоке (D-17)"
    status: failed
    reason: "CR-03: UploadService/UrlIngestService всегда await runAnalysis до ответа; kind:'accepted' меняет только форму ответа, не блокировку потока"
    artifacts:
      - path: packages/backend/src/modules/speech-analytics/ingest/upload.service.ts
        issue: "await this.deps.runAnalysis(...) для каждого файла до return accepted"
      - path: packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.ts
        issue: "Документация sync=true vs accepted; реализация всё равно ждёт score"
    missing:
      - "Fire-and-forget анализ при sync≠true / multi-item; await только single-item sync=true"
advisory:
  - finding: "Production public + hangup Nest STT/score default to null (WR-01)"
    category: architectural
    reason: "defaultPipelineDeps и createSaAnalysisWorker подставляют stt/score → null; UUID/enqueue есть, scored completion без провайдеров недостижим. Не в prior gaps; именованный red-тест на must_have не гонялся."
    evidence_status: "none provided — source defaults observed; not promoted to blocker without fail-closed STT requirement in gap contract"
  - finding: "moduleRegistry still lists speech-analytics-reports nav id"
    category: other
    reason: "Router redirects /reports → conversations (D-37); nav id leftover is UX noise, not product Reports surface"
    evidence_status: "grep moduleRegistry.ts id speech-analytics-reports"
---

# Phase 18: Полный рефакторинг речевой аналитики — Verification Report

**Phase Goal:** Заново собрать модуль речевой аналитики до паритета с aiPBX и удобнее текущего кабинета: проекты и редактор метрик, загрузка записей через интерфейс и API, дашборды и отчёты, диаризация stereo/mono, включение анализа на маршруте, внешний API для чужих АТС, модели из каталога platform/тенанта, биллинг Krasterisk, эталонные оценки, настройка через AI-чат и живой UAT.

**Verified:** 2026-09-23T03:55:00Z  
**Status:** gaps_found  
**Re-verification:** Yes — after gap closure 18-16…18-19

SUMMARY.md не принимались как доказательство. Проверены исходники после gap-closure, unit-тесты gap-планов (49 passed), `18-REVIEW.md` CR-01…CR-03, evidence `.planning/evidence/speech-analytics-uat-live.json` (API-секция — **устаревший stub-shaped journal:**; не доказательство нового public path). Живой refresh API / полный `Z:\temp\speech-analytics-samples` / wallet debit **не** запускались (запрет оркестратора; live API — одобренный чеклист `18-UAT-API-RECHECK.md`, не исполнен в этом прогоне).

Контракт: Goal + CONTEXT D-* + must_haves планов 18-01…18-19. Шесть gaps G-18-01…G-18-06 **закрыты** в коде. Три critical из code review **подтверждены в source** и ломают D-27 / D-46 / D-17 → `gaps_found`.

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts (soft gate: 50/50). Наличие символов **не** отменяет FAILED по CR-01/02/03 ниже.

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | Production STT/score null defaults (WR-01) | architectural | new-scope vs prior gaps; no red named test forced into blocker |
| 2 | `moduleRegistry` nav id `speech-analytics-reports` | other | redirect exists; leftover nav id |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | Журнал sa_* отделён от Asterisk CDR; загрузки не создают CDR (D-05) | ✓ VERIFIED | createRun / public wiring `createsCdr: false`; cabinet UAT UUID |
| 2 | SA-CHARGE-RUN persist amount с charged=false; settleShadow/BillingBalance не вызываются (D-46…D-48) | ✓ VERIFIED | `sa-charge-run.ts` + specs; seams без wallet. (Корректность units audio_ms — truth 22) |
| 3 | Селект проекта на маршруте; hangup_handler при projectId (D-01, D-02) | ✓ VERIFIED | `RouteGeneralTab` + `route-recording.util` |
| 4 | Hangup в Nest production ставит задание анализа (D-03) — G-18-01 | ✓ VERIFIED | `HangupAnalyticsPortService` + `{ provide: HANGUP_ANALYTICS_PORT }` export; `RoutesModule` `forwardRef(SpeechAnalyticsModule)`; specs enqueue/skip/idempotent |
| 5 | Worker wait nonempty → `runAnalysis` в Nest (D-03/D-23) — G-18-02 | ✓ VERIFIED | `sa-analysis.worker.nest.ts` factory всегда инжектит `runAnalysis`; `saAnalysisWorkerProvider` в module; specs 500ms/60s |
| 6 | Stereo energy / mono LLM; dual-stt off (D-23) | ✓ VERIFIED | `channel-diarize.ts` + specs |
| 7 | Журнал + sheet + вкладки Cost «не списано» (D-05…D-08) | ✓ VERIFIED | Journal/ConversationSheet |
| 8 | Редактор метрик + draft/publish (D-25, D-26) | ✓ VERIFIED | `MetricEditor.tsx`, `ProjectEditorService` |
| 9 | Кабинетная загрузка создаёт sa_* (D-14…D-16) | ✓ VERIFIED | UAT web UUID `recordingId`/`runId` |
| 10 | Внешний API upload/URL → sa_* UUID + путь разбора (G-18-03) | ✓ VERIFIED | `public-ingest.wiring.ts` createRun; controller без `journal:` stubs; unit UUID proof. (HTTP-await — truth 23) |
| 11 | API token: hash-only, один проект, body не override (D-32, D-33) | ✓ VERIFIED | `resolveTokenBoundProject` |
| 12 | Стандартный дашборд без конструктора (D-34) | ✓ VERIFIED | `DashboardService` |
| 13 | HTTP insights persist SA-CHARGE-INSIGHTS charged=false (D-47) — G-18-05 | ✓ VERIFIED | `insights.service.ts` real `findLatestRates`/`updateInsightsRequest`; specs persist |
| 14 | Excel с панели журнала; Reports не product surface (D-37) | ✓ VERIFIED | Router redirect `/speech-analytics/reports`. (⚠ nav id в registry — advisory) |
| 15 | AI-чат маршрута: list/set/clear analytics project (D-04) | ✓ VERIFIED | `routes-ai.adapter.ts` |
| 16 | SA AI adapter + ModuleSettings в Nest DI (G-18-04) | ✓ VERIFIED | `SpeechAnalyticsModule.providers` включает `SpeechAnalyticsAiAdapter`, `ModuleSettingsService`, AI ports. (Apply wipe — truth 21) |
| 17 | Golden eval tooling (D-43…D-45) | ✓ VERIFIED | `run-golden.ts`, fixtures, `eval:speech-analytics` |
| 18 | Live UAT web mono 58/58 + stereo 49/49 (D-50) | ✓ VERIFIED | evidence `live.web` |
| 19 | Automated UUID proof public API + UAT re-check checklist (G-18-06) | ✓ VERIFIED | unit specs UUID; `18-UAT-API-RECHECK.md` approved; **old** `live.api` journal: ids **не** считаются proof нового path; live refresh не исполнен |
| 20 | Повторная загрузка того же файла → 2 journal rows (D-50) | ✓ VERIFIED | evidence `doubleUpload.journalMatchCount: 2`; public wiring unique idempotencyKey |
| 21 | AI-чат apply сохраняет полный merged draft (D-27) | ✗ FAILED | CR-01 confirmed: `applyPayload.config = input.config`; `apply` → `mergeConfig(partial)` |
| 22 | Hangup SA-CHARGE-RUN audio_ms = длительность, не bytes (D-46) | ✗ FAILED | CR-02 confirmed: `audioMs: Math.max(0, bytes)` в nest worker |
| 23 | Public accepted batch не ждёт score на HTTP (D-17) | ✗ FAILED | CR-03 confirmed: `await runAnalysis` до `kind: 'accepted'` |

**Score:** 20/23 truths verified (0 present, behavior-unverified)

### Deferred Items

Нет — CR-01/02/03 не покрыты более поздними фазами milestone roadmap.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `hangup-analytics.port.ts` | Nest HangupAnalyticsPort | ✓ VERIFIED | resolve + enqueue + knownOrigins idempotent |
| `sa-analysis.worker.nest.ts` | wait → runAnalysis | ✓ VERIFIED | wired; audioMs bug = truth 22 |
| `speech-analytics.module.ts` | providers HANGUP/worker/AI | ✓ VERIFIED | G-18-01/02/04 |
| `routes.module.ts` | forwardRef SA | ✓ VERIFIED | HANGUP port injectable |
| `public-ingest.wiring.ts` | createRun UUID | ✓ VERIFIED | G-18-03 |
| `speech-analytics-public.controller.ts` | non-stub batch | ✓ VERIFIED | wiring; await = truth 23 |
| `insights.service.ts` | persist charge | ✓ VERIFIED | G-18-05 |
| `speech-analytics-ai.adapter.ts` | Nest + tools | ⚠️ HOLLOW on apply | DI OK; apply wipe CR-01 |
| `18-UAT-API-RECHECK.md` | live checklist | ✓ VERIFIED | human-approved later |
| `speech-analytics-uat-live.json` | UAT evidence | ⚠️ PARTIAL | web OK; api section stale stub ids |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| dialplan-webhooks.service | HangupAnalyticsPort | HANGUP_ANALYTICS_PORT | WIRED | Provided/exported from SA module |
| HangupAnalyticsPort | SaAnalysisWorker | fire-and-forget | WIRED | SA_ANALYSIS_WORKER optional inject |
| sa-analysis.worker.nest | run-analysis | runAnalysis after wait | WIRED | Always injected |
| public.controller | createRun | buildPublicUploadDeps | WIRED | UUID path |
| public runAnalysis | HTTP response | await in UploadService | PARTIAL | Wired but blocks accepted path (D-17) |
| insights.service | sa-charge-insights | invokeSaChargeInsights | WIRED | Real deps |
| SpeechAnalyticsAiAdapter | AiAdapterRegistry | OnModuleInit | WIRED | DI present; apply logic wrong |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Public uploadBatch journalId | recordingId | SpeechAnalyticsService.createRun | Yes (unit) | ✓ FLOWING |
| Public analyzeUrl | recordingId | same createRun path | Yes (unit) | ✓ FLOWING |
| Old evidence live.api | journalId | stub era `journal:…` | No (stale) | ✗ DISCONNECTED (do not trust) |
| Insights HTTP charge | amount/charged | updateInsightsRequest | Yes | ✓ FLOWING |
| Hangup SA-CHARGE-RUN audio_ms | audioMs | file bytes mislabeled | Wrong units | ⚠️ HOLLOW semantics |
| AI apply draft | config | partial → defaults merge | Wipes fields | ✗ DISCONNECTED from propose merge |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Gap-closure unit suite | `npm run test -w @krasterisk/backend -- --testPathPattern="hangup-analytics.port.spec\|sa-analysis.worker.spec\|insights.service.spec\|public-ingest.wiring.spec\|speech-analytics-public.controller.spec\|speech-analytics-ai.adapter.spec" --no-coverage` | 6 suites / 49 passed | ✓ PASS |
| CR-01 apply payload | static read adapter proposeEdit/apply | partial config in applyPayload | ✓ PASS (proves FAIL truth 21) |
| CR-02 audioMs bytes | static read worker.nest.ts | `audioMs: Math.max(0, bytes)` | ✓ PASS (proves FAIL truth 22) |
| CR-03 await accepted | static read upload.service.ts | await runAnalysis before accepted | ✓ PASS (proves FAIL truth 23) |
| Locked: no settleShadow in charge seams | grep sa-charge-*.ts | no settleShadow/BillingBalance | ✓ PASS |
| Locked: no dual-STT | channel-diarize.spec | dual-stt absent | ✓ PASS |
| Live API UUID refresh | — | not run (checklist only) | ? SKIP |
| Full Z:\temp catalog | — | forbidden | ? SKIP |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | Phase probes not declared as scripts/*/tests/probe-*.sh | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| REQ-SA-PARITY | 18-01…18-18 (most) | Паритет aiPBX | ✗ BLOCKED | Nest/API UUID wiring OK; CR-01/02/03 + D-17/D-27/D-46 |
| REQ-SA-ARCH | 18-02,05,08,09,11–16,18 | Архитектура кабинета | ? PARTIAL | UI/FSD + Nest DI; Reports nav leftover; AI apply wipe |
| REQ-SA-UAT | 18-10,17,19 | Живой UAT samples | ? PARTIAL | Web+doubleUpload OK; automated UUID OK; live API UUID refresh not executed |
| REQ-SA-* rows in REQUIREMENTS.md | — | — | ABSENT AS ROWS | В `.planning/REQUIREMENTS.md` **нет** строк `REQ-SA-PARITY` / `REQ-SA-ARCH` / `REQ-SA-UAT`; IDs живут на ROADMAP и PLAN frontmatter — учтены здесь явно, строки не выдумывались |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| speech-analytics-ai.adapter.ts | ~210–218, ~309–316 | Partial apply → defaults (CR-01) | 🛑 Blocker | D-27 / AI chat config wipe |
| sa-analysis.worker.nest.ts | ~135 | bytes as audioMs (CR-02) | 🛑 Blocker | D-46 wrong charge math |
| upload.service.ts | ~157–161 | await analysis on accepted path (CR-03) | 🛑 Blocker | D-17 HTTP blocks |
| public-ingest / nest worker | defaults | stt/score → null (WR-01) | 📋 Advisory | Scored path incomplete |
| moduleRegistry.ts | ~281–285 | reports nav id | ⚠️ Warning | Redirected |

Debt markers `TBD`/`FIXME`/`XXX` в ключевых gap-файлах не найдены.

### Locked Rules Check

| Rule | Status | Evidence |
| ---- | ------ | -------- |
| no settleShadow / wallet debit | ✓ | charge seams + insights HTTP |
| charged=false | ✓ | SA-CHARGE-RUN / INSIGHTS |
| no analyst role | ✓ | adapter/journal specs |
| no dual-STT | ✓ | channel-diarize |
| no CDR writes from SA journal | ✓ | createsCdr:false |
| pause blocks only new automatic | ✓ | ModuleSettings / hangup resolve |
| duplicate hangup idempotent | ✓ | hangup-analytics.port.spec |

### Human Verification Required

Не меняют статус (уже `gaps_found`), но остаются после закрытия CR:

1. **Live API UUID re-check** — по `18-UAT-API-RECHECK.md`: один mono + один stereo; UUID в `sa_recordings`/`sa_analysis_runs`; без wallet debit; не полный `Z:\temp`.  
   **Expected:** `journalId`/`recordingId`/`runId` UUID, не `journal:`.  
   **Why human:** live deploy + token; старый evidence api невалиден.

2. **AI apply partial edit** — после фикса CR-01: метрик-only confirm сохраняет topics/webhooks.  
3. **Hangup smoke** — после фикса CR-02: `audio_ms` ≈ duration, не file size.

### Gaps Summary

Gap-closure 18-16…18-19 **закрыл** Nest hangup→worker→runAnalysis, public sa_* UUID, AI adapter DI, insights HTTP charge и automated UUID gate. Цель фазы **всё ещё не достигнута**: code review CR-01/02/03 подтверждены в исходниках и ломают must-haves D-27 (AI apply wipe), D-46 (audio_ms=bytes), D-17 (accepted всё ещё await score). Старый `speech-analytics-uat-live.json` api-канал со stub `journal:` **не** доказывает новый public path.

Structured gaps in frontmatter for `/gsd-plan-phase --gaps`.

---

_Verified: 2026-09-23T03:55:00Z_  
_Verifier: Claude (gsd-verifier)_
