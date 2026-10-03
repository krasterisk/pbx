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

## CI follow-up — W4, 2026-10-03

Both [e2e](https://github.com/krasterisk/pbx/actions/runs/37085591228) and [harness](https://github.com/krasterisk/pbx/actions/runs/37085591192) on 1377a1c7 fail only the operator idle-state assertion: the page-wide union resolves to hidden `ai-agent-header-status` Ready. Harness otherwise passed 32 browser scenarios; quality passed. Scope operator state locators to `cc-agent-desktop`/`cc-agent-phone` and `agent-status-bar`; preserve idle/active alternatives and visibility requirements. No skips, timeout increases or production/UI changes.

Local verification: both Playwright configs successfully discover the 3 operator/agent scenarios; staged diff whitespace check passes. Real rerun acceptance pending after commit/push. Unrelated dirty backend migration/main.ts excluded.

First rerun fba9ac8a: [e2e](https://github.com/krasterisk/pbx/actions/runs/37086307229) now correctly excludes AiChat but finds no legacy idle hint. Source confirms current AgentStatusBar renders the enabled Start shift/Начать смену button before login; the old hint key is unused. Update idle smoke to require this actionable control (including enabled state) or a real active agent status, still scoped to the workspace/status bar. A standalone TypeScript check reports pre-existing worker-fixture scope declarations in unchanged e2e/harness auth fixtures; Playwright discovery compiles the scenarios successfully.

Final acceptance: verified code commit `ea4d790c`, pushed to origin/main.

- [e2e](https://github.com/krasterisk/pbx/actions/runs/37086927612): PASS, 3 browser scenarios.
- [harness](https://github.com/krasterisk/pbx/actions/runs/37086927614): PASS, 25 API/realtime/stub tests and 33 browser scenarios. Existing 3 external realtime skips/1 live-LLM browser skip unchanged; no failed/flaky cases.
- [quality](https://github.com/krasterisk/pbx/actions/runs/37086927604): PASS, lint, shared 65, backend 3529, frontend 1591 tests and full build. Existing backend skips/lint warnings unchanged.

W4 accepted; no pending CI gates. Final evidence update is documentation only and does not change tested code. Remote logs remain in ignored `.tmp-ci-<run-id>.log` files. Diagnostic script and generated e2e report removed. Other writers' backend changes remain untouched and uncommitted by this task.
# Follow-up W5/W6 — drag/resize and topbar, 2026-10-03

- Fixed left edge resize to preserve the right edge while updating x and width together; keyboard arrows use the same anchor. Width setter returns its actual clamped value to shared geometry.
- Entire free desktop header can start dragging; action buttons excluded; existing accessible keyboard grip retained. Mobile/workspace headers remain fixed.
- Topbar chat/search are icon buttons. Shortcuts retained in hover tooltips; search now uses Ctrl or Command according to platform. Removed obsolete badge styles.
- Local authenticated browser: header title moved window; left edge moved 238→138 while right stayed 698; topbar visually checked. [Screenshot](drag-topbar.png). No live LLM requests made.
- Targeted: 3 files/79 tests PASS. Full frontend: 299 files/1593 tests PASS, exit 0. Backend: 372 suites/3529 tests PASS (existing 11 skipped). Lint PASS (existing 116 backend/87 frontend warnings). Final frontend TS PASS. Initial sandbox esbuild access failure rerun escalated; full runner ignores CLI maxWorkers, so restarted with VITEST_MAX_WORKERS=2. One synthetic resize event initially omitted isPrimary; corrected to match browser pointer semantics, regression passes. Logs retained locally in ignored .tmp-drag-*.log.
- Only assigned UI/evidence paths belong to this commit. Unrelated backend migrations/main.ts left unchanged. All local gates passed; user authorized commit/push to main. Remote CI has not yet been checked for this follow-up.
