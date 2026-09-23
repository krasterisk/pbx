---
status: testing
phase: 18-polnyy-refaktoring-rechevoy-analitiki
source: [18-VERIFICATION.md]
started: 2026-09-23T05:05:00Z
updated: 2026-09-23T05:05:00Z
---

## Current Test

number: 1
name: Live API UUID re-check (G-18-06 / D-50)
expected: |
  recordingId / runId / journalId are UUIDs present in sa_recordings / sa_analysis_runs.
  Success ids do not use the journal: prefix.
  charged stays false. No wallet debit.
awaiting: user response

## Tests

### 1. Live API UUID re-check (G-18-06 / D-50)
expected: Follow 18-UAT-API-RECHECK.md. Issue one SA API token. POST /api/v1/speech-analytics/uploads/batch with one small mono fixture and one small stereo fixture only (not the full Z:\temp\speech-analytics-samples catalog). recordingId / runId / journalId are UUIDs in sa_recordings / sa_analysis_runs. charged === false. No wallet debit. Do not commit plaintext tokens.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
