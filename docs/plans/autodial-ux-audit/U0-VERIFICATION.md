# U0 verification — 2026-10-16

Status: implemented, targeted-automated-tests-passed, isolated engine live-verified.
This does not close the full REPORT or constitute a production release.

## Delivered

- One physical dialplan application per AMI Append entry for finalize/machine CURL.
- Editor names for DTMF, labels/goto/hangup; tenant-scoped Read prompt; named input retained.
- DNC ORM creation timestamp; base-locked manual/API deduplication; tenant-wide active-number
  exclusion inside the database claim transaction without forbidding legitimate duplicate records.
- Russian amounts (normal/NBSP/narrow spaces), calendar dates, multi-number import splitting
  before normalization; explicit optional-invalid omission with original-value warnings.
- Durable daily monitor counts and database statuses, percentage units, distinct-contact penetration,
  timezone-aware half-open report days, raw daily series including today, scenario-result export/DTMF UI.
- Shared supported-action catalog, editor filtering, indexed unsupported-step errors,
  running/paused dial-mode guard, enum TagInput.
- Existing BOM, TTS interpolation and field reference guards retained.

## Evidence

- Backend module regression before final two tests: 25 suites / 255 tests PASS, 14 opt-in DB tests skipped.
- Updated focused regression: 118 tests PASS; AMI Append regression and optional-policy tests then added;
  indexed error expectation updated. Final rerun remains required.
- Actual MySQL isolated schema integration: 14 tests PASS (including DNC timestamp, concurrent inserts,
  cross-campaign active-number exclusion, rollback and tenant checks). Schema removed.
- Frontend autodial targeted: 18 files / 96 tests PASS.
- Backend production-source typecheck and frontend typecheck PASS at the recorded source checkpoint;
  subsequent additive tests/changes require final rerun. Raw backend tsconfig includes existing spec/rootDir
  diagnostics; use tsconfig.build.json for production-source checking.
- Scoped eslint: 0 errors / 3 pre-existing warnings.
- [live-u0.cjs](../../../.planning/autodial-ux-audit/live-u0.cjs), [result](../../../.artifacts/legacy/.planning/autodial-ux-audit/live-u0-result.json): eight actual source-originator PJSIP loopback
  calls; all expected dispositions PASS; MACHINE persisted, DTMF=1, talk_sec>0, actual loaded CURL present,
  daily/summary and new-state monitor totals read successfully from MySQL.
- Run used a separate random MySQL schema, tenant 991016, campaigns 991016/991017 inside that schema,
  dedicated ARI app, localhost reverse callback port and a per-run callback credential. No existing campaign
  started. Synthetic numbers only; transport guard rejects other endpoints.
- Cleanup PASS: test config/audio/schema removed; original ac_0.conf, ac_2.conf and existing loopback
  fixture SHA256 unchanged. Original campaign states preserved; uid1 draft.
- Two earlier harness setup attempts stopped before calls (missing callback key; missing required phone
  field). Corrected with a per-run key and a valid test schema; cleanup verified on the second attempt.

## Remaining gates

Final global lint/backend/frontend, actual browser verification, PostgreSQL runtime, additional
live DNC/retry/restart/concurrency scenarios and operator modes remain pending. Do not substitute these
eight engine calls for full application, pacing, UI, AI, TTS speech or operator-mode acceptance.

Live observation: ARI's rounded answer duration can exceed CDR billsec by one second; preserve authoritative
scenario callback billsec when finalizing after enrichment, then cover callback-order permutations.
