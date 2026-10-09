# Routes / contexts access refactor — PLAN and EXECUTION

- Coordinator and sole writer: `/root`; mode `codex-direct`; revision 2026-10-08-r1.
- Authorized scope: ordered context includes, removal of route_type permissions,
  tests and isolated live validation on root@ipbx.krasterisk.ru. Preserve the
  existing dirty baseline. No new permission-profile entity or external calls.
- Owned paths: contexts/routes backend services, DTOs and AI contracts/skills;
  context/route frontend forms, shared ordered-list wrapper, locale/API types;
  focused tests, bounded module docs and this evidence. No neighbouring state.

## Tasks
1. R1: tenant-owned ordered include graph. Atomic replacement within context
   save; duplicate/self/cross-tenant and transitive-cycle validation; serialize
   graph writes by locking tenant contexts in UID order. Secure legacy add/remove.
2. R2: context form selection + accessible ordered drag/drop list (keyboard and
   buttons). Store the order as priorities in existing context_includes; no DDL.
   Show direct and effective included contexts with search-order explanation.
3. R3: remove Route Type from form and assistant write schema. Keep historic
   persisted route_type inert for compatibility; do not rewrite existing DB data.
   Verify generated managed route chains terminate. Raw dialplan remains expert.
4. R4: unit tests (ownership, cycle, atomic order), UI draft/save/reorder and
   language tests, TypeScript, root lint/backend/frontend gates.
5. R5: SSH read-only preflight; build current services locally; isolated generated
   test contexts on the existing Asterisk, local test calls with no trunk usage:
   first include, reordered includes, own-context precedence, transitive include,
   unreachable number. Use unique namespace, save evidence and remove only test
   resources. Validate actual DB/service path against a disposable test tenant
   if the existing local connection is available; restore all test resources.

## Acceptance
- No Route Type input; context selection preserved.
- Context create/edit persists selected includes and order atomically.
- Includes only within tenant, no graph cycles or duplicates under concurrent edits.
- Own context before ordered depth-first includes; UI explains this distinction.
- API/chat use the same validation, not an alternative permissions registry.
- Tests distinguish unit, live Asterisk and actual backend/DB coverage.

## Status / next action
- R1/R2/R3 implemented; sole writer `/root`. Backend includes are persisted atomically
  with context metadata/defaults and validated for ownership, cycles and ordered writes.
  Legacy endpoints and chat use the same service. Context writes apply via AMI and
  return explicit dialplan_applied status; form retries apply without another create.
  Deletion cleans DB references, clears the category and reapplies direct parents.
  Managed route chains terminate; context names reject config/path injection characters.
- R4: full backend PASS (382 suites / 3598 tests, 11 skipped); final backend delta
  PASS (7 suites / 60 tests). Backend build PASS; frontend TypeScript PASS; root lint
  PASS (existing warnings), final targeted lint PASS. Full frontend PASS:
  316 files / 1649 tests. Final UI delta PASS: 4 files / 9 tests; final frontend
  TypeScript and scoped ESLint PASS. git diff --check PASS.
- R5 live-verified: [evidence](artifacts/context-includes-live.json), 8 cases PASS:
  ownership/duplicate/cycle/atomic rollback, first include, reorder, own precedence
  and terminal chain, transitive includes, explicit unreachable-number rejection,
  concurrent reverse-edge prevention, deletion revokes inherited access.
  Actual production controllers and services hosted in an isolated local Nest HTTP
  app with real JWT strategy, current .env DB and remote AMI; no worker boot or PSTN.
  Calls use Local channels on certified Asterisk 22.8. No SIP-phone registration or
  trunk failover claim. No deployment of the full application to the remote server.
- Cleanup verified: final test tenant contexts/includes/routes counts all zero;
  no extensions_ctxaudit_*.conf files; zero active channels/calls. Earlier harness
  errors (AMI callback shape, missing command seam, empty response parsing and
  overly strict cleanup filename regex) repaired; all earlier files cleaned too.
