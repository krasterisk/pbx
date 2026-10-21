# Deferred items (16-05…16-07)

- Pre-existing `npm run lint` errors in `packages/backend/src/modules/ai-platform/read-adapters-operations.spec.ts` and `read-adapters-speech.spec.ts` (`preserve-caught-error`). Out of scope for conference plans. Conference-module eslint is clean (`eslint src/modules/conferences/**/*.ts --max-warnings 0`).
- Pre-existing `npm run test:backend` failures (15 suites / 36 tests) in ai-platform, ai-chat, call-groups, ivrs, queues, endpoints, moh, directories, trunks — all outside `src/modules/conferences`. Conference suites `conference-participant|conference-state|conference-stale-channel|conference-spine` are green (60/60).
- Pre-existing `npm run test:frontend` failures in `packages/frontend/src/features/directories/model/directories.locales.test.ts` (3 tests: `fieldLabel` copy and missing `directories.csv.*` keys). Dirty locale WIP; not touched by 16-07. 205/206 files and 1135/1138 tests passed.
