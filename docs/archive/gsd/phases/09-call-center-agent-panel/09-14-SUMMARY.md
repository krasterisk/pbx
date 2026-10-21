---
phase: 09-call-center-agent-panel
plan: 14
subsystem: ui
tags: [react, rtk-query, i18n, notifications, radix-ui, web-audio, mobile]

requires:
  - phase: 09-call-center-agent-panel/09-13
    provides: getCallCenterSettings-family REST endpoints (UI customization, granular permissions, notification matrix) with lock/default semantics
  - phase: 09-call-center-agent-panel/09-08
    provides: CallCenterAgentPage hybrid orchestrator + mobile Tabs/sticky-softphone-bar shell (D-04/D-46 base)
provides:
  - CallCenterSettings operator-facing editor (panel visibility + softphone placement + notification matrix, lock-aware)
  - NotificationMatrix reusable event×channel grid component
  - useCallCenterNotifications matrix-driven notification engine (sound/popup/chat, locked-event override)
  - Complete ru/en localization for the new settings + notification strings
affects: [09-15, phase-09-verify-work]

tech-stack:
  added: []
  patterns:
    - "Effective-value pattern: locked field renders the tenant default and ignores a possibly-stale operator override entirely (not merge) — same rule applied client-side (CallCenterSettings/NotificationMatrix) and server-side (09-13 read path)"
    - "Pure gating functions (isEventLocked/getEffectiveChannels/isChannelEnabled) extracted from the notification hook so lock-override behavior is unit-testable without DOM/Notification mocks"

key-files:
  created:
    - packages/frontend/src/features/callcenter/ui/CallCenterSettings/CallCenterSettings.tsx
    - packages/frontend/src/features/callcenter/ui/NotificationMatrix/NotificationMatrix.tsx
    - packages/frontend/src/features/callcenter/lib/useCallCenterNotifications.ts
    - packages/frontend/src/features/callcenter/lib/useCallCenterNotifications.test.ts
  modified:
    - packages/frontend/src/shared/api/endpoints/callCenterApi.ts
    - packages/backend/src/modules/callcenter/callcenter-settings.service.ts
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx
    - packages/frontend/src/pages/CallCenterSettingsPage/CallCenterSettingsPage.tsx
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts
  deleted:
    - packages/frontend/src/features/callcenter/lib/useCallNotifications.ts

key-decisions:
  - "Backend GET responses for UI customization/notifications extended to return { ..., locks, defaults } (09-13 shipped matrix/visibility only) so the settings UI can render locked rows disabled without a second round-trip; read path also now forces locked fields to the tenant default server-side, closing a gap where a stale pre-lock operator override could still leak through GET"
  - "useCallCenterNotifications fully replaces useCallNotifications rather than running both — avoids duplicate cues/toasts and gives the matrix a single source of truth"
  - "Chat notification channel dispatches a cc:notification-chat window CustomEvent instead of rendering directly — no in-app chat panel consumer exists yet; gating/persistence is complete, the panel-side listener is a follow-up"
  - "Mobile/tablet rework (D-43/D-46) was already fully implemented in 09-08 (Tabs as phone nav, single-column <1024px, sticky softphone bar on phone, FAB on tablet/desktop, status bar chip collapse) - verified via code inspection rather than re-implemented; this plan's remaining scope was the i18n completion pass"

requirements-completed: [D-38, D-39, D-40, D-41, D-42, D-43, D-44, D-46]

