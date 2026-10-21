# Autodial refactor — SUMMARY

Date: 2026-09-21. Assignment: close [AUTODIAL-REFACTOR-PLAN-2026-09-18.md](AUTODIAL-REFACTOR-PLAN-2026-09-18.md) in `codex-direct` without rewriting that PLAN file and without claiming historical GSD STATE/ROADMAP or a production release.

Campaign `MCP-Live-20260921` (uid 1) stayed **draft**. No start, no real subscriber calls.

## What this close means

Code slices R0–R5 that were still open in the 21.09 canvas (fencing, shared trunk reservations, `apply_error`, `renderActionChain`/TTS, technical failover, last-mile DNC in the claim transaction, bulk-delete bases) are in the autodial module. Isolated AMD voicemail on Local/loopback passed. Targeted tests passed. SUMMARY/VERIFICATION/ADR/matrix/canvas are written.

It does **not** mean: live campaign, provider From-override, full ARI permutation matrix, native Chrome Ctrl++ zoom, 10k import-preview through JSON, full frontend repository suite, or GSD phase-17 STATE.

## Implemented in this close wave

| Area | Code |
|---|---|
| R2c fencing | Campaign CAS `pacer_owner` / `pacer_heartbeat_at`, TTL 5s |
| R2c reservations | Durable `ac_channel_reservations`; pacer subtracts holds from capacity |
| R2a apply | `apply_error` on campaign DTO after failed AMI apply; start/resume still refuse `running` |
| R2a compiler | Autodial adapter onto shared `renderActionChain`; TTS via CURL+Playback |
| R4 failover | Extra originate legs only after technical originate failure |
| R2c DNC | `gate` inside `claimAndOpenAttempt` (READ_COMMITTED) |
| R3 bulk-delete | `POST /autodial/bases/bulk-delete` + BasesList sequential `remove()` with per-uid failures |
| R5 AMD | Isolated Local: `AMD=MACHINE`, `WaitForSilence SUCCESS`, `Playback(beep)` |

## Checks run 2026-09-21

- Backend autodial Jest (earlier this session): 23 suites, 230 passed, 11 skipped (opt-in DB)
- Frontend autodial vitest, explicit 18 files (not the hanging `vitest-run-src` glob): **18 files / 96 tests passed**, 58.8s
- Playwright `pageScale 200%` ru/en after opening the modal: **2 passed**. Zoom-then-click-create is intercepted by the sticky header; that path is named open
- Import-preview: 1000 rows HTTP 201 in 154 ms; 10000 rows HTTP 413 (JSON body vs 20 MiB DTO)
- Isolated AMD probe cleaned: context gone, 0 channels
- Scoped ESLint autodial backend: 0 errors. Frontend autodial: 0 errors, 1 pre-existing `react-hooks/exhaustive-deps` warning in `ReportsView`

`npm run test:frontend` (full wrapper) is still the known Windows hang. `npm run lint` / `npm run test:backend` full gates were not re-declared green in this wave.

## Explicitly not done

- Start of campaign uid 1
- Provider-specific SIP From rewrite
- Full ARI event-order permutations
- Live multi-worker fault injection (fencing is in DB; not injected on two processes)
- Native browser Ctrl++ 200% (CDP `setPageScaleFactor` used)
- 10k preview through the HTTP JSON parser
- Automatic repair of lost field UIDs
- Archive policy for `ac_attempts` after campaign delete
- GSD `STATE.md` / ROADMAP phase 17
