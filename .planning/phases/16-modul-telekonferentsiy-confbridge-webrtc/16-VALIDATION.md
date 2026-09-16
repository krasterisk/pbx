---
phase: "16"
slug: "modul-telekonferentsiy-confbridge-webrtc"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-15"
validated: "2026-09-16"
---

# Phase 16 — Validation Strategy

> Per-phase validation contract. Seeded from `16-RESEARCH.md`, audited by `/gsd-validate-phase 16`.
> Phase 16 core covers D-01…D-09, D-11, D-13…D-17, D-22, D-25, D-34…D-37, R-PROFILE, R-STALE.
> D-10, D-12, D-18…D-21, D-23, D-24, D-26, D-27, D-29…D-33, D-38…D-41 (guest UI / video grid / recording) belong to 16.1 / 16.2 / 16.3.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | jest `^29.7.0` |
| **Framework (frontend)** | vitest |
| **Config file** | `jest` key in `packages/backend/package.json` (`rootDir: src`, `testRegex: .*\.spec\.ts$`); `packages/frontend/vitest.config.ts` |
| **Quick run command** | `npm run test -w @krasterisk/backend -- --testPathPattern="conferences" --no-coverage` |
| **Full suite command** | `npm run test:backend && npm run test:frontend` |
| **Estimated runtime** | ~7s quick · ~5–8 min full |

---

## Sampling Rate

