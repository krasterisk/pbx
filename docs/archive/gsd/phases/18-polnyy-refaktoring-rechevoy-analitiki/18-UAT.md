---
status: complete
phase: 18-polnyy-refaktoring-rechevoy-analitiki
source: [18-01-SUMMARY, 18-02-SUMMARY, 18-03-SUMMARY, 18-04-SUMMARY, 18-05-SUMMARY, 18-06-SUMMARY, 18-07-SUMMARY, 18-08-SUMMARY, 18-09-SUMMARY, 18-10-SUMMARY, 18-11-SUMMARY, 18-12-SUMMARY, 18-13-SUMMARY, 18-14-SUMMARY, 18-15-SUMMARY, 18-16-SUMMARY, 18-17-SUMMARY, 18-18-SUMMARY, 18-19-SUMMARY, 18-20-SUMMARY, 18-21-SUMMARY, 18-22-SUMMARY]
started: 2026-09-23T05:15:31Z
updated: 2026-09-23T05:40:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Живая проверка UUID публичного API (G-18-06 / D-50)
expected: |
  Выпустите один API-токен речевой аналитики для опубликованного лабораторного проекта. Секрет токена не коммитьте и не присылайте в чат.
  POST /api/v1/speech-analytics/uploads/batch: один небольшой моно-файл и один небольшой стерео-файл. Полный каталог Z:\temp\speech-analytics-samples не запускайте.
  recordingId, runId и journalId — UUID, и эти строки есть в sa_recordings и sa_analysis_runs. У успешных id нет префикса journal:.
  charged остаётся false. Списания с кошелька нет.
result: pass
observed: HTTP 202 accepted; journalId/recordingId/runId UUID; charged false; no billing charge; token revoked after check

### 2. Analytics journal remains separate from Asterisk CDR (D-05)
expected: Analytics journal remains separate from Asterisk CDR (D-05)
result: pass
source: automated
coverage_id: D1
summary: 18-01-SUMMARY.md

### 3. SA-CHARGE-RUN persists amount 0 with charged=false when rates missing
expected: SA-CHARGE-RUN persists amount 0 with charged=false when rates missing
result: pass
source: automated
coverage_id: D2
summary: 18-01-SUMMARY.md

### 4. Migration 0023 listed; multi-run unique gone; insights seam without GATE
expected: Migration 0023 listed; multi-run unique gone; insights seam without GATE
result: pass
source: automated
coverage_id: D3
summary: 18-01-SUMMARY.md

### 5. Route form shows Analytics project Select when module active and recording on; hidden when recording off or module inactive without clearing projectId
expected: Route form shows Analytics project Select when module active and recording on; hidden when recording off or module inactive without clearing projectId
result: pass
source: automated
coverage_id: D1
summary: 18-02-SUMMARY.md

### 6. resolveCapturePolicy requires route projectId; pauseNew blocks new autos; no company default fallback
expected: resolveCapturePolicy requires route projectId; pauseNew blocks new autos; no company default fallback
result: pass
source: automated
coverage_id: D2
summary: 18-02-SUMMARY.md

### 7. recordingDialplanLines pushes hangup_handler when analyticsProjectId set without hangup webhook; no STT in dialplan lines
expected: recordingDialplanLines pushes hangup_handler when analyticsProjectId set without hangup webhook; no STT in dialplan lines
result: pass
source: automated
coverage_id: D3
summary: 18-02-SUMMARY.md

### 8. handleOnHangup enqueues analysis when entitled, not paused, and route has projectId; skips pause/missing project; does not call STT
expected: handleOnHangup enqueues analysis when entitled, not paused, and route has projectId; skips pause/missing project; does not call STT
result: pass
source: automated
coverage_id: D1
summary: 18-03-SUMMARY.md

### 9. decideHangupAnalysisAdmission gates enqueue via capture-policy + admitInternalAssetReady
expected: decideHangupAnalysisAdmission gates enqueue via capture-policy + admitInternalAssetReady
result: pass
source: automated
coverage_id: D2
summary: 18-03-SUMMARY.md

### 10. Worker waits with 500ms poll / 60s ceiling / two-poll size stability; timeout or empty skips SA-CHARGE-RUN; fakeStt not scored success
expected: Worker waits with 500ms poll / 60s ceiling / two-poll size stability; timeout or empty skips SA-CHARGE-RUN; fakeStt not scored success
result: pass
source: automated
coverage_id: D3
summary: 18-03-SUMMARY.md

### 11. Hangup dialplan keeps StopMixMonitor → ffmpeg → CURL and notifies when SA_PROJECT attached without WH_OH
expected: Hangup dialplan keeps StopMixMonitor → ffmpeg → CURL and notifies when SA_PROJECT attached without WH_OH
result: pass
source: automated
coverage_id: D4
summary: 18-03-SUMMARY.md

