# AiChat floating widget — 2026-10-02-r1

User assignment: refactor AiChat into a draggable, minimizable widget following canonical frontend/backend architecture. Mode: codex-direct; coordinator and executor: current chat `/root`.

- W1: Extract reusable viewport-safe pointer/keyboard window geometry into shared. Persist window and launcher position; clean up listeners; handle cancellation and viewport changes.
- W2: Refactor AssistantPanel presentation into floating window, draggable launcher, minimize/restore and resize controls. Keep conversation mounted and streaming during minimization; preserve close cancellation and workspace mode. Mobile uses full viewport.
- W3: Add RU/EN labels, interaction regression tests and run repository lint/backend/frontend tests plus frontend type check.

Owned paths: frontend shared floating geometry, AssistantPanel, ai-chat panel layout, ModuleShell integration, RU/EN locales; this directory and registry entry only. Backend, voice initiatives, API contracts and root STATE excluded.

Acceptance: mouse/touch and keyboard move; drag does not activate launcher; geometry stays reachable after viewport resize; minimize preserves draft and stream; hidden panel inert; restore/maximize work; mandatory checks recorded honestly. Visual/live evidence recorded separately from unit evidence.

## Follow-up r2 — CI repair, 2026-10-03

W4: user reported failing e2e/harness after 1377a1c7. Both logs resolve operator idle assertions to hidden AiChat `Ready` text. Scope: e2e/tests/operator-happy-path.spec.ts, harness/scenarios/ui/agent-smoke.spec.ts, harness/assertions/ui.ts; this initiative evidence. Constrain assertions to cc-agent workspace/status bar, retain idle/active requirements, list tests/type-check and push; accept after both real CI workflows pass. Preserve unrelated dirty backend migrations/main.ts. No production code or workflow setup change planned.
