# Autodial refactor — VERIFICATION

Goal-backward against [AUTODIAL-REFACTOR-PLAN-2026-09-18.md](AUTODIAL-REFACTOR-PLAN-2026-09-18.md). Verdict: **implemented in module scope, not released**.

| Plan goal | Delivered? | Evidence |
|---|---|---|
| R0 matrix + ADR + no production repair | Partial / yes for ADR | [acceptance matrix](AUTODIAL-REFACTOR-ACCEPTANCE-MATRIX-2026-09-18.md), [ADR](AUTODIAL-REFACTOR-ADR-B01-B13-2026-09-21.md). D-01..D-20 text not re-copied |
| R1 data/HTTP UID/import | Yes in module | Existing journal + 96 frontend autodial tests |
| R2a compiler/deploy/409 | Yes with named leftovers | `renderActionChain` adapter, TTS CURL, `apply_error`, `expected_revision`. Dynamic queue still rejected rather than guessed |
| R2b ARI lifecycle | Partial | Up=handoff, idempotent finalize, Destroy-by-channel. Event permutations not fully live |
| R2c eligibility/capacity | Yes in code | Last-mile DNC in claim tx, pacer owner CAS, `ac_channel_reservations`. No two-process injection |
| R3 UX | Partial / yes for contracts | Forms, IANA TZ, DNC boundary, bulk-delete. Live 1920 7-tab modal in bounds. CDP 200% 2/2 after open-then-scale |
| R4 trunks/CID/failover | Yes in code + isolated SIP | Per-trunk CID, technical legs, loopback CallerID from earlier gate. Provider From-override open |
| R5 AMD voicemail | Yes isolated | [amd-voicemail-2026-09-21.md](evidence/amd-voicemail-2026-09-21.md): MACHINE + WaitForSilence SUCCESS + Playback. Campaign prompt file open |
| R6 lint+both suites+STATE | No | Autodial ESLint 0 errors (1 pre-existing FE warning). Targeted tests pass. Full frontend suite hangs on Windows wrapper. STATE/ROADMAP not updated |
| No real subscriber calls | Yes | Isolated Local AMD only. Campaign uid 1 remains draft |

## External gates 2026-09-21

| Gate | Result |
|---|---|
| Isolated AMD voicemail Local | **PASS** (`MACHINE/MAXWORDS-3-2`, `TRY=SUCCESS`, `PLAY=beep`, cleanup 0 channels) |
| Browser 1920 campaign modal 7 tabs | **PASS** (no document overflow; modal 928×918 inside 1920) |
| CDP pageScale 200% form tabs ru/en | **PASS** (2 Playwright tests). Create-button under header if scaled first: named leftover |
| Import-preview 1k | **PASS** 154 ms / 1000 rows |
| Import-preview 10k | **FAIL** HTTP 413 |
| Multi-worker live injection | **NOT RUN** |
| Full `npm run test:frontend` | **NOT GREEN** (wrapper hang) |
| Campaign start | **NOT RUN** (human/real-call action) |