### 12. runAnalysis success persists then calls invokeSaChargeRun once including amount 0; score failure skips charge
expected: runAnalysis success persists then calls invokeSaChargeRun once including amount 0; score failure skips charge
result: pass
source: automated
coverage_id: D1
summary: 18-04-SUMMARY.md

### 13. D-38 model resolution uses allowlist with project override and one silence fallback to module default
expected: D-38 model resolution uses allowlist with project override and one silence fallback to module default
result: pass
source: automated
coverage_id: D2
summary: 18-04-SUMMARY.md

### 14. Channel maps lock route vs upload; identical channels not stereo; energy failure → LLM roles; no dual-stt export
expected: Channel maps lock route vs upload; identical channels not stereo; energy failure → LLM roles; no dual-stt export
result: pass
source: automated
coverage_id: D3
summary: 18-04-SUMMARY.md

### 15. ConversationSheet opens with locked tabs and PBX/upload player rules plus rebuild badge
expected: ConversationSheet opens with locked tabs and PBX/upload player rules plus rebuild badge
result: pass
source: automated
coverage_id: D1
summary: 18-05-SUMMARY.md

### 16. Journal page opens sheet at stable conversation URL
expected: Journal page opens sheet at stable conversation URL
result: pass
source: automated
coverage_id: D2
summary: 18-05-SUMMARY.md

### 17. Journal API enforces CDR access scope, ADMIN mutate RBAC, and no-refund delete
expected: Journal API enforces CDR access scope, ADMIN mutate RBAC, and no-refund delete
result: pass
source: automated
coverage_id: D3
summary: 18-05-SUMMARY.md

### 18. Draft/publish stamp rules and publisher RBAC (D-25…D-27)
expected: Draft/publish stamp rules and publisher RBAC (D-25…D-27)
result: pass
source: automated
coverage_id: D1
summary: 18-06-SUMMARY.md

### 19. Soft budget sums SA-CHARGE-RUN only; zero = no limit; never stops analyses (D-28)
expected: Soft budget sums SA-CHARGE-RUN only; zero = no limit; never stops analyses (D-28)
result: pass
source: automated
coverage_id: D2
summary: 18-06-SUMMARY.md

### 20. Integrations tenant check, webhook enqueue/test, delete effects (D-29…D-31)
expected: Integrations tenant check, webhook enqueue/test, delete effects (D-29…D-31)
result: pass
source: automated
coverage_id: D3
summary: 18-06-SUMMARY.md

### 21. API sync=true single-file upload waits for scored result; stores bytes; journal-only
expected: API sync=true single-file upload waits for scored result; stores bytes; journal-only
result: pass
source: automated
coverage_id: D1
summary: 18-07-SUMMARY.md

### 22. Hash-only project-bound SA tokens; ADMIN/SUPERADMIN issue; SUPERVISOR cannot
expected: Hash-only project-bound SA tokens; ADMIN/SUPERADMIN issue; SUPERVISOR cannot
result: pass
source: automated
coverage_id: D2
summary: 18-07-SUMMARY.md

### 23. URL download caps + incomplete skip charge; JWT Get analytics admission
expected: URL download caps + incomplete skip charge; JWT Get analytics admission
result: pass
source: automated
coverage_id: D3
summary: 18-07-SUMMARY.md

### 24. Insights <10 empty without LLM; success charges once; cache hit skips charge
expected: Insights <10 empty without LLM; success charges once; cache hit skips charge
result: pass
source: automated
coverage_id: D1
summary: 18-08-SUMMARY.md

### 25. Dashboard page Get insights CTA is on-demand; empty <10; busy keeps cache; cost labeled not charged and excluded from cost card
expected: Dashboard page Get insights CTA is on-demand; empty <10; busy keeps cache; cost labeled not charged and excluded from cost card
result: pass
source: automated
coverage_id: D2
summary: 18-08-SUMMARY.md

### 26. Dashboard aggregations exclude low-STT from averages with count; access list matches journal; latest-run cost sum
expected: Dashboard aggregations exclude low-STT from averages with count; access list matches journal; latest-run cost sum
result: pass
source: automated
coverage_id: D3
summary: 18-08-SUMMARY.md

### 27. Chat route tools list/set/clear analytics project; set refuses when recording off; confirm reloads dialplan; tenant uid from JWT only
expected: Chat route tools list/set/clear analytics project; set refuses when recording off; confirm reloads dialplan; tenant uid from JWT only
result: pass
source: automated
coverage_id: D1
summary: 18-09-SUMMARY.md

