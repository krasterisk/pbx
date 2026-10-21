---
phase: 9
slug: call-center-agent-panel
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-22
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `09-RESEARCH.md` § Validation Architecture. No formal REQ-XX IDs — map to CONTEXT D-XX.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Frontend: Vitest ^4.1.4 + Testing Library; Backend: Jest ^29.7.0 + @nestjs/testing |
| **Config file** | Frontend: colocated `*.test.ts(x)` (no dedicated vitest.config at research time); Backend: `jest` block in `packages/backend/package.json` |
| **Quick run command** | `npm run test:cc -w @krasterisk/frontend` and/or `npm run test:cc -w @krasterisk/backend` |
| **Full suite command** | `npm run test:frontend` / `npm run test:backend` (+ `npm run lint` at phase gate) |
| **Estimated runtime** | ~30–90s scoped CC; full suite longer |

---

## Sampling Rate

- **After every task commit:** Run scoped `test:cc` for the side touched (frontend and/or backend)
- **After every plan wave:** Run `npm run test:backend && npm run test:frontend`
- **Before `/gsd-verify-work`:** Full suite green + `npm run lint` (AGENTS.md)
- **Max feedback latency:** 120 seconds for scoped CC runs

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T2 | 09-02 | 1 | D-13 | — | N/A | unit | `vitest run src/features/callcenter/model` | ❌ W0 extend slice/selectors tests | ⬜ pending |
| T1 | 09-03 | 2 | D-08 | T-09-03-01 | N/A | unit | `jest --testPathPattern=callcenter-ami.service.spec` | ✅ extend | ⬜ pending |
| T1 | 09-09 | 4 | D-16/17/19/20 | T-09-09-02 | UNIQUE(call_uniqueid) preserved | unit | `jest --testPathPattern=callcenter.service.spec` | ✅ extend | ⬜ pending |
| T2 | 09-05 | 2 | D-21…D-25 | T-09-05-01 | can_spy/spyable/scope enforced server-side | unit | `jest --testPathPattern=callcenter-permissions.service.spec` (+ callcenter.service.spec peer-spy) | ❌ W0 new spec | ⬜ pending |
| T1 | 09-05 | 2 | D-38…D-40 | T-09-05-03 | lock flag enforced on PUT | unit | `jest --testPathPattern=callcenter-permissions.service.spec` | ❌ W0 new spec | ⬜ pending |
| T1 / T3 | 09-02 / 09-08 | 1 / 4 | D-01…D-07, D-46 | — | Tabs ARIA + Waiting default | integration | `vitest run src/shared/ui/Tabs` + `src/pages/CallCenterAgentPage` | ❌ Tabs W0 / ✅ page extend | ⬜ pending |
| T2 | 09-11 | 5 | D-45 | T-09-11-02 | SSE delta/throttle (debounced presenceUpdate) | unit | `jest --testPathPattern=callcenter-state.service.spec` | ✅ extend | ⬜ pending |

*Task ID / Plan / Wave now filled from the final PLAN.md files (see mapping above).*
*Status reflects planning state; flips to ✅ during `/gsd-execute-phase 9` as each spec goes green.*
*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/backend/src/modules/callcenter/callcenter-permissions.service.spec.ts` (or fold into `callcenter.service.spec.ts`) — D-21…D-25, D-38…D-40
- [ ] `packages/frontend/src/shared/ui/Tabs/Tabs.test.tsx` — new Tabs component (D-01…D-07)
- [ ] Extend `callCenterSlice.test.ts` / `callCenterSelectors.test.ts` — DIALING/CONSULT/ACW (D-13)
- [ ] Extend `callcenter-ami.service.spec.ts` — DialBegin/DialEnd all-channel KPI (D-08)
- [ ] ENUM migration for `cc_agent_events.event_type` if ACW/CONSULT/DIALING are logged (Open Q #3) + model update

*Existing Vitest/Jest infrastructure covers runners — Wave 0 is new/extended specs, not framework install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AMI ChanSpy / Park / DeviceState field names | D-21…D-28, D-36/D-37 | Live Asterisk field casing may differ from research assumptions | On lab PBX: trigger ChanSpy, Park, DeviceStateChange; confirm event keys match handlers |
| Softphone FAB + incoming toast + dialpad UX | D-01…D-07, UI-SPEC | WebRTC + real media | Browser: receive call, answer/reject, expand dialpad, verify 28px Display timer |
| Mobile bottom chrome + sticky softphone | D-46, Phase 8 shell | Device/viewport | Phone viewport ≤768: tabs + FAB clear of 60px bottom bar |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s (scoped)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
