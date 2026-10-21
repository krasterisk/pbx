# CI repair execution

- Coordinator: current Codex chat `/root`; mode: codex-direct; no delegated writers.
- Baseline: main/f04b8b75, clean working tree. User scope: fix failed tests/lint/build and GitHub Actions, push to krasterisk/pbx main.
- Plan/revision: this document, revision 1 (2026-10-02).
- Tasks: CI-1 reproduce workflow failures; CI-2 fix implementation/type errors and stale mocks/fixtures; CI-3 run lint, shared/backend/frontend tests, DB unit/schema and full build; CI-4 push and inspect all triggered Actions until completion.
- Owned paths: files with reproduced diagnostics in packages/backend, packages/frontend, packages/shared, harness/database; this evidence document. Workflow edits only when an actual CI setup failure is demonstrated.
- Exclusions: unrelated feature work, production data/config, historical initiative state.
- Acceptance: required local commands pass and triggered Actions pass; preserve coverage and security checks.
- Status: automated-tests-passed; CI repair complete. Implementation and workflow changes pushed to main; all required gates pass.
- Next action: none for CI repair. Production deployment is outside this task.

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

## Runtime/browser regression fixes

- PostgreSQL full core/CDR/CC/robot runtime passed on 6efd8cf8. MySQL timeline 500 fixed by binding both linkedid predicates instead of comparing CDR/CEL columns with different collations; transfer CEL fixtures now checked. Tenant isolation endpoint contract is 200 with empty legs/events.
- Harness traces showed control classification requests consuming scripted LLM turns and temporary SSE steps duplicated after persisted proposal reload. Stub supports nonstream JSON/control calls without consuming the scenario; menu drafts carry real destinations. Frontend merge replaces temporary steps before a persisted proposal, preserving later live continuation; SSE event state survives network chunk boundaries.
- Target frontend regression tests: 15 passed; stub tests: 9 passed; backend build and targeted lint passed. Latest CI pending.
- Owned scope extended to harness/llm-stub for the reproduced request protocol mismatch. Next action: inspect latest Actions and repair any remaining browser failures; keep production unchanged.

- f3d81a34: Database contracts and e2e passed; quality full frontend passed (build finishing). Harness: 31 browser passes, one stale subscriber detail expectation and one retry in missed-call badge locator. Updated the detail expectation and use the accessible button name with explicit lazy-page readiness. Next action: verify final harness rerun.

- 3a5e21c2: quality and e2e green; harness green with 25 API/realtime and 33 browser passes, but missed-call test required a retry. Trace proves ERR_NETWORK_CHANGED across Vite source imports with a blank page. Harness now serves the already-built frontend via preview (existing API/WebSocket proxy inherited); no test skips or network-error suppression added. Next action: verify the built-artifact harness run.

- Built-artifact run 270eea98 removed the module network-change failure; fast responsive reloads exposed HTTP 429 on /tenant-settings and /marketplace/hub-catalog (traces), preventing the module guard from rendering the bases page. CI harness now sets the existing THROTTLE_LIMIT=300 on its disposable backend. The limiter remains finite and explicit auth decorator limits remain unchanged; production config/code are unchanged. Next action: verify this final harness run and all triggered checks.

## Final acceptance (2026-10-02)

- Verified code/workflow commit: 0d8051f5 (main). Subsequent evidence update is documentation only.
- [quality](https://github.com/krasterisk/pbx/actions/runs/37025978467): pass — lint, shared/backend/frontend tests, complete build. Shared 65 tests, backend 3529 tests (372 suites), frontend 1581 tests. Existing skipped backend tests and lint warnings remain; no new skips.
- [harness](https://github.com/krasterisk/pbx/actions/runs/37025978523): pass — 25 API/realtime/stub tests and 33 browser tests, zero failed/flaky browser cases. Browser run 51.1s; existing tests requiring external Asterisk/live LLM stay skipped.
- [e2e](https://github.com/krasterisk/pbx/actions/runs/37025978463): pass.
- [Database contracts](https://github.com/krasterisk/pbx/actions/runs/37022168167): pass on both MySQL and PostgreSQL — 51 DB unit, 8 schema inventory, 16 real contracts per engine, plus AppModule core/CDR/CC/robot golden. Database/backend paths are unchanged since that verified revision.
- Local required checks: lint, backend/frontend tests and full build passed; final AI stream/timeline regressions (15) and LLM stub tests (9) passed. Local frontend TypeScript and targeted backend lint/build passed after the final implementation fixes.
- Review: own diff review and CI integration evidence; no independent reviewer claimed. Runtime migrations/baseline checks remain enabled; no implementation/test changes follow this acceptance.
- Handoff: coordinator /root, codex-direct, this scoped plan complete. No unfinished writers or pending gates; all changes pushed. Test logs retained in Documents/Codex/actions-<run-id>.log. Production deployment is not part of CI repair.