### 28. DiffConfirmCard blocks missing project and recording-off, ignores double confirm while busy, wraps long project names
expected: DiffConfirmCard blocks missing project and recording-off, ignores double confirm while busy, wraps long project names
result: pass
source: automated
coverage_id: D2
summary: 18-09-SUMMARY.md

### 29. Golden delivery check fails only on an empty model answer and is not part of npm test
expected: Golden delivery check fails only on an empty model answer and is not part of npm test
result: pass
source: automated
coverage_id: D1
summary: 18-10-SUMMARY.md

### 30. Journal Excel exports full filtered selection with D-37 columns, truncateCell, no robot KPIs
expected: Journal Excel exports full filtered selection with D-37 columns, truncateCell, no robot KPIs
result: pass
source: automated
coverage_id: D1
summary: 18-11-SUMMARY.md

### 31. CDR shows Аналитика / Получить аналитику with recording, module, project, and pause rules
expected: CDR shows Аналитика / Получить аналитику with recording, module, project, and pause rules
result: pass
source: automated
coverage_id: D2
summary: 18-11-SUMMARY.md

### 32. Empty projects list shows locked copy and Create project CTA
expected: Empty projects list shows locked copy and Create project CTA
result: pass
source: automated
coverage_id: D1
summary: 18-12-SUMMARY.md

### 33. MetricEditor exposes D-25 sections and disables publish while draft save is in flight
expected: MetricEditor exposes D-25 sections and disables publish while draft save is in flight
result: pass
source: automated
coverage_id: D2
summary: 18-12-SUMMARY.md

### 34. UploadForm requires project, busy Загрузка..., no channel swap; batch shares one field set
expected: UploadForm requires project, busy Загрузка..., no channel swap; batch shares one field set
result: pass
source: automated
coverage_id: D1
summary: 18-13-SUMMARY.md

### 35. TokensTable empty copy, supervisor CTA hidden, secret shown once then gone
expected: TokensTable empty copy, supervisor CTA hidden, secret shown once then gone
result: pass
source: automated
coverage_id: D2
summary: 18-13-SUMMARY.md

### 36. /speech-analytics/reports redirects to journal; SpeechAnalyticsReportsPage is not a live product route
expected: /speech-analytics/reports redirects to journal; SpeechAnalyticsReportsPage is not a live product route
result: pass
source: automated
coverage_id: D1
summary: 18-14-SUMMARY.md

### 37. Hub seed has no Reports path/page_code; dashboard and conversations journal entries present
expected: Hub seed has no Reports path/page_code; dashboard and conversations journal entries present
result: pass
source: automated
coverage_id: D2
summary: 18-14-SUMMARY.md

### 38. Optimistic pause Switch rolls back on failure and shows error; model selects gated by D-38
expected: Optimistic pause Switch rolls back on failure and shows error; model selects gated by D-38
result: pass
source: automated
coverage_id: D1
summary: 18-15-SUMMARY.md

### 39. Module AI adapter + skill; token secret omitted from chat history; project edit publishes when metrics change
expected: Module AI adapter + skill; token secret omitted from chat history; project edit publishes when metrics change
result: pass
source: automated
coverage_id: D2
summary: 18-15-SUMMARY.md

### 40. Hangup Nest port enqueues on project+recording; skips recording off / missing project; duplicate origin is idempotent (G-18-01)
expected: Hangup Nest port enqueues on project+recording; skips recording off / missing project; duplicate origin is idempotent (G-18-01)
result: pass
source: automated
coverage_id: D1
summary: 18-16-SUMMARY.md

### 41. Nest SaAnalysisWorker always has runAnalysis; 500ms/60s wait; no charge on wait failure (G-18-02)
expected: Nest SaAnalysisWorker always has runAnalysis; 500ms/60s wait; no charge on wait failure (G-18-02)
result: pass
source: automated
coverage_id: D2
summary: 18-16-SUMMARY.md

### 42. SpeechAnalyticsAiAdapter and ModuleSettingsService are Nest providers; token secret once; no analyst role (G-18-04)
expected: SpeechAnalyticsAiAdapter and ModuleSettingsService are Nest providers; token secret once; no analyst role (G-18-04)
result: pass
source: automated
coverage_id: D3
summary: 18-16-SUMMARY.md

### 43. uploadBatch success returns UUID journal/recording id backed by createRun (no journal: stubs)
expected: uploadBatch success returns UUID journal/recording id backed by createRun (no journal: stubs)
result: pass
source: automated
coverage_id: D1
summary: 18-17-SUMMARY.md

### 44. body.projectId cannot override token project; >50MB skips createRun; double upload → two UUIDs
expected: body.projectId cannot override token project; >50MB skips createRun; double upload → two UUIDs
result: pass
source: automated
coverage_id: D2
summary: 18-17-SUMMARY.md

