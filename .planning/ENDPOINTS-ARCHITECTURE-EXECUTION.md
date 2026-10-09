# Endpoints architecture repair — EXECUTION / PLAN

## Follow-up: basic / expert form (2026-10-07-r1)

- Coordinator remains `/root`, codex-direct; sole writer, no delegated workers.
- User refinement replaces the initial browser-persistence interpretation:
  `/settings` → Абоненты contains a tenant-wide persisted expert preference;
  each create/edit modal has a session-only switch with a global-setting hint.
- Owned extension: entities/tenantSettings defaults/public API/API tests,
  features/tenant-settings EndpointExpertModeSetting, SettingsPage wiring,
  backend tenant-settings key descriptor and focused service tests. Existing
  unrelated dirty backend changes are retained.
- E6: no tabs by default; local switch shows all six tabs until form closes;
  global `endpoints.expert_mode` default false, true forces tabs in every form;
  global switch uses existing optimistic RTK update/undo. No DB migration needed
  for an additional key in the existing tenant-settings store. Session switches
  never mutate endpoint records or global preference. Hidden invalid drafts open
  the appropriate expert tab so validation remains actionable.
- Implemented. Initial targeted final run: 3 frontend files / 18 tests pass;
  tenant-settings service target: 9 tests pass. Browser basic/expert/reopen reset
  and settings section verified; live global save pending (local API unavailable).
- Root backend full run: 376 suites / 3567 tests pass, existing 11 skipped;
  added service scenario passed in the targeted final rerun. Full frontend initial
  run blocked by sandbox esbuild parent-directory access; escalated rerun active.
- Final lint pass (0 errors, existing backend 115/frontend 85 warnings), final
  frontend TypeScript pass, git diff --check pass. Own diff review completed.
  Settings UI target adds 3 passing tests: write payload, rejected save, load retry.
  Total targeted frontend coverage: 4 files / 21 passing tests.
- Full frontend rerun processed 309 files: 308 passed, 1 failed (1631 tests
  passed, 3 failed). All three failures were the SettingsPage isolated layout
  fixture missing the new card mock, causing a missing Redux Provider error.
  Updated its existing card-mock pattern and asserted the new endpoint section.
  Corrective rerun SettingsPage + EndpointExpertModeSetting: 2 files / 6 tests
  pass. The new setting's test file was added after full-run enumeration and
  passed separately (3 tests). No assertions removed or production behavior
  weakened. Full command retains its historical exit 1; affected file retest
  passed, no second 309-file run after the test-only fixture fix.
- Automated checks complete; browser basic/expert/reopen reset pass. Live global
  GET/PUT not verified because the local backend API is unavailable; mocked RTK
  request/cache/undo and backend storage/type/tenant-isolation tests pass.
- Status: implemented, automated-tests-passed with the corrective retest above;
  representative UI live-verified. No active workers or remaining implementation
  assignments. Next: user review locally; live global save when API is available.
  Logs: host Temp krasterisk-expert-{lint-final,types-complete,backend,
  backend-target,target-final,frontend-final,settings-test,settings-retest}.log.
  No publication/commit requested. Screenshot: artifacts/endpoint-basic-mode.jpg.

- Coordinator and sole writer: current chat `/root`, codex-direct.
- Revision: 2026-10-06-r1; baseline: main/c63d7c23.
- Assignment: user's Endpoints architecture audit and request to fix every finding.
- Required reads: AGENTS.md, CANONICAL_REFS.md, frontend/backend ARCHITECTURE.md,
  HYBRID-WORKFLOW.md, EXECUTION-REGISTRY.md, completed BLF-SUPPORT.md.
- Owned paths: frontend features/endpoints, pages/EndpointsPage, shared endpoint/
  pickup-group API, endpoint-specific locale keys, shared endpoint contracts/index,
  and bounded shared UI/API helpers needed by these components and their tests.
