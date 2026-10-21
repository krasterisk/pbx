---
phase: "18"
slug: "polnyy-refaktoring-rechevoy-analitiki"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-22"
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `18-RESEARCH.md` § Validation Architecture. Task IDs filled from PLAN.md automated verifies.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend Jest 29 + ts-jest; Frontend Vitest 4 |
| **Config file** | `packages/backend/package.json` (`jest`); frontend `scripts/vitest-run-src.cjs` |
| **Quick run command** | `npm run test -w @krasterisk/backend -- --testPathPattern=speech-analytics --no-coverage` |
| **Full suite command** | `npm run test:backend` and `npm run test:frontend` |
| **Estimated runtime** | Quick ~60s; full suite several minutes |

---

## Sampling Rate

- **After every task commit:** Targeted Jest or Vitest for the touched module
- **After every plan wave:** `npm run test:backend` and the relevant frontend Vitest files
- **Before `/gsd-verify-work`:** `npm run lint`, `npm run test:backend`, `npm run test:frontend`; live UAT evidence; golden command red only when a case fails to score
- **Max feedback latency:** 60 seconds for the quick speech-analytics Jest pattern

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-T1 | 18-01 | 1 | REQ-SA-PARITY / D-46 | T-18-WALLET | Zero-rate still hits SA-CHARGE-RUN; wallet unused | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="sa-charge-run" --no-coverage` | ✅ | ✅ green |
| 18-01-T2 | 18-01 | 1 | REQ-SA-PARITY / D-47 | T-18-WALLET | Insights seam + migration list | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="sa-charge-insights\|runner.test" --no-coverage` | ✅ | ✅ green |
| 18-02-T1 | 18-02 | 1 | REQ-SA-ARCH / D-02 | T-18-02-IDOR | Recording-gated project Select | frontend unit | `npm run test -w @krasterisk/frontend -- --run src/features/routes/ui/RouteFormModal/RouteGeneralTab.test.tsx` | ✅ | ✅ green |
| 18-02-T2 | 18-02 | 1 | REQ-SA-PARITY / D-19 | — | pauseNew + hangup_handler project attach | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="capture-policy\|route-recording.util" --no-coverage` | ✅ | ✅ green |
| 18-03-T1 | 18-03 | 2 | REQ-SA-PARITY / D-03 | T-18-03-SPOOF | Hangup enqueues; no STT in handler | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="dialplan-webhooks.service\|internal-admission" --no-coverage` | ✅ | ✅ green |
| 18-03-T2 | 18-03 | 2 | REQ-SA-PARITY / D-03 | T-18-03-PATH | 500ms poll / 60s ceiling stable non-empty wait | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="sa-analysis.worker" --no-coverage` | ✅ | ✅ green |
| 18-04-T1 | 18-04 | 3 | REQ-SA-PARITY / D-46 | — | runAnalysis hits SA-CHARGE-RUN | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="run-analysis" --no-coverage` | ✅ | ✅ green |
| 18-04-T2 | 18-04 | 3 | REQ-SA-PARITY / D-23 | — | Channel energy diarize; dual-stt off | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="channel-diarize" --no-coverage` | ✅ | ✅ green |
| 18-05-T1 | 18-05 | 4 | REQ-SA-ARCH / D-06 | T-18-05-IDOR | Journal sheet tabs at stable URL | frontend unit | `npm run test -w @krasterisk/frontend -- --run src/features/speechAnalytics/ui/ConversationSheet/ConversationSheet.test.tsx src/pages/SpeechAnalyticsJournalPage/SpeechAnalyticsJournalPage.test.tsx` | ✅ | ✅ green |
| 18-05-T2 | 18-05 | 4 | REQ-SA-PARITY / D-11 | T-18-05-RBAC | Access-scoped journal + RBAC | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="journal.service" --no-coverage` | ✅ | ✅ green |
| 18-11-T1 | 18-11 | 5 | REQ-SA-PARITY / D-37 | T-18-11-IDOR | Excel truncateCell export | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="excel-export" --no-coverage` | ✅ | ✅ green |
| 18-11-T2 | 18-11 | 5 | REQ-SA-PARITY / D-05 | — | CDR analytics actions + journal i18n | frontend unit | `npm run test -w @krasterisk/frontend -- --run src/pages/SpeechAnalyticsJournalPage/SpeechAnalyticsJournalPage.test.tsx` | ✅ | ✅ green |
| 18-06-T1 | 18-06 | 6 | REQ-SA-PARITY / D-26 | — | Draft/publish version stamp | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="project-editor" --no-coverage` | ✅ | ✅ green |
| 18-06-T2 | 18-06 | 6 | REQ-SA-PARITY / D-28 | T-18-06-HOOK | Budget + webhooks + delete | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="project-editor\|budget\|event-webhooks" --no-coverage` | ✅ | ✅ green |
| 18-08-T1 | 18-08 | 6 | REQ-SA-PARITY / D-47 | T-18-08-PROMPT | Insights charge seam + min-10 | unit + frontend | `npm run test -w @krasterisk/backend -- --testPathPattern="insights.service" --no-coverage` | ✅ | ✅ green |
| 18-08-T2 | 18-08 | 6 | REQ-SA-PARITY / D-34 | T-18-08-IDOR | Dashboard aggregations | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="dashboard.service" --no-coverage` | ✅ | ✅ green |
| 18-12-T1 | 18-12 | 7 | REQ-SA-ARCH / D-36 | — | Empty projects CTA | frontend unit | `npm run test -w @krasterisk/frontend -- --run src/pages/SpeechAnalyticsProjectsPage/SpeechAnalyticsProjectsPage.test.tsx` | ✅ | ✅ green |
| 18-12-T2 | 18-12 | 7 | REQ-SA-PARITY / D-25 | — | MetricEditor sections | frontend unit | `npm run test -w @krasterisk/frontend -- --run src/pages/SpeechAnalyticsProjectsPage/SpeechAnalyticsProjectsPage.test.tsx` | ✅ | ✅ green |
| 18-14-T1 | 18-14 | 7 | REQ-SA-ARCH / D-37 | — | Reports route removed/redirected | frontend unit | `npm run test -w @krasterisk/frontend -- --run src/app/router/speechAnalyticsReportsRoute.test.tsx` | ✅ | ✅ green |
| 18-14-T2 | 18-14 | 7 | REQ-SA-ARCH / D-37 | — | Hub seed without Reports | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="migrate-hub-modules-phase8" --no-coverage` | ✅ | ✅ green |
| 18-07-T2 | 18-07 | 7 | REQ-SA-PARITY / D-32 | T-18-07-TOKEN | Hash-only token sync upload | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="upload.service\|integration-credentials.service\|speech-analytics-public" --no-coverage` | ✅ | ✅ green |
| 18-07-T3 | 18-07 | 7 | REQ-SA-PARITY / D-42 | T-18-07-SSRF | Incomplete URL skips charge | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="url-download" --no-coverage` | ✅ | ✅ green |
| 18-09-T1 | 18-09 | 7 | REQ-SA-PARITY / D-04 | T-18-09-TENANT | Recording-off refuses set project | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="routes-ai.adapter" --no-coverage` | ✅ | ✅ green |
| 18-09-T2 | 18-09 | 7 | REQ-SA-PARITY / D-04 | — | DiffConfirmCard busy/refusal | frontend unit | `npm run test -w @krasterisk/frontend -- --run src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.test.tsx` | ✅ | ✅ green |
| 18-13-T1 | 18-13 | 8 | REQ-SA-ARCH / D-14 | — | UploadForm project + busy | frontend unit | `npm run test -w @krasterisk/frontend -- --run src/features/speechAnalytics/ui/UploadForm/UploadForm.test.tsx` | ✅ | ✅ green |
| 18-13-T2 | 18-13 | 8 | REQ-SA-PARITY / D-32 | T-18-13-SECRET | TokensTable one-time secret | frontend unit | `npm run test -w @krasterisk/frontend -- --run src/features/speechAnalytics/ui/TokensTable/TokensTable.test.tsx` | ✅ | ✅ green |
| 18-15-T1 | 18-15 | 9 | REQ-SA-ARCH / D-38 | — | Optimistic pause Switch | unit + frontend | `npm run test -w @krasterisk/backend -- --testPathPattern="module-settings" --no-coverage` | ✅ | ✅ green |
| 18-15-T2 | 18-15 | 9 | REQ-SA-PARITY / D-33 | T-18-15-SECRET | Module AI adapter + skill | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="speech-analytics-ai.adapter" --no-coverage` | ✅ | ✅ green |
| 18-10-T1 | 18-10 | 9 | REQ-SA-PARITY / D-45 | — | Golden CLI scoring path | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="run-golden" --no-coverage` | ✅ | ✅ green |
| 18-10-T2 | 18-10 | 9 | REQ-SA-UAT / D-50 | — | UAT harness syntax | harness | `node --check harness/scenarios/manual/speech-analytics-uat-live.cjs` | ✅ | ✅ green |
| 18-16-T1 | 18-16 | 12 | REQ-SA-PARITY / D-03 | T-18-16-SPOOF | Hangup port keeps dialplan auth | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="hangup-analytics.port\|dialplan-webhooks.service" --no-coverage` | ✅ | ✅ green |
| 18-16-T2 | 18-16 | 12 | REQ-SA-PARITY / D-03 | T-18-16-TENANT | Worker calls runAnalysis | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="sa-analysis.worker" --no-coverage` | ✅ | ✅ green |
| 18-16-T3 | 18-16 | 12 | REQ-SA-ARCH / D-27 | T-18-16-SECRET | AI adapter registered | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="speech-analytics-ai.adapter" --no-coverage` | ✅ | ✅ green |
| 18-17-T1 | 18-17 | 12 | REQ-SA-UAT / D-50 | T-18-17-OVERRIDE | Public createRun returns UUID | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="public-ingest.wiring\|speech-analytics-public.controller" --no-coverage` | ✅ | ✅ green |
| 18-17-T2 | 18-17 | 12 | REQ-SA-UAT / D-42 | T-18-17-SIZE | URL ingest and 50MB cap | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="url-download" --no-coverage` | ✅ | ✅ green |
| 18-18-T1 | 18-18 | 12 | REQ-SA-PARITY / D-47 | T-18-18-TAMPER | Insights persist charged=false | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="insights.service\|sa-charge-insights" --no-coverage` | ✅ | ✅ green |
| 18-19-T1 | 18-19 | 12 | REQ-SA-UAT / D-50 | T-18-19-SECRET | Success ids are UUIDs, not journal: | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="speech-analytics-public.controller\|public-ingest.wiring" --no-coverage` | ✅ | ✅ green |
| 18-20-T1 | 18-20 | 12 | REQ-SA-PARITY / D-27 | T-18-20-01 | Apply merges the full editor draft | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="speech-analytics-ai.adapter" --no-coverage` | ✅ | ✅ green |
| 18-21-T1 | 18-21 | 12 | REQ-SA-PARITY / D-46 | T-18-21-01 | audioMs comes from duration, not file bytes | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="sa-analysis.worker\|hangup-analytics.port\|run-analysis.spec" --no-coverage` | ✅ | ✅ green |
| 18-22-T1 | 18-22 | 12 | REQ-SA-UAT / D-17 | T-18-22-02 | Accepted batch does not wait for score | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="upload.service\|url-download\|speech-analytics-public.controller" --no-coverage` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Checkpoint-only tasks (no automated row): 18-01 decision (D-05), 18-07 decision (D-32), 18-10 human UAT (D-50).

