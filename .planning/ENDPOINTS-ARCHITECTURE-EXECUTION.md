# Endpoints architecture repair — EXECUTION / PLAN

## E7 — endpoints table and mobile design, 2026-10-12 (implemented, automated checks with corrective reruns, live UI verified)
- Coordinator and sole writer /root, codex-direct, no agents. User requests a richer endpoint list/card design, row/card editing without an edit action, retained SIP/delete controls, compact icon toolbar with conditional clear selection, and content-sized credentials dialog.
- Baseline main/7263d499 with existing dirty work preserved; prior endpoint assignments are completed. Owned: EndpointsTable/columns/styles/tests, EndpointsPage layout/styles/tests, SipCredentialsModal/styles/tests, EndpointFormModal section headings/styles/tests, endpoint locale keys, bounded shared DataTable row keyboard/interactive-event handling and selection-cell hit area. Other dirty modules, database/runtime/deployment excluded.
- Tasks E7a compact toolbar and surface hierarchy; E7b accessible row/card activation and isolated selection/SIP/delete; E7c content-size credentials; E7d focused interaction/selection/CSV tests, types, mandatory lint/backend/frontend checks, browser light/dark at320/390/768/1440 plus credentials with/without WebRTC. Existing selection across pages/filter and CSV behavior must survive. No actual record mutation is required for visual verification.
- Final user refinement supersedes the unified-card decision: page heading separate from table, without a card background/border/shadow, using TrunksPage typography (shared h1 30px/700) and Phone24 icon badge (10px padding, primary10%, radius-xl). Compact creation actions stay at right; on320 they wrap below, on390 align with heading. Table header only counters/search/tools. Stable selection height and safe checkbox hit area; expert switch inside identity section header, decorated form sections. Basic/expert settings and dashboard query route retain existing behavior.
- E7a-c implemented: icon actions/tooltips, row keyboard activation and card overlay, SIP/delete isolated from editing, conditional clear, fixed counter line height, full desktop selection cell and 40px mobile label hit area, shared ModalSection icons/actions, content-sized SIP dialog. At 768px the desktop table keeps a 60rem minimum width inside its horizontal scroller.
- Targeted run: 6 files / 34 tests, 33 passed and one old form fixture failed because it clicked an unmounted expert switch after leaving Basic. Updated fixture to return to Basic and use the current control; corrective form rerun 11/11 passed. Selection padding regression covers both desktop and mobile. Types pass; root lint pass (0 errors, existing frontend 80 warnings); backend 406 suites / 3894 tests pass (11 skipped). Full frontend completed 340 files: 339 passed, 1 failed; 1841 tests passed, same single historical form fixture failure, corrected 11/11 rerun. Full command retains exit1; no weakened assertions. Final separate-heading layout/selection/page rerun 3 files /13 tests pass; final typecheck pass and scoped lint pass. CSS/icon refinement follows TrunksPage without new behavior.
- Browser evidence: actual local endpoints page at 1440/768/390/320, plus light-theme fixture using demo data. Desktop table Y stays 265.796875 and summary height50 before/after selection; mobile first-card Y stays281 and summary height50. No document horizontal overflow at320/390/768. Checkbox padding selects without opening editor; row/card editing, local expert on/off, SIP open and delete preview/cancel verified without saving records. Form expert switch and identity title aligned on desktop (Y187/186.6); narrow form keeps scrolling body and visible footer. SIP-only desktop 480x441; SIP+WebRTC fixture desktop704x509 and mobile374x608, internal scroll keeps footer visible. These are UI evidence, not backend mutation or release evidence.
- Final review and git diff --check pass. Latest separate-heading UI: no header background, border0, h1 30px/700 and icon24 confirmed from DOM; no document overflow at320/390; at390 heading/button Y76/75. Temporary QA fixture/file/tabs removed; viewport reset; actual local endpoints tab retained for user review. Final screenshot artifacts/endpoints-design-final.jpg; earlier light/form/mobile screenshots show the earlier combined-card revision, with current table/form styling. No open implementation assignments or other workers. Next: user visual review locally. Released: not-applicable (no publication/commit requested).

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
