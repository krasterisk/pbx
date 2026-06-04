---
phase: 04-ivr-phrases-tab-tts-text-phrases-with-per-phrase-engine-voic
plan: 03
subsystem: ui
tags: [ivr, tts, react]
requires:
  - plan: 04-01
provides:
  - IvrPromptsEditor audio + TTS modes
  - Preview button with toast errors
  - Per-phrase engine settings UI
key-files:
  created:
    - packages/frontend/src/features/ivrs/ui/IvrPhraseTtsFields/IvrPhraseTtsFields.tsx
  modified:
    - packages/frontend/src/features/ivrs/ui/IvrPromptsEditor/IvrPromptsEditor.tsx
    - packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFormModal.tsx
    - packages/frontend/src/shared/api/endpoints/ivrsApi.ts
requirements-completed: [REQ-301, REQ-302, REQ-303, REQ-307, REQ-308, REQ-309]
completed: 2026-06-04
---

# Phase 4 Plan 03 Summary

«Фразы» editor supports mixed audio/TTS list, per-phrase engine overrides, and JWT preview before save.
