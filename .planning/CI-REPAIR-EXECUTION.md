# CI repair execution

- Coordinator: current Codex chat `/root`; mode: codex-direct; no delegated writers.
- Baseline: main/f04b8b75, clean working tree. User scope: fix failed tests/lint/build and GitHub Actions, push to krasterisk/pbx main.
- Plan/revision: this document, revision 1 (2026-10-02).
- Tasks: CI-1 reproduce workflow failures; CI-2 fix implementation/type errors and stale mocks/fixtures; CI-3 run lint, shared/backend/frontend tests, DB unit/schema and full build; CI-4 push and inspect all triggered Actions until completion.
- Owned paths: files with reproduced diagnostics in packages/backend, packages/frontend, packages/shared, harness/database; this evidence document. Workflow edits only when an actual CI setup failure is demonstrated.
- Exclusions: unrelated feature work, production data/config, historical initiative state.
- Acceptance: required local commands pass and triggered Actions pass; preserve coverage and security checks.
- Status: in_progress. Actions quality fails at lint; e2e fails at build; Database contracts fails at DB unit tests. Local reproduction running.
- Next action: correct stale DB migration lists, missing Sequelize model/mock dependencies, frontend project mocks, and lint/type errors. Record commands/results here.

## Evidence, first repair

- Lint pass (0 errors, existing warnings remain). Shared tests: 65/65. Backend: 372 suites, 3529 tests passed; pre-existing 11 skipped tests unchanged. DB unit: 51/51. Schema inventory: 8/8. Full npm run build passed including frontend TypeScript and Vite. Project page target test passed. Full frontend suite running.
- Fixes: Sequelize mock dependency, stronger Telegram URL redaction expectation, typed model ports/error cause, i18next/helper types, shared UI exports/semantic Stack events, missing notice state, preservation of summary enabled flag, complete Hub/catalog/insight fixtures, reviewed post-baseline schema snapshot.
- Next action: push this repair and inspect triggered Actions; continue full frontend tests; fix any downstream CI failures before declaring completion.

## Integration repair progress

- Full frontend suite: 318 files, 1577 tests passed (exit 0).
- Database contracts on fresh MySQL/PostgreSQL: 16 tests passed on each engine. Runtime core/CDR/CC/robot check still pending.
- CI seed updated for seller_id and removed pricing column; upgrade contracts track current migration registry while historical PostgreSQL shape remains pinned at 0020.
- E2E passed on 82b3fa8a. Harness API/realtime: 24 passed, 3 existing skipped; browser tests blocked by removed pricing in shared provider fixture.
- Owned scope extended to harness/fixtures for the reproduced provider DTO mismatch; CI workflow env uses bundled ONNX CPU binaries to avoid optional CUDA download timeouts.
- Current next action: finish latest Actions, fix remaining runtime/browser failures, then record final evidence.