---

## Wave 0 Requirements

- [x] Migration dropping `uq_sa_run_initial` plus charge amount columns on runs and insights
- [x] Tests for `SA-CHARGE-RUN` / `SA-CHARGE-INSIGHTS` that assert the wallet is not called
- [x] Hangup admission enqueue unit test (handler enqueues; STT is not inside the handler)
- [x] Worker file-wait specs for 500ms poll / 60s ceiling / two-poll stability
- [x] Acceptance path does not treat `fakeStt` as a completed analysis
- [x] Harness `speech-analytics-uat` reading `SPEECH_ANALYTICS_SAMPLES_DIR`
- [x] Three golden fixtures without clinic wording, plus the runner script
- [x] Frontend tests for the recording-gated project select and removal of the Reports page

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live upload of mono and stereo samples | REQ-SA-UAT / D-50 | Audio lives on `Z:\temp\speech-analytics-samples` and must not be committed | Run the harness against that directory; keep evidence JSON; do not copy mp3 into git |
| Hangup path on a live PBX | D-02 / D-03 | Needs Asterisk, MixMonitor, and a closed recording file | Separate from unit tests; unit tests cover enqueue + finite file-wait |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 / checkpoint dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s for the quick command
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-23

---

## Validation Audit 2026-09-23

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Backend 32 suites / 211 tests green. Frontend 8 files / 42 tests green. Gap plans 18-16…18-22 added to the map. Live sample upload and live PBX hangup stay manual-only.
