---
phase: 04-ivr-phrases-tab-tts-text-phrases-with-per-phrase-engine-voic
plan: 01
subsystem: api
tags: [ivr, tts, shared-types]
requires: []
provides:
  - IIvrPhrase union in @krasterisk/shared
  - IvrTtsService (yandex, google, custom)
  - Prompt normalize/validate on save
key-files:
  created:
    - packages/shared/src/types/ivr-phrase.types.ts
    - packages/shared/src/utils/ivr-prompts.ts
    - packages/backend/src/modules/ivrs/ivr-tts.service.ts
    - packages/backend/src/modules/ivrs/ivr-tts-google.provider.ts
    - packages/backend/src/modules/ivrs/ivr-tts-custom.provider.ts
  modified:
    - packages/backend/src/modules/ivrs/ivrs.service.ts
    - packages/backend/src/modules/ivrs/ivrs.module.ts
requirements-completed: [REQ-305, REQ-306, REQ-305b]
completed: 2026-06-04
---

# Phase 4 Plan 01 Summary

Shared `IIvrPhrase` contract, migration helpers, and `IvrTtsService` with all three engine types for batch WAV synthesis.
