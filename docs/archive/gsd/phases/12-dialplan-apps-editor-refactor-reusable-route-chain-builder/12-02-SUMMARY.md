---
phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
plan: 02
subsystem: dialplan-tracer
tags: [toqueue, ValueSource, StepSheet, normalizeTarget, phonebook-lookup]

requires:
  - phase: 12-01
    provides: Wave 0 characterization baselines for actionToDialplan
provides:
  - ValueSource structural source (fixed / route_pattern / variable / phonebook+varKey)
  - normalizeTarget + toqueue tenant-scoped Queue(q…_{uid})
  - ToQueueParamsDto validation
  - StepSheet + ValueSourceField tracer UI (schema-driven queue field)
  - Phonebook lookup var_key value-only mode for dynamic queue target
affects:
  - 12-03 per-type DTO expansion
  - 12-05 normalizeTarget call-sites for other address kinds
  - 12-07 / 12-08 Sheet expansion

tech-stack:
  added: []
  patterns:
    - "ValueSource discriminated union in @krasterisk/shared"
    - "InfoTooltip rich copy: newlines + **bold** (ARCHITECTURE §3)"
    - "phonebook-lookup?var_key= returns value-only for address targets"

key-files:
  created:
    - packages/backend/src/shared/utils/dialplan-target.util.ts
    - packages/backend/src/shared/utils/dialplan-target.util.spec.ts
    - packages/backend/src/modules/routes/dto/dialplan-params/toqueue.params.dto.ts
    - packages/frontend/src/features/dialplan-apps/ui/StepSheet/StepSheet.tsx
    - packages/frontend/src/features/dialplan-apps/ui/StepSheet/StepSheet.module.scss
    - packages/frontend/src/features/dialplan-apps/ui/StepSheet/StepSheet.test.tsx
    - packages/frontend/src/features/dialplan-apps/ui/ValueSourceField/ValueSourceField.tsx
    - packages/frontend/src/features/dialplan-apps/ui/ValueSourceField/ValueSourceField.module.scss
    - packages/shared/src/types/dialplan-params.types.ts
  modified:
    - packages/backend/src/shared/utils/dialplan.util.ts
    - packages/backend/src/shared/utils/dialplan.util.spec.ts
    - packages/backend/src/modules/routes/dto/route-action.dto.ts
    - packages/backend/src/modules/routes/dto/route-action.dto.spec.ts
    - packages/backend/src/modules/phonebooks/phonebook-lookup.controller.ts
    - packages/backend/src/modules/phonebooks/phonebooks.service.ts
    - packages/backend/src/modules/phonebooks/phonebooks.service.spec.ts
    - packages/frontend/src/features/dialplan-apps/model/registry.ts
    - packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.tsx
    - packages/frontend/src/shared/ui/Tooltip/Tooltip.tsx
    - packages/frontend/.idea/ARCHITECTURE.md
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts

key-decisions:
  - "Phonebook ValueSource requires varKey; lookup uses ?var_key= value-only into PB_TARGET"
  - "Empty queue allowed with confirm on Sheet close and RouteFormModal save"
  - "Sheet desktop width 50vw; queue Select uses optgroups Dynamic/Static"
  - "UI never shows dialplan internals in tooltips (ARCHITECTURE rich InfoTooltip pattern)"

patterns-established:
  - "Tracer cuts one ActionType end-to-end before horizontal expansion"
  - "formatRichTooltipText: \\n + **bold** in locale strings"

requirements-completed: [D-01, D-03, D-04, D-06, D-07, D-09, D-10, D-20, D-21, D-32]

coverage:
  - id: D1
    description: route_pattern emits Queue(q${EXTEN}_{uid}) not raw ${EXTEN}
    requirement: D-21
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#toqueue with route_pattern
        status: pass
    human_judgment: false
  - id: D2
    description: phonebook target emits CURL var_key lookup then Queue(q${PB_TARGET}_{uid})
    requirement: D-20
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#toqueue with phonebook target
        status: pass
    human_judgment: false
  - id: D3
    description: ToQueueParamsDto rejects empty fixed and phonebook without varKey
    requirement: D-09
    verification:
      - kind: unit
        ref: packages/backend/src/modules/routes/dto/route-action.dto.spec.ts
        status: pass
    human_judgment: false
  - id: D4
    description: StepSheet opens on toqueue; loading vs empty catalog distinguishable
    requirement: D-01
    verification:
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/StepSheet/StepSheet.test.tsx
        status: pass
    human_judgment: true