- Status: implemented, automated-tests-passed, live-verified for the isolated
  HTTP/DB/AMI/Local-channel scenarios above. Not a full application release.
- Next action for follow-up: keep the dirty baseline, use the saved manual live
  harness after a backend build; SIP phone/transfer/PSTN scenarios require a
  separately assigned fixture. Current assignment complete; no active writers.

## R6 — AiChat/MCP parity follow-up (2026-10-08)
- Coordinator/writer `/root`, codex-direct; current assignment R6, revision r2.
- Owned paths: contexts-ai.adapter.ts and its tests, registered-capabilities.spec.ts,
  existing contexts/routes/endpoints/trunks/pbx-setup/platform-configuration skills,
  bounded capability evidence and this plan. Preserve all unrelated dirty changes.
- Fix optional ModuleRef narrowing; add read-only context search graph and confirmed
  retry apply; expose ordered includes in review and skills, validate draft graph.
- Gates: backend build, targeted adapter/registry/MCP/skill and diff checkpoint tests,
  scoped lint. Previous full R4 and isolated live R5 evidence remains as recorded.
- Status: in_progress. Next: implement adapter and recipes, then verify.
- R6 scope addendum: routes-ai.adapter.ts knowledge block only, same writer `/root`.

- R6 implemented / automated-tests-passed: backend build PASS; scoped lint PASS;
  6 suites / 77 tests PASS, final ORM/getter+adapter/checkpoint/registry/skills
  delta 4 suites / 43 tests PASS. Registry: 35 domains, 119 tools, 49 canonical
  mutation contracts. All six updated skills copied to dist by backend build.
- R6 adds get_context_configuration and confirmed apply_context, ordered-name
  previews, graph preflight/revalidation, update reload checkpoint and saved UID
  on create apply failure. Optional ModuleRef narrowed via local constant.
- No R6 live LLM/AMI claim; R5 live evidence unchanged. Previous required full
  lint/backend/frontend results remain above; frontend code untouched in R6.
- Initial report export failed because the output path was relative to backend;
  rerun with repository absolute path passed. No product test failure remained.
- Handoff: R6 complete, sole writer /root, no active writers or pending required
  gates. Preserve dirty baseline; next action only on a newly assigned follow-up.

## R7 — Context identifier and form tooltip follow-up
- /root, codex-direct, sole writer; owned shared contextIdentifier/export, context DTO/service/AI schema, form/includes editor, RU/EN locales, bounded tests and contexts skill.
- Product identifier: 1–64, lowercase Latin initial letter, lowercase letters/digits, single internal hyphen/underscore. No automatic rename of stored contexts.
- All instructional form hints in InfoTooltip; preserve visible actionable errors.
- Status in_progress; next: targeted validation/UI tests, build/typecheck/lint.
- Sandbox setup refresh broken; authorized workspace reads/writes via reviewed require_escalated shell.

- R7 implemented / automated-tests-passed: shared build PASS; backend build PASS; frontend TypeScript PASS; scoped backend/frontend ESLint PASS; shared 26 tests, backend 24 tests (DTO/service/AI/MCP discovery), frontend 7 tests PASS. HTML pattern verified with RegExp v flag. git diff --check PASS.
- Existing invalid identifiers are displayed without automatic renaming; form requires a valid identifier to save. Backend metadata-only patches omit name and do not rename existing rows. Description remains Unicode/free text (128 limit). Instructional includes/effective-order text moved to InfoTooltip; error status remains visible.
- Handoff: R7 complete; /root sole writer, no pending required gates or active writers. Preserve dirty baseline; no migration/deployment/live PBX action in R7. Full prior R4 suite evidence remains above; targeted checks cover this delta.

## R8 — Single tooltip presentation across frontend
- /root, codex-direct, sole writer; scope shared Tooltip, regression tests, ExtensionChips, ModuleShell, route-template action titles, canonical frontend architecture.
- Remove simultaneous HTML title/custom tooltip, preserve accessible labels and native title where no custom content exists. Audit all JSX tooltip sites.
- Status in_progress; next targeted tests, TypeScript, scoped lint and audit evidence.

