# Phase 8: User Setup Required

**Generated:** 2026-07-17
**Phase:** navigation-redesign-android-port-foundation
**Status:** Incomplete

Complete these items for FCM push registration on Android. Claude automated the client/server skeleton; Firebase project files require human access.

## Environment Variables

None required in `.env` for the Phase 8 FCM skeleton (token POST uses existing JWT).

## Account Setup

- [ ] **Create / reuse Firebase project** for Android app id `com.krasterisk.app` (or flavor applicationId)
  - URL: https://console.firebase.google.com/
  - Skip if: Project already exists for this app

## Dashboard Configuration

- [ ] **Download `google-services.json`**
  - Location: Firebase Console → Project settings → Your apps → Android app
  - Place file at: `packages/frontend/android/app/google-services.json`
  - Notes: File is **gitignored** — never commit. Rebuild after placing: `npm run build && npx cap sync android`

## Verification

After completing setup, verify with:

```bash
cd packages/frontend
npm run build && npx cap sync android
npx cap run android
```

Expected results:
- Login on device/emulator logs a Push `registration` event
- Authenticated `POST /api/marketplace/device-token` returns 2xx
- Softphone mic grant works in foreground (see `docs/ANDROID_WEBRTC_NOTES.md`)

---

**Once all items complete:** Mark status as "Complete" at top of file.