duration: multi-session
completed: 2026-08-19
status: complete
---

# Phase 12 Plan 02: Queue-by-route-mask tracer Summary

**End-to-end tracer for «Очередь по маске маршрута»: ValueSource → ToQueueParamsDto → normalizeTarget → Queue(q…_{uid}), plus StepSheet/ValueSourceField UI with phonebook varKey lookup.**

## Accomplishments

- Structural `ValueSource` (`fixed` / `route_pattern` / `variable` / `phonebook`+`varKey`) in shared; sentinel `__USE_EXTEN__` not used on tracer path.
- `normalizeTarget('queue', …)` always tenant-suffixes; `toqueue` uses it; phonebook mode does CURL `?var_key=` → `PB_TARGET` then conditional `Queue`.
- Schema-driven `toqueue` field in registry; `StepSheet` + `ValueSourceField` with optgroups, confirm-on-empty-close/save, rich InfoTooltip copy.
- Human-verify checkpoint **approved** (2026-08-19).

## Performance

- **Duration:** multi-session (close-out 2026-08-19)
- **Tasks:** 2/2 (tracer + human-verify approved)
- **Files committed in close-out:** 24 (implementation); locales left unstaged

## Task Commits

1. **Task 1 RED** - `3462661` — `test(12-02): add failing test for queue-by-route-mask tracer`
2. **Task 1 GREEN** - `94fa8b3` — `feat(12-02): implement queue-by-route-mask tracer`
3. **UX iteration** - `7eab2fc` — `fix(12-02): simplify queue StepSheet and block incomplete close`
4. **Phonebook varKey + Sheet UX** - `b04c437` — `feat(12-02): phonebook varKey lookup and queue StepSheet UX`
5. **Human-verify** - approved (user, 2026-08-19)

## Deviations from Plan

### Auto-fixed / product UX

**1. Phonebook source needs `varKey` + lookup**
- Plan stub used only `PB_RESULT`; implemented `varKey` + `phonebook-lookup?var_key=` value-only response and UI key select.

**2. Close without queue**
- Plan hard-blocked close; product asked confirm + highlight, allow save with confirm.

**3. UI-SPEC SegmentedControl vs one Select with optgroups**
- User-directed: single Select, Dynamic/Static groups, 50vw Sheet.

**4. Locales skipped in close-out commit**
- `ru.ts` / `en.ts` contain `routes.chain.*` + tooltip strings mixed with unrelated users/callcenter/profile WIP.
- Close-out staged code only (`b04c437`). New chain keys remain in the working tree and should be committed later when locale hunks can be split, or via a dedicated i18n commit.
- Runtime is safe: new strings are called with fallback second argument.

## Decisions Made

- Phonebook `ValueSource` requires `varKey`; lookup `?var_key=` returns value-only into `PB_TARGET`.
- Empty queue allowed with confirm on Sheet close and RouteFormModal save.
- Sheet desktop width 50vw; queue Select uses Dynamic/Static optgroups.
- UI never shows dialplan internals in tooltips (ARCHITECTURE rich InfoTooltip: newlines + `**bold**`).

## Next Phase Readiness

- 12-02 tracer is human-approved and committed. Next plan is **12-03** (per-type DTO expansion). Do not start 12-03 from this close-out.
- Locales `routes.chain.*` still dirty in the working tree — split/commit separately before relying on ru/en keys without fallbacks.

## Self-Check: PASSED

- SUMMARY written; ROADMAP 12-02 checkbox marked; STATE focus set to 12-03.
- Implementation commit `b04c437` exists; locales not included.
- Focused tests previously recorded: dialplan-target / route-action.dto / dialplan.util toqueue phonebook / StepSheet — pass.
