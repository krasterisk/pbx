---
phase: 09-call-center-agent-panel
plan: 06
subsystem: ui
tags: [react, softphone, webrtc, i18n, radix-popover]

requires:
  - phase: 09-02
    provides: "AgentStatus model + status label/color maps (informs how a future orchestrator will pass callerLabel/queueLabel/status into this widget); shared/ui/Tabs (sibling primitive, not directly consumed here)"
provides:
  - "SoftphoneWidget — FAB (56px, desktop) + Popover expanded panel (~320px) wrapping useWebRTCPhone + DtmfKeypad verbatim; phone (<768) fallback renders a sticky control bar instead of a floating FAB (D-46)"
  - "IncomingCallToast — non-modal slide-in (top-right desktop / top phone), controlled open/call/onAnswer/onReject props, no backdrop, no auto-dismiss timer"
  - "callcenter.softphone.* and callcenter.incoming.* i18n namespaces (ru/en, D-44)"
affects: ["09-08", "09-04", "09-10", "09-14"]

tech-stack:
  added: []
  patterns:
    - "Widget takes the useWebRTCPhone() return value as a prop instead of calling the hook itself, so it never forks call logic and stays a pure presentation layer over the existing hook (per plan's explicit 'reuse verbatim, presentation change only' instruction)"
    - "44px touch-target override via `:global(button) { min-height: 44px; min-width: 44px; }` inside a flex control row — same trick already used by CallCenterAgentPage.module.scss's `.callActions`, reused here instead of re-deriving a new pattern"
    - "IncomingCallToast avoids Sheet (its overlay blocks the page); uses a plain fixed/absolutely-positioned div with CSS-keyframe slide-in, matching the existing pulse/fadeIn/modalIn keyframe convention instead of introducing the `motion` JS library"

key-files:
  created:
    - packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.tsx
    - packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.module.scss
    - packages/frontend/src/features/callcenter/ui/SoftphoneWidget/index.ts
    - packages/frontend/src/features/callcenter/ui/IncomingCallToast/IncomingCallToast.tsx
    - packages/frontend/src/features/callcenter/ui/IncomingCallToast/IncomingCallToast.module.scss
    - packages/frontend/src/features/callcenter/ui/IncomingCallToast/index.ts
  modified:
    - packages/frontend/src/features/callcenter/index.ts
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts

key-decisions:
  - "SoftphoneWidget accepts `phone: ReturnType<typeof useWebRTCPhone>` as a prop rather than invoking the hook internally - keeps this a pure presentation component with a single hook owner (the page orchestrator, 09-08), consistent with the plan's 'do not fork call logic' instruction"
  - "Transfer/park/conference/zombie-reset are optional slots (`onTransferClick`, `extraControls`) rather than built-in actions - the underlying directory/park/conference mechanics don't exist yet (09-10), so the widget exposes hook points instead of stub buttons that do nothing"
  - "Mobile fallback (<768) renders an entirely different tree (sticky bar) instead of the FAB+Popover, per the plan's explicit correction to the UI-SPEC ('render nothing free-floating on phone') - D-46 takes precedence over the UI-SPEC's more general 'Sheet on phone' wording"
  - "IncomingCallToast uses CSS keyframes (not the `motion` library) for the slide-in, per UI-SPEC's own guidance to reuse the existing pulse/fadeIn/modalIn keyframe convention rather than inventing new easing curves"
  - "New i18n keys live under callcenter.softphone.*/callcenter.incoming.* (distinct from the pre-existing, only-English-fallback callcenter.agent.answerBtn/rejectBtn/etc. used by CallCenterAgentPage.tsx) so the widget's Answer/Reject copy is genuinely localized in ru.ts, not relying on i18next's untranslated-key fallback"

requirements-completed: [D-01, D-02, D-03, D-44, D-46]