- R8 scope addendum: RouteTemplatesPage.test.tsx expectations and single-tooltip-audit.json. Shared regression tests passed; template test updated to require no title when the built-in read-only tooltip is shown. The native title remains for ordinary actions without custom tooltip.

- R8 implemented / automated-tests-passed: AST audit 488 non-test TSX files / 297 tooltip sites; only 2 guarded titles remain (builtin false means custom content absent). Evidence artifacts/single-tooltip-audit.json.
- Tests PASS: shared Tooltip + context/route forms 3 files / 13 tests; ModuleShell 15 tests; final RouteTemplatesPage 2 tests. Initial table expectation required native title even under tooltip; updated to architecture exception and final pass. Total 30 targeted tests.
- Frontend TypeScript PASS; scoped ESLint PASS (2 existing ModuleShell hook warnings); diff check PASS. No new backend changes or live-browser claim.
- Handoff: R8 complete, /root sole writer, no pending required gates or active writers. Preserve dirty baseline.

## R9 — Caller ID routing rules (current assignment)
- /root, codex-direct, sole writer. Scope shared rule parser/serializer and conservative dry-run, routes DTO/service/AI/preference utilities, AMI managed-file replacement, route apply, ExtensionChips editor and RU/EN locales, skills, targeted tests and isolated live harness/evidence.
- Store canonical extension/callerId strings in existing JSON; no database migration.
- Without Caller ID keep direct generation. With Caller ID dispatch to tenant/route private execution context preserving EXTEN. Replace owned context file categories to revoke removed execution contexts.
- Validate rules, reject duplicate pairs, disclose overlaps/dry-run limitations. Test current-caller matching, masks, fallback, anonymous, CID change mid-chain, includes, update/delete/disable and cleanup using HTTP/DB/AMI/Local only.
- Status in_progress; next implement bounded contract/generator/UI, automated gates, then remote live cases and cleanup.

- R9 implemented. Shared tests 3 suites / 30 PASS; backend targeted 7 suites / 79 PASS; routes AI/precedence/agent eval PASS; editor 2 files / 5 PASS. Root lint PASS (116 backend / 85 frontend existing warnings). Frontend TypeScript PASS.
- Live first run cidaudit_dcb6ebf8a3: 10 HTTP/DB/AMI/Local cases PASS, cleanup true. Separate DB check tenant 808284587: contexts/includes/routes all zero. SSH: no matching files, 0 active channels/calls. Evidence artifacts/route-caller-id-live.json.
- Current gates: full backend/frontend tests running (logs TEMP/cid-backend-full-verified.log and TEMP/cid-frontend-full.log), final backend build running. Initial root backend --runInBand forwarding failed before tests; corrected with extra separator.
- No active delegated writers; /root owns all R9 paths. Next: inspect full-gate outcomes, rerun final compiled live harness, verify cleanup and save final evidence. No PSTN/SIP provider or live LLM claim.

- Full backend: 385 suites / 3625 tests passed, 11 skipped, one fixture failed: generic UID helper used directory UID for the R6 get_context_configuration tool. Scoped fixture repair selects the matching entity catalog, retaining cross-tenant assertions. Writer /root owns this test-only repair. Rerun failing suite through root onlyFailures; no production behavior changed for this repair.

- R9 final automated gates: root lint PASS (existing warnings), full frontend 318 files / 1658 tests PASS. Full backend 385 suites / 3625 PASS / 11 skipped initially; the only failed legacy fixture repaired and rerun through root onlyFailures PASS (14 tests). Final production raw-null delta + schemas 3 suites / 39 PASS; all original full-run failures resolved, no remaining failed gate. Final backend/shared builds and frontend TypeScript PASS.
- R9 final live: cidaudit_f8714e5c1a, 11 cases PASS including explicit raw override clearing. Evidence artifacts/route-caller-id-live.json; HTTP controllers + actual DB + remote AMI + Local channels. No full app deployment, SIP registration, provider/PSTN or live LLM claim.

