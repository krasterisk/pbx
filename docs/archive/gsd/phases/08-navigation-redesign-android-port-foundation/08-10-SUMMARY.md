---
phase: 08-navigation-redesign-android-port-foundation
plan: 10
subsystem: infra
tags: [capacitor, android, secure-storage, NAV-10, NAV-11, D-30, D-33, D-34, D-35]

requires:
  - phase: 08-navigation-redesign-android-port-foundation
    provides: tokenStorage stub (08-12); ModuleShell chrome (08-03)
provides:
  - "Capacitor 8 android+ios scaffold (webDir=dist)"
  - "Secure Storage TokenStorage on native; localStorage on web"
  - "env URL flavors + offline banner in ModuleShell"
  - "Human-verified Gradle sync + assembleDebug (JDK 21)"
affects:
  - 08-11 FCM foundation + WebRTC notes + ARCHITECTURE/i18n

tech-stack:
  added:
    - "@capacitor/core / cli / android / ios (8.x)"
    - "@aparajita/capacitor-secure-storage"
    - "@capacitor/app preferences status-bar splash-screen keyboard"
  patterns:
    - "TokenStorage adapter: web localStorage vs native SecureStorage"
    - "resolveApiBaseUrl flavor + optional runtime override"
    - "OfflineBanner: navigator.onLine + retry only (no action queue)"

key-files:
  created:
    - packages/frontend/capacitor.config.ts
    - packages/frontend/android/
    - packages/frontend/ios/
    - packages/frontend/src/shared/lib/capacitor/isNative.ts
    - packages/frontend/src/shared/lib/capacitor/envUrls.ts
    - packages/frontend/src/shared/lib/capacitor/envUrls.test.ts
    - packages/frontend/src/shared/lib/capacitor/offlineBanner.ts
    - packages/frontend/src/shared/lib/capacitor/offlineBanner.test.ts
  modified:
    - packages/frontend/src/features/auth/lib/tokenStorage.ts
    - packages/frontend/src/features/auth/lib/tokenStorage.test.ts
    - packages/frontend/src/widgets/ModuleShell/ModuleShell.tsx
    - packages/frontend/android/gradlew.bat
    - packages/frontend/android/app/build.gradle
    - packages/frontend/android/gradle/wrapper/gradle-wrapper.properties

key-decisions:
  - "Human checkpoint: Android Studio + SDK; CLI assembleDebug with Studio JBR 21 acceptable"
  - "gradlew.bat: drop empty -classpath (breaks some JVMs)"
  - "proguard-android.txt → proguard-android-optimize.txt (AGP no longer supports non-optimize default)"
  - "networkTimeout raised to 120000 for Gradle distribution download"
  - "Use Android Studio JBR 21 (not system Java 16) for Gradle"

patterns-established:
  - "Native auth tokens only via Secure Storage; no token console logs"
  - "Cap sync after vite dist build: npm run build && npx cap sync android"

requirements-completed: [NAV-10, NAV-11]

duration: multi-session
completed: 2026-07-17
---

# Phase 8 Plan 10: Capacitor + Secure Storage + Android Checkpoint Summary

**Capacitor 8 scaffold with Secure Storage auth, URL flavors, offline banner, and human-approved Android Gradle build path**

## Performance

- **Duration:** multi-session (Tasks 1–2 earlier; Task 3 human env 2026-07-17)
- **Completed:** 2026-07-17
- **Tasks:** 3/3
- **Human checkpoint:** approved

## Accomplishments

- Capacitor 8 `android/` + `ios/` with `webDir=dist`
- Native `SecureStorageTokenStorage`; web localStorage unchanged
- `envUrls` flavor resolution + ModuleShell offline banner
- Human: Android Studio sync, `npm run build && npx cap sync android`, `assembleDebug` **BUILD SUCCESSFUL** (JDK 21 JBR)

## Task Commits

1. **Task 1: Capacitor scaffold** — prior session (feat)
2. **Task 2: TokenStorage + flavors + offline banner** — prior session (feat)
3. **Task 3: Android Studio checkpoint** — human `approved` 2026-07-17

## Human verification (Task 3)

| Step | Result |
|------|--------|
| Android Studio + SDK | Installed (Quail / Studio JBR 21) |
| `npm run build && npx cap sync android` | OK (after TS build fixes) |
| Gradle sync / `assembleDebug` | OK after: empty-classpath fix, ProGuard optimize file, JAVA_HOME=JBR 21 |
| Signal | **approved** |

## Self-Check: PASSED

- [x] NAV-10 / NAV-11 must_haves
- [x] android/ present; assembleDebug green
- [x] Human resume-signal received

## Next

`/gsd-execute-phase 8` → **08-11** (FCM foundation, WebRTC notes, ARCHITECTURE + i18n audit)