coverage:
  - id: D1
    description: "SoftphoneWidget renders a 56px circular FAB (desktop), primary-tinted idle / destructive-tinted pulsing when phone.status === 'ringing', fixed bottom-right or bottom-left per placement prop, z-index via var(--z-index-toast)"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "npx tsc -p packages/frontend/tsconfig.json --noEmit (0 errors attributable to this plan; 1 pre-existing unrelated error already logged in deferred-items.md)"
        status: pass
      - kind: other
        ref: "npm run lint (0 errors; only pre-existing unrelated warnings in other files)"
        status: pass
    human_judgment: true
    rationale: "Visual FAB sizing/color/pulse state and the mobile-vs-desktop branch are best confirmed by a human looking at the rendered widget in both breakpoints - no visual regression test exists for this component yet"
  - id: D2
    description: "Expanded panel (Popover, ~320px) reuses DtmfKeypad and the injected useWebRTCPhone return value verbatim; shows a 28px Display-token call timer + caller number when ringing/in-call, and the full mute/hold/DTMF/transfer/hangup control row (44px touch targets) when in-call"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "npx tsc -p packages/frontend/tsconfig.json --noEmit (0 errors attributable to this plan)"
        status: pass
    human_judgment: true
    rationale: "Panel layout/typography sizing and touch-target rendering require visual confirmation; no snapshot/visual test exists"
  - id: D3
    description: "On phone (<768), SoftphoneWidget renders a sticky control bar instead of a floating FAB, exposing the same ringing/in-call controls without stacking two floating elements (D-46)"
    requirement: "D-46"
    verification:
      - kind: other
        ref: "npx tsc -p packages/frontend/tsconfig.json --noEmit (0 errors attributable to this plan); code inspection confirms isMobile branch returns a different tree with no .fab/.panel classes rendered"
        status: pass
    human_judgment: true
    rationale: "Breakpoint-conditional rendering needs a human check at <768px viewport to confirm no floating element ever coexists with the sticky bar"
  - id: D4
    description: "IncomingCallToast renders a non-modal slide-in (no Sheet/backdrop) with caller number/name, a queue/personal/outbound context tag, and Answer (default/accent)/Reject (destructive) buttons >=44px; no auto-dismiss timer; controlled via open/call/onAnswer/onReject props"
    requirement: "D-02"
    verification:
      - kind: other
        ref: "npx tsc -p packages/frontend/tsconfig.json --noEmit (0 errors attributable to this plan); code inspection confirms no Sheet/Dialog/overlay import, no setTimeout-based auto-hide"
        status: pass
    human_judgment: true
    rationale: "Non-modal behavior (underlying content stays interactive) and the slide-in animation need visual/interaction confirmation in a browser"
  - id: D5
    description: "callcenter.softphone.* and callcenter.incoming.* i18n namespaces added symmetrically to ru.ts/en.ts with locked Copywriting Contract copy (Ответить/Answer, Отклонить/Reject, Из очереди/From queue, Личный/Personal, Исходящий/Outbound), no em dash"
    requirement: "D-44"
    verification:
      - kind: other
        ref: "npx eslint src/features/callcenter/ui/SoftphoneWidget src/features/callcenter/ui/IncomingCallToast src/features/callcenter/index.ts src/shared/config/locales/ru.ts src/shared/config/locales/en.ts (0 errors, 0 warnings)"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-07-22
status: complete
---

# Phase 9 Plan 06: Softphone Widget + Incoming Call Toast Summary

**SoftphoneWidget (56px FAB desktop / sticky bar on phone, Popover-expanded panel over `useWebRTCPhone` + `DtmfKeypad`) and IncomingCallToast (non-modal slide-in with Answer/Reject) demote the softphone from a dominant call card to floating chrome, per D-01/D-02/D-46.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3/3
- **Files modified:** 9 (7 created, 2 modified — plus `features/callcenter/index.ts` barrel)

## Accomplishments
- `SoftphoneWidget` renders a 56px circular FAB fixed bottom-right/bottom-left on desktop - `--color-primary` idle, `--color-destructive` pulsing (respecting `prefers-reduced-motion`) when `phone.status === 'ringing'`, `z-index: var(--z-index-toast)` per UI-SPEC Surface 2 - clicking it opens a ~320px anchored Popover with a 28px Display-token call timer, caller number, an optional queue tag, and (when in-call) a full mute/hold/DTMF/transfer/hangup control row with 44px touch targets via the existing `.callActions`-style `min-height` override trick.
- On phone (<768px), the same component renders a completely different tree - a fixed sticky control bar (not a floating FAB) - per the plan's explicit correction that UI-SPEC's general "Sheet on phone" wording is superseded by D-46's "never stack two floating elements" rule for this widget.
- `IncomingCallToast` is a fully controlled (`open`/`call`/`onAnswer`/`onReject`) non-modal slide-in - no `Sheet`, no backdrop, no auto-hide timer - showing caller number/name, a queue/personal/outbound context tag, and Answer/Reject buttons ≥44px; slide-in uses CSS keyframes disabled under `prefers-reduced-motion`, matching the existing `pulse`/`fadeIn`/`modalIn` convention instead of the `motion` JS library.
- Both components reuse `DtmfKeypad` and the `useWebRTCPhone` hook's return value verbatim (passed in as props) - no call-logic fork, purely presentational, as the plan required.
- `callcenter.softphone.*` gained `panelTitle`/`answer`/`reject`/`mute`/`unmute`/`hold`/`unhold`/`transfer`/`hangup`; a new `callcenter.incoming.*` namespace covers the toast's own copy (`title`/`answer`/`reject`/`unknownCaller`/`fromQueue`/`personal`/`outbound`) - symmetrical ru/en keys with the locked Copywriting Contract translations, no em dash.
- Both components exported from `features/callcenter/index.ts` alongside their prop/type exports, ready for the page orchestrator (09-08) to mount and wire.

## Task Commits

Each task was committed atomically:

