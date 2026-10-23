# Softphone window controls

- Coordinator/executor: `/root`, chat `01a166a2-0ac9-7a33-9fd2-e47662d64f0a`; codex-direct; no delegated writers.
- Assignment/plan W1, 2026-10-23: make the desktop softphone window movable and resizable, with a top-right close button. Preserve transport/session behavior and mobile Sheet.
- Baseline: `main`, `b03e97cf79ce19efac0f3cc05a48e98901ca2590`; existing dirty softphone, phone-session, floating-window hook and locale changes are preserved.
- Required reads: AGENTS.md, canonical frontend/backend architectures, CANONICAL_REFS, HYBRID-WORKFLOW, EXECUTION-REGISTRY, existing SoftphoneWidget and useFloatingWindow.
- Owned delta: shared/ui/SoftphoneWidget/{SoftphoneWidget.tsx,SoftphoneWidget.module.scss,SoftphoneWidget.desktop.test.tsx}; moveWindow/resizeWindow/backspaceHint/clearDialHint strings in shared/config/locales/{ru,en}.ts; operator SoftphoneWidget.test.tsx close-button locator. Shared hook and phone-session files remain baseline dependencies, without new edits in this assignment.
- Acceptance: drag header; resize lower-right and left edge; keyboard arrow controls; retain geometry across remount; keep window inside viewport; close with X/Escape without hanging up and return focus to launcher; retain mobile behavior.
- Implementation: implemented; uses existing useFloatingWindow with separate window geometry/width storage. Ordinary and operator desktop windows share controls; operator launcher stays docked.
- Follow-up W2: user requested number field aligned to keypad width, both deletion controls inside the input and top tooltips. Implemented shared 240px width, reserved input padding, Lucide icons and tooltip wrappers accessible even while the buttons are disabled. Added edit-action/tooltip regression.
- Verification: SCSS compile and scoped diff check PASS. `npx vitest run src/shared/ui/SoftphoneWidget/SoftphoneWidget.desktop.test.tsx src/shared/ui/SoftphoneWidget/SoftphoneWidget.mobile.test.tsx src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.test.tsx src/features/phone/PhoneSessionHost.test.tsx --maxWorkers=2`: 4 files/29 tests PASS. Final W2 desktop regression: 1 file/6 tests PASS (including both tooltip actions). `npm run lint`: PASS, existing warnings. Initial runs exposed the obsolete Minimize locator, a costly repeated movement test and an overly broad EventTarget test type; corrected without widening test timeouts.
- Pending gates: repeat `npx tsc -b --pretty false` after the corrected test type (session 69178); `npm run test:backend` (session 74140); `VITEST_MAX_WORKERS=2 npm run test:frontend` (session 12865). The full suites were launched for W1 and are still running; no full-suite pass claimed. Browser tool initialization timed out, so visual/live-call verification remains pending. User follow-up screenshot supplied the W2 layout requirement; it is not final W2 browser evidence. No release assigned.
- Next action: collect pending typecheck/full-suite results on continuation; fix only failures attributable to W1/W2. No neighboring initiative or release status is changed.

## Collected gates on subsequent continuation

- Final frontend typecheck and scoped ESLint PASS (session 69178).
- Full backend run exited 1: 510 suites/5070 tests passed; one voice-robots public curl HTTP test timed out at 5000ms, one suite/27 tests skipped. The failure is outside the softphone delta.
- Full frontend runner completed all 13 chunks and exited 1; compact collected output did not retain the individual failure details. Full frontend acceptance remains FAIL/unresolved; targeted softphone 29+6 regression evidence above remains PASS.
- No release performed. Next action for this assignment: inspect retained test logs or rerun the failed frontend cases when repository-wide gate repair is assigned; final browser/live-call acceptance remains pending.