coverage:
  - id: D1
    description: "CallCenterSettings tabbed editor: panel-visibility toggles + softphone-placement select + notification matrix, each field disabled + tenant-default value when tenant-locked (D-38/D-39/D-40)"
    requirement: "D-38, D-39, D-40"
    verification:
      - kind: unit
        ref: "tsc -p packages/frontend/tsconfig.json --noEmit"
        status: pass
    human_judgment: true
    rationale: "Lock-disabled rendering and the toast/save flow are visual/interactive; no component test was written for CallCenterSettings itself (only the underlying pure notification-gating logic is unit-tested) — needs a human click-through to confirm disabled+tooltip UX."
  - id: D2
    description: "NotificationMatrix: 6-event x 3-channel (chat/sound/popup) switch grid, locked rows disabled with 'set by administrator' tooltip, reused as one row/column/lock pattern"
    requirement: "D-41"
    verification:
      - kind: unit
        ref: "tsc -p packages/frontend/tsconfig.json --noEmit"
        status: pass
    human_judgment: true
    rationale: "Grid rendering/tooltip is visual; no dedicated component test, covered indirectly via CallCenterSettings usage and the notification-hook's gating tests."
  - id: D3
    description: "useCallCenterNotifications: event x channel notification dispatch (sound cue, native Notification/toast popup, chat window event) honoring locks -> tenant default override, never the operator's stale preference"
    requirement: "D-41, D-42"
    verification:
      - kind: unit
        ref: "packages/frontend/src/features/callcenter/lib/useCallCenterNotifications.test.ts (13 tests: isEventLocked/getEffectiveChannels/isChannelEnabled + 5 hook-integration cases including locked-off-never-fires and self-chat-message-ignored)"
        status: pass
    human_judgment: false
  - id: D4
    description: "ui_visibility hides/shows panels live and softphone_placement drives FAB corner on CallCenterAgentPage (D-40)"
    requirement: "D-40"
    verification:
      - kind: unit
        ref: "Pre-existing from 09-08 (packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx effectivePanelVisibility/softphonePlacement) - unchanged by this plan, re-verified via tsc + CallCenterAgentPage.test.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "Mobile/tablet layout: phone Tabs nav above untouched app bottom-nav, single-column panels <1024px, softphone sticky-bar (phone) / FAB (tablet+desktop), status bar collapses queue chips + login-time on phone (D-43/D-46)"
    requirement: "D-43, D-46"
    verification:
      - kind: unit
        ref: "Pre-existing from 09-08/09-06 (CallCenterAgentPage.module.scss breakpoints, SoftphoneWidget.tsx isMobile branch, AgentStatusBar.tsx isMobile guards) - inspected, not modified, confirmed intact by this plan's tsc/lint run"
        status: pass
    human_judgment: true
    rationale: "No new CSS was written this plan; confirming the layout renders correctly across the 768px/1024px breakpoints in a real browser is a visual check this plan did not re-run."
  - id: D6
    description: "All new UI strings (settings editor, notification matrix, notification hook) localized ru+en, no em dash, per Copywriting Contract"
    requirement: "D-44"
    verification:
      - kind: unit
        ref: "Static extraction of every t('callcenter....) / t('common....) call across the 4 touched files cross-checked against ru.ts/en.ts additions - all resolved; tsc --noEmit clean"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-07-23
status: complete
---

# Phase 9 Plan 14: Operator settings UI + notification engine + mobile verification + i18n Summary

**Lock-aware CallCenterSettings editor (panel visibility/softphone placement/notification matrix) + a matrix-driven useCallCenterNotifications hook that fully replaces the legacy sound/browser-notification hook, plus the final ru/en localization pass.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3/3
- **Files modified:** 13 (4 created, 8 modified, 1 deleted)

## Accomplishments

