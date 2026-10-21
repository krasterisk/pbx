---
phase: 10
slug: full-softphone
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-24
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `10-RESEARCH.md` § Validation Architecture. No formal REQ-XX IDs — map to CONTEXT D-XX.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Frontend: Vitest (`vitest run`) + Testing Library; Backend: Jest + @nestjs/testing |
| **Config file** | Frontend: colocated `*.test.ts(x)` (Vite/Vitest config co-located per package); Backend: `jest` block in `packages/backend/package.json` |
| **Quick run command** | `npx vitest run --root packages/frontend <name>` / `cd packages/backend && npx jest --testPathPattern="<name>" --no-coverage` |
| **Full suite command** | `npm run test:frontend` / `npm run test:backend` (+ `npm run lint` at phase gate, per AGENTS.md) |
| **Estimated runtime** | ~30–120s scoped; full suite longer |

---

## Sampling Rate

- **After every task commit:** Run the scoped targeted test for the touched module (e.g. `vitest run SoftphoneJournal`, `jest callcenter.service`)
- **After every plan wave:** Run `npm run test:backend && npm run test:frontend`
- **Before `/gsd-verify-work 10`:** Full suite green + `npm run lint` (AGENTS.md standing rule)
- **Max feedback latency:** 120 seconds for scoped runs

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T1 (tracer) | 10-01 | 1 | D-11, D-15 | T-10-01-01 | tenant `where: { user_uid }` scope | unit | `jest --testPathPattern="modules/callcenter"` | ✅ extend | ⬜ pending |
| T2 | 10-01 | 1 | D-12, D-13 | T-10-01-02/03/04 | ownership folded into where clause; DTO @MaxLength | unit | `jest --testPathPattern="cc-contacts.service.spec"` | ❌ W0 new spec | ⬜ pending |
| T1 | 10-02 | 1 | D-05 | T-10-02-01 | per-tenant `historyRow` emit, success-only | unit | `jest --testPathPattern="callcenter-history-writer.service.spec"` | ❌ W0 new spec | ⬜ pending |
| T2 | 10-02 | 1 | D-04 | T-10-02-03 | supervisor-gated settings write (09-13) | unit | `jest --testPathPattern="modules/callcenter"` | ✅ extend | ⬜ pending |
| T1 | 10-03 | 2 | D-32 | T-10-03-01/02 | single-char digit regex + own-channel resolve | unit | `jest --testPathPattern="callcenter.service.spec"` | ✅ extend | ⬜ pending |
| T2 | 10-03 | 2 | D-33, D-35 | T-10-03-03 | mode/extension re-derived server-side (Pitfall 3) | unit | `jest --testPathPattern="modules/callcenter"` | ✅ extend | ⬜ pending |
| T1 | 10-04 | 3 | D-04, D-11…D-14, D-32, D-35 | — | N/A (type contracts) | typecheck | `tsc -p packages/frontend/tsconfig.json --noEmit` | ✅ tsc | ⬜ pending |
| T2 | 10-04 | 3 | D-05, D-19 | T-10-04-01/02 | own-operator guard before cache patch; JSON.parse try/catch | unit | `vitest run --root packages/frontend shiftSession` | ✅ extend | ⬜ pending |
| T3 | 10-04 | 3 | D-16, D-18 | — | i18n ru+en, no em dash | typecheck | `tsc -p packages/frontend/tsconfig.json --noEmit` | ✅ tsc | ⬜ pending |
| T1 | 10-05 | 4 | D-01…D-05 | T-10-05-01/02 | clickToCall gated server-side; self-scoped history | integration | `vitest run --root packages/frontend SoftphoneJournal` | ❌ W0 new spec | ⬜ pending |
| T2 | 10-05 | 4 | D-04 | — | supervisor-gated settings (reuse) | typecheck | `tsc -p packages/frontend/tsconfig.json --noEmit` | ✅ tsc | ⬜ pending |
| T1 | 10-06 | 4 | D-11…D-14, D-25 | T-10-06-01/02/03 | server ownership boundary (10-01); tenant-scoped read | integration | `vitest run --root packages/frontend SoftphoneContacts` | ❌ W0 new spec | ⬜ pending |
| T2 | 10-06 | 4 | D-13 | T-10-06-01 | per-row ownership gate is UX only; server is boundary | typecheck | `tsc -p packages/frontend/tsconfig.json --noEmit` | ✅ tsc | ⬜ pending |
| T1 | 10-07 | 4 | D-06…D-10 | T-10-07-01/02 | client-side filter over server-scoped self history | integration | `vitest run --root packages/frontend CallHistoryPanel` | ✅ extend | ⬜ pending |
| T1 | 10-08 | 5 | D-16…D-27, D-34 | T-10-08-01/02 | fab removal grep-verified; SIP omits getStats/mediaDevices | integration | `vitest run --root packages/frontend SoftphoneWidget` | ✅ extend | ⬜ pending |
| T2 | 10-08 | 5 | D-16…D-19, D-27 | — | N/A | integration | `vitest run --root packages/frontend SoftphoneWidget` | ✅ extend | ⬜ pending |
| T3 | 10-08 | 5 | D-20…D-23, D-34 | T-10-08-01 | quality/device DOM-absent in SIP mode | integration | `vitest run --root packages/frontend SoftphoneWidget` | ✅ extend | ⬜ pending |
| T1 (tracer) | 10-09 | 6 | D-24, D-31…D-35 | T-10-09-01/02 | facade forwards only, adds no identity; server re-derives mode | typecheck + integration | `tsc -p packages/frontend/tsconfig.json --noEmit` | ✅ tsc | ⬜ pending |
| T2 | 10-09 | 6 | D-24, D-32 | T-10-09-01 | own-call ownership enforced server-side | unit | `vitest run --root packages/frontend useSipPhoneAmi` | ❌ W0 new spec | ⬜ pending |
| T3 (checkpoint) | 10-09 | 6 | D-32, D-35 | T-10-09-03 | live-Asterisk A1/A3 confirmation (blocking) | manual | see Manual-Only Verifications | N/A | ⬜ pending |

