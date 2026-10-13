# Helpdesk support

Coordinator /root, codex-direct, sole writer. Canonical assignment: aiPBX-helpdesk/docs/PLAN.md revision9, accepted five-case plan. Baseline7263d499; clean QA worktree excludes unrelated voice runtime/mobile/trunks/dashboard changes. No other phases or master STATE are changed.

Implemented: integration pbx_support with per-tool grants/tenant revision/active admin owner, readonly MCP, trusted immutable proposal/apply/status/verify, stale-state checks, route/calendar common adapters, scoped runtime queue/STT diagnostics. Remaining route step identity/order is enforced; unsupported target mutations stop before proposal. Existing calendar changes explicitly include every dependent consumer update.

Automated tests: full backend3694pass11skip392suites, frontend all9chunks pass, full lint pass with existing warnings, latest backend build and20targeted support tests pass after action identity guard. MySQL and PostgreSQL real HTTP/MCP/Asterisk golden passed10checks each; calendar+8consumer plan, exact583forwarding removal and subsequent web API save, scoped ringall runtime, synthetic STT401/probe one-call/replay. Four deployed inline TESTTIME boundaries pass on both DB dialects. PostgreSQL lost apply response was reconciled with readonly status/verify; apply was not retried. Latest identity guard verified by unit tests; earlier real goldens precede that final guard.

Portable fixture: harness/helpdesk-support. Real customer configuration, paid provider and production deployment not performed. Source publication pending this snapshot, version4.6.10/backend4.5.3 on own branch. Foreign working tree root4.7.0/backend4.5.4 preserved. Independent review not performed (agents prohibited).
