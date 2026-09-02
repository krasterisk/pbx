---
phase: 13
slug: custom-voicemail-instead-of-voicemail
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-02
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Источник: `13-RESEARCH.md` § `## Validation Architecture`. Task ID проставляются в `/gsd-validate-phase 13`
> после создания планов.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | Jest `^29.7.0` + ts-jest |
| **Config file (backend)** | `packages/backend/package.json` § `jest` |
| **Framework (frontend)** | Vitest `^4.1.4` + Testing Library |
| **Config file (frontend)** | `packages/frontend/vite.config.ts` |
| **Quick run command** | `npm run test:backend -- --testPathPattern="voicemail\|wav-pcm\|dialplan.util" --no-coverage` |
| **Full suite command** | `npm run lint && npm run test:backend && npm run test:frontend` |
| **Estimated runtime** | ~20 s узкий прогон · полный набор — минуты |
| **Обязательный префикс** | любая задача, меняющая `packages/shared` → сначала `npm run build -w @krasterisk/shared` |

---

## Sampling Rate

- **After every task commit:** matching `--testPathPattern` / vitest file
- **After every plan wave:** `npm run test:backend && npm run test:frontend`
- **Before `/gsd-verify-work`:** `npm run lint && npm run test:backend && npm run test:frontend`
- **Max feedback latency:** 30 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | D-55 hangup_handler_push before Record + k | T-lost-file | Handler fires on hangup; k always present | unit | `--testPathPattern=dialplan.util` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | D-55b hangup_handler_pop after Record | T-double-ingest | No double CURL on # | unit | `--testPathPattern=dialplan.util` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | D-54 no VoiceMail( emit | — | N/A | unit | `--testPathPattern=dialplan.util` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | D-57 parseWavPcm16 chunks | T-stt-garbage | LIST chunk / non-16-bit handled | unit | `--testPathPattern=wav-pcm` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | D-59 token guard; no cdr-public | T-unauth-url | missing/revoked/expired → 401; no sub/level | unit | `--testPathPattern=voicemail-link` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-60/D-61 scanner pending | — | ingest does not call STT | unit | `--testPathPattern=voicemail-scanner` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-64/D-65 2MB attach | — | size gate | unit | `--testPathPattern=voicemail` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-68/D-70 retry axes | — | notify_failed vs transcript failed independent | unit | `--testPathPattern=voicemail-scanner` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | Surface L tab/filter | — | Mic ≠ Voicemail icons | RTL | vitest CdrReportPage | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/backend/src/modules/voicemail/**/*.spec.ts` — ingest, scanner, link guard, wav-pcm, llm-summary
- [ ] Extend `dialplan.util.spec.ts` — D-55 order + pop + no `VoiceMail(` + `.wav` + `k`
- [ ] Shared `RECORD_STATUS_VALUES` + condition invariant test
- [ ] Frontend `schemas/voicemail.test.tsx`, CdrReportPage tab/filter, details Dialog states
- [ ] Framework install: none — Jest + Vitest already present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hang up mid-Record → file exists and notify received | M2 / D-55 | Live SIP | Originate, hang up during Record, check file + notify |
| CLI shows enter `krsk-vm-done-*` after Hangup | M3 / D-55 | Live PBX | `asterisk -rvvv` during hangup |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