- R9 post-cleanup verification PASS: disposable tenant contexts/context-includes/routes all zero; no extensions_cidaudit_*.conf files; marked CDR rows removed; remote Asterisk certified-22.8-cert2 reports zero active channels/calls. Evidence includes post_cleanup_database.
- Handoff: R9 complete, implemented / automated-tests-passed / live-verified for 11 isolated HTTP/DB/AMI/Local scenarios. Coordinator and sole writer /root; no active writers or pending required gates. Local implementation preserved over the existing dirty baseline, no full application deployment or release claim. Next action only on a newly assigned follow-up.

## R10 — Inline two-field dial rule editor (2026-10-09)
- /root, codex-direct, sole writer; bounded ownership ExtensionChips component/styles/tests and RU/EN instructional strings. Preserve dirty baseline and R9 server behavior.
- Every rule is an editable Extension/Caller ID pair; empty Caller ID means any. Ghost add button creates another pair; no saved-rule cards or caller mode selector. Preserve validation, external value synchronization and parent save blocking for invalid drafts.
- Status in_progress; next implementation and required lint/backend/frontend gates.

- R10 implemented: editable pairs, ghost Plus add, row removal, immediate serialization, empty rows ignored, invalid/duplicate drafts block parent Save. Empty Caller ID means any; opening a legacy anonymous rule normalizes its local draft to unrestricted until explicit form Save. RU/EN tooltips updated.
- Targeted 2 files / 7 tests PASS; final frontend TypeScript and scoped editor ESLint PASS. Root lint PASS (116 backend / 85 frontend existing warnings). Full backend PASS: 386 suites / 3627 tests, 11 skipped. Full frontend in progress. Browser attempt unavailable: cua kernel failed with sandbox helper setup refresh error, no live browser claim. R9 dialplan/server live evidence unchanged; no backend/runtime change in R10.
- R10 bounded scope addendum: matching editor paragraph in .docs/ROUTES_MODULE.md, same sole writer /root.
- R10 user steering: one shared column-heading row; remove Extensions heading and repeated per-row labels, move dial rule tooltip to destination heading, preserve accessible field labels via aria-labelledby. Final targeted/type/lint delta to follow; full frontend run continues.

- R10 final gates PASS: full frontend 318 files / 1660 tests (all 8 batches, exit 0); full backend 386 suites / 3627 tests (11 skipped, exit 0); root lint zero errors with existing warnings. Final heading delta 2 files / 7 tests, scoped ESLint and TypeScript PASS. git diff --check PASS. Final removal of row wrapping keeps fields aligned under shared headings.
- Handoff: R10 complete, implemented / automated-tests-passed; coordinator and sole writer /root, no active writers or pending required automated gates. Browser verification unavailable due the sandbox helper failure, not claimed as live-verified. No remote deployment/runtime changes; R9 server evidence retained. Preserve dirty baseline; next work only from a new user assignment.

## R11 — Caller ID application v2 (2026-10-09, accepted)
- Coordinator/sole writer /root, codex-direct; no delegates. User approved complete plan: independent number/name, snapshot before step, original CID at first platform entry, directory five keys, lists/mapping/pools, Unicode text transformations, legacy dual-read, trunk entry snapshot and isolated live verification.
- Owned shared Caller ID contract/normalizer/name evaluator; backend Caller ID compiler, DTO/draft/reference validation, dialplan bridge transform/list endpoint, trunk snapshot, route/host metadata; frontend callerid schema/editor/rewrite widgets/locales; AI catalog/knowledge/skills; bounded tests, manual harness/artifacts and this plan. Preserve unrelated dirty baseline and completed external initiatives. No migration or full deployment.
- Execute slices: shared contract -> validation and compiler/bridge -> editor -> AI/template compatibility -> targeted/build/types/lint -> full backend/frontend -> actual AMI/DB/HTTP/Local and mock-PJSIP test trunks on ipbx.krasterisk.ru -> clean owned resources and record evidence.
- Defaults: snapshot input for both fields; keep on missing/error, explicit empty/hangup on missing and hangup on error; pool state per tenant/host/step/hash under lock. Version 2 new saves, legacy execution unchanged until explicit edit; number/name tabs are navigation only.
- Status accepted: implemented, automated-tests-passed, isolated live-verified. Final evidence and handoff are below. Sandbox helper required reviewed require_escalated commands for authorized repo/SSH work.

