---
phase: "16"
slug: "modul-telekonferentsiy-confbridge-webrtc"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-15"
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `16-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | jest `^29.7.0` |
| **Framework (frontend)** | vitest |
| **Config file** | `jest` key in `packages/backend/package.json` (`rootDir: src`, `testRegex: .*\.spec\.ts$`); `packages/frontend/vitest.config.ts` |
| **Quick run command** | `npm run test -w @krasterisk/backend -- --testPathPattern="conferences" --no-coverage` |
| **Full suite command** | `npm run test:backend && npm run test:frontend` |
| **Estimated runtime** | ~30s quick · ~5–8 min full |

---

## Sampling Rate

- **After every task commit:** Run the task's narrow `--testPathPattern` command (see Per-Task Verification Map)
- **After every plan wave:** Run `npm run test:backend && npm run test:frontend` — must include `ai-adapter-completeness.spec.ts`
- **Before `/gsd-verify-work`:** Full suite green + `npm run lint` + one manual pass on live `ipbx.krasterisk.ru`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

*Populated by `/gsd-validate-phase 16` once PLAN.md files exist. Requirement → command mapping inherited from `16-RESEARCH.md` § Validation Architecture:*

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| D-06 / D-07 | `normalizeTarget('conference', …)` produces `conf{number}_{uid}` and keeps the passthrough guard | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="dialplan-target" --no-coverage` | ❌ W0 |
| D-02 / D-05 | `confbridge` case + mask-index emit correct dialplan lines | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="dialplan.util" --no-coverage` | ❌ W0 |
| Static profile bootstrap | Idempotent — no duplicate writes on restart | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="confbridge-static-profile" --no-coverage` | ❌ W0 |
| Data model | Sequelize models read/write, FK cascade fires | integration (MySQL, no Asterisk) | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-rooms.service" --no-coverage` | ❌ W0 |
| D-11 / D-12 | Guard enforces TTL/revoke, never sets `sub`/`level` on `req.user` | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-guest-token.guard" --no-coverage` | ❌ W0 |
| D-10 | Ephemeral endpoint created with room-scoped `context`, removed on leave | integration (AMI mocked) | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-guest" --no-coverage` | ❌ W0 |
| D-34 / D-37 | AMI event → EventEmitter2 → participant state map | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-state" --no-coverage` | ❌ W0 |
| D-19 / D-20 | `maxParticipantsForBudget`, `min(tariff, capacity)` | unit (pure function) | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-capacity" --no-coverage` | ❌ W0 |
| Stale-channel sweeper | Detects stale channel by threshold and calls `ConfbridgeKick` | unit (AMI mock + fake timers) | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-stale-channel" --no-coverage` | ❌ W0 |
| D-41 | `MODULE_COVERAGE['conferences']` present, adapter registered, skill parses | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="ai-adapter-completeness" --no-coverage` | ✅ exists |
| Grid / custom SDH | Custom `SessionDescriptionHandler` retains N remote tracks in a Map | unit (RTCPeerConnection mock) | `npm run test -w @krasterisk/frontend -- src/features/conferences/lib` | ❌ W0 |
| UI-SPEC components | `VideoSurface`, `ConferencesTable`, room form | component (Vitest + RTL) | `npm run test -w @krasterisk/frontend -- src/features/conferences` | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/backend/src/shared/utils/dialplan-target.util.spec.ts` — add a describe block for `normalizeTarget('conference', …)`
- [ ] `packages/backend/src/shared/utils/dialplan.util.spec.ts` — add `case 'confbridge'` cases (fixed + route_pattern)
- [ ] `setup-conferences-schema.ts` + first `db:setup:conferences` run against the test database
- [ ] AMI fixtures/mocks for `AmiService.action('ConfbridgeList' | 'ConfbridgeKick' | 'Originate', …)` — copy the existing AMI mock pattern from other `*.spec.ts`
- [ ] Manual checklist runbook for `ipbx.krasterisk.ru` (see Manual-Only Verifications)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full flow: call → room → video grid | D-22, D-24 | Needs a live Asterisk with real PJSIP registrations and a browser | Spike 002's draft client is the manual test bench; join 3 web participants, confirm one tile per peer |
| Static profile applied, `video_mode=sfu` active | D-02 amendment | `module reload app_confbridge.so` effect is only observable on a live server | `confbridge show profile bridge <name>` after bootstrap |
| Hybrid web + hardware SIP phone in one room | D-23 | Requires physical/soft SIP endpoint outside the browser | Join a non-WebRTC peer, confirm it receives one video stream per peer |
| Guest link end-to-end, with and without PIN | D-11, D-12 | Cross-origin browser flow with real SIP credentials | Open the shared link and a named invitation in a clean browser profile |
| Recording start/stop and Range playback | D-30, D-31, D-33 | Needs real media files on `records_base_path` | Start via moderator button, stop, play back with seeking |
| "Joined but no video" re-negotiation (~1 in 12 joins) | Research finding | Statistical — not deterministically reproducible in CI | Repeat joins on the live bench, confirm the detector re-negotiates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
