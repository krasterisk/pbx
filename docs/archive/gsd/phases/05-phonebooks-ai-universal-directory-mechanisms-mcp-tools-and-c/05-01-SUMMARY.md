---
phase: 05-phonebooks-ai-universal-directory-mechanisms-mcp-tools-and-c
plan: 01
subsystem: backend/ami
tags: [refactor, dialplan, ami, dedup]
dependency-graph:
  requires: []
  provides: [DialplanApplyService]
  affects:
    - packages/backend/src/modules/routes/routes.controller.ts
    - packages/backend/src/modules/ai-chat/ai-webhook.controller.ts
    - packages/backend/src/modules/mcp/mcp-tools.service.ts
    - packages/backend/src/modules/system-settings/dialplan-subroutines.service.ts
tech-stack:
  added: []
  patterns: ["Injectable AMI batch-apply service (DelCat/NewCat/Append-batch/reload)"]
key-files:
  created:
    - packages/backend/src/modules/ami/dialplan-apply.service.ts
    - packages/backend/src/modules/ami/dialplan-apply.service.spec.ts
  modified:
    - packages/backend/src/modules/ami/ami.module.ts
    - packages/backend/src/modules/routes/routes.controller.ts
    - packages/backend/src/modules/ai-chat/ai-webhook.controller.ts
    - packages/backend/src/modules/mcp/mcp-tools.service.ts
    - packages/backend/src/modules/system-settings/dialplan-subroutines.service.ts
decisions:
  - "D-22 implemented: single DialplanApplyService.applyCategories(filename, categories[], {reload}) replaces 4 duplicated AMI UpdateConfig batch-apply copies"
metrics:
  duration: "~40 min"
  completed: 2026-07-14
---

# Phase 5 Plan 1: DialplanApplyService extraction Summary

Extracted the 4x-duplicated AMI `UpdateConfig` batch-apply logic (`DelCat` → `NewCat` → `Append` in 20-line batches with Var/Value parsing → optional `dialplan reload`) into a single injectable `DialplanApplyService` in the `ami` module, and migrated all 4 existing callers onto it — a pure refactor with no behavior change (D-22).

## What Was Built

**`DialplanApplyService`** (`packages/backend/src/modules/ami/dialplan-apply.service.ts`), injecting the existing `AmiService`:

```ts
applyCategories(
  filename: string,
  categories: Array<{ name: string; lines: string[] }>,
  opts?: { reload?: boolean },
): Promise<{ success: boolean; linesApplied: number }>
```

For each category (in the order given): `DelCat` (error swallowed — expected when category/file doesn't exist yet) → `NewCat` (error is fatal) → `Append` in batches of 20 lines, splitting each line on the first `=>` (Var/Value, Value prefixed with `> `) or else the first `=`, throwing if any Append batch response is `Error`. Lines are defensively trimmed and filtered (blank lines, `[category headers]`, `;comments` dropped) even though callers typically pass already-clean lines. Exactly one `dialplan reload` command runs after all categories, unless `opts.reload === false`.

Exported from `AmiModule` alongside the existing `AmiService` export, so the 4 consuming modules (`RoutesModule`, `AiChatModule`, `McpModule`, `SystemSettingsModule`) pick it up automatically — they already import `AmiModule`, no module-import changes were needed.

**Migrated callers** — each replaced its local batch-loop with a single `applyCategories(...)` call and dropped its direct `AmiService` dependency (it was only used for this logic in all 4 files):

1. `routes.controller.ts` `_applyContextDialplan` — now builds `[{ name: tenantedContextName, lines }]` and calls `applyCategories(filename, [...], { reload: true })`.
2. `ai-webhook.controller.ts` `applyDialplan` (webhook tool `apply_dialplan`) — same pattern, single category.
3. `mcp-tools.service.ts` `regApplyDialplan` (MCP tool `apply_dialplan`) — same pattern, single category.
4. `system-settings/dialplan-subroutines.service.ts` `applySubroutines` — already parsed the generated subroutines file into multiple `{name, lines}` contexts; now passes that array directly to `applyCategories(file, contexts, { reload: true })` in one call instead of looping AMI calls per context itself.

## Deviations from Plan

None — plan executed as written. One clarification made during implementation (not a deviation, just a design note): callers now pass unfiltered `dialplan.split('\n')` lines straight to `applyCategories` rather than pre-filtering blank/header/comment lines themselves, since the plan explicitly calls for the service to "defensively filter" — this removes the last bit of duplicated filtering logic from all 4 callers, consistent with the plan's intent to have the batch logic exist in exactly one place.

## Verification

- `npx jest dialplan-apply --silent` — 5/5 tests pass (batch/Var-Value parsing, Append-error propagation, reload:true/false, multi-category ordering, defensive line filtering).
- `npx jest routes --silent` — no spec file named `routes*.spec.ts` exists in the repo (pre-existing state, not introduced by this plan); "no tests found" is expected, not a regression.
- `npm run test:backend` — **16 suites / 162 tests pass** (full backend suite green, no regressions).
- `grep -r "Action-000000" packages/backend/src` — matches only in `dialplan-apply.service.ts` and its spec; confirms the batch logic now exists in exactly one place.
- `npm run lint` — **could not run**: `eslint` is not installed in this environment (no `eslint` in `packages/backend/package.json` devDependencies, no `eslint.config.js`, no local binary). This is a pre-existing environment gap unrelated to this plan's changes; `npx eslint` on the changed files fails identically for the same reason (missing config). No linter errors were found via the IDE's linter tool on all 7 changed/created files.

## Known Stubs

None.

## Self-Check: PASSED

- `packages/backend/src/modules/ami/dialplan-apply.service.ts` — FOUND
- `packages/backend/src/modules/ami/dialplan-apply.service.spec.ts` — FOUND
- Commit `900ae96` — FOUND in `git log`
