# Android WebRTC / softphone notes (Phase 8 / NAV-13)

Baseline for Call Center softphone inside the Capacitor Android WebView.
Decisions: **D-31** (softphone validation depth), **D-36** (foreground-only), BrowserRouter **A1**.

## Phase 8 baseline: foreground-only (D-36)

- Softphone audio is supported **only while the app is in the foreground**.
- Minimizing / backgrounding the app may pause or drop WebRTC media; that is expected for Phase 8.
- Do **not** assume held calls continue reliably in background without a native Telecom / foreground-service path.
- **Android Telecom / ConnectionService** and a persistent call foreground-service notification are **deferred** past Phase 8.

## Required Android permissions

Declared in `android/app/src/main/AndroidManifest.xml`:

| Permission | Why |
|------------|-----|
| `RECORD_AUDIO` | `getUserMedia` / SIP.js microphone capture |
| `MODIFY_AUDIO_SETTINGS` | WebView audio route / focus (Capacitor issues #6967, #802) |
| `INTERNET` | WSS / API (already present) |

**Runtime:** request microphone permission **before** creating the SIP.js `UserAgent` / calling `getUserMedia`. Do not register the softphone until the OS permission is granted.

## Softphone stack (unchanged from Phase 7)

- SIP.js `0.21.2` over WSS; ICE/TURN from `GET /callcenter/webrtc/config` only.
- Agent UI lives under ModuleShell when opened from Hub (`callcenter` module code).

## BrowserRouter (A1)

- Production uses `BrowserRouter` under Capacitor `https://localhost` (or flavor host).
- HashRouter is **not** required for Phase 8 smoke if `cap sync` + Android WebView load `dist` correctly.
- If deep links 404 on a custom WebView host, prefer server rewrite / Capacitor `server` config before switching to HashRouter.

## FCM / `google-services.json` (NAV-12 / D-32 companion)

Push registration uses `@capacitor/push-notifications@8.1.x`.

1. Create a Firebase Android app for `com.krasterisk.app` (or flavor applicationId).
2. Download `google-services.json` and place it under `packages/frontend/android/app/`.
3. **Never commit** `google-services.json` (gitignored in `packages/frontend/.gitignore` and `android/.gitignore`).
4. Rebuild: `npm run build && npx cap sync android`, then assemble/run on device/emulator.
5. Without this file the Google Services Gradle plugin is skipped and push registration will fail on device (Pitfall 5).

## Manual smoke checklist (NAV-13)

See `08-VALIDATION.md` Manual-Only and plan `08-11` Task 3:

1. Place flavor `google-services.json`; rebuild.
2. `npx cap run android`; login; confirm push `registration` log + `POST /marketplace/device-token` 2xx.
3. Grant mic; Call Center agent softphone register/answer in foreground; confirm audio.
4. Background/minimize: confirm documented foreground-only limitation (no crash required).

## Out of scope

- Full ConnectionService / Telecom integration
- Background ringing UI campaigns
- Offline SSE/WebRTC action queues (D-35: banner + retry only)