1. **Task 1: SoftphoneWidget FAB + expandable panel** - `e2dfdd6` (feat)
2. **Task 2: IncomingCallToast (non-modal slide-in)** - `37c54bd` (feat)
3. **Task 3: i18n for softphone + incoming toast** - `a8ca0e3` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE.md/ROADMAP.md, via `gsd-tools query commit`)

_Note: no TDD RED/GREEN split was used - this plan has no `tdd="true"` tasks and no `<behavior>` blocks (pure presentational UI, no new business logic), consistent with the plan's own type="auto" tasks._

## Files Created/Modified
- `packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.tsx` - FAB + Popover panel + phone sticky-bar fallback, controls row, ringing Answer/Reject
- `packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.module.scss` - fab/panel/stickyBar styles, all `var(--color-*)`/`var(--z-index-*)` tokens, no literal hex/z-index
- `packages/frontend/src/features/callcenter/ui/SoftphoneWidget/index.ts` - named exports (component + prop/placement types)
- `packages/frontend/src/features/callcenter/ui/IncomingCallToast/IncomingCallToast.tsx` - controlled non-modal slide-in toast
- `packages/frontend/src/features/callcenter/ui/IncomingCallToast/IncomingCallToast.module.scss` - slide-in keyframes (desktop/phone variants), context tag, 44px action row
- `packages/frontend/src/features/callcenter/ui/IncomingCallToast/index.ts` - named exports (component + context/kind types)
- `packages/frontend/src/features/callcenter/index.ts` - barrel-export both new components + their types
- `packages/frontend/src/shared/config/locales/ru.ts` - += softphone.{panelTitle,answer,reject,mute,unmute,hold,unhold,transfer,hangup} + new incoming.* namespace
- `packages/frontend/src/shared/config/locales/en.ts` - same key set, English copy

## Decisions Made
- **`phone` is a required prop, not an internally-invoked hook:** `SoftphoneWidget` takes `ReturnType<typeof useWebRTCPhone>` from its parent instead of calling `useWebRTCPhone()` itself. This guarantees there is exactly one SIP session per page (owned by the orchestrator, 09-08) and the widget can never accidentally create a second, out-of-sync WebRTC registration.
- **Transfer/park/conference/zombie-reset are slots, not stub buttons:** `onTransferClick?` and `extraControls?` let the widget compile and render correctly today without inventing placeholder actions that do nothing; 09-10 wires real handlers into these exact slots instead of editing this file's internals again.
- **Mobile branch is a structurally different render, not a CSS media query on the same markup:** the FAB/Popover DOM never mounts on phone at all (early `isMobile` branch returns a different JSX tree) - this makes "no floating FAB on phone" a structural guarantee, not a hide-with-CSS accident that could regress.
- **New softphone/incoming i18n keys, not reuse of `callcenter.agent.answerBtn` etc.:** grepping `ru.ts` showed the existing `agent.answerBtn`/`rejectBtn`/`muteBtn`/etc. keys used by `CallCenterAgentPage.tsx` (via `t('callcenter.agent.answerBtn', 'Answer')` with an English fallback) don't actually exist in `ru.ts` - they silently fall back to English in the Russian locale. Rather than propagate that pre-existing gap into new components, this plan added genuinely-translated keys under the namespaces the plan itself specified (`callcenter.softphone.*`/`callcenter.incoming.*`).

## Deviations from Plan

None - plan executed exactly as written. The `callcenter.agent.*` fallback-to-English gap noted above is pre-existing (predates this plan, lives in `CallCenterAgentPage.tsx`/`ru.ts`) and out of this plan's `files_modified` scope - not fixed, only avoided in the new code.

## Issues Encountered
None beyond the pre-existing, already-logged `callCenterSlice.test.ts(123,64)` TS2322 error (see `deferred-items.md`, originally logged by 09-02) - confirmed still present and unrelated to this plan's files via `npx tsc --noEmit`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `SoftphoneWidget` and `IncomingCallToast` are ready for 09-08's `CallCenterAgentPage` rework to mount, feeding them `phone` (the existing `useWebRTCPhone()` instance), `activeCall`/`callTimer` state, and wiring `onTransferClick` to the Transfer Directory (09-10).
- `onOpenCard` slot is ready to wire to the existing `useCallCardPopup().openManually` (already used by `CallCenterAgentPage.tsx`) without any further changes to `SoftphoneWidget`.
- `extraControls` slot on `SoftphoneWidget` is the intended integration point for 09-10's park/conference/zombie-reset buttons - no widget-internal changes needed when 09-10 lands.
- `callcenter.softphone.*`/`callcenter.incoming.*` i18n keys are ready for 09-08's page rework and 09-10's new call-control copy to extend without renaming existing keys.
- No blockers identified for 09-08 or later plans.

## Self-Check: PASSED

All 9 created/modified files verified present on disk; all 3 task commit hashes (`e2dfdd6`, `37c54bd`, `a8ca0e3`) verified present in `git log --oneline`.

---
*Phase: 09-call-center-agent-panel*
*Completed: 2026-07-22*
