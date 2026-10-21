---
phase: 15-universal-pbx-ai-agent
plan: 02
subsystem: api
tags: [skills, progressive-disclosure, d-10, d-11, d-12, d-16]

requires:
  - phase: 15-universal-pbx-ai-agent
    provides: DomainAiAdapter self-registration and D-22 handler signature (vpbxUserUid is positional)
provides:
  - AgentSkillRegistryService catalog plus list_skills and read_skill
  - Four repository-hosted seed skills under src/skills
  - nest-cli assets glob that copies skill markdown into dist
  - resolveSkillsRootCandidates for compiled-layout resolution
affects:
  - 15-03+ (PbxContextBuilder catalog insertion, D-10)
  - 15-23 (completeness gate reads SKILL.md files)
  - wave-4 adapter plans (remaining domain skills ship with their adapters)

actuals:
  tokens: 5370
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - Two-field skill frontmatter parsed by anchored regex — no YAML dependency
    - Skills root: __dirname/../../skills then cwd/src/skills; missing dir is logger.error
    - Catalog in the prompt, bodies only via read_skill with an 8000-char cap

key-files:
  created:
    - packages/backend/src/modules/ai-platform/agent-skill-registry.service.ts
    - packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts
    - packages/backend/src/skills/developer-convention/SKILL.md
    - packages/backend/src/skills/directories/SKILL.md
    - packages/backend/src/skills/voicemail/SKILL.md
    - packages/backend/src/skills/callcenter/SKILL.md
  modified:
    - packages/backend/src/modules/ai-platform/ai-platform.module.ts
    - packages/backend/nest-cli.json

key-decisions:
  - "Skills live in src/skills/<name>/SKILL.md and are versioned with the tools they describe"
  - "Frontmatter is exactly two single-line fields, hand-parsed; Phase 15 adds no YAML package"
  - "Primary resolver candidate is relative to the compiled module directory so production finds dist/skills"
  - "Skill markdown is a nest-cli asset glob only — no second postbuild copy path"

patterns-established:
  - "Pattern: getCatalog() returns {name, description}[]; readSkill(name) returns body or structured not-found"
  - "Pattern: list_skills / read_skill are non-destructive entityType skill; handlers accept unused vpbxUserUid"
  - "Pattern: new module = <module>-ai.adapter.ts + src/skills/<module>/SKILL.md (D-16)"

requirements-completed: [D-10, D-11, D-12, D-16]

coverage:
  - id: D1
    description: getCatalog returns name and description from frontmatter and never the skill body (D-10)
    requirement: D-10
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#getCatalog returns name and description from frontmatter and never the body
        status: pass
    human_judgment: false
  - id: D2
    description: read_skill loads one body on demand; unknown names return structured not-found; oversize bodies truncate at 8000 (D-10)
    requirement: D-10
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#readSkill('developer-convention') returns the markdown body
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#unknown skill name returns structured not-found text rather than throwing
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#body longer than the cap is truncated with a trailing note
        status: pass
    human_judgment: false
  - id: D3
    description: Skill files live in the repository next to backend code and appear in a non-empty catalog (D-11)
    requirement: D-11
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#loads a non-empty catalog from the repository skills root
        status: pass
    human_judgment: false
  - id: D4
    description: Production build ships skill markdown; resolver primary candidate is derived from the compiled module directory (D-11)
    requirement: D-11
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#derives the primary candidate from the compiled module directory
        status: pass
    human_judgment: false
  - id: D5
    description: developer-convention skill states the D-16 adapter-plus-skill pair rule
    requirement: D-16
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#readSkill('developer-convention') returns the markdown body
        status: pass
    human_judgment: false
  - id: D6
    description: Seed skills for directories, voicemail, and callcenter describe our model and conventions (D-12)
    requirement: D-12
    verification:
      - kind: unit
        ref: packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts#loads a non-empty catalog from the repository skills root
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-09-04
status: complete
---

# Phase 15 Plan 02: Skills Catalog and On-Demand Read Summary

