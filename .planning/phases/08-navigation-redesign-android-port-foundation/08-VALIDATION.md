---
phase: 8
slug: navigation-redesign-android-port-foundation
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-16
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `08-RESEARCH.md` § Validation Architecture. Tracking unit = derived NAV-* IDs / CONTEXT D-XX (REQUIREMENTS.md has no Phase 8 REQ-IDs).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | Jest (existing — `packages/backend`) |
| **Framework (frontend)** | Vitest (existing — `packages/frontend/package.json` / `vite.config.ts` test block) |
| **Config file** | existing — do not recreate |
| **Quick run command** | Targeted: `npm run test:frontend -- src/features/modules src/widgets/ModuleHub src/widgets/ModuleShell src/shared/lib/capacitor` (paths appear as waves land) + `npx jest --testPathPattern="cloud-admin|modules-registry|role-start|device-token" -w @krasterisk/backend` |
| **Full suite command** | `npm run lint && npm run test:backend && npm run test:frontend` (AGENTS.md verify protocol) |
| **Estimated runtime** | quick &lt;30s once scoped; full calibrate at Wave 0 |

---

## Sampling Rate

- **After every task commit:** Run the smallest automated command covering the touched NAV-* / D-XX row
- **After every plan wave:** Full lint + backend + frontend suites
- **Before `/gsd-verify-work`:** Full suite green + manual Android checklist for NAV-13
- **Max feedback latency:** quick run must stay under ~30s

---

## Per-Task Verification Map

| Decision / Req | Wave | Behavior | Test Type | Automated Command / File | File Exists | Status |
|-----------------|------|----------|-----------|--------------------------|-------------|--------|
| NAV-01 / D-01–D-03 | 0–2 | Module registry maps Hub modules → pages; level filter | unit | `moduleRegistry.test.ts` | ❌ W0 | ⬜ pending |
| NAV-02 / D-07–D-08 | 2 | Hub splits `active` / `disabled` / `locked`; favorites sort | unit | Hub license helpers + list component test | ❌ W0 | ⬜ pending |
| NAV-03 / D-06 D-10 | 2 | Logo → Hub; breadcrumbs; full-height sidebar + footer modules/collapse | unit | ModuleShell test (RTL) | ✅ | ⬜ pending |
| NAV-04 / D-06 | 3 | ⌘K filters modules + current-module pages; empty copy | unit | CommandPalette test | ❌ W0 | ⬜ pending |
| NAV-05 / D-04 D-16 D-17 | 1+7 | Role→start defaults; CC-off fallback; locked deep-link fallback | unit | `roleStartResolver` jest+vitest | ❌ W0 | ⬜ pending |
| NAV-06 / D-21 D-22 | 4 | SuperAdminGuard + platform routes; tenant cannot edit membership | unit | guard + controller specs | ❌ W0 | ⬜ pending |
| NAV-07 / D-23 | 5 | Purchase: insufficient balance fails; success charges + activates | unit | `purchase-module.service.spec.ts` | ✅ 08-06 | ✅ passed |
| NAV-08 / D-24–D-26 | 6 | Bottom bar 5 items; chip opens Sheet on mobile breakpoint | unit | MobileBottomBar + useIsMobile tests | ❌ | ⬜ pending |
| NAV-09 / D-27–D-29 | 8 | Critical tables card/h-scroll; CC agent sticky softphone layout smoke | unit + manual | page SCSS/RTL smoke + manual 360px | ❌ | ⬜ pending |
| NAV-10 / D-33 | 9 | Token storage: web localStorage; native Secure Storage mock | unit | `tokenStorage.test.ts` | ❌ W0 | ⬜ pending |
| NAV-11 / D-34 | 9 | Flavor config resolves API base URL | unit | env/config helper test | ❌ | ⬜ pending |
| NAV-12 / D-32 | 10 | Device token register DTO + auth required | unit | device-token controller spec | ❌ W0 | ⬜ pending |
| NAV-13 / D-31 D-36 | 10 | WebRTC getUserMedia + sip register on Android WebView | manual | Emulator/device checklist | N/A | ⬜ pending |
| NAV-14 / D-38 | all | New UI strings in `ru.ts` + `en.ts`; no em dash | unit/grep | locale key presence test | ❌ W0 | ⬜ pending |
| NAV-15 / D-18 D-40 D-41 | 2–3 | Wallboard outside layout; AiChat mounted; `/operator` redirect | unit | router config test / grep | ❌ | ⬜ pending |
| NAV-16 / D-20 | 7 | Roles editor grants Hub modules; Users links role/numbers | unit | roles feature tests extend | ⚠️ partial | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/frontend/src/features/modules/lib/moduleRegistry.test.ts` — NAV-01/02
- [ ] `packages/frontend/src/features/modules/lib/roleStartResolver.test.ts` — NAV-05
- [ ] `packages/frontend/src/features/auth/lib/tokenStorage.test.ts` — NAV-10
- [ ] `packages/frontend/src/shared/ui/CommandPalette/CommandPalette.test.tsx` (or widgets path) — NAV-04
- [ ] `packages/backend/src/modules/cloud-admin/purchase-module.service.spec.ts` (or equivalent) — NAV-07
- [ ] `packages/backend/src/modules/auth/superadmin.guard.spec.ts` (extend/create) — NAV-06
- [ ] Device-token controller/service spec — NAV-12
- [ ] Locale key smoke for shell copy keys from UI-SPEC — NAV-14
- [ ] Framework install: NOT required (Jest/Vitest already configured)
- [ ] Optional: root script `test:nav` once paths stabilize

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| Android WebView mic + sip.js register/answer | D-31/D-36 | Needs Android Studio/emulator + Asterisk WSS | Install Studio/SDK; `npx cap run android`; grant mic; shift-login browser softphone; place/answer call; confirm foreground-only note |
| FCM register returns token on device | D-32 | Needs `google-services.json` + real Firebase | Place flavor JSON; build; confirm `registration` event; POST hits backend stub |
| Hub/shell visual vs sketch winners | D-11 / UI-SPEC | Visual contract | Desktop: Hub list E, tabs B; phone: bottom bar B; platform chrome distinct |
| prefers-reduced-motion | D-09 | OS setting | Enable reduced motion; Hub stagger skipped |
| Tablet ≥768 desktop shell | D-24 / UI-SPEC | Device/viewport | Resize 768–1024: no phone bottom bar |

---

## Validation Sign-Off

- [x] All major NAV/D decisions have automated verify or Wave 0 / manual justification
- [x] Sampling continuity: no 3 consecutive implementation tasks without automated verify planned
- [x] Wave 0 covers MISSING registry/billing/auth/push specs
- [x] No watch-mode flags (single-run vitest/jest)
- [x] Feedback latency target &lt; 30s for quick scoped run
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending plan-phase validation gate (`wave_0_complete` flips true once Wave 0 stubs land in execution)
