---
phase: 15-universal-pbx-ai-agent
plan: 23
subsystem: testing
tags: [d-16, d-17, coverage, completeness, skills, convention]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: getDomains() on AiAdapterRegistryService (15-01)
  - phase: 15-universal-pbx-ai-agent
    provides: Skill registry and developer-convention seed (15-02)
  - phase: 15-universal-pbx-ai-agent
    provides: Adapter-only dispatch after cutover (15-15)
  - phase: 15-universal-pbx-ai-agent
    provides: Shared speech-engines and operations skills (15-20, 15-21)
provides:
  - Classification of every src/modules directory with a reason for each non-covered entry
  - Completeness suite that goes red on an unclassified module, missing adapter, missing or malformed skill, or unreasoned exclusion
  - Normative D-16 statement in backend ARCHITECTURE and an explanatory developer-convention skill
affects:
  - /gsd-secure-phase 15
  - every future backend module (new directory must be classified)

actuals:
  tokens: 5400
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Directory listing is read from the filesystem and compared both ways to MODULE_COVERAGE
    - getDomains() is the registered-adapter side of the D-17 gate
    - Covered domains resolve to an own SKILL.md or an explicit sharedSkill
    - Frontmatter validity is a test failure, not a silent catalog drop

key-files:
  created:
    - packages/backend/src/modules/ai-platform/module-coverage.registry.ts
    - packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts
  modified:
    - packages/backend/src/skills/developer-convention/SKILL.md
    - packages/backend/.idea/ARCHITECTURE.md

key-decisions:
  - "Classification keys are module directories; adapter domain is an override when it differs (pbx, skills, route_templates, dialplan_dry_run)"
  - "Shared skills are declared on the covered entry (speech-engines, operations, messaging, settings, routes, diagnostics, developer-convention)"
  - "callback-requests, cloud-admin and route-references are excluded with written reasons; transport and platform plumbing are infrastructure"

patterns-established:
  - "Pattern: collectCoverageFailures / collectSkillFailures return every issue in one array"
  - "Pattern: a one-word exclusion is illegal — infrastructure and excluded require a non-empty reason"
  - "Pattern: ARCHITECTURE is normative; developer-convention skill is explanatory and points at the test"

requirements-completed: [D-16, D-17]

coverage:
  - id: D1
    description: An unclassified module directory turns the coverage test red with that directory named (D-17)
    requirement: D-17
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#names an unclassified module directory from the filesystem listing
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#live classification matches on-disk modules and getDomains() with no leftovers
        status: pass
    human_judgment: false
  - id: D2
    description: A module classified as covered but lacking an adapter turns the coverage test red with the domain named (D-17)
    requirement: D-17
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#names a covered domain that has no registered adapter
        status: pass
    human_judgment: false
  - id: D3
    description: A domain classified as infrastructure or excluded carries a written reason (D-17, T-15-104)
    requirement: D-17
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#names a non-covered classification that has an empty reason
        status: pass
    human_judgment: false
  - id: D4
    description: A covered domain whose skill is missing or whose frontmatter does not parse turns the suite red (D-16, D-17)
    requirement: D-16
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#names a covered domain that has neither its own nor a shared skill
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#names the skill file when frontmatter does not parse
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#accepts one declared shared skill for several covered domains
        status: pass
    human_judgment: false
  - id: D5
    description: Every registered tool belongs to a domain that resolves to a skill (D-16, T-15-105)
    requirement: D-16
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#names a tool whose domain does not resolve to a skill
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts#live covered domains and registered tools resolve to a parseable skill
        status: pass
    human_judgment: false
  - id: D6
    description: The convention is written in ARCHITECTURE (normative) and developer-convention skill (explanatory), each pointing at the enforcing test (D-16)
    requirement: D-16
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#readSkill('developer-convention') returns the markdown body
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 23: Coverage Test and Developer Convention Summary

**Filesystem-backed D-17 completeness suite over every `src/modules` directory, with shared-skill declarations and the D-16 convention written in ARCHITECTURE plus `developer-convention`**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-04T16:40:00Z
- **Completed:** 2026-09-04T16:58:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Every on-disk backend module directory is classified as covered, infrastructure, or excluded; non-covered rows carry a written reason
- The completeness suite compares the filesystem listing both ways, `getDomains()` for adapters, skill files (own or `sharedSkill`), strict frontmatter, and every discovered tool domain — all failures in one run
- The new-module convention is the normative §6 statement and an explanatory skill the agent can quote; both point at `ai-adapter-completeness.spec.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: unclassified module fails the build** - `9db14c4` (test)
2. **Task 1 GREEN: classify every module directory** - `f2833ee` (feat)
3. **Task 2 RED: skill currency fixtures** - `d73f3e2` (test)
4. **Task 2 GREEN: enforce skill presence and frontmatter** - `a9e80d9` (feat)
5. **Task 3: write the convention where it is read** - `9fc5a8c` (docs)

**Plan metadata:** `docs(15-23): complete coverage-test plan`

_Note: TDD tasks have multiple commits (test → feat)._

## Files Created/Modified

- `packages/backend/src/modules/ai-platform/module-coverage.registry.ts` — classification map, `collectCoverageFailures`, `collectSkillFailures`
- `packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts` — fixture failure modes plus live green run
- `packages/backend/src/skills/developer-convention/SKILL.md` — explanatory D-16 skill with per-rule reasons and the exclusion path
- `packages/backend/.idea/ARCHITECTURE.md` — normative D-16 statement pointing at the test and the registry

## Decisions Made

- Classification keys are module directories. Adapter domains that do not match the directory (`pbx`, `skills`, `route_templates`, `dialplan_dry_run`) are recorded as `domain` overrides so `getDomains()` still has to appear in the classification.
- Shared skills are explicit on the covered entry: `speech-engines`, `operations`, `messaging`, `settings`, `routes` (templates and dry-run), `diagnostics` (`pbx`), `developer-convention` (`skills`). A stub file per directory would satisfy the test without teaching the model.
- Tenant-facing leftovers without an adapter this phase are excluded with a reason (`callback-requests`, `route-references`). `cloud-admin` is excluded as platform SuperAdmin. Transport and Nest plumbing are infrastructure.

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** Classification `sharedSkill` field was filled in Task 1 GREEN so Task 2 live skill check had declarations to read; that is the plan's intended registry shape, not extra scope.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

D-16 and D-17 are enforced. Phase 15 execute plans are complete; next is the mandatory `/gsd-secure-phase 15`.

## TDD Gate Compliance

RED and GREEN commits exist for Tasks 1 and 2 (`test(15-23)` then `feat(15-23)`). Task 3 is docs-only.

## Self-Check: PASSED

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
