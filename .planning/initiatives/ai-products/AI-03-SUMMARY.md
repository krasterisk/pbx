# AI-03 SUMMARY — capture intents and durable recording handoff

Phase: AI-03 CAP1–CAP5. Product commercial runtime remains `not-installed`. Native Asterisk rollout stays flag-gated (`DURABLE_CAPTURE` default OFF). Test ipbx received an isolated generated-route MixMonitor context; customer `custom/routes` were not rewritten.

## Delivered

- Additive `0010-ai-capture.sql` (MySQL + PostgreSQL): `ai_capture_node_bindings`, `ai_capture_intents`, `ai_capture_segments`, `ai_capture_receipts`.
- Capture engine: tenant A/B/0, spoof node/binding, expired/revoked, duplicate recording, foreign asset, same-digest replay vs conflicting 409.
- Isolated `recording-node.ts` + local spool journal (no AppModule, no SQL).
- Recorder compatibility: UUID filename and MixMonitor recorder id only when `DURABLE_CAPTURE=1`; hangup handler stops that recorder and skips ffmpeg on the new branch.
- Robot-only adapter reuses the same intent contract without routes/CDR.

## Not claimed

- Replacing the existing Adaptive ODBC DSN or charging real tenants.
- Rewriting all generated customer routes on disk (`DURABLE_CAPTURE` still required for `generateRouteDialplan`).
- Commercial launch / paid capture.
