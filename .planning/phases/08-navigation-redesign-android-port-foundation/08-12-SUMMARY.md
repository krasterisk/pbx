---
phase: 08-navigation-redesign-android-port-foundation
plan: 12
subsystem: auth
tags: [nyquist, auth-storage, command-palette, i18n, TokenStorage, NAV-04, NAV-10, NAV-14]

requires:
  - phase: 08-navigation-redesign-android-port-foundation
    provides: Wave 0a module contracts (08-01); authSlice localStorage key names
provides:
  - "TokenStorage interface + LocalStorageTokenStorage web adapter (D-33 prep)"
  - "createTokenStorage factory with mockable native null path (no Capacitor yet)"
  - "Pure filterPaletteItems helper + CommandPalette unit gate (NAV-04)"
  - "UI-SPEC shell locale seeds hub/marketplace/commandPalette/license in ru+en (NAV-14)"
affects:
  - 08-04 CommandPalette Dialog UI
  - 08-10 Capacitor Secure Storage switch in authSlice
  - Hub / Marketplace / ModuleShell copy consumers

tech-stack:
  added: []
  patterns:
    - "TokenStorage async get/set/remove; web wraps localStorage; native injectable/null until 08-10"
    - "CommandPalette filter is pure unit-tested helper before Dialog shell"
    - "Locale seeds under hub.* / marketplace.* / commandPalette.* / license.* (no em dash)"

key-files:
  created:
    - packages/frontend/src/features/auth/lib/tokenStorage.ts
    - packages/frontend/src/features/auth/lib/tokenStorage.test.ts
    - packages/frontend/src/shared/ui/CommandPalette/filterPaletteItems.ts
    - packages/frontend/src/shared/ui/CommandPalette/CommandPalette.test.tsx
  modified:
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts

key-decisions:
  - "Locale seeds written to shared/config/locales (actual path), not plan's i18n/locales typo"
  - "createTokenStorage({ isNative: true }) returns null until Secure Storage wired in 08-10"
  - "authSlice left unchanged — storage switch is plan 08-10"

patterns-established:
  - "features/auth/lib/tokenStorage.ts owns TokenStorage + TOKEN_STORAGE_KEYS matching authSlice"
  - "shared/ui/CommandPalette/filterPaletteItems.ts is the pure ⌘K filter seam"

requirements-completed: [NAV-04, NAV-10, NAV-14]

duration: 8min
completed: 2026-07-16
---

# Phase 8 Plan 12: Wave 0b Nyquist Frontend Stubs Summary

**TokenStorage web adapter with GREEN tests, pure filterPaletteItems for ⌘K, and UI-SPEC hub/marketplace/commandPalette/license locale seeds in ru+en**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-16T16:15:55Z
- **Completed:** 2026-07-16T16:23:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Landed `TokenStorage` interface + `LocalStorageTokenStorage` using authSlice keys (`accessToken`/`refreshToken`/`user`) with mockable native path (no Capacitor install)
- GREEN vitest coverage for token round-trip and `createTokenStorage` factory (5 tests)
- Pure `filterPaletteItems` helper with case-insensitive label/path match (4 tests); Dialog palette UI deferred to 08-04
- Seeded UI-SPEC Primary CTA / empty / error / pill copy under `hub` / `marketplace` / `commandPalette` / `license` in ru+en with no em dash in those values

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: TokenStorage interface + web adapter**
   - `ef9f80c` (test) — failing tokenStorage tests
   - `fd81e6d` (feat) — TokenStorage + LocalStorageTokenStorage GREEN
2. **Task 2: filterPaletteItems + locale seeds**
   - `e1f17d8` (test) — failing filterPaletteItems tests
   - `aadb72a` (feat) — filter helper + ru/en locale seeds GREEN

**Plan metadata:** `fc2c12d` (docs: complete plan)

## Files Created/Modified

- `packages/frontend/src/features/auth/lib/tokenStorage.ts` — TokenStorage interface, LocalStorageTokenStorage, createTokenStorage
- `packages/frontend/src/features/auth/lib/tokenStorage.test.ts` — NAV-10 unit gate
- `packages/frontend/src/shared/ui/CommandPalette/filterPaletteItems.ts` — pure ⌘K filter
- `packages/frontend/src/shared/ui/CommandPalette/CommandPalette.test.tsx` — NAV-04 filter unit gate
- `packages/frontend/src/shared/config/locales/ru.ts` — hub/marketplace/commandPalette/license seeds
- `packages/frontend/src/shared/config/locales/en.ts` — matching en seeds

## Decisions Made

- Used existing `shared/config/locales/{ru,en}.ts` (plan path `i18n/locales` does not exist)
- Native factory returns `null` without injected impl — keeps Capacitor out of Wave 0b
- Did not touch `authSlice` (explicitly deferred to 08-10)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Locale path corrected to existing config location**
- **Found during:** Task 2 (locale seeds)
- **Issue:** Plan listed `shared/config/i18n/locales/{ru,en}.ts`; repo uses `shared/config/locales/{ru,en}.ts`
- **Fix:** Seeded keys in the actual locale files imported by `shared/config/i18n.ts`
- **Files modified:** `packages/frontend/src/shared/config/locales/ru.ts`, `en.ts`
- **Verification:** Keys present; em-dash grep on new namespaces returned 0 matches
- **Committed in:** `aadb72a`

---

**Total deviations:** 1 auto-fixed (1 blocking path correction)
**Impact on plan:** Correct path required for i18n to load keys; no scope creep.

## Issues Encountered

None beyond the locale path correction above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-04 can import `filterPaletteItems` and locale keys for Dialog CommandPalette UI
- 08-10 can swap authSlice to `TokenStorage` / Secure Storage without inventing adapter surface
- Wave 0c (08-13) backend Nyquist stubs remain independent

## TDD Gate Compliance

- RED commits present: `ef9f80c`, `e1f17d8`
- GREEN commits present after each RED: `fd81e6d`, `aadb72a`

## Self-Check: PASSED

- All 6 key files FOUND on disk
- Commits `ef9f80c`, `fd81e6d`, `e1f17d8`, `aadb72a` FOUND in git log
- Vitest: tokenStorage 5/5 + CommandPalette 4/4 passed

---
*Phase: 08-navigation-redesign-android-port-foundation*
*Completed: 2026-07-16*
