---
phase: "18"
slug: "polnyy-refaktoring-rechevoy-analitiki"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-22"
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `18-RESEARCH.md` § Validation Architecture. Task IDs are filled when plans exist.

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
| TBD | TBD | 0 | REQ-SA-PARITY | T-18-SSRF | Incomplete URL is an error; no wallet debit | unit | jest `sa-charge` / `ingest` / `pipeline` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | REQ-SA-PARITY | — | `pauseNew` blocks new auto jobs only | unit | extend capture-policy specs | ✅ partial | ⬜ pending |
| TBD | TBD | 0 | REQ-SA-PARITY | — | Route left=customer; upload left=operator | unit | port channel-diarize tests | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | REQ-SA-PARITY | T-18-IDOR | Journal uses CDR access scope | unit | extend `cdr-access-scope.spec.ts` consumers | ✅ scope util | ⬜ pending |
| TBD | TBD | 0 | REQ-SA-PARITY | — | Golden CLI exits non-zero only on scoring failure | integration | `npm run eval:speech-analytics` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | REQ-SA-ARCH | — | Route select only when recording is on | frontend unit | vitest RouteFormModal / RouteGeneralTab | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | REQ-SA-ARCH | — | Journal sheet tabs, no reports page | frontend unit | vitest journal/sheet | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | D-46/D-47 | T-18-WALLET | Zero rate still hits the seam; insights stay separate; wallet not called | unit | jest charge seams | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | D-32 | T-18-TOKEN | Token stored as digest; bound to one project | unit | extend integration-credentials specs | ✅ partial | ⬜ pending |
| TBD | TBD | 0 | REQ-SA-UAT | — | Upload mono and stereo from samples dir | manual/harness | harness script + evidence JSON | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Migration dropping `uq_sa_run_initial` plus charge amount columns on runs and insights
- [ ] Tests for `SA-CHARGE-RUN` / `SA-CHARGE-INSIGHTS` that assert the wallet is not called
- [ ] Hangup admission enqueue unit test (handler enqueues; STT is not inside the handler)
- [ ] Acceptance path does not treat `fakeStt` as a completed analysis
- [ ] Harness `speech-analytics-uat` reading `SPEECH_ANALYTICS_SAMPLES_DIR`
- [ ] Three golden fixtures without clinic wording, plus the runner script
- [ ] Frontend tests for the recording-gated project select and removal of the Reports page

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live upload of mono and stereo samples | REQ-SA-UAT / D-50 | Audio lives on `Z:\temp\speech-analytics-samples` and must not be committed | Run the harness against that directory; keep evidence JSON; do not copy mp3 into git |
| Hangup path on a live PBX | D-02 / D-03 | Needs Asterisk, MixMonitor, and a closed recording file | Separate from unit tests; unit tests cover enqueue only |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s for the quick command
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