*Task ID / Plan / Wave filled from the final PLAN.md files.*
*Status reflects planning state; flips to ✅ during `/gsd-execute-phase 10` as each spec goes green.*
*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New/extended spec files that must exist before or during the wave that consumes them (RESEARCH § Validation Architecture > Wave 0 Gaps):

- [ ] `packages/backend/src/modules/callcenter/cc-contacts.service.spec.ts` — NEW (10-01): tenant isolation + D-13 ownership (operator sees/edits only own; supervisor/admin all)
- [ ] `packages/backend/src/modules/callcenter/callcenter-history-writer.service.spec.ts` — NEW (10-02): `historyRow` emit fires once per written row, per-tenant, on both write paths, success-only (D-05)
- [ ] `packages/backend/src/modules/callcenter/callcenter.service.spec.ts` — EXTEND (10-03): DTMF ownership/digit-validation + registration-state derivation (D-32/D-33/D-35)
- [ ] `packages/frontend/src/features/callcenter/lib/shiftSession.test.ts` — EXTEND (10-04): dial buffer / last number round-trip under independent key (D-19)
- [ ] `packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneJournal.test.tsx` — NEW (10-05): blended feed, N cap, exactly-two-actions, empty + error-retry (D-01…D-05)
- [ ] `packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneContacts.test.tsx` — NEW (10-06): five sections, unified search + collapse, Recent dedup, Book CTA dial, ownership gate, error-retry (D-11…D-14, D-25)
- [ ] `packages/frontend/src/features/callcenter/ui/CallHistoryPanel/CallHistoryPanel.test.tsx` — EXTEND/NEW (10-07): Queue/Outbound/Personal segment filter + per-segment search; no Missed segment (D-07/D-10)
- [ ] `packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.test.tsx` — EXTEND (10-08): fab absence (grep-verified), Tabs three tabs, mode gating, registration states, SIP quality/device DOM-absence (D-16…D-27, D-34)
- [ ] `packages/frontend/src/features/callcenter/lib/useSipPhoneAmi.test.ts` — NEW (10-09): binary status mapping (no 'registering'), hold/unhold/hangup/sendDtmf mutation routing, DTMF uniqueid, quality/device absence (D-31…D-35)
- [ ] Migration manual-verify for `cc_contacts` (10-01) and `journal_depth` (10-02) — follows the "migration applied to live DB" convention (STATE.md); migrations are not unit-tested, only applied + verified

*Existing Vitest/Jest infrastructure covers runners — Wave 0 is new/extended specs, not framework install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AMI `PlayDTMF` param shape (A1) | D-32 | Live Asterisk action name/params may differ from research `[ASSUMED]` | On lab PBX (SIP hardware phone): during a call, press DTMF from the softphone Dial tab; confirm the far end receives the digits (validates `Channel`/`Digit` shape). Capture actual field names if it fails. |
| AMI `DeviceState`/`ExtensionState` field names (A3) | D-35 | Live Asterisk event key casing may differ from research `[ASSUMED]` (inherited from 09-VALIDATION) | Toggle the endpoint offline/online (unregister/re-register the phone); confirm the trigger badge flips offline→online within the poll interval and Recover re-requests state. |
| SIP-mode full call-control parity | D-31…D-35 | WebRTC-free path needs real hardware media | On lab PBX: log a SIP shift, confirm Dial/Journal/Contacts chrome renders and quality indicator + device picker are ABSENT (D-34); confirm hold/unhold/hangup/transfer act on the hardware call via AMI; confirm SIP outbound places via clickToCall/originate callback then dials target (D-33). |
| WebRTC softphone registration/Recover + quality/devices UX | D-16…D-23 | WebRTC + real media/devices | Browser: F5 during a shift → auto re-REGISTER, registering badge, Recover only after timeout; in-call MOS/jitter/RTT/loss detail row; switch mic/speaker mid-call. |

*A1 and A3 are validated by the blocking `checkpoint:human-verify` in 10-09 (T3) before the phase is marked done — same precedent as Phase 9's 09-VALIDATION AMI checks.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency (or the blocking live-Asterisk checkpoint for A1/A3)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s (scoped)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
