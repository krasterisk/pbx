# Supervisor Pulse — PLAN r1

2026-10-23. Explicit user assignment: implement the approved `/callcenter/supervisor` design. Coordinator/executor `/root`, chat `01a16857-c4aa-7e10-a3cf-3b61a35d84de`, mode `codex-direct`. Execution: [EXECUTION](EXECUTION.md).

## Accepted requirements

- P1: quiet overview with four clickable metrics (SLA, answered, lost for the reporting day; waiting now), compact attention summary, and one operator table. Additional live calls, queue breakdowns and journals open on demand. Keep the existing weighted metric dictionary, reporting-day boundary and access scope.
- P2: “My team” / “Моя команда” with an explicit “Team members” / “Состав команды” action. Search permitted candidates, edit a draft, Save or Cancel. Membership in this personal observation list is independent of shifts and queue membership.
- P3: one status menu per operator: start/end shift, pause with a reason, resume. Call/ringing/wrap-up states are automatic; preserve existing phone-unavailable and queue-detached information. Confirm ending an operator's active call shift. Existing spy/whisper/barge remain in operator detail.
- P4: separate “Inbound” / “Входящие” and “Outbound” / “Исходящие” columns for reporting-day agent counters. No grouped “Calls” header. Keep operator missed offers distinct from lost queue calls.
- P5: queues are comma-separated names, limited to 32 Unicode characters including ellipsis. Hover/focus tooltip has the entire list; clicking opens a Sheet with queue membership switches. No expanding table rows or per-queue chips. Preserve allowed queues and live-interface guards, optimistic feedback, rollback and errors.
- P6: retain missing-avatar fallback across clock ticks; use shared UI, design tokens, RU/EN, responsive layouts and accessible controls. Loading/error/offline/empty states must remain actionable.

## Tasks and ownership

1. **S1 — Layout and details:** supervisor page/KPI strip and scoped styles; compact attention mode; on-demand KPI/live-call/queue panels. No new backend formulas or schema.
2. **S2 — Team table and actions:** supervisor board, a reusable callcenter status menu, queue summary helper and membership Sheet; existing WatchlistSheet and AgentSheet integration. Keep the pre-existing avatar fix.
3. **S3 — Validation:** meaningful component/helper tests for team draft isolation, menu guards/actions, queue truncation/tooltip/Sheet, failure rollback and KPI scope; targeted lint/types/tests and required root lint/backend/frontend checks; local rendered component/browser verification when available.

Owned paths: `packages/frontend/src/pages/CallCenterSupervisorPage/**`; new/explicitly edited callcenter UI/lib files for these requirements; `packages/frontend/src/shared/config/locales/{ru.ts,en.ts,supervisorPulse.ts}`; this plan/execution plus scoped pointers in registry/index. Existing API endpoints are reused; no backend, shared schema, telephony/audio hooks, deployment or release changes assigned.

## Evidence and acceptance

Source of the accepted design is the conversation's final Pulse mock, `supervisor-pulse-final.html`; the requirements above make the clone independent of that external file. Automated checks, browser fixtures and live/release evidence are separate gates. Raw outputs use external `ARTIFACTS_ROOT/runs/supervisor-pulse/<run-id>/` via `tools/artifacts/paths.cjs`. The repository has an extensive pre-existing dirty baseline; never revert, stash or commit it.