- R11 implemented: shared v2 contract/dual-read adapter, Unicode evaluator, compiler/internal bridge, editor, tenant validation, AiChat descriptions/skills and trunk entry snapshot. Full root lint/backend/frontend gates passed before final error-protocol hardening; final targeted checks/build/types in progress. Live scenarios 1–17 pass so far; remaining mock-trunk/cleanup gates pending. Sole writer /root, next inspect final live output and targeted delta checks.

- R11 acceptance (2026-10-09): implemented / automated-tests-passed / live-verified for isolated scenarios. Shared build/tests (5), backend builds/types, frontend TypeScript, root lint and final scoped lint PASS. Root lint retains 116 backend / 85 frontend existing warnings.
- Full backend run: 386 suites / 3637 tests PASS, 11 skipped, one outdated directory-policy protocol fixture failed. Fixture now checks encoded protocol; root onlyFailures PASS (1 suite / 7 tests). All full-run failures resolved. Final trunk/template regression 181 PASS; final compiler/bridge strict mapping regression 8 PASS. No remaining failed automated gate.
- Full frontend final PASS: 319 files / 1665 tests, all 8 batches exit 0. Final expert conversion keeps complex rules, including an explicit empty replacement and disabled rule state; clear is an explicit model change. Final diff check PASS. Automated evidence artifacts/callerid-app-v2-automated.json.
- Main live cidapp_9a4e577a18: 20 grouped scenarios PASS, real HTTP controllers + disposable DB + remote AMI + Local + loopback PJSIP INVITE. Verified simultaneous snapshot values, Unicode preview equivalence, all directory keys, empty original CID, transition/loop, concurrent locked pools, missing/error atomic fallback, legacy static, SIP per-trunk overrides and failover restoration, single-trunk preservation. Report artifacts/callerid-app-v2-live.json.
- Additional list/pool follow-up PASS: 4 scenarios (strict mapping missing vs first, singleton pool, empty catalog, exact plain-list identity). Report artifacts/callerid-app-v2-mapping-live.json. New mapping has no implicit first-number fallback; conversion warning and skills disclose this difference.
- Live testing found and repaired two runtime defects: raw JSON HTTP error protocol was compared inside Asterisk expressions (now encoded comparisons); inline trunk carousel called Return without Gosub (now finishes at a continuation label; single trunk also preserves entering identity). Server journal confirmed the latter. These corrections are intentional.
- Cleanup independently checked by follow-up read-only DB/SSH commands by the same coordinator (not an independent reviewer): both disposable tenant scopes have zero contexts/includes/routes/numbers/directories/settings/CDR, owned ps_endpoints/ps_aors are zero, no owned config files/AstDB state/processes remain; server has zero active channels/calls. Reports include post_cleanup_database/server.
- Scope addendum: bounded template JSON round-trip regression, .docs/ROUTES_MODULE.md, AiChat audit notes and capability inventory. MCP discovery remains 119 tools. No live LLM claim; browser automation unavailable due sandbox helper failure and no browser verification claimed. No migration, full application deployment, provider/PSTN call, commit or release.
- Handoff: R11 complete; coordinator and sole writer /root, no active writers or required pending gates. Preserve the existing unrelated dirty baseline. Current plan is this R11 revision; next work only on a new user assignment. Local implementation ready for use after normal backend reload/build.