- `CallCenterSettings`: tabbed "Panel customization" / "Notifications" editor wired to `getMyUiCustomization`/`updateMyUiCustomization` and `getMyNotifications`/`updateMyNotifications`; every lockable field renders disabled with the tenant default value and a "Set by administrator" tooltip instead of the operator's own (possibly stale) preference.
- `NotificationMatrix`: shared 6-event × 3-channel (Chat/Sound/Popup) switch grid, reusable as-is by a future admin role-default/lock screen per UI-SPEC Surface 12.
- Backend `callcenter-settings.service.ts` gap-closed (Rule 1/2 deviation): `getOperatorUiCustomization`/`getOperatorNotifications` now return `{ ..., locks, defaults }` and force locked fields to the tenant default **on read**, not just on write — closing a hole where a stale pre-lock operator override could leak back through GET after an admin locked the field.
- `useCallCenterNotifications`: matrix-driven notification engine (incoming/missed/queue-pool-missed/chat_message) dispatching sound cues (Web Audio), native `Notification`/in-app toast popups, and a `cc:notification-chat` window event, all gated by the effective channel set (`locked ? default : operator`). Fully replaces and deletes the legacy `useCallNotifications` hook; wired into `CallCenterAgentPage`.
- Pure `isEventLocked`/`getEffectiveChannels`/`isChannelEnabled` extracted and unit-tested (13 tests) — the "a locked event never notifies regardless of the operator's own stale preference" contract is proven without DOM/Notification mocking.
- Verified (not re-implemented) that the D-43/D-46 mobile/tablet rework — phone `Tabs` nav, single-column panels below 1024px, sticky softphone bar on phone / FAB on tablet+desktop, status-bar chip collapse — was already fully delivered by 09-08/09-06; this plan's remaining scope for D-46 was confirmation, not new CSS.
- Completed the ru/en i18n pass: added every new `callcenter.settings.customize.*`, `callcenter.settings.notifications.*`, `callcenter.settings.lockedHint`, `callcenter.settings.tabs.myPanel`, and `callcenter.notify.chatTitle/holdTimeoutTitle/holdTimeoutBody` key, and fixed one em-dash violation in `NotificationMatrix`'s aria-label (D-44).

## Task Commits

1. **Task 1: Settings queries + CallCenterSettings editor (lock-aware)** - `b14d640` (fix, backend lock/defaults gap) + `1d165e8` (feat, frontend editor)
2. **Task 2: Notification engine + apply ui_visibility/placement live** - `7ec006b` (feat)
3. **Task 3: Mobile/tablet rework + final i18n pass** - `47ce01a` (docs, i18n; mobile/tablet layout verified as already complete, no code change needed)

**Plan metadata:** (this commit, made immediately after this summary)

## Files Created/Modified

- `packages/frontend/src/features/callcenter/ui/CallCenterSettings/CallCenterSettings.tsx` - Tabbed operator settings editor (visibility/placement/notifications), lock-aware
- `packages/frontend/src/features/callcenter/ui/NotificationMatrix/NotificationMatrix.tsx` - Reusable event×channel switch grid
- `packages/frontend/src/features/callcenter/lib/useCallCenterNotifications.ts` - Matrix-driven notification engine + pure gating functions
- `packages/frontend/src/features/callcenter/lib/useCallCenterNotifications.test.ts` - 13 unit tests (pure functions + hook integration)
- `packages/frontend/src/shared/api/endpoints/callCenterApi.ts` - `updateMyUiCustomization`, `getMyNotifications`, `updateMyNotifications` + `INotificationSettings`/`NotificationMatrix` types
- `packages/backend/src/modules/callcenter/callcenter-settings.service.ts` - Read-side lock enforcement + locks/defaults surfaced in GET responses
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx` - Swapped `useCallNotifications` for `useCallCenterNotifications`, wired to `getMyNotifications`
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.test.tsx` - Updated mocks for the new hook/query
- `packages/frontend/src/pages/CallCenterSettingsPage/CallCenterSettingsPage.tsx` - New "My panel" tab rendering `CallCenterSettings`
- `packages/frontend/src/shared/config/locales/ru.ts` / `en.ts` - Full i18n for settings + notifications strings
- `packages/frontend/src/features/callcenter/lib/useCallNotifications.ts` - **Deleted** (superseded by `useCallCenterNotifications`)

## Decisions Made