**Repository-hosted skill files with a cheap name/description catalog and `read_skill` bodies, shipped into the production build via nest-cli assets**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-04T07:01:04Z
- **Completed:** 2026-09-04T07:12:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- `AgentSkillRegistryService` implements `DomainAiAdapter` (`domain = 'skills'`), self-registers in `onModuleInit`, and exposes `getCatalog()` / `readSkill()`
- Progressive disclosure (D-10): the catalog never carries bodies; `read_skill` loads one file, caps at 8000 characters, and returns structured not-found instead of throwing
- Four seed skills live under `packages/backend/src/skills/` and are versioned with the tools (D-11)
- `nest-cli.json` copies `skills/**/*.md` into the compiled output; the resolver prefers `__dirname/../../skills` so `dist/skills` works in production
- `developer-convention` records the D-16 rule: a new module ships `<module>-ai.adapter.ts` plus `src/skills/<module>/SKILL.md`

## Task Commits

Each task was committed atomically (TDD RED → GREEN for the tracer):

1. **Task 1 RED: skill catalog and read_skill** - `7ef51f0` (test)
2. **Task 1 GREEN: AgentSkillRegistryService + developer-convention** - `f485c4a` (feat)
3. **Task 2: nest-cli skill assets + resolver proof** - `6a8c739` (feat)
4. **Task 3: directories, voicemail, callcenter seed skills** - `97acee5` (feat)

**Plan metadata:** docs commit (SUMMARY + STATE + ROADMAP) follows this file

_Note: TDD tracer has two commits (test → feat)._

## Files Created/Modified

- `packages/backend/src/modules/ai-platform/agent-skill-registry.service.ts` — catalog, frontmatter parser, `list_skills` / `read_skill`
- `packages/backend/src/modules/ai-platform/agent-skill-registry.service.spec.ts` — catalog, read, not-found, cap, tools, resolver, four-skill seed
- `packages/backend/src/modules/ai-platform/ai-platform.module.ts` — provider + export
- `packages/backend/nest-cli.json` — `skills/**/*.md` asset next to proto
- `packages/backend/src/skills/developer-convention/SKILL.md` — D-16 pair rule, uid-as-parameter, proposal writes, two-field frontmatter
- `packages/backend/src/skills/directories/SKILL.md` — schema/records, key normalization, route bindings, five write tools propose
- `packages/backend/src/skills/voicemail/SKILL.md` — message model, read-only, transcript is data
- `packages/backend/src/skills/callcenter/SKILL.md` — queue/agent snapshot, live pause/unpause, today-only KPI

## Decisions Made

- **Skills are repository files, not `.docs/`.** Path is `src/skills/<name>/SKILL.md`; they ship with the tools they describe.
- **No YAML parser.** Frontmatter is two single-line fields parsed by anchored regex; missing `name` falls back to the directory name.
- **Resolver is compile-layout first.** `path.resolve(__dirname, '../../skills')` then `process.cwd()/src/skills`. Absence of the directory is `logger.error`, not a silent empty catalog.
- **One build mechanism.** nest-cli `assets` glob only; the postbuild proto copy was left untouched so the two paths cannot drift.
- **Seed skills stay in Russian.** Single language per D-14; the model answers in the language of the question.

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0
**Impact on plan:** None.

## Issues Encountered

- PowerShell cannot run bash heredoc commits; used `-F` message files under `.tmp/` (not staged). Same as 15-01.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 15-03+ can insert `getCatalog()` into the system prompt without inlining bodies
- 15-23 can assert adapter + `SKILL.md` pairs against the four seed files plus later domains
- Wave-4 adapter plans add their own `src/skills/<domain>/SKILL.md` beside the adapter

## TDD Gate Compliance

Plan frontmatter is `type: execute` with Task 1 `tdd="true"` (tracer). RED commit `7ef51f0` failed on missing module; GREEN `f485c4a` passed 6 tests. Tracer feedback gate re-ran `agent-skill-registry` after Task 1 (pass) and continued (`human_verify_mode` default end-of-phase, automated-only verify). Tasks 2–3 are `type="auto"` without TDD.

## Self-Check: PASSED

- FOUND: `packages/backend/src/modules/ai-platform/agent-skill-registry.service.ts` (`getCatalog`, `readSkill`, `list_skills`, `read_skill`)
- FOUND: `packages/backend/src/skills/developer-convention/SKILL.md` (D-16 pair rule)
- FOUND: `packages/backend/nest-cli.json` (`skills/**/*.md`)
- FOUND: `packages/backend/src/skills/directories/SKILL.md`
- FOUND: `packages/backend/src/skills/voicemail/SKILL.md`
- FOUND: `packages/backend/src/skills/callcenter/SKILL.md`
- FOUND: commits `7ef51f0`, `f485c4a`, `6a8c739`, `97acee5`

---
*Phase: 15-universal-pbx-ai-agent*
*Completed: 2026-09-04*
