# AiChat floating widget — 2026-10-02-r1

User assignment: refactor AiChat into a draggable, minimizable widget following canonical frontend/backend architecture. Mode: codex-direct; coordinator and executor: current chat `/root`.

- W1: Extract reusable viewport-safe pointer/keyboard window geometry into shared. Persist window and launcher position; clean up listeners; handle cancellation and viewport changes.
- W2: Refactor AssistantPanel presentation into floating window, draggable launcher, minimize/restore and resize controls. Keep conversation mounted and streaming during minimization; preserve close cancellation and workspace mode. Mobile uses full viewport.
- W3: Add RU/EN labels, interaction regression tests and run repository lint/backend/frontend tests plus frontend type check.

Owned paths: frontend shared floating geometry, AssistantPanel, ai-chat panel layout, ModuleShell integration, RU/EN locales; this directory and registry entry only. Backend, voice initiatives, API contracts and root STATE excluded.

Acceptance: mouse/touch and keyboard move; drag does not activate launcher; geometry stays reachable after viewport resize; minimize preserves draft and stream; hidden panel inert; restore/maximize work; mandatory checks recorded honestly. Visual/live evidence recorded separately from unit evidence.