## R12 — Expert mode prop for reusable DialModifyField
- /root sole writer, codex-direct, bounded frontend follow-up. Owned DialModifyField and CallerIdEditor components/tests, RU/EN strings, this plan and test evidence. Preserve R11 and unrelated dirty baseline.
- allowExpertMode defaults true; Caller ID passes false for both targets. Hide expert editor/switch, retain basic fields and actual preview. Saved complex rules remain unchanged until explicit confirmation of replacement through a basic edit.
- Status implemented; next targeted tests/types/lint and required root gates. No backend/runtime/remote changes.

- R12 user steering: fix allowed-character validation in name modification. Reproduced with a failing shared test: undefined optional transform fields caused invalid_transform. Owned scope extends shared callerid validator/tests and preview sample helper/tests. Name textMode retains Unicode/whitespace; number validation remains strict. Next targeted regressions/build/type and final gate outcomes.

- R12 current evidence: editor/sample regression 3 files / 27 tests PASS; shared name regression 6 PASS (initial failing test reproduced optional undefined error). Final backend/compiler DTO delta 167 PASS. Full backend 387 suites / 3638 tests PASS, 11 skipped; root lint PASS with existing warnings. Shared/backend builds and frontend TypeScript/scoped lint PASS. Full frontend still running in shell session 45652 (TEMP/r12-frontend-full.log); next inspect all 8 batches and save final acceptance. No new SSH/runtime fixtures. Sole writer /root.

- R12 accepted: all root gates PASS; backend 387 suites / 3638 tests (11 skipped), frontend 319 files / 1670 tests, root lint existing warnings only. Editor/sample 27 tests, shared 6 tests, backend delta 167 tests, builds/types/diff PASS. allowExpertMode false in Caller ID; name textMode accepts Unicode and preserves sample whitespace. No pending R12 gates.

## R13 — Notify legacy contract/errors and Caller ID source UX
- /root sole writer, codex-direct; extends same canonical plan under current user steering. Owned shared notify normalizer/export/tests, backend action parameter validation and notify compiler/tests; frontend route modal error feedback, shared dialplan editor/sheet/reducer/client/server error helpers/tests and relevant RU/EN strings; CallerIdEditor source labels/tooltips/tests; bounded docs/evidence. Preserve unrelated initiatives and dirty baseline. No live notification sending or modification of user's route 3.
- Dual-read message -> body when canonical body is absent; canonical UI saves body, preserving explicit canonical values. Ensure save errors visible, navigate/open invalid action and translate known notify errors. Explain each Caller ID source and differentiate manually entered value from original platform Caller ID.
- Status in_progress; next bounded implementation, regressions and required final gates.

- R13 implemented: Notify legacy adapter and canonical body saves, pre-PUT validation, persistent route save feedback and automatic opening of the invalid step; localized notify field errors. Caller ID purpose tooltip now explains number/name, tabs Number/Name, explicit per-target source labels and full source descriptions. Long help uses optional InfoTooltip contentClassName with local SCSS viewport scrolling. Owned scope includes shared Tooltip prop, CallerIdEditor.module.scss and targeted locale tests.
- Current evidence: shared Notify 2 tests PASS, backend DTO/compiler 331 PASS, frontend final targeted 6 files / 37 PASS. Types/build/scoped lint PASS (2 existing RouteFormModal hook warnings). Required root gates running: backend session 33632, frontend session 52339, lint session 14764; logs TEMP/r13-*. Sole writer /root; next inspect gate outcomes, save final acceptance. No provider/integration messages sent and no user route data overwritten.

- R13 final baseline gates PASS: root lint, backend 387 suites / 3641 tests (11 skipped), frontend 321 files / 1678 tests.

## R14 — Remove access-list sources and readable save validation
- /root sole writer, codex-direct. Supersedes R11 recommendation to use access NumberList for Caller ID. Owned frontend dialplan editor sources/catalog registry/errors/sheet/schema wrappers and route modal/tests/RU/EN; backend AI descriptions and runtime skills docs, bounded evidence. Retain legacy runtime read compatibility, no automatic database rewrite. Manual numbers/pool are call destinations/identities, not access catalogs.
- Parse structured action-ID, index paths and Nest message-array errors; show localized feedback and open/focus the invalid step including collapsed sections. Raw server payloads stay out of user UI. Status in_progress; next implement and targeted regressions, final required gates.

