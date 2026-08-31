---
phase: 11
slug: harness-layer-external-scenario-runner-environment-observabi
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-04
updated: 2026-08-31
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `11-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (API/realtime harness) + Playwright 1.x (UI harness) |
| **Config file** | `harness/vitest.config.ts`, `harness/playwright.config.ts` |
| **Quick run command** | `npm run harness:api` |
| **Full suite command** | `npm run harness` |
| **Estimated runtime** | ~60–180 seconds (CI workers=1; Asterisk job separate) |
| **PR CI** | `.github/workflows/harness.yml` (Node 22) |
| **Asterisk CI** | `.github/workflows/harness-asterisk.yml` (`workflow_dispatch` + nightly) |

App unit suites unchanged: `npm run test:backend` (Jest), `npm run test:frontend` (Vitest).

---

## Sampling Rate

- **After every task commit:** `npm run harness:api` (or affected UI spec)
- **After every plan wave:** `npm run harness`
- **Before `/gsd-verify-work`:** `npm run lint && npm run test:backend && npm run test:frontend && npm run harness`
- **Max feedback latency:** 180 seconds

Phase gate (same as AGENTS.md verify convention):

```bash
npm run lint && npm run test:backend && npm run test:frontend && npm run harness
```

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File | Status |
|---------|------|------|-------------|---------|-----------------|-----------|-------------------|------|--------|
| 11-01-01 | 01 | 1 | D-H06 | T-cred-logs | Health public, no secrets | smoke | `curl -f localhost:5010/api/health` | `packages/backend/src/modules/health/health.controller.ts` | ⚠️ live |
| 11-01-02 | 01 | 1 | D-21 | — | Workspace package isolated | unit/smoke | `npm run harness` | `harness/package.json` | ✅ |
| 11-02-01 | 02 | 2 | D-08 | — | Readiness + seed/teardown | env | inspect `harness/environment/*` | `harness/environment/readiness.ts` | ✅ |
| 11-03-01 | 03 | 3 | D-01 | T-auth | JWT via login only | API | `npm run harness:api -- --tag auth` | `harness/scenarios/api/auth.test.ts` | ⚠️ live |
| 11-03-02 | 03 | 3 | D-02 | T-access | Bearer + tenant from token | API | `npm run harness:api -- --tag moh` | `harness/scenarios/api/moh-crud.test.ts` | ⚠️ live |
| 11-04-01 | 04 | 4 | D-03 | — | Agent+supervisor UI | UI | `npm run harness:ui` | `harness/scenarios/ui/agent-smoke.spec.ts` | ⚠️ live |
| 11-04-02 | 04 | 4 | D-04 | T-session | SSE token query only | realtime | `npm run harness:api -- --tag sse` | `harness/scenarios/realtime/sse-heartbeat.test.ts` | ⚠️ live |
| 11-05-01 | 05 | 5 | D-11 | — | Reporter triad | unit | reports under `harness/reports/` | `harness/reporters/index.ts` | ✅ |
| 11-06-01 | 06 | 6 | D-H05 | — | Harness-only OTel | unit | inspect `harness/observability/` | `harness/observability/tracing.ts` | ✅ |
| 11-07-01 | 07 | 7 | D-05 | — | Skip without lab | gated | `HAS_ASTERISK=0 npm run harness:asterisk` | `harness/scenarios/realtime/asterisk-originate.test.ts` | ✅ skip path |
| 11-08-01 | 08 | 8 | D-09/D-24 | T-11-08-02 | Node 22 harness.yml | CI | `grep node-version: '22' .github/workflows/harness.yml` | `.github/workflows/harness.yml` | ✅ |
| 11-08-02 | 08 | 8 | D-11 | — | Artifact triad upload | CI | `upload-artifact` harness-reports | `.github/workflows/harness.yml` | ✅ |
| 11-08-03 | 08 | 8 | D-H01/D-23 | — | Retire e2e.yml + `e2e/` | CI | delete after harness.yml green | `e2e/` still present | ⬜ pending CI green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ live (needs isolated stack / running API) · flaky*

---

## Wave 0 Requirements

- [x] `harness/package.json` + root workspace entry
- [x] `harness/vitest.config.ts`
- [x] `harness/playwright.config.ts` (from `e2e/`)
- [x] `harness/fixtures/auth.fixture.ts` (from `e2e/`)
- [x] `packages/backend` — `GET /api/health` controller (D-H06)
- [x] Root scripts: `harness`, `harness:api`, `harness:ui`, `harness:asterisk`
- [x] `.github/workflows/harness.yml` (evolve from `e2e.yml`, Node 22)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Asterisk originate→answer→hangup | D-05 | Requires lab secrets / phones | Run `workflow_dispatch` Asterisk job with lab env; confirm answer + hangup |
| Supervisor page visual smoke beyond locators | D-03 | Flaky without lab data | Spot-check `/callcenter/supervisor` after UI absorb |
| First green `harness.yml` on GitHub | D-H01/D-23 | Isolated MySQL + browsers; local `:5010` is not CI | After first green PR job, delete `e2e/` and `.github/workflows/e2e.yml` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Wave 0 signed 2026-08-31. D-H01/D-23 absorb of `e2e/` waits on first green `harness.yml`.

**Black-box check (11-08):** no `from '@krasterisk/shared'` under `harness/`. Pre-existing import from `packages/backend/src/modules/directories/setup-directories-schema` in `harness/scenarios/api/directories-schema.test.ts` is outside this plan — do not treat as 11-08 regression.
