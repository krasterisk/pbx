# AiChat widget result

Assignment: [PLAN](PLAN.md), 2026-10-02-r1, W1–W3. Coordinator/executor: current `/root`, codex-direct. Implementation and review by the same executor; no independent review claimed.

## Implemented

- AssistantPanel is a non-modal floating window with keyboard/pointer movement, corner resize and retained desktop/workspace modes. Internal `dock` mode remains compatible with existing Redux/storage consumers.
- Shared `useFloatingWindow` owns viewport bounds, persisted geometry, pointer identity, drag threshold, click suppression, edge snapping, cancellation and listener cleanup.
- Header and launcher are separate widget components. Minimize keeps conversation, draft and streaming mounted. Close retains request abortion. Hidden contents are inert; minimizing focuses the launcher.
- Launcher shows busy state/pending plan count. Shell trigger and Ctrl/Cmd+Shift+J restore minimized chat. Compact window/mobile history remains available via an overlay.
- Mobile uses 100dvh with safe-area footer and preserves desktop dimensions when returning. RU/EN labels, SCSS modules, shared controls/Stack, Lucide and token-based z-index follow frontend architecture.

## Evidence

| Gate | Result |
|---|---|
| Targeted AssistantPanel/layout/ModuleShell unit tests | PASS: 3 files, 77 tests, `npx vitest run src/widgets/AssistantPanel/AssistantPanel.test.tsx src/features/ai-chat/model/assistantPanelLayout.test.ts src/widgets/ModuleShell/ModuleShell.test.tsx --maxWorkers=2` from frontend |
| Frontend TypeScript | PASS: `npx tsc -b --pretty false` from frontend |
| Repository lint | PASS: `npm run lint`; existing 116 backend + 87 frontend warnings, zero errors |
| Backend suite | PASS: `npm run test:backend`; 372 suites, 3529 tests passed; 1 suite/11 tests skipped |
| Full frontend suite | PASS: `npm run test:frontend`, Windows sequential batches; 299 files, 1591 tests passed, runner exit 0 |
| Local browser UI | PASS: real pointer drag, launcher snap, draft minimize/restore, keyboard restore, fullscreen round-trip, 390×844 mobile, desktop size preservation |
| Authenticated API/LLM integration | Not exercised: UI refactor; browser preview used actual component/store with no configured authenticated backend, thread-list error state visible. Streaming preservation verified by unit mocks |
| Release | Not applicable: no deploy requested |

Browser evidence: [desktop](desktop.png), [mobile](mobile.png), [minimized](minimized.png). Temporary preview files/tab/server removed. Generated tracked tsbuildinfo restored to clean baseline. User follow-up authorized commit and push to GitHub on current `main`; deployment is outside this request.

## Handoff

Assignment accepted: code implemented; targeted tests/type/lint/backend/full frontend and local UI passed. Full frontend command output remains `.tmp-widget-frontend.log` (ignored). No outstanding implementation gates in this UI scope. Next action: user review of the widget in the application. Do not rerun unrelated voice/autodial initiatives or change root STATE. API behavior unchanged. No other writers assigned.
