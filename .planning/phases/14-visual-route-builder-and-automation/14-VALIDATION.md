---
phase: 14
slug: visual-route-builder-and-automation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-03
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Источник: `14-RESEARCH.md` § `## Validation Architecture`. Task ID проставляются в `/gsd-validate-phase 14`
> после создания планов.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | Jest `^29.7.0` + ts-jest |
| **Config file (backend)** | `packages/backend/package.json` § `jest` (`rootDir: src`, `testRegex: .*\.spec\.ts$`) |
| **Framework (frontend)** | Vitest `^4.1.4` + `@testing-library/react ^16.3.2` + `user-event ^14.6.1` + `jsdom ^29.0.2` |
| **Config file (frontend)** | `packages/frontend/vite.config.ts`; setup — `src/shared/config/tests/setupTests.ts` |
| **Quick run command** | backend: `npm run test -w @krasterisk/backend -- --testPathPattern="<area>" --no-coverage` · frontend: `npm run test -w @krasterisk/frontend -- <path>` |
| **Full suite command** | `npm run lint && npm run test:backend && npm run test:frontend` |
| **Estimated runtime** | ~15 s узкий прогон · полный набор — минуты |
| **Обязательный префикс** | любая задача, меняющая `packages/shared` → сначала `npm run build -w @krasterisk/shared` |
| **E2E / live Asterisk** | **не требуется** — dry-run детерминированный (D-29) |

---

## Sampling Rate

