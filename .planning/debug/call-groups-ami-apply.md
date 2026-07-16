---
status: diagnosed
trigger: "call-groups-ami-apply — Saving/updating a call group fails: AMI UpdateConfig returns File requires escalated privileges for category group_<uid>_<vpbx> in krasterisk/groups/group_<vpbx>.conf; then CallGroupsService throws Transaction cannot be rolled back because it has been finished with state: commit. Route config files also not created on Asterisk."
created: 2026-07-16T12:28:00+07:00
updated: 2026-07-16T12:35:00+07:00
goal: find_root_cause_only
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED — two stacked root causes (AMI missing-file + post-commit rollback)
test: code+Asterisk source comparison complete
expecting: diagnose-only return to orchestrator
next_action: none (diagnosis complete; no fix in this mode)

## Symptoms

expected: Call group CRUD persists to DB and applies dialplan category to krasterisk/groups/group_<vpbx>.conf via DialplanApplyService; API returns 200; group usable in live dialplan.
actual: DialplanApplyService ERROR Failed to create category [group_1_0]: File requires escalated privileges; then ExceptionsHandler Error: Transaction cannot be rolled back because it has been finished with state: commit (on create and update). User also: route config files not created.
errors: |
  [DialplanApplyService] Failed to create category [group_1_0]: File requires escalated privileges
  Error: Transaction cannot be rolled back because it has been finished with state: commit
  at CallGroupsService.create / CallGroupsService.update
reproduction: Test 1 and Test 10 in 06-UAT.md — save/update call group via UI/API
started: Discovered during Phase 6 UAT after Sequelize model registration + migrations were fixed

## Eliminated

- hypothesis: Call-groups uses a different AMI code path / options than routes/phonebooks/subroutines
  evidence: All four callers use the same DialplanApplyService.applyCategories with relative krasterisk/<subdir>/<file>.conf paths and identical DelCat→NewCat→Append UpdateConfig actions. No CreateConfig anywhere in packages/.
  timestamp: 2026-07-16T12:32:00+07:00

- hypothesis: Error means true live_dangerously / path-outside-AST_CONFIG_DIR restriction for groups only
  evidence: Relative path krasterisk/groups/group_N.conf is under AST_CONFIG_DIR when resolved. Asterisk GetConfig distinguishes is_restricted_file ret==1 (restricted) vs ret==-1 (missing); UpdateConfig treats any non-zero as privileges — missing file yields the same message. Test 11 (routes not created) shows the failure is shared for first-time files, not groups-specific ACL.
  timestamp: 2026-07-16T12:33:00+07:00

- hypothesis: NewCat semantics differ for category name group_* vs extensions_*
  evidence: Failure is thrown from the NewCat try/catch, but DelCat uses the same UpdateConfig against the same missing file and is swallowed; Asterisk rejects UpdateConfig before handle_updates when is_restricted_file is truthy. Category name is irrelevant.
  timestamp: 2026-07-16T12:34:00+07:00

## Evidence

- timestamp: 2026-07-16T12:29:00+07:00
  checked: call-groups.service.ts create/update/remove
  found: transaction.commit() then applyGroup/removeGroupContext; catch always calls transaction.rollback() then rethrows. Identical structure on create (L134-144), update (L196-204), remove (L220-228).
  implication: Any AMI failure after commit produces Sequelize "Transaction cannot be rolled back... state: commit" and masks/compound the original error into a 500.

- timestamp: 2026-07-16T12:30:00+07:00
  checked: dialplan-apply.service.ts vs route-apply / dialplan-subroutines / phonebooks paths
  found: Shared applyCategories; filenames only differ by subdir (routes|phonebooks|subroutines|groups). No CreateConfig, no mkdir, no file-ensure step.
  implication: First write to a never-created .conf fails the same way for all modules.

- timestamp: 2026-07-16T12:31:00+07:00
  checked: repo-wide CreateConfig
  found: Zero matches under packages/. DialplanApplyService only UpdateConfig DelCat/NewCat/Append.
  implication: New files are never created by the application; UpdateConfig requires an existing file.

- timestamp: 2026-07-16T12:33:00+07:00
  checked: Asterisk master main/manager.c action_updateconfig + is_restricted_file
  found: is_restricted_file returns -1 when realpath fails (file/path missing). GetConfig handles ret==1 vs ret==-1 correctly. UpdateConfig uses `if (is_restricted_file(sfn) || is_restricted_file(dfn))` — -1 is truthy → Message "File requires escalated privileges". CreateConfig is the AMI action that creates empty files (parent dir must exist).
  implication: Observed AMI error for group_1_0 is the missing-file case mislabeled as privileges, not a true privilege escalation block.

- timestamp: 2026-07-16T12:34:00+07:00
  checked: queues.service.ts post-commit pattern; 06-UAT Test 11
  found: Queues also commit-then-side-effect, but reloadQueues() swallows errors. Call groups applyGroup throws. UAT Test 11 reports route conf files also not created — consistent with shared missing-file CreateConfig gap.
  implication: Transaction bug is call-groups (and queues-shaped) catch misuse; AMI gap is systemic for any first-time krasterisk/*/*.conf including groups and new routes.

- timestamp: 2026-07-16T12:35:00+07:00
  checked: common-bug-patterns Error Handling + Environment/Permission
  found: Matches "Error in handler — cleanup throws, masking original" (post-commit rollback) and permission/missing-path class (AMI file ensure / directory ops).
  implication: Pattern checklist aligned with confirmed dual root cause.

## Resolution

root_cause: |
  TWO STACKED DEFECTS:

  A) AMI apply cannot create new conf files:
  DialplanApplyService.applyCategories issues UpdateConfig against krasterisk/groups/group_<vpbx>.conf without ensuring the file exists (no AMI CreateConfig). On modern Asterisk, UpdateConfig calls is_restricted_file(); when the file (or parent path) does not exist, realpath fails and returns -1; action_updateconfig treats any non-zero as restricted and returns "File requires escalated privileges" (misleading — GetConfig would say "Config file not found"). DelCat fails the same way but is swallowed; NewCat surfaces the error. Call-groups path is new (Phase 6) so the file/dir almost never pre-exists. Same gap explains UAT Test 11 (route files not created) for brand-new extensions_*.conf. Parent directory krasterisk/groups/ must exist on Asterisk for CreateConfig to succeed (ops).

  B) Post-commit rollback bug:
  CallGroupsService.create/update/remove commit the DB transaction, then call applyGroup/removeGroupContext. On AMI failure the catch block still awaits transaction.rollback(), which Sequelize rejects with "Transaction cannot be rolled back because it has been finished with state: commit". DB row may already be committed while API returns 500.

fix: (diagnose-only — not applied)
verification: (diagnose-only)
files_changed: []