- **After every task commit:** Run the task's narrow `--testPathPattern` command
- **After every plan wave:** `npm run test:backend && npm run test:frontend`
- **Before `/gsd-verify-work`:** Full suite + `npm run lint` + live `ipbx.krasterisk.ru` (UAT 11/11 done)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | D-01 D-02 D-06 D-22 D-25 D-34 D-35 R-PROFILE | T-16-01-01…04 | sanitize + tenant filter + no `allow=` on bridge | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-spine\|confbridge-static-profile" --no-coverage` | ✅ | ✅ green |
| 16-01-02 | 01 | 1 | D-06 | T-16-01-01 | `normalizeTarget('conference')` + INT max `2147483647` | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-spine\|dialplan-target" --no-coverage` | ✅ | ✅ green |
| 16-01-03 | 01 | 1 | schema | — | 5 tables / models, `created_by` | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-schema" --no-coverage` | ✅ | ✅ green |
| 16-02-01 | 02 | 2 | D-03 D-17 | T-16-02-01 T-16-02-02 | tenant CRUD + two `logAction` on repeat enter | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-rooms.service" --no-coverage` | ✅ | ✅ green |
| 16-02-02 | 02 | 2 | D-03 D-04 | T-16-02-03 T-16-02-04 | digits-only uniqueid; `collectIfEmpty` | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-ephemeral" --no-coverage` | ✅ | ✅ green |
| 16-02-03 | 02 | 2 | D-03 D-17 | T-16-02-05 | `addToConference` uses ephemeral context; ownership guards | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="callcenter" --no-coverage` | ✅ | ✅ green |
| 16-03-01 | 03 | 3 | D-05 D-07 D-08 | T-16-03-01 T-16-03-02 | mask-index sanitize; two creates keep both numbers | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-dialplan\|conference-rooms.service" --no-coverage` | ✅ | ✅ green |
| 16-03-02 | 03 | 3 | D-05 D-08 | T-16-03-01 T-16-03-03 | hop to `krsk-conf-{uid}` / mask; `emitHopPrologue` | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="dialplan.util\|dialplan-params" --no-coverage` | ✅ | ✅ green |
| 16-03-03 | 03 | 3 | D-09 | T-16-03-04 | legacy report dry-run; `MODULE_COVERAGE.conferences` | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="legacy-confbridge-steps\|ai-adapter-completeness" --no-coverage` | ✅ | ✅ green |
| 16-04-01 | 04 | 4 | D-08 | T-16-04-01 T-16-04-03 | catalog uid decimal string; label number+name | component | `npm run test -w @krasterisk/frontend -- src/features/dialplan-apps/model/useSchemaRefs.test.tsx` | ✅ | ✅ green |
| 16-04-02 | 04 | 4 | D-08 | T-16-04-02 | `confbridge` schema catalog, no profile field | component | `npm run test -w @krasterisk/frontend -- src/features/dialplan-apps` | ✅ | ✅ green |
| 16-04-03 | 04 | 4 | D-08 | T-16-04-01 | ValueSourceField catalog-agnostic | component | `npm run test -w @krasterisk/frontend -- src/features/dialplan-apps/ui/ValueSourceField` | ✅ | ✅ green |
| 16-05-01 | 05 | 4 | D-14 | T-16-05-02 T-16-05-03 | role table + conditional admin lines | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-roles\|conference-dialplan\|conference-state" --no-coverage` | ✅ | ✅ green |
| 16-05-02 | 05 | 4 | D-16 | T-16-05-03 | permanent rights persist + sanitize | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-rooms.service" --no-coverage` | ✅ | ✅ green |
| 16-05-03 | 05 | 4 | D-15 D-16 | T-16-05-01 T-16-05-04 T-16-05-05 | `resolveCallerRef`; AMI channel from snapshot | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-moderation\|conference-state" --no-coverage` | ✅ | ✅ green |
| 16-06-01 | 06 | 5 | D-11 D-13 | T-16-06-01 T-16-06-03 | entry policy + wait_marked only for participant | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-entry-policy\|conference-dialplan" --no-coverage` | ✅ | ✅ green |
| 16-06-02 | 06 | 5 | D-11 | T-16-06-01 T-16-06-02 | PIN required + sanitized | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-rooms.service" --no-coverage` | ✅ | ✅ green |
| 16-06-03 | 06 | 5 | D-13 | T-16-06-05 | `waitingForModerator` on snapshot | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-state" --no-coverage` | ✅ | ✅ green |
| 16-07-01 | 07 | 6 | D-36 | T-16-07-01 | mapper 6 keys, no channel / conf name | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-participant" --no-coverage` | ✅ | ✅ green |
| 16-07-02 | 07 | 6 | D-37 | T-16-07-02 | `me/video` uses `resolveCallerRef` | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-state\|conference-spine" --no-coverage` | ✅ | ✅ green |
| 16-07-03 | 07 | 6 | R-STALE | T-16-07-03 | sweeper threshold + kick | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-stale-channel" --no-coverage` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all Phase 16 core requirements. Guest token / capacity / video grid / recording stubs stay in 16.1–16.3.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live profile `krsk_conf_sfu` | D-02 / R-PROFILE | `module reload app_confbridge.so` only on live Asterisk | UAT 1 — CLI `confbridge show profile bridge krsk_conf_sfu` |
| Live call + SSE both paths | D-22 D-34 D-35 | Real ConfBridge + AMI | UAT 2 — Local originate + SSE |
| DIALPLAN_EXISTS mask | D-05 D-08 | Asterisk build-dependent | UAT 3 |
| Grant vs DTMF menu | D-15 D-16 | Engine reads user profile at join | UAT 4 |
| Cold-cache hydrate | D-34 | Needs backend restart | UAT 5 |
| Hybrid web + SIP phone | D-23 | Physical/soft SIP — Phase 16.1 | Join non-WebRTC peer on live bench |
| Guest link + PIN | D-11 D-12 | Phase 16.1 | Clean browser profile |
| Recording / Range | D-30 D-31 D-33 | Phase 16.2 | Moderator start/stop + seek |
| Video grid SDH | D-24 D-38 | Phase 16.3 | Spike 002 client, 3 peers |

UAT 6–11 (D-06 precision, D-25 order, D-34 parallel, D-35 close, D-17 order, D-08 two creates) now have matching Jest coverage; live scripts remain a backstop, not the only proof.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references for Phase 16 core
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-16

---

## Validation Audit 2026-09-16

| Metric | Count |
|--------|-------|
| Gaps found | 5 |
| Resolved | 5 |
| Escalated | 0 |

| Gap | Requirement | File | Status |
|-----|-------------|------|--------|
| 1 | D-25 codec order | `confbridge-static-profile.service.spec.ts` | green |
| 2 | D-34 parallel join | `conference-state.spec.ts` | green |
| 3 | D-17 two admin enters | `conference-rooms.service.spec.ts` | green |
| 4 | D-08 two creates mask-index | `conference-rooms.service.spec.ts` | green |
| 5 | D-35 SSE unsubscribe | `conference-spine.spec.ts` | green |