- R14 scope addendum: RouteGeneralTab receives localized top-level field errors and focuses name/context/extensions. Action-mode reveal is local presentation state and preserves raw/action execution source.

- R14 final review found value-source fields dropped server error text when their source was complete. Bounded ownership includes ValueSourceField invalid prop, SchemaFields wrapper/error, and options/conditions focus anchors. Added a complete-source server-validation regression.

- R14 accepted: production source audit 81 files, zero access catalog imports/options. NumberList removed from Caller ID selectors, shared application catalog loader/schema metadata and active AI guidance. Saved obsolete sources receive an explicit replacement notice; manual pools/dial destinations preserved.
- Mandatory root lint PASS; final frontend types and scoped lint PASS (7 existing warnings). Full backend 387 suites / 3641 tests PASS, 11 skipped. Full frontend 322 files / 1692 tests covered: initial 1691 PASS / 1 new-fixture failure (ambiguous two-combobox query). Corrected fixture and repeated the entire failed 40-file batch: 286 PASS; no unresolved failures. Final targeted coverage 108 tests, repaired navigation subset 3 files / 18 PASS. Diff check PASS.
- Evidence: artifacts/callerid-editor-followups-automated.json. Browser attempt failed before page access: node_repl Windows sandbox helper setup refresh error. No real-browser verification claim. No DB rewrite, remote changes or notification sending. R13 and R14 implemented / automated-tests-passed; optional manual browser confirmation remains unavailable, not a release claim.
- Handoff: coordinator and sole writer /root, codex-direct; current assignment R14 complete, no active writers or required pending automated gates. Preserve unrelated dirty baseline. Next work only on a new user assignment; optional live form check when UI tools recover.

## R15 — Route General layout and grouped settings
- /root sole writer, codex-direct, bounded frontend follow-up. Root cause: R14 replaced VStack with Flex for ref without retaining align=stretch. Scope RouteGeneralTab/RouteFormModal SCSS, ExtensionChips adaptive grid/labels, relevant RU/EN headings and existing tests. Restore full-width layout, group identity/routing/recording+analytics, stack fields at 640px, retain error focus and all behavior. Next targeted tests, types/lint and stylesheet compile; reuse accepted R14 full backend/frontend evidence for unchanged runtime.

- R15 implemented / targeted-tests-passed: three semantic settings sections with RU/EN titles, muted Lucide icon badges, theme surfaces/borders/shadow and clear heading hierarchy. Root Flex explicitly restores align=stretch and max. Name/context stack at 640px; dial rules use grid, mobile per-field labels and compact remove actions. Scoped grid selectors outrank Stack display defaults. Removed hardcoded white analytics select text.
- Verification PASS: route general/modal/extension regressions 3 files / 19 tests, frontend tsc, scoped ESLint, both SCSS compile and diff check. Accepted R14 full-gate evidence reused for unchanged backend/runtime and unrelated frontend modules; no broad rerun for layout-only changes. Browser retries failed before page access (trusted Node/kernel, Windows sandbox helper refresh); no live viewport claim.
- Handoff: /root sole writer, R15 complete locally; no active writers or required pending checks. Optional actual-browser visual confirmation unavailable in current tool environment. No deployment or release claim; preserve dirty baseline.

## R16 — Per-step directories and Dialplan tab cleanup
- /root sole coordinator/writer, codex-direct. Extend existing directory_lookup with optional matchMode, behavior, behaviorParams and nested actions. Keep old output-only steps valid. Extract shared policy compiler, retain legacy binding compiler; step policies run through isolated managed subcontexts at their chain position with EXTEN preserved and Return, ERROR skips behavior. Tenant ownership and nested DTO/label validation required.
- Frontend ownership directory app schema/editor in features/dialplan-apps, RouteFormModal/ActionsTab, bounded shared contract/helper and backend policy/compiler/service/DTO paths, AI descriptions/skills, tests and evidence. Convert old bindings to initial steps locally on editing; save bindings=[] atomically with actions, no blanket DB migration. Keep existing pre_command values for compatibility while removing its UI/new input; no silent deletion of arbitrary old commands. Rename tab Dialplan RU/EN.
- Verification: compatibility, execution order, match/no-match/error, Unicode/literals, field mapping/redirect/drop/custom, tenant ownership, failed-save preservation, repeated save and raw override. Required full lint/backend/frontend/types/build gates after targeted regressions. No live provider or notification calls. Next shared contract/compiler and form adapter.


