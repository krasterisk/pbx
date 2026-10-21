---
phase: 05-phonebooks-ai-universal-directory-mechanisms-mcp-tools-and-c
plan: 03
subsystem: ui
tags: [react, react-hook-form, rtk-query, i18n, fsd, scss-modules]

# Dependency graph
requires:
  - phase: 05-05
    provides: route_phonebook_bindings CRUD (RoutesService), per-binding dialplan generation, POST /phonebooks/:uid/lookup-test
  - phase: 05-02
    provides: GET/PUT /ai-chat/settings (per-tenant confirmDestructive, default OFF)
provides:
  - RoutePhonebooksTab — ordered binding list UI in RouteFormModal (MOH playlist pattern), 7 behavior presets with on_no_match preset narrowing (D-24), custom preset -> DialplanAppsEditor (D-26)
  - PhonebookFormModal reduced to pure data (name/description/entries) with an inline demo lookup test (D-10)
  - AiChatSettingsCard — per-tenant AI destructive-op confirmation toggle inside SellerSettingsForm (D-20, D-25)
  - i18n (ru/en) for all new strings across the three tasks
affects: [05-04 (UAT of the bindings UI, lookup test, and AI Chat settings)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ordered-list-with-up/down-buttons pattern (from MohFormModal) reused for route<->phonebook bindings — no DnD library needed"
    - "Behavior preset UI keeps a var-key/fixed-value mode toggle per preset (set_name/set_number/redirect), collapsing to fixed-only fields when match_mode=on_no_match makes var-key presets unavailable"
    - "Card-based settings subsections (SellerSettingsForm + AiChatSettingsCard) each own their own RTK Query hooks and local isSaving/saved state, matching the existing SellerSettingsForm shape"

key-files:
  created:
    - packages/frontend/src/features/routes/ui/RouteFormModal/RoutePhonebooksTab.tsx
    - packages/frontend/src/features/routes/ui/RouteFormModal/RoutePhonebooksTab.module.scss
    - packages/frontend/src/features/routes/ui/RouteFormModal/RoutePhonebooksTab.test.tsx
    - packages/frontend/src/features/phonebooks/ui/PhonebookLookupTest/PhonebookLookupTest.tsx
    - packages/frontend/src/features/phonebooks/ui/PhonebookLookupTest/PhonebookLookupTest.module.scss
    - packages/frontend/src/features/phonebooks/ui/PhonebookLookupTest/index.ts
    - packages/frontend/src/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard.tsx
    - packages/frontend/src/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard.module.scss
    - packages/frontend/src/features/cloud-admin/ui/AiChatSettingsCard/index.ts
  modified:
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.tsx
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteGeneralTab.tsx
    - packages/frontend/src/features/phonebooks/ui/PhonebookFormModal/PhonebookFormModal.tsx
    - packages/frontend/src/features/phonebooks/ui/PhonebookFormModal/PhonebookFormModal.module.scss
    - packages/frontend/src/features/phonebooks/ui/PhonebooksTable/PhonebooksTable.tsx
    - packages/frontend/src/features/phonebooks/ui/PhonebooksTable/PhonebooksTable.module.scss
    - packages/frontend/src/features/phonebooks/index.ts
    - packages/frontend/src/features/cloud-admin/ui/SellerSettingsForm/SellerSettingsForm.tsx
    - packages/frontend/src/shared/api/endpoints/routeApi.ts
    - packages/frontend/src/shared/api/endpoints/phonebookApi.ts
    - packages/frontend/src/shared/api/endpoints/aiChatApi.ts
    - packages/frontend/src/shared/api/rtkApi.ts
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts
    - packages/backend/src/modules/phonebooks/phonebook-dialplan.util.ts
    - packages/backend/src/modules/phonebooks/phonebooks.service.spec.ts
  deleted:
    - packages/frontend/src/features/phonebooks/ui/PhonebookSelect/PhonebookSelect.tsx
    - packages/frontend/src/features/phonebooks/ui/PhonebookSelect/index.ts

key-decisions:
  - "Locale files (ru.ts/en.ts) collect i18n keys from all three tasks into one final commit under Task 3, matching Task 3's plan action item 3 ('финальная проверка фазы по i18n')"
  - "PhonebooksTable's Режим/Действия columns removed along with pb.invert/pb.actions, since those fields no longer exist on IRoutePhonebook after 05-05 (D-04) — required to keep the table compiling and consistent with 'phonebook = data only'"

requirements-completed: [D-08, D-09, D-10, D-20, D-24, D-25, D-26]

# Metrics
duration: ~2h (continuation session; picked up mid Task 2 from a prior session)
completed: 2026-07-14
---

# Phase 05 Plan 03: Phonebooks Bindings UI, Lookup Test, AI Chat Settings Summary

**RouteFormModal gained a «Справочники» tab with an ordered, MOH-style binding list (7 behavior presets, on_no_match preset narrowing, custom preset opening DialplanAppsEditor); PhonebookFormModal was reduced to pure data with an inline lookup demo test; SellerSettingsForm gained a per-tenant AI Chat destructive-op confirmation toggle; all new strings localized in ru/en.**

## Performance

- **Tasks:** 3/3 completed
- **Files created:** 9
- **Files modified:** 16 (2 in `packages/backend`)
- **Files deleted:** 2
- **Completed:** 2026-07-14

## Accomplishments

- **Task 1 (D-08, D-24, D-26):** New `RoutePhonebooksTab` renders an ordered list of route↔phonebook bindings — each row shows the phonebook name, a `match_mode` select (`on_match`/`on_no_match`), a `behavior_type` select (7 presets), and up to 2 conditional param fields (var-key vs. fixed-value toggle for `set_name`/`set_number`/`redirect`); `custom` reveals the existing `DialplanAppsEditor` reusing `IRouteAction[]`. Reorder/remove use plain up/down/trash buttons (MOH playlist pattern, no DnD dependency, satisfying the plan's threat register T-05-SC). Selecting `whitelist` forces `match_mode=on_no_match`; switching to `on_no_match` narrows the preset select to `blacklist`/`whitelist`/`redirect`/`set_name`/`custom` (drops `vars_only`/`set_number`, and both `set_name`/`redirect` collapse to their fixed-value variant per D-24). `RouteFormModal` replaced its old `phonebookUids` state with a `bindings: IRoutePhonebookBinding[]` array (initialized from `route.bindings`, re-indexed by array position on save) and removed `PhonebookSelect` from `RouteGeneralTab` entirely.
- **Task 2 (D-04-UI, D-10):** `PhonebookFormModal` no longer has `invert`/`actions` state or UI — a phonebook is now strictly name + description + entries (number/comment/vars). New `PhonebookLookupTest` renders inline for an already-saved phonebook: a number input + "Проверить" button calls the `lookupTestPhonebook` mutation (`POST /phonebooks/:uid/lookup-test`, 05-05) and shows a matched/no-match badge plus a `PB_*` variables table on success, or an inline error message on failure. The now-unused `PhonebookSelect` component was deleted (superseded by Task 1's bindings), and `PhonebooksTable`'s Режим/Действия columns were removed along with it since `pb.invert`/`pb.actions` no longer exist on `IRoutePhonebook`.
- **Task 3 (D-20, D-25):** New `AiChatSettingsCard`, rendered as a second `Card` inside `SellerSettingsForm`, with a `Checkbox`-based toggle (no `Switch` component exists in `@/shared/ui`) for "Подтверждать деструктивные операции AI", backed by `useGetAiChatSettingsQuery`/`useUpdateAiChatSettingsMutation` against the existing `GET`/`PUT /ai-chat/settings` endpoints from 05-02. All i18n strings from Tasks 1-3 (`routes.phonebooks.*`, `phonebooks.lookupTest.*`, `cloudAdmin.settings.aiChat.*`) were added to both `ru.ts` and `en.ts` in this task's commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Вкладка «Справочники» в RouteFormModal (D-08, D-24, D-26)** - `768fce9` (feat)
2. **Task 2: Чистка PhonebookFormModal + демо-тест lookup (D-04-UI, D-10)** - `0ca60b8` (feat)
3. **Task 3: Подраздел «AI Chat» в SellerSettingsForm + i18n-полировка (D-20, D-25)** - `43ac53b` (feat)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `RoutePhonebooksTab.tsx`/`.module.scss`/`.test.tsx` - Ordered binding list tab, 5 vitest cases (render/reorder/remove, add, custom reveal, redirect params, on_no_match preset narrowing)
- `RouteFormModal.tsx`/`RouteGeneralTab.tsx` - `bindings` state replaces `phonebookUids`; `PhonebookSelect` removed from the general tab
- `PhonebookFormModal.tsx`/`.module.scss` - Removed invert/actions; renders `PhonebookLookupTest` for saved phonebooks
- `PhonebookLookupTest.tsx`/`.module.scss`/`index.ts` - Demo lookup test (matched badge + PB_* vars table)
- `PhonebooksTable.tsx`/`.module.scss` - Dropped invert/actions columns (fields removed from the model in 05-05)
- `AiChatSettingsCard.tsx`/`.module.scss`/`index.ts` - Per-tenant AI confirmation toggle card
- `SellerSettingsForm.tsx` - Renders `AiChatSettingsCard` below the seller info card
- `routeApi.ts`/`phonebookApi.ts`/`aiChatApi.ts`/`rtkApi.ts` - `bindings` pass-through, `lookupTestPhonebook` mutation, `getAiChatSettings`/`updateAiChatSettings` + new `AiChatSettings` tag
- `ru.ts`/`en.ts` - New `routes.phonebooks.*`, `phonebooks.lookupTest.*`, `cloudAdmin.settings.aiChat.*` namespaces
- `phonebook-dialplan.util.ts`/`phonebooks.service.spec.ts` (backend) - `set_name` fixed-value variant (see Deviations)

## Decisions Made

See `key-decisions` in frontmatter. In short: locale-file edits from all three tasks were committed together under Task 3 (its own action item calls for a final i18n pass), and the `PhonebooksTable` invert/actions columns had to go because the underlying model fields were already removed by 05-05.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `set_name` behavior had no fixed-value variant**
- **Found during:** Task 1 (building the on_no_match preset param UI)
- **Issue:** The plan's `on_no_match` UX requires a fixed-value `set_name` option ("фиксированное имя"), but `phonebook-dialplan.util.ts` only implemented `set_name` via `var_key` — there was no dialplan path for a fixed caller name, unlike `set_number` which already had one.
- **Fix:** Added an `if (params.fixed)` branch to the `set_name` case in `generateBehaviorLines`, emitting `Set(CALLERID(name)=<fixed>)`, mirroring the existing `set_number` fixed-value handling.
- **Files modified:** `packages/backend/src/modules/phonebooks/phonebook-dialplan.util.ts`, `packages/backend/src/modules/phonebooks/phonebooks.service.spec.ts`
- **Verification:** New spec case asserts the generated dialplan contains `Set(CALLERID(name)=Unknown)`; full backend suite green (238/238).
- **Committed in:** `768fce9` (Task 1 commit)

**2. [Rule 1 - Bug] `PhonebooksTable` referenced removed model fields**
- **Found during:** Task 2 (cleanup pass, grepping for `invert` under `features/phonebooks`)
- **Issue:** `PhonebooksTable.tsx` still read `pb.invert` and `pb.actions` for a "Режим"/"Действия" column, but `IRoutePhonebook` no longer has either field (removed by the 05-05 backend plan per D-04) — this was a live type/runtime bug, not just a missed cleanup.
- **Fix:** Removed both columns and their cells; kept the "Номера" (entries count) column. Removed the now-dead `badgeInvert`/`badgeNormal` SCSS classes. Also removed stale `invert`/`actions` fields from two test mock fixtures (`phonebooksSlice.test.ts`, `phonebooksSelectors.test.ts`) that used `as any` and so weren't caught by the type checker.
- **Files modified:** `packages/frontend/src/features/phonebooks/ui/PhonebooksTable/PhonebooksTable.tsx`, `PhonebooksTable.module.scss`, `phonebooksSlice.test.ts`, `phonebooksSelectors.test.ts`
- **Verification:** `npm run test:frontend` green for this suite; `npm run lint` 0 errors.
- **Committed in:** `0ca60b8` (Task 2 commit)

**3. [Rule 1 - Bug] `RoutePhonebooksTab.test.tsx` had two ambiguous `getByText` queries**
- **Found during:** Task 1 verification (`npm run test:frontend`)
- **Issue:** The phonebook add-row `<select>` always renders an `<option>` per phonebook (e.g. "VIP", "Blacklist"), so `screen.getByText('VIP')`/`getByText('Blacklist')` threw `TestingLibraryElementError: Found multiple elements` once a binding row with the same name was also on screen.
- **Fix:** Scoped the "render/reorder/remove" test to filter matched elements by `el.tagName !== 'OPTION'`; changed the "add binding" test to assert on the delete-button count and the new row's default `behavior_type` (`vars_only`) instead of matching on the phonebook's display name.
- **Files modified:** `packages/frontend/src/features/routes/ui/RouteFormModal/RoutePhonebooksTab.test.tsx`
- **Verification:** All 5 cases in the file pass in isolation and as part of the full suite.
- **Committed in:** `768fce9` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 bug, 1 test-bug — all Rule 1)
**Impact on plan:** All three were necessary for correctness (dialplan behavior, type/runtime safety, passing tests). No scope creep beyond what the plan's own `on_no_match`/`D-04-UI` requirements implied.

## Issues Encountered

- `npm run test:frontend` has 7 pre-existing failures across 3 files unrelated to this plan: `dialplanVpbxUserUid.test.ts` (a `uid=0` falsy-check bug in `@krasterisk/shared`'s `ensureCdrVpbxUserUidInDialplan`), and `SttEnginesTable.test.tsx`/`TtsEnginesTable.test.tsx` (an i18n mock returning `{count, defaultValue}` objects instead of strings into React children). Confirmed pre-existing by running each in isolation against `git stash` (clean tree) — same failures reproduce with none of this plan's changes applied. Logged here per the Scope Boundary rule; not fixed.
- Windows PowerShell does not support `&&` chaining or `<<EOF` heredocs — commands were run with the `working_directory` parameter and commit messages were written to temp files (`git commit -F`) instead.

## User Setup Required

None. No new environment variables, migrations, or external service configuration — this plan is frontend-only aside from the small backend dialplan deviation, which reuses existing config/migrations from 05-05.

## Next Phase Readiness

- `npm run test:frontend` — 121/128 pass (7 pre-existing, unrelated failures — see Issues Encountered); all tests in files touched by this plan are green.
- `npm run test:backend` — 238/238 pass, no regressions.
- `npm run lint` — 0 errors, 82 pre-existing warnings unrelated to this plan.
- Plan 05-04 (UAT) can now exercise: adding/reordering/removing phonebook bindings on a route with each behavior preset, the on_no_match preset narrowing, the custom preset's DialplanAppsEditor, the phonebook lookup demo test, and the AI Chat confirmation toggle end-to-end.

---
*Phase: 05-phonebooks-ai-universal-directory-mechanisms-mcp-tools-and-c*
*Completed: 2026-07-14*

## Self-Check: PASSED

All 9 created files verified present on disk (`RoutePhonebooksTab.tsx/.module.scss/.test.tsx`, `PhonebookLookupTest.tsx/.module.scss/index.ts`, `AiChatSettingsCard.tsx/.module.scss/index.ts`). Both deleted files (`PhonebookSelect.tsx`, `PhonebookSelect/index.ts`) verified absent from disk and staged as deletions. All 3 task commit hashes (`768fce9`, `0ca60b8`, `43ac53b`) verified present in `git log`. `npm run test:frontend` — 121/128 passed (7 pre-existing unrelated failures). `npm run test:backend` — 238/238 passed. `npm run lint` — 0 errors, 82 pre-existing warnings.
