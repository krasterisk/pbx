# Deferred items (Phase 07)

## Out of scope during 07-18

- Pre-existing frontend `tsc --noEmit` failures (not introduced by 07-18):
  - `CallGroupFormModal.test.tsx` — tuple/undefined payload typing
  - `NotificationIntegrationFormModal.tsx` — credentials type mismatch
  - `RoutePhonebooksTab.tsx` — Text `title` prop typing
- `requirements mark-complete D-33/D-34/D-36` — IDs not present in `.planning/REQUIREMENTS.md` (decision IDs live in CONTEXT/UI-SPEC)

## DEF-07-MUTE-AMI — SIP softphone mute via AMI MuteAudio

- **Symptom:** In SIP-device softphone mode, mute on the agent ARM toggles local UI state only; far-end audio is not muted.
- **Desired fix:** Call Asterisk AMI `MuteAudio` (or equivalent) against the agent channel when `softphoneMode` is SIP, with channel identity resolution and error UX.
- **Why deferred from Phase 07 gap closure (07-20):** No existing `MuteAudio` / `muteAudio` helper or AMI action in the repo; adding it needs new backend AMI wiring outside the verified gap preference (track DEF, no bare TBD).
- **Owner surface:** `CallCenterAgentPage` `handleMuteToggle` + future callcenter AMI service method.
