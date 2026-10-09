# Context defaults and platform assistant — EXECUTION / PLAN

- Coordinator / sole writer: current `/root`, codex-direct. Revision 2026-10-07-r3 (modal exclusivity follow-up).
- Baseline: current main plus prior dirty Endpoints/theme/expert-mode repairs;
  preserve unrelated backend migration/main/package and deleted files.
- Assignment C1: one tenant-wide default context per endpoint/trunk kind,
  editable on ContextFormModal with occupied flags hidden; apply only to untouched create drafts, preserve
  edit/copy choices, explicit required context and localized placeholder.
- C2: audit actual adapter registration, strict schemas, MCP discovery/dispatch,
  skills/intent selection and tenant-visible module coverage. Repair missing
  configuration capabilities, including the new context flags/expert preference.
- Owned: contexts service/UI/API/contracts, bounded endpoint/trunk forms/DTOs and
  AI adapters/skills, tenant-setting references, assistant discovery/coverage
  tests and this evidence. No ai-voice runtime, billing or production deployments.
- Required reads: canonical frontend/backend architecture, AGENTS, canonical
  index, hybrid registry; existing assistant mutation/confirmation/secret contract.
- C3: focused default-selection/validation/adapter/MCP tests, TS and root lint /
  backend / frontend suites; honest static/unit/live coverage matrix.
- Context references use existing tenant settings keyed by UID: each kind has a
  single persisted scalar, so concurrent saves cannot yield two defaults; context
  mutations and setting changes use one DB transaction, conditional clear on
  deselect/delete. No extra context columns or schema migration needed.
- C1 follow-up assigned to `/root`: purpose column displays selected defaults
  only. Latest user steering supersedes table toggles: keep flags in modal, hide
  occupied types on other contexts, keep owner flags available for deselection.
  Hidden fields are omitted from submit even if selected before a catalog refresh.
  Enforce clear-before-select under the tenant/key row lock; update chat recipe.
  Owned files: contexts table/form, tenant-settings default write method,
  context tool descriptions/skill and focused tests. Implemented. Final modal/
  table evidence: 2 files / 4 tests passed, covering hidden occupied flags, owner
  deselection, omission after a catalog change and read-only table marks. Both
  TypeScript checks and final root lint passed (existing warnings). Server:
  3 targeted suites / 18 tests; full backend 381 suites / 3589 tests passed,
  11 skipped. Full frontend passed: 313 files / 1645 tests, exit 0; started before
  final UI steering, so final modal/table delta is covered by a focused rerun.
  Locale follow-up: RU/EN keys already existed; added dictionary HMR refresh in
  shared/config/i18n.ts and an actual i18next key-resolution test. Final focused
  suite: 3 files / 5 tests passed. This diagnoses stale development dictionaries
  as a possible cause; no browser reproduction of the reported missing keys.
  Final locale delta: frontend TypeScript and targeted ESLint passed; key test
  rerun passed with language fallback disabled via an empty fallback list.
- Subsequent locale report reproduced with real i18next + stable query rows:
  TanStack retained English accessor strings after changing to RU. This confirms
  the actual table-cache cause and supersedes the earlier tentative HMR diagnosis
  for these labels. Refresh table data identity when the translation function
  changes, keeping UID selection and current-language CSV values. Regression
  EN -> RU -> EN failed before the fix and passed after it; focused 4 files /
  6 tests passed. No backend change or repeat of broad suites for this UI delta.
  Live DB concurrency/browser validation not run for this follow-up.
- C1 implemented, tests pending: virtual context flags resolved from internal
  tenant_settings UID references; atomic context/default writes, compare-and-clear
  on delete/deselect; typed DTOs; context flags and form errors; shared untouched
  draft default hook for endpoint/bulk/trunk, required explicit context.
- C2 expanded by user's steering: deep field/operation parity, working recipes,
  conversational continuation and verifiable configuration diffs, rather than
  only domain-presence checks. Real adapter-factory/MCP discovery test passed:
  35 domains / 106 tools at first snapshot (before later tools). JSON report
  generated in Temp krasterisk-aichat-capabilities.json; static inventory here
  AICHAT-TOOLS-INVENTORY.txt. Discovery test does not boot a live Nest/DB app.
- Implemented so far: configuration capability/schema discovery; platform-
  configuration skill; get/update endpoint and trunk; context flag schemas;
  update route + create route options; expanded queue parameters/advanced fields;
  expert-mode/page-size settings allowlist; shared PJSIP and queue field catalogs;
  planned context names; generic confirmation continuation; required configure
  tool use; structured before/after view and protected provider-secret confirmation
  path (single proposal + workflow) under implementation/validation.
- C1/C2 implemented: [actual capability audit](AICHAT-CAPABILITY-AUDIT.md) and
  [JSON inventory](artifacts/aichat-capabilities.json): 35 domains / 117 tools /
  48 executable mutation contracts. Added call-group settings, endpoint resource
  catalogs/ownership, MOH sort, notification public config, prompt metadata and
  speech-provider name/enabled; fixed false configure classifications.
- Conversation continuation now confirms a scoped single proposal as well as a
  workflow, refuses to start a secret-bearing plan before protected UI input,
  and refreshes entity/card caches after a chat-confirmed change. Explicit
  `примени` accepted; questions/conditions/negation remain nonconfirmations.
- State: automated-tests-passed for the implemented C1/C2 scope. Own verification:
  backend discovery/configuration 64 tests passed; additional proposal/workflow
  47 passed; final registry/legacy/core/security 48 passed; conversation/security
  53 passed; context/default transactions 8 passed; shared 10 suites/69 passed;
  frontend final cards/stream 3 files/35 passed and defaults/forms tested separately.
- Mandatory full frontend: PASS, 312 files / 1641 tests, exit 0 (Temp
  krasterisk-ai-frontend-final.log). Latest stream delta separately PASS (35 tests).
- Mandatory full backend: PASS, 381 suites / 3588 passed / 1 suite and 11 tests
  skipped by existing suite configuration; exit 0, krasterisk-ai-backend-verified.log.
- Mandatory lint: PASS, exit 0, backend 116 warnings / frontend 85 warnings;
  krasterisk-ai-lint-verified.log. Backend and frontend TS: PASS, both exit 0,
  krasterisk-ai-{be-types,fe-types}-verified.log. Shared build/tests PASS (69 tests).
- Latest changes after full frontend run: chat-applied SSE cache invalidation
  passed targeted stream/card tests; 16 RU/EN progress labels for new tools have
  locale/stream targeted validation. They do not change configuration writes.
- Final next action for any further work: use the capability audit's explicit
  missing-operation list to assign a new bounded scope; validate real LLM/DB/SIP
  separately against a designated test cabinet. Preserve the entire dirty baseline;
  no commit, reset, production deployment or neighbouring initiative closure.
- Browser evidence: localhost:3010/contexts, unsaved form with both independent
  flags checked, [screenshot](artifacts/context-defaults-form.png). Draft canceled;
  server-backed list returned a loading error. Live DB writes, real LLM tool use,
  SIP registration/call and external delivery remain pending; no release/deploy.
- Do not mark all modules writable: existing protected platform/RBAC/billing
  boundaries must remain consistent with current actor permissions and contracts.
