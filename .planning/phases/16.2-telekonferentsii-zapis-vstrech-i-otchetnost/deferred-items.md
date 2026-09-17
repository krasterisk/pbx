# Deferred items — Phase 16.2

## Out of scope (16.2-04)

- `npm run lint` at repo root exits non-zero because of pre-existing backend ESLint errors (preserve-caught-error, no-unsafe-function-type, and others) in files this plan did not touch. Frontend lint for `ConferenceHistoryTab` is clean. Do not treat the repo-wide lint failure as a 16.2-04 regression.