- **After every task commit:** targeted jest/vitest for touched module (`--testPathPattern` / file path)
- **After every plan wave:** `npm run test:backend && npm run test:frontend` (scoped if CI timebox)
- **Before `/gsd-verify-work 14`:** `npm run lint && npm run test:backend && npm run test:frontend` — все green
- **Wave 0 gate:** `dialplan-walk` + `action-reference` specs green before Wave 1+
- **Max feedback latency:** 30 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-T1 | 14-01 | 0 | D-45 hop exceed → Congestion; 20 steps → hops=0 | T-14-08 | Hop budget caps traversal | unit | `npm run build -w @krasterisk/shared && npm run test -w @krasterisk/shared -- dialplan-walk --no-coverage` | ❌ W0 | ⬜ pending |
| 14-01-T1 | 14-01 | 0 | D-46 exact_only toroute reasons | — | N/A | unit | same as above | ❌ W0 | ⬜ pending |
| 14-01-T1 | 14-01 | 0 | D-47 reask one control | — | N/A | unit | same as above | ❌ W0 | ⬜ pending |
| 14-01-T1 | 14-01 | 0 | D-43 IVR t/i inputs always available | — | N/A | unit | same as above | ❌ W0 | ⬜ pending |
| 14-01-T1 | 14-01 | 0 | callback terminal outcome in walk | D-38 | Walker stops with callback_requested | unit | same as above | ❌ W0 | ⬜ pending |
| 14-01-T2 | 14-01 | 0 | D-48 collect refs toivr/queue/robot | T-14-03 | Tenant-scoped scan | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="action-reference" --no-coverage` | ❌ W0 | ⬜ pending |
| 14-02-T1 | 14-02 | 1 | D-48 GET usage polymorphic | T-14-03 | vpbx_user_uid filter | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="action-reference\|route-references" --no-coverage` | ❌ W0 | ⬜ pending |
| 14-02-T2 | 14-02 | 1 | D-48 delete 409 IVR/queue/group/robot/integration | T-14-04 | ConflictException shape | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="ivrs.service\|queues.service\|call-groups\|voice-robots\|notification" --no-coverage` | ❌ W0 | ⬜ pending |
| 14-02-T3 | 14-02 | 1 | D-48 directories delegate | — | No regression | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="directory-reference\|directories.service" --no-coverage` | ✅ partial | ⬜ pending |
| 14-03-T1 | 14-03 | 2 | D-01/D-03 flowchart branch lane | — | Read-only | component | `npm run test -w @krasterisk/frontend -- src/features/dialplan-apps/ui/FlowchartCanvas/FlowchartCanvas.test.tsx` | ❌ W0 | ⬜ pending |
| 14-03-T1 | 14-03 | 2 | D-52 no graph libs | — | CSS grid only | grep | `rg "reactflow\|dagre\|elkjs\|jspdf\|html2canvas" packages/frontend/src/features/dialplan-apps packages/frontend/src/features/routes/ui/RouteFormModal packages/frontend/src/features/ivrs/ui/IvrFormModal -g "*.tsx" -g "*.ts" && exit 1 || exit 0` | N/A | ⬜ pending |
| 14-03-T2 | 14-03 | 2 | D-04 print contentRef | — | react-to-print not window.print | component | `npm run test -w @krasterisk/frontend -- src/features/dialplan-apps/ui/FlowchartCanvas/FlowchartPrint.test.tsx` | ❌ W0 | ⬜ pending |
| 14-03-T3 | 14-03 | 2 | D-05 IVR host schema | D-43 | no direct_dial branch | component | `npm run test -w @krasterisk/frontend -- src/features/ivrs/ui/IvrFormModal` | ❌ W0 | ⬜ pending |
| 14-04-T1 | 14-04 | 2 | D-29 linear POST dry-run | — | Draft body | integration | `npm run test -w @krasterisk/backend -- --testPathPattern="dialplan-dry-run" --no-coverage` | ❌ W0 | ⬜ pending |
| 14-04-T2 | 14-04 | 2 | D-44/D-45/D-46 cross-entity walk | T-14-06 | Hop + exact_only | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="dialplan-dry-run\|dialplan-walk" --no-coverage` | ❌ W0 | ⬜ pending |
| 14-04-T2 | 14-04 | 2 | callback terminal outcome in walker | D-38 | outcome callback_requested | unit | same as above | ❌ W0 | ⬜ pending |
| 14-04-T3 | 14-04 | 2 | D-47 reask + D-32 AI tool | T-14-07 | uid arg only | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="dialplan-dry-run-ai\|dialplan-dry-run" --no-coverage` | ❌ W0 | ⬜ pending |
| 14-05-T1 | 14-05 | 2 | D-33 CRUD + built-in seed | — | 3 built-ins seeded | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="route-templates" --no-coverage` | ❌ W0 | ⬜ pending |
| 14-05-T2 | 14-05 | 2 | D-35 slot apply | — | fresh UUIDs | unit | same as above | ❌ W0 | ⬜ pending |
| 14-05-T3 | 14-05 | 2 | D-34 buildFromDescription stub | — | Callable interface | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="route-templates-ai\|route-templates" --no-coverage` | ❌ W0 | ⬜ pending |
| 14-06-T1 | 14-06 | 4 | D-30/D-31 route highlight | — | Draft not saved | component | `npm run test -w @krasterisk/frontend -- src/features/dialplan-apps/ui/DryRunForm/DryRunForm.test.tsx` | ❌ W0 | ⬜ pending |
| 14-06-T1 | 14-06 | 4 | callback outcome highlight | D-38 | Success channel + i18n | component | same as above | ❌ W0 | ⬜ pending |
| 14-06-T2 | 14-06 | 4 | D-43/D-44 IVR + segments | — | No tabs/accordion | component | `npm run test -w @krasterisk/frontend -- src/features/dialplan-apps/ui/DryRunForm src/features/ivrs/ui/IvrFormModal` | ❌ W0 | ⬜ pending |
| 14-06-T3 | 14-06 | 4 | D-47 reask loop | — | Single control | component | `npm run test -w @krasterisk/frontend -- src/features/dialplan-apps/ui/DryRunForm/DryRunForm.test.tsx` | ❌ W0 | ⬜ pending |
| 14-07-T* | 14-07 | 5 | D-36/D-37/D-51 templates FE + RouteTemplateFormModal | — | Route host only; create/edit/copy | component | vitest route-templates + RouteTemplateFormModal + DialplanAppsEditor | ❌ W0 | ⬜ pending |
| 14-08-T1 | 14-08 | 3 | D-38 route callback CURL enqueue | T-14-14 | Internal auth | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="dialplan.util\|callback" --no-coverage` | ❌ W0 | ⬜ pending |
| 14-08-T2 | 14-08 | 3 | D-38 queue DTMF + abandon paths | — | order_mode/dtmf_digit wired | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="callback-queue\|queues.service\|dialplan.util" --no-coverage` | ❌ W0 | ⬜ pending |
| 14-08-T3 | 14-08 | 3 | D-40/D-39 scanner + dial_order | T-14-13 | mutex + caps | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="callback-scanner\|callback-requests" --no-coverage` | ❌ W0 | ⬜ pending |
| 14-08-T3 | 14-08 | 3 | D-49 callback_policy | — | ShiftPolicyForm pattern | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="cc-settings\|callcenter-settings" --no-coverage` | ❌ W0 | ⬜ pending |
| 14-08-T4 | 14-08 | 3 | D-42 operator REST list/claim/cancel | T-14-14 | JWT queue scope | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="callback-requests.controller" --no-coverage` | ❌ W0 | ⬜ pending |
| 14-09-T* | 14-09 | 4 | D-42/D-49/D-50 callback UI | — | Badge not segment | component | vitest callcenter callback | ❌ W0 | ⬜ pending |
| 14-10-T* | 14-10 | 4 | D-48 Usage + delete precheck | T-14-16 | 409 keeps modal | component | `npm run test -w @krasterisk/frontend -- src/features/route-references` | ❌ W0 | ⬜ pending |
| * | * | * | ActionType callback completeness | — | META/DTO/registry parity | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="dialplan-params" --no-coverage` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Gaps (from RESEARCH)

- [ ] `packages/shared/.../dialplan-walk/*.spec.ts` — walk, hops, exact_only, reask, IVR digit, **callback terminal**
- [ ] Extend reference util specs for non-directory kinds
- [ ] Completeness tests expect `callback` once added
- [ ] FE flowchart + dry-run highlight + template dialog tests
- [ ] Callback scanner scanOnce unit tests (mutex / window / attempts)
- [ ] **Queue runtime specs** — DTMF subscriber enqueue + queue abandon auto-enqueue per D-38

---

## Phase Gate Checklist

Before `/gsd-verify-work 14`:

1. `npm run lint` green
2. `npm run test:backend` green
3. `npm run test:frontend` green
4. D-52 grep gate: zero forbidden graph/PDF lib imports in flowchart surfaces
5. All Wave 0 specs green before claiming dry-run/reference complete
