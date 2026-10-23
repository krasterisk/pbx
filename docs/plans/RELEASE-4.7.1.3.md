# Release 4.7.1.3 — execution

- Coordinator/executor: /root, codex-direct; user explicitly requests commit, push main and deploy 185.177.216.132.
- Baseline: main b03e97cf; deployed application ebedc378 / 4.7.1.2 / schema 0055-phone-sessions.sql.
- Plan R1: review current authored packages/docs, exclude temporary/private/generated outputs; bump build to 4.7.1.3. R2: lint, backend/frontend suites, build and CI; repair concrete release blockers. R3: publish source, build Linux images, private backup, verify unchanged schema, deploy only application containers with rollback. R4: authenticated API/assets/version/SHA checks and customer policy comparison; record evidence.
- Owned paths: release metadata, this record/registry entry, bounded fixes required by release gates. Existing feature implementations accepted as input, no adjacent initiative execution or delegated writers.
- Dependency lock and database catalog identical to deployed baseline. No DDL assigned. Customer grants, menu and organization regional settings must be preserved.
- Status: in_progress R2. Full tests running; initial backend invocation rejected an npm argument before tests started, relaunched canonical command.
- Evidence: C:/Users/Professional/Documents/Codex/Artifacts/krasterisk_v4/runs/release-4.7.1.3/20261023/ (publication.json, test/build/CI logs and deployment receipts).
- Gates: lint pending; backend pending; frontend pending; build pending; CI pending; production live checks pending.

R2 progress: lint PASS (existing warnings), backend515suites/5083tests PASS/27conditional skips, local full build PASS. Initial d36b5f02 harness failed on two obsolete always-visible calls-panel expectations after the accepted on-demand supervisor redesign. Release owns harness/assertions/ui.ts and harness/scenarios/ui/supervisor-smoke.spec.ts for bounded repair: four KPI shell assertions and opening/closing the real calls Sheet. Initial failure logs retained. Concurrent supervisor-pulse execution-document edits belong to the separate test-stand deployment and are excluded from release follow-ups.
