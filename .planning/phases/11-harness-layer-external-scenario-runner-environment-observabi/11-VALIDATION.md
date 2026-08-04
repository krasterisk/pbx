---
phase: 11
slug: harness-layer-external-scenario-runner-environment-observabi
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-04
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `11-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (API/realtime harness) + Playwright 1.x (UI harness) |
| **Config file** | `harness/vitest.config.ts`, `harness/playwright.config.ts` (Wave 0) |
| **Quick run command** | `npm run harness:api` |
| **Full suite command** | `npm run harness` |
| **Estimated runtime** | ~60–180 seconds (CI workers=1; Asterisk job separate) |

App unit suites unchanged: `npm run test:backend` (Jest), `npm run test:frontend` (Vitest).

---

## Sampling Rate

- **After every task commit:** `npm run harness:api` (or affected UI spec)
- **After every plan wave:** `npm run harness`
- **Before `/gsd-verify-work`:** `npm run lint && npm run test:backend && npm run test:frontend && npm run harness`
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|---------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | D-H06 | T-cred-logs | Health public, no secrets | smoke | `curl -f localhost:5010/api/health` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | D-21 | — | Workspace package isolated | unit/smoke | `npm run harness:api -- --help` or dry registry | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 2 | D-01 | T-auth | JWT via login only | API | `npm run harness:api -- --tag auth` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 2 | D-02 | T-access | Bearer + tenant from token | API | `npm run harness:api -- --tag moh` | ❌ W0 | ⬜ pending |
| 11-04-01 | 04 | 3 | D-03 | — | Agent+supervisor UI | UI | `npm run harness:ui` | ❌ migrate | ⬜ pending |
| 11-04-02 | 04 | 3 | D-04 | T-session | SSE token query only | realtime | `npm run harness:api -- --tag sse` | ❌ W0 | ⬜ pending |
| 11-07-01 | 07 | 5 | D-05 | — | Skip without lab | gated | `HAS_ASTERISK=0 npm run harness:asterisk` exits 0 skip | ❌ PR-7 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `harness/package.json` + root workspace entry
- [ ] `harness/vitest.config.ts`
- [ ] `harness/playwright.config.ts` (from `e2e/`)
- [ ] `harness/fixtures/auth.fixture.ts` (from `e2e/`)
- [ ] `packages/backend` — `GET /api/health` controller (D-H06)
- [ ] Root scripts: `harness`, `harness:api`, `harness:ui`, `harness:asterisk`
- [ ] `.github/workflows/harness.yml` (evolve from `e2e.yml`, Node 22)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Asterisk originate→answer→hangup | D-05 | Requires lab secrets / phones | Run `workflow_dispatch` Asterisk job with lab env; confirm answer + hangup |
| Supervisor page visual smoke beyond locators | D-03 | Flaky without lab data | Spot-check `/callcenter/supervisor` after UI absorb |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
