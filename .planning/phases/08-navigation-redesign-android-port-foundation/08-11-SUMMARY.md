---
phase: 08-navigation-redesign-android-port-foundation
plan: 11
subsystem: infra
tags: [fcm, webrtc, architecture, i18n, NAV-12, NAV-13, NAV-14, D-32, D-36, D-39]
status: partial
checkpoint: human-verify
checkpoint_task: 3

requires:
  - phase: 08-navigation-redesign-android-port-foundation
    provides: Capacitor android scaffold + Secure Storage (08-10); device-token Wave 0 stub (08-13)
provides:
  - "FCM registerPush + POST /marketplace/device-token upsert (Tasks 1–2)"
  - "ANDROID_WEBRTC_NOTES foreground-only baseline"
  - "ARCHITECTURE Module Hub / Capacitor section"
  - "Awaiting human Android device smoke (Task 3)"
affects:
  - phase-8 verify / UAT
  - production FCM ops (google-services.json)

tech-stack:
  added:
    - "@capacitor/push-notifications@8.1.2"
  patterns:
    - "registerPush after native login; no-op on web"
    - "device_tokens upsert on (user_uid, tenant_id); never log token value"

key-files:
  created:
    - packages/frontend/src/shared/lib/capacitor/push.ts
    - packages/frontend/src/shared/lib/capacitor/push.test.ts
    - packages/backend/src/modules/cloud-admin/device-token.service.ts
    - packages/backend/src/modules/cloud-admin/models/device-token.model.ts
    - packages/frontend/docs/ANDROID_WEBRTC_NOTES.md
    - .planning/phases/08-navigation-redesign-android-port-foundation/08-USER-SETUP.md
  modified:
    - packages/backend/src/modules/cloud-admin/device-token.controller.ts
    - packages/backend/src/modules/cloud-admin/device-token.controller.spec.ts
    - packages/backend/src/modules/cloud-admin/cloud-admin.module.ts
    - packages/backend/src/modules/cloud-admin/migrate-hub-modules-phase8.ts
    - packages/frontend/src/features/auth/model/authSlice.ts
    - packages/frontend/android/app/src/main/AndroidManifest.xml
    - packages/frontend/.idea/ARCHITECTURE.md
    - packages/frontend/package.json

key-decisions:
  - "POST path marketplace/device-token (JWT); upsert user_uid+tenant_id"
  - "JWT identity via sub (uniqueid fallback) — Wave 0 stub used uniqueid incorrectly"
  - "Foreground-only WebRTC baseline documented; Telecom deferred"
  - "ARCHITECTURE force-tracked despite .idea gitignore for D-39"

patterns-established:
  - "Push: requestPermissions → register → listener POSTs token"
  - "FCM secrets: google-services.json gitignored + USER-SETUP"

requirements-completed: []  # NAV-12/14 code done; NAV-13 blocked on human Task 3

duration: ~12min
completed: null
partial_as_of: 2026-07-17
---

# Phase 8 Plan 11: FCM + WebRTC notes + ARCHITECTURE/i18n — PARTIAL Summary

**FCM client/server skeleton and WebRTC/ARCHITECTURE/i18n docs shipped; Android device smoke awaits human approval**

## Status

**PARTIAL** — Tasks 1–2 complete and committed. **Task 3** (`checkpoint:human-verify`) waiting for human `approved` or failure report.

## Performance

- **Duration so far:** ~12 min (Tasks 1–2)
- **Started:** 2026-07-17T10:26:55Z
- **Tasks:** 2/3 automated complete; 1/3 human checkpoint pending
- **Files modified (Tasks 1–2):** ~14

## Accomplishments (Tasks 1–2)