## R17 — Route modal UX follow-up (same coordinator and assignment)
- /root sole coordinator/writer, codex-direct; extends R16 frontend scope: General/Flowchart tabs, StepRow, DialplanAppsEditor, CSS modules and localized labels. Active is in the identity header. Recording/analytics defaults collapsed when unset or creating. Flowchart contains only the diagram, with no scenario runner or the two explanatory banners. Step operations and template operations use overflow menus; copied-step insertion and redundant configure button removed. Conditions, disabled status and chain exit use accessible tooltip icons; a condition click opens its corresponding section.
- Applied the modal header/tab/body/footer SCSS to the actual Dialog. Responsive theme surfaces, borders, shadows and wrapping use shared UI and Stack. Corrected static schema option labels to use their i18n keys in select/multiselect/mode/cards. New directory policy editor remains in features/dialplan-apps; redirect context selector can retain an imported value or clear it to the current context. Query failure uses shared QueryErrorState.
- Found enabled was editor-only. Bounded shared contract, DTO, modal serialization, compiler, label validation, abstract walk and AI draft support now preserve enabled:false and skip execution. Default absent/true behavior is unchanged. Disabling a label cannot leave a valid active jump to it. An intentional runtime correction verified through the real save/apply path.
- R16 completed locally: behavior presets and custom chains in directory_lookup, isolated generated contexts with EXTEN preserved, internal branch labels cannot collide with user labels, subsequent main actions remain in their caller context. Tenant/field ownership includes numeric catalog strings; explicit redirect target contexts must belong to the tenant. Legacy bindings are locally converted on explicit action-mode saves and cleared atomically. Explicit raw execution keeps its legacy bindings; existing pre_command retained as compatibility data while UI removed. Directories and Where used tabs removed; remaining tab name is Dialplan. AI action schema/catalog/routes and pbx-setup guidance updated.
- Automated verification: shared/backend/frontend builds and frontend type checks PASS; mandatory root lint PASS with warnings, no errors. Final full backend 388 suites / 3662 PASS, 11 skipped. Full frontend covered 323 files / 1698 tests: initial two old text-badge assertions failed; changed assertions to accessible icons and re-ran the full failed 40-file batch, 280 PASS. No unresolved failures. After enabled correction, entire affected dialplan-apps/routes scope 46 files / 381 PASS; final UI additions 4 files / 46 PASS. Source diff check PASS.
- Live runtime PASS: 8 groups on ipbx.krasterisk.ru using isolated HTTP controller/DB/AMI/Local-channel fixtures: all five keys, Unicode/literal name and number, ordered step execution, mappings, custom Return and labels, current/selected/foreign context redirect, match/no-match/ERROR, drop and persistent disabled-step skip. Cleanup PASS; zero provider calls and no notification sending. Evidence: artifacts/directory-steps-live.json; automated report: artifacts/directory-dialplan-ui-followups-automated.json.
- Browser visual gate unavailable: CUA kernel exits before page access with Windows sandbox helper setup refresh error. Automated DOM interaction and SCSS/build checks passed; no actual-browser visual or independent review claim. No deployment/release performed.
- Handoff: R16/R17 implemented, automated-tests-passed; runtime live-verified. /root only writer, no active workers or required pending automated gates. Preserve unrelated dirty baseline and earlier initiatives. Optional next action is real-browser viewport review when CUA recovers, or a new user assignment. No further phase auto-chain.