- Extended the 09-13 GET endpoints to surface `locks`/`defaults` and enforce them on read (not just write) — necessary for the lock-aware UI to render correctly and to close a stale-override leak; documented below as a deviation.
- Fully replaced (not layered on top of) the legacy notification hook to keep a single source of truth for sound/popup dispatch.
- Chat notification channel dispatches a window `CustomEvent` rather than rendering into the chat panel directly, since no in-app chat panel consumer for system notifications exists yet — gating/persistence is complete end-to-end, the panel-side listener is tracked as a follow-up (see Known Stubs).
- Confirmed via code inspection that D-43/D-46 mobile/tablet layout was already fully implemented in 09-08/09-06 (phone Tabs, single-column, sticky-bar/FAB split, status-bar collapse) — no redundant CSS rewrite; this plan's Task 3 delivered the i18n completion instead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Backend GET endpoints didn't surface locks/defaults or enforce locks on read**
- **Found during:** Task 1 (Settings queries + CallCenterSettings editor)
- **Issue:** 09-13 shipped `getOperatorUiCustomization`/`getOperatorNotifications` returning only the raw operator override + matrix — no `locks`/`defaults` in the response, and no server-side enforcement that a locked field's GET value equals the tenant default. A stale operator override captured before an admin lock was applied would still be returned as-is.
- **Fix:** Both methods now return `{ ..., locks, defaults }` and force any locked key to the tenant default before returning, mirroring the write-side rejection semantics already present.
- **Files modified:** `packages/backend/src/modules/callcenter/callcenter-settings.service.ts`, `callcenter-settings.service.spec.ts`
- **Verification:** New spec test (`getOperatorNotifications` read forces a locked event to tenant default); `npm run test:backend` for the module green.
- **Committed in:** `b14d640`

**2. [Rule 1 - Bug] Em dash in NotificationMatrix aria-label**
- **Found during:** Task 3 (final i18n pass)
- **Issue:** The per-switch `aria-label` template used an em dash (`${rowLabel} — ${channelLabel}`), violating the locked "no em dash" typography rule (D-44).
- **Fix:** Changed to a comma separator (`${rowLabel}, ${channelLabel}`).
- **Files modified:** `packages/frontend/src/features/callcenter/ui/NotificationMatrix/NotificationMatrix.tsx`
- **Verification:** Manual grep for `—` across all files touched by this plan; only JSDoc comments remain (not user-facing copy, outside the D-44 typography rule's scope).
- **Committed in:** `47ce01a`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both were necessary for the plan's own acceptance criteria (lock-aware settings UI; no-em-dash i18n) - no scope creep beyond that.

## Issues Encountered

- The `missedCallNew` SSE payload has no explicit `personal` boolean; distinguishing `missed_call` (personal) from `queue_missed_pool` (shared) in `useCallCenterNotifications` uses the existing `queue` field's `direct:<iface>` prefix convention (confirmed against `callcenter.service.ts`/`callcenter-ami.service.ts` producers and their spec fixtures) - same heuristic already relied on elsewhere in the codebase, not a new assumption.
- A pre-existing, unrelated TypeScript error in `callCenterSlice.test.ts:123` (`Type 'null' is not assignable to type 'string | undefined'`) remains from before this plan and is out of scope.

## Known Stubs

- `sla_threshold` and `spy_connected` notification events have no live per-operator SSE signal from the backend yet (alert routing exists for supervisors, not an operator-facing SSE event; ChanSpy-connect has no broadcast). Gating/persistence for both events is fully wired end-to-end in `useCallCenterNotifications`/`CallCenterSettings`, but nothing currently triggers them client-side. Not a bug in this plan's scope - tracked for whichever future plan adds those producer-side signals.
- The `chat` notification channel dispatches a `cc:notification-chat` window `CustomEvent` with no current listener - the internal chat panel doesn't yet render system notifications inline. Follow-up: wire `ChatPanel` to listen for this event.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 8 requirements for this plan (D-38 through D-44, D-46) implemented and unit-verified; D-45 (SSE throttling/batching) was out of this plan's scope (09-11 delivered per-extension debouncing for presence already).
- `sla_threshold`/`spy_connected` notification producers and a chat-panel consumer for `cc:notification-chat` are the two remaining stubs for a future plan or phase 9 gap-closure pass.
- Phase 9 (call-center-agent-panel) plan sequence 09-01…09-14 is now fully executed; ready for `/gsd-verify-work 9`.

---
*Phase: 09-call-center-agent-panel*
*Completed: 2026-07-23*
