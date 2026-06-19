---
status: testing
phase: 04-ivr-phrases-tab-tts-text-phrases-with-per-phrase-engine-voic
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md
started: 2026-06-16T04:30:00.000Z
updated: 2026-06-16T04:30:00.000Z
---

## Current Test

number: 1
name: Open IVR modal — Phrases tab with audio + TTS modes
expected: |
  /ivrs → edit/create IVR → tab «Фразы» shows phrase list with ability to add «Запись» (audio from prompts) and «TTS» (text phrase) rows; UI readable, not merged with background.
awaiting: user response

## Tests

### 1. Open IVR modal — Phrases tab with audio + TTS modes
expected: /ivrs → IVR modal → «Фразы» tab shows add controls for audio prompt and TTS text phrase; section has visible panel/border.
result: pending

### 2. Add TTS phrase with per-phrase engine and voice overrides
expected: Add TTS row → select TTS engine → override voice/speed (or role) fields visible; different phrases can use different engines/settings.
result: pending

### 3. Preview TTS phrase before save
expected: Click Preview on a TTS phrase → audio plays or loading indicator; on error (bad engine/config) toast/error message shown, modal stays open.
result: pending

### 4. Save IVR with mixed audio + TTS phrases
expected: Save IVR with at least one audio + one TTS phrase → modal closes, IVR appears in table; reopen shows phrases preserved in order.
result: pending

### 5. Dialplan / call — phrases play in order
expected: After apply dialplan, test call to IVR plays audio prompts then TTS phrases in configured order (runtime TTS, no pre-saved WAV required).
result: pending

### 6. Technical — backend unit tests
expected: npm run test:backend passes; ivrs.service.spec.ts covers phrase/dialplan logic.
result: pass

### 7. Technical — frontend unit tests (IVR prompts)
expected: IvrPromptsEditor-related tests pass if present.
result: pending

## Summary

total: 7
passed: 1
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