- `@capacitor/push-notifications@8.1.2`; `registerPush` after native login; web no-op
- Backend `POST /marketplace/device-token` with JwtAuthGuard, body validation, upsert `device_tokens`
- `ANDROID_WEBRTC_NOTES.md` foreground-only (D-36) + mic permissions + google-services ops note
- AndroidManifest: `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS`
- ARCHITECTURE.md: Module Hub / ModuleShell / platform / Capacitor (D-39)
- Locale audit: `hub` / `marketplace` / `commandPalette` / `license` already match UI-SPEC; no em dash `—`

## Task Commits

1. **Task 1 RED:** `7e9a81c` — test(08-11): failing device-token + push tests
2. **Task 1 GREEN:** `3d7aebe` — feat(08-11): FCM push + device-token API
3. **Task 2:** `e165307` — docs(08-11): WebRTC notes + manifest audio perms
4. **Task 2 (ARCHITECTURE):** `17771f8` — docs(08-11): ARCHITECTURE Module Hub / Capacitor

## Automated verification

| Check | Result |
|-------|--------|
| `jest --testPathPattern=device-token` | PASS (5) |
| `vitest run src/shared/lib/capacitor` | PASS (9) |
| `vitest run src/features/modules src/shared/ui/CommandPalette` | PASS (38) |
| `google-services.json` gitignored | PASS |
| Device smoke (NAV-13) | **PENDING human** |

## Decisions Made

- Endpoint `POST /marketplace/device-token` (plan allowed marketplace or /users/me)
- Bind JWT `sub` (+ uniqueid fallback); tenant from `tenant_id` or `vpbx_user_uid` → tenants.id
- Token max length 4096; never log token string
- Force-add `packages/frontend/.idea/ARCHITECTURE.md` (normally gitignored under `.idea/`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wave 0 stub checked `req.user.uniqueid` but JWT payload uses `sub`**
- **Found during:** Task 1
- **Issue:** Authenticated requests with real JWT would 401
- **Fix:** Resolve `userUid` from `sub ?? uniqueid`
- **Files modified:** `device-token.controller.ts`
- **Committed in:** `3d7aebe`

**2. [Rule 3 - Blocking] Vitest mock hoisting for PushNotifications**
- **Found during:** Task 1 GREEN
- **Issue:** `vi.mock` referenced unbound vars
- **Fix:** `vi.hoisted()` in `push.test.ts`
- **Committed in:** `3d7aebe`

**3. [Rule 3 - Blocking] ARCHITECTURE.md gitignored via `.idea/`**
- **Found during:** Task 2 commit
- **Fix:** `git add -f packages/frontend/.idea/ARCHITECTURE.md`
- **Committed in:** `17771f8`

---

**Total deviations:** 3 auto-fixed  
**Impact on plan:** Required for correct JWT bind and tracked ARCHITECTURE update; no scope creep.

## Issues Encountered

None beyond deviations above.

## User Setup Required

**External Firebase config required for device FCM.** See [08-USER-SETUP.md](./08-USER-SETUP.md).

## Checkpoint — Task 3 (human)

**Blocked on:** Android emulator/device smoke (NAV-13). Do not fake results.

### How to verify

1. Place flavor `google-services.json` (gitignored); rebuild.
2. `npx cap run android` on emulator/device; login; confirm push registration event fires (log) and `POST` device-token 2xx.
3. Grant mic; Call Center agent softphone register/answer in foreground; confirm audio.
4. Background/minimize: confirm documented foreground-only limitation (no crash required).
5. Reply **`approved`** or list failures.

### Resume signal

Type `approved` or describe device failures.

## Next Phase Readiness

- Code for NAV-12 / NAV-14 ready
- NAV-13 and full plan SUMMARY close-out after human Task 3
- Then `/gsd-verify-work 8`

## Self-Check: PARTIAL

- [x] Task 1 commits + files present
- [x] Task 2 commits + `ANDROID_WEBRTC_NOTES.md` present
- [ ] Task 3 human smoke — **waiting**
- [ ] requirements-completed NAV-12/13/14 — deferred until Task 3

---
*Phase: 08-navigation-redesign-android-port-foundation*
*Partial: 2026-07-17*