- Excluded: existing dirty backend files/deletions, unrelated phases and deployment.
- Shared contracts/locales owner: this chat only; no delegated workers.
- Tasks: E1 typed shared contracts/schema/public APIs; E2 canonical forms, tooltips,
  responsive SCSS, validation and accessible controls; E3 advanced settings sync,
  groups lifecycle, truthful bulk status and localized errors; E4 real selection/
  CSV/column integration tests, selectors and missing component tests; E5 lint,
  shared build, frontend typecheck, backend/frontend suites and UI review.
- Acceptance: no raw business JSX/Tailwind/Radix wrappers, stable modal shells,
  complete RU/EN keys, validated local drafts, all audited defects covered.
- E1–E4: implemented. Shared contracts/schema/public APIs, shared form controls,
  scoped SCSS, password controls, inline validation, grouped PJSIP editor with
  same-length value synchronization, safe group deletion, truthful bulk job errors,
  real cross-page selection/CSV/delete tests and complete RU/EN key coverage.
- Bounded extensions: reusable PJSIP editor/config moved to shared to remove the
  existing trunks -> endpoints feature dependency (TrunkFormModal imports only);
  shared DataTable selected CSV uses all selected rows, not only visible matches;
  shared Dialog/InfoTooltip accessible labels localized; Windows vitest chunks
  use one fork worker after the existing threads runner hung during verification.
- Shared pagination regression fixture: ConversationsTable.test.tsx mock now
  interpolates common.tableRange from the actual RU locale. Full suite first run
  found this single failure in chunk 6; isolated repeat passes all 4 tests. This
  is a test-only compatibility change, not speech analytics feature work.
- Gates: shared build pass; frontend typecheck pass (final repeat exit 0);
  root lint pass (0 errors, pre-existing warnings); backend pass (376 suites,
  3567 tests, 1 suite/11 tests skipped); frontend full-suite coverage complete.
- Targeted evidence: real table/shared DataTable, bulk job and group lifecycle
  12 tests passed; complete module first run 48 pass/2 test assertion failures,
  corrected label selector and plural locale fallback, repeat 14/14 pass.
- Final scoped suite: 17 files / 56 tests pass (Endpoints feature, endpoint
  entity, EndpointsPage and shared DataTable). Draft-only PJSIP rows now remain
  mounted across tabs; reserved NAT/WebRTC columns are excluded from the endpoint
  advanced editor so profile patches cannot silently discard entered values.
- Final frontend lint: pass, 0 errors / 85 existing warnings. Own diff review and
  normal git diff --check: pass (line-ending notices only, no whitespace errors).
- Browser evidence: local localhost:3010, unsaved create/bulk dialogs at 360x800
  and 768x900, PJSIP editor at 1440x900; stable body/footer, grouped selects, password
  masking and field errors. Live API list currently unavailable: list/API CRUD
  integration is covered by mocked API UI tests, not claimed live-verified.
- Full frontend evidence: npm run test:frontend processed all 308 files, 1625
  passed tests / 1 failed assertion. Its aggregate exit stays 1 for that run.
  The sole failing ConversationsTable fixture was corrected and repeated:
  1 file / all 4 tests pass, targeted lint exit 0. Remaining 307 files passed.
  The added final advanced-tab regression also passed in the 17-file/56-test
  scoped final suite. No remaining failing tests were observed; no second full
  run was needed for a file-local translation mock adjustment.
- Status: implemented; automated-tests-passed with the explicit full-run +
  targeted-retest evidence above. Own review complete. Live UI pass for unsaved
  forms; live API CRUD pending because API list is unavailable. Release N/A.
- Handoff: coordinator /root completed E1–E5; no active writers or implementation
  work remains. Existing dirty backend/deletions retained. Temporary Vite on 3011
  stopped; user's 3010 server retained; browser viewport reset and test tab closed.
  Next optional gate: authenticated API CRUD verification once API access works.
