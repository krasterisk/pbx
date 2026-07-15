---
phase: 7
slug: call-center-overhaul-professional-agent-supervisor-workspace
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-15
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `07-RESEARCH.md` § Validation Architecture. Tracking unit = decision ID (D-XX) — `phase_req_ids` is null for this phase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | Jest (existing — `packages/backend/package.json` → `"test": "jest"`) |
| **Framework (frontend)** | Vitest (existing — `packages/frontend/package.json`) |
| **Config file** | `packages/backend/jest.config.*` / `packages/frontend/vitest.config.*` (existing — do not recreate) |
| **Quick run command** | `npm run test:cc` (root — runs both workspace CC-scoped scripts: `jest --testPathPattern="modules/callcenter"` + `vitest run src/features/callcenter`) |
| **Full suite command** | `npm run lint && npm run test:backend && npm run test:frontend` (project verify protocol per AGENTS.md) |
| **Estimated runtime** | quick ~few sec (CC-scoped, no coverage); full ~calibrate at Wave 0 |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:cc` (fast CC-scoped, backend + frontend)
- **After every plan wave:** Run `npm run lint && npm run test:backend && npm run test:frontend`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** quick run must stay under ~30s

---

## Per-Task Verification Map

| Decision | Plan | Wave | Behavior | Test Type | Automated Command / File | File Exists | Status |
|----------|------|------|----------|-----------|--------------------------|-------------|--------|
| D-09 | 07-01 | 1 | Batched writer flushes buffer on interval/threshold, does not block AMI handler; bounded buffer cap | unit | `callcenter-history-writer.service.spec.ts` (`npm run test:cc`) | ❌ W0 | ⬜ pending |
| Bug (agentTransfer) | 07-01 | 1 | Blind transfer calls `Redirect` with channel name, not CallerID | unit | extend existing `callcenter.service.spec.ts` | ✅ (test to add) | ⬜ pending |
| D-05/D-06/D-07 | 07-03 | 2 | SLA/counters accumulators restore from DB on restart; per-queue + tenant-default SLA | unit | `callcenter-metrics.service.spec.ts` (`npm run test:cc`) | ❌ W0 | ⬜ pending |
| D-05 (queue_log) | 07-04 | 2 | Reconciliation job backfills missing rows after simulated AMI disconnect | integration | `callcenter-queuelog-reconciler.service.spec.ts` | ❌ W0 | ⬜ pending |
| D-30/D-31/D-32 | 07-07 | 2 | Message sent REST → delivered via SSE to same tenant filter | integration | `callcenter-chat.controller.spec.ts` | ❌ | ⬜ pending |
| D-26 (display-token) | 07-10 | 3 | Wallboard token grants read-only SSE ONLY, no agent/supervisor actions | integration | `callcenter-sse.controller.spec.ts` (display-token branch) | ❌ | ⬜ pending |
| D-33 (reports backend) | 07-12 | 4 | Each of 7 reports returns correct aggregation on `cc_queue_calls` fixture | integration | `callcenter-reports.service.spec.ts` | ❌ | ⬜ pending |
| D-33 (reports UI) | 07-18 | 4 | Page renders all 7 report tabs and loads data from backend API | unit | `npx tsc --noEmit` + grep 7 CcReportId keys in CallCenterReportsPage | ❌ | ⬜ pending |
| D-34 (export backend) | 07-12 | 4 | CSV/XLSX generate without error and contain expected headers | unit | export spec in `callcenter-reports.service.spec.ts` (structure snapshot, not bytes) | ❌ | ⬜ pending |
| D-34 (export PDF/UI) | 07-18 | 4 | PDF via generateReportPdf; CSV/XLSX blob download from export endpoint | unit | grep `generateReportPdf` + `createObjectURL` in CallCenterReportsPage | ❌ | ⬜ pending |
| D-36 (AgentTimeline reuse) | 07-18 | 4 | agent-timeline report imports AgentTimeline from 07-09 (not a duplicate component) | unit | grep `import.*AgentTimeline` from features/callcenter/ui/AgentTimeline in CallCenterReportsPage | ❌ | ⬜ pending |
| D-14 (WebRTC) | 07-14 | 4 | `useWebRTCPhone` registers/answers (mocked SIP.js transport) | unit + manual | frontend spec + manual scenario w/ real Asterisk PJSIP WSS | ❌ | ⬜ pending |
| D-41b (MCP tools) | 07-16 | 4 | `CallCenterAiAdapter` registers tools; handler receives `vpbxUserUid` as param (not closure) | unit | `callcenter-ai.adapter.spec.ts` (mirror `phonebooks-ai.adapter.spec.ts`) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `callcenter-metrics.service.spec.ts` — covers D-05/D-06/D-07 (accumulators, per-queue + tenant SLA)
- [ ] `callcenter-history-writer.service.spec.ts` — covers D-09
- [ ] `callcenter-queuelog-reconciler.service.spec.ts` — covers D-05 (backfill)
- [ ] `callcenter-ai.adapter.spec.ts` — covers D-41b, mirrors existing `phonebooks-ai.adapter.spec.ts`
- [ ] Extend existing `callcenter.service.spec.ts` — regression test for `agentTransfer` channel bug
- [ ] Framework install: NOT required (Jest/Vitest already configured and cover the CC module)

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| WebRTC register/answer/hangup end-to-end audio | D-14 | Requires real Asterisk PJSIP WSS transport + coturn/STUN + browser mic — not reproducible in unit env | Configure `ps_transports` wss on target Asterisk (ops runbook), log in shift-mode "browser", place/answer a real call, verify two-way audio + hold/mute/DTMF/transfer |
| queue_log reader against live Asterisk | D-05 | Depends on target-server `queue_log.conf` (file vs realtime) — verified at 07-04 Task 1 checkpoint | Confirm config, run reconciler against real queue_log, verify backfilled rows match |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (all commands are single-run `jest`/`vitest run`/`tsc --noEmit`)
- [x] Feedback latency target < 30s (quick CC-scoped run)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-15 (plan-phase validation gate; `wave_0_complete` flips true once the 5 Wave-0 spec stubs land in execution)
