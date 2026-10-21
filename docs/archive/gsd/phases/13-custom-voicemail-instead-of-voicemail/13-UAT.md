---
status: complete
phase: 13-custom-voicemail-instead-of-voicemail
source: [13-01-SUMMARY.md … 13-13-SUMMARY.md]
started: 2026-09-03T06:20:00Z
updated: 2026-09-03T06:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. CDR tab and shared filter
expected: Tab and checkbox stay in sync via voicemail=1; list from /voicemail; journal icon on rows with a message
result: pass
source: automated
note: CdrReportPage + CdrFilter + journal icon tests (frontend cdr / dialplan-apps 29 files / 258 tests, 2026-09-03)

### 2. Details Dialog and player
expected: Dialog (not Sheet), full AudioPlayer, JWT stream /voicemail/:uniqueid/play, no ?token= on screen
result: pass
source: automated
note: VoicemailDetailsModal four-state + AudioPlayer tests; JWT play path asserted in backend controller specs

### 3. Live greeting → Record → notify
expected: File under {records_base_path}/{uid}/voicemail/; Telegram/email attach or 7-day link; CDR row; hangup does not wait STT
result: skipped
reason: "Deferred follow-up: голос будем гонять позже (тот же прецедент, что Phase 12 M4/M5/M12)"

## Summary

total: 3
passed: 2
issues: 0
pending: 0
skipped: 1
blocked: 0

## Deferred Follow-Ups

- test: 3
  idea: "Live greeting → Record → notify on a real Asterisk channel + Telegram/email"
  deferred_at: 2026-09-03

## Gaps