### 45. analyzeUrl uses same sa_* path; incomplete URL skips runAnalysis and continues batch
expected: analyzeUrl uses same sa_* path; incomplete URL skips runAnalysis and continues batch
result: pass
source: automated
coverage_id: D3
summary: 18-17-SUMMARY.md

### 46. HTTP insights persist SA-CHARGE-INSIGHTS amount with charged=false
expected: HTTP insights persist SA-CHARGE-INSIGHTS amount with charged=false
result: pass
source: automated
coverage_id: D1
summary: 18-18-SUMMARY.md

### 47. Missing rates still persist amount 0 with charged=false
expected: Missing rates still persist amount 0 with charged=false
result: pass
source: automated
coverage_id: D2
summary: 18-18-SUMMARY.md

### 48. Cache hit skips second SA-CHARGE-INSIGHTS invoke; below-min skips charge
expected: Cache hit skips second SA-CHARGE-INSIGHTS invoke; below-min skips charge
result: pass
source: automated
coverage_id: D3
summary: 18-18-SUMMARY.md

### 49. Wallet helpers unused from insights HTTP module source
expected: Wallet helpers unused from insights HTTP module source
result: pass
source: automated
coverage_id: D4
summary: 18-18-SUMMARY.md

### 50. Automated unit proof: public uploadBatch success journalId is UUID from createRun; no journal: prefix; recordingId/runId UUIDs
expected: Automated unit proof: public uploadBatch success journalId is UUID from createRun; no journal: prefix; recordingId/runId UUIDs
result: pass
source: automated
coverage_id: D1
summary: 18-19-SUMMARY.md

### 51. Metric-only AI confirm preserves non-metric draft sections (topics, webhooks, digest, alerts, budget, prompts)
expected: Metric-only AI confirm preserves non-metric draft sections (topics, webhooks, digest, alerts, budget, prompts)
result: pass
source: automated
coverage_id: D1
summary: 18-20-SUMMARY.md

### 52. revalidate rejects stale_draft; applyPayload stays partial; tenant uid from ctx only
expected: revalidate rejects stale_draft; applyPayload stays partial; tenant uid from ctx only
result: pass
source: automated
coverage_id: D2
summary: 18-20-SUMMARY.md

### 53. Nest hangup runAnalysis passes audioMs from durationSec/audioMs, never waitForFile byte size (CR-02 / D-46)
expected: Nest hangup runAnalysis passes audioMs from durationSec/audioMs, never waitForFile byte size (CR-02 / D-46)
result: pass
source: automated
coverage_id: D1
summary: 18-21-SUMMARY.md

### 54. Hangup enqueue puts durationSec and audioMs=durationSec*1000 onto processJob
expected: Hangup enqueue puts durationSec and audioMs=durationSec*1000 onto processJob
result: pass
source: automated
coverage_id: D2
summary: 18-21-SUMMARY.md

### 55. When hangup audioMs is 0/unknown, SA-CHARGE-RUN uses STT durationSec*1000; positive hangup wins
expected: When hangup audioMs is 0/unknown, SA-CHARGE-RUN uses STT durationSec*1000; positive hangup wins
result: pass
source: automated
coverage_id: D3
summary: 18-21-SUMMARY.md

### 56. Public upload sync≠true returns accepted with UUID journalId before deferred runAnalysis resolves (CR-03 / D-17)
expected: Public upload sync≠true returns accepted with UUID journalId before deferred runAnalysis resolves (CR-03 / D-17)
result: pass
source: automated
coverage_id: D1
summary: 18-22-SUMMARY.md

### 57. sync=true single file still awaits scored sync_result
expected: sync=true single file still awaits scored sync_result
result: pass
source: automated
coverage_id: D2
summary: 18-22-SUMMARY.md

### 58. URL sync≠true / incomplete skip+continue without awaiting score (D-40 / D-42)
expected: URL sync≠true / incomplete skip+continue without awaiting score (D-40 / D-42)
result: pass
source: automated
coverage_id: D3
summary: 18-22-SUMMARY.md

### 59. Живой каталог моно 58 и стерео 49
expected: |
  Ранее выполненный живой прогон веб и API: моно 58 и стерео 49 из каталога образцов, плюс две строки журнала на один повторно загруженный файл.
  Полный каталог Z:\temp\speech-analytics-samples заново не запускайте. Подтвердите, что тот прогон совпадает с тем, что вы видели, либо опишите расхождение.
result: pass
observed: evidence web mono 58/58, web stereo 49/49, double upload two distinct recording UUIDs; historical API catalog ids used journal: prefix and were superseded by the small UUID recheck

## Summary

total: 59
passed: 59
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
