# Artifact storage migration — PLAN r4


## Current revision r4 — accepted bounded result

Supersedes earlier r1–r3 deferrals. User explicitly approved the checked bulk migration and the exact CDR proposal (1491 proposed files / six caches / 781 preserved inputs, five named generators). Applied 238 AST-equivalent legacy path adaptations plus nine manually scoped generators; preserved standalone remote behavior. CDR storage owner transfer is recorded in its EXECUTION; product ownership remains there. Migrated all approved inactive outputs with hashes and symlink compatibility; retained two actually locked active logs. See REPORT/VERIFICATION for exact counts and gates. No further implementation work remains in this storage assignment; product frontend failure and missing historical evidence are recorded independent follow-ups.

## Historical plan and revisions

Coordinator: /root, chat 01a15cc9-e096-7fd2-b4a1-319ff59dd48e. Mode: codex-direct.
User assignment: version ignore rules, external ARTIFACTS_ROOT, migrate accumulated generated files, update references, preserve planning documents.
Baseline: main / 10308472a809ba42e501ccbd2d079a097b9a1222; mixed pre-existing dirty tree retained. No commits, resets, publication or production execution.

1. Inventory generated outputs, source/document paths and active writers.
2. Add shared Node/Python/PowerShell resolver, explicit external output configuration and versioned ignore rules.
3. Update local generators/readers without executing their network/production actions. Preserve remote /opt lab paths and source/document locations.
4. Move only planned untracked artifacts to ARTIFACTS_ROOT/legacy/<original-repository-path>; compare SHA-256 before/after and refuse collisions. Preserve tracked paths and source/config fixtures.
5. Rewrite documentation links through ignored .artifacts junction; validate targets and syntax/tests. Record results and limitations.

Owned: .gitignore, tools/artifacts/**, .planning/artifact-storage/**, artifact IO references in inactive planning scripts, harness report configuration, documentation references to migrated artifacts, additive index/registry entry. Product packages/** remain read-only.
CDR active scope: pending user authorization to coordinate; .planning/cdr-reports-ux excluded until owner transfer/confirmation. Do not touch its scripts, caches, snapshots, evidence or running services meanwhile.

Acceptance: default and overridden ARTIFACTS_ROOT outside checkout, traversal rejection, Node/Python policy parity, preserved documents/fixtures, hash-verified move ledger, source syntax, local reference targets, targeted artifact tests and required repository lint/backend/frontend tests. Network/provider/call/deploy actions are outside this assignment.

## Revision r2 — safe compatibility migration

Supersedes the proposed broad automated script rewrite: automatic approval review rejected behavior-changing rewrites across hundreds of historical scripts. No such rewrite was applied. Current implementation uses exact edits to four reviewed Node generators, four harness configuration/reporter/runner files, explicit shared resolvers, and ignored compatibility junctions for relocated directories. Legacy remote scenarios retain their paths. Directory migration remains SHA-256 verified; loose mixed-directory artifacts and the active CDR scope remain outside the move until their consumers/ownership are resolved. This is one revised plan, not a second execution chain.


## Revision r3 — compatible loose-file migration

The filesystem supports file symlinks. The remaining 1,420 inactive loose generated files can be moved with matching SHA-256 and ignored file symlinks at their original paths. This supersedes the r2 deferral of loose artifacts; source/config fixtures and all planning documents remain in the checkout. It avoids the rejected broad behavioral script rewrite. Active CDR scope still excluded pending owner coordination.
