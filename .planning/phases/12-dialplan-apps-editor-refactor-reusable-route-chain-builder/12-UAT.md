---
status: complete
phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
source: [12-01-SUMMARY.md … 12-17-SUMMARY.md]
started: 2026-08-31T06:30:00Z
updated: 2026-08-31T06:40:00Z
---

## Current Test

[testing complete]

## Tests

### 1. StepSheet opens on toqueue; loading vs empty catalog
expected: Sheet opens; loading is distinguishable from empty catalog
result: pass
source: automated
coverage_id: 12-02-D4

### 2. Mobile Sheet 85dvh and overlay nesting (M8)
expected: Nested Sheet covers host modal; focus, Esc, dimming work at 375/768/1280
result: pass
coverage_id: 12-08-D7
note: Approved 2026-08-20; fallback --z-index-modal-nested not applied

### 3. Live Progress()+language on a real call (M4 / 12-10-D8)
expected: Sound before answer; CDR not ANSWERED
result: skipped
reason: "Deferred follow-up: голос будем гонять позже"

### 4. Live notify and TTS on a real Asterisk/Nest pair (12-11-D4)
expected: Notify/TTS fire via internal CURL, not /usr/scripts
result: skipped
reason: "Deferred follow-up: голос будем гонять позже"

### 5. Live call_groups.exten ALTER (12-14-D1)
expected: Four-step migration applied; second run no-op
result: pass
note: 2026-08-31 both runs already applied, remainingNull=0

### 6. Live ring-options ALTER (12-15-D5)
expected: Seven columns present; second run no-op
result: pass
note: 2026-08-31 applied=0 already=7 on both runs

### 7. Early media Progress() audible before answer (M4)
expected: External trunk call hears audio before answer
result: skipped
reason: "Deferred follow-up: M4 approve, пропускаем, голос будем гонять позже"

### 8. QUEUESTATUS overflow routes the second call (M5)
expected: Second call with maxlen=1 leaves queue to the next chain step
result: skipped
reason: "Deferred follow-up: M5 approve, пропускаем, голос будем гонять позже"

### 9. usr/scripts counter does not grow after notify/TTS (M12)
expected: grep -c usr/scripts before/after test calls is unchanged
result: skipped
reason: "Deferred follow-up: M12 approve, пропускаем; baseline 0 already recorded"

### 10. Automated coverage 12-01…12-17
expected: All coverage entries with passing unit/integration refs auto-pass
result: pass
source: automated
note: classify-coverage all_auto_covered on 12-01, 03–07, 09, 12–13, 16; remaining auto_passed on 02, 08, 10, 11, 14, 15, 17

## Summary

total: 10
passed: 5
issues: 0
pending: 0
skipped: 5
blocked: 0

## Deferred Follow-Ups

- test: 3
  idea: "Live Progress()+language on a real trunk call (M4)"
  deferred_at: 2026-08-31
- test: 4
  idea: "Live notify and TTS after generator deploy (12-11)"
  deferred_at: 2026-08-31
- test: 7
  idea: "M4 early media"
  deferred_at: 2026-08-31
- test: 8
  idea: "M5 QUEUESTATUS overflow"
  deferred_at: 2026-08-31
- test: 9
  idea: "M12 post-deploy usr/scripts counter pair"
  deferred_at: 2026-08-31

## Gaps

[none]
