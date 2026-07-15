---
phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
plan: 11
subsystem: ui
tags: [react, dnd-kit, radix-dialog, call-cards, rtk-query, sheet, field-renderer]

requires:
  - phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
    provides: Call card backend schema and CRUD API (07-06)
  - phase: 07-call-center-overhaul-professional-agent-supervisor-workspace
    provides: /callcenter/settings cardTemplates tab shell (07-02)
provides:
  - queue_names binding on cc_card_templates (additive migration)
  - shared/ui Sheet 480px side panel primitive
  - FieldRenderer single source of truth for 14 v1 field types
  - TemplateBuilder DnD constructor with live preview
  - CardTemplatesTab in /callcenter/settings
  - CallCardPopup runtime card with auto_open_on + auto-populate
  - useCallCardPopup hook mounted in CallCenterAgentPage
affects:
  - 07-08 agent workspace enhancements
  - 07-12 reports (card data in CDR context)

tech-stack:
  added: []
  patterns:
    - "FieldRenderer shared between TemplateBuilder preview and CallCardPopup runtime"
    - "Template resolution: first active template where queue_names includes call.queue"
    - "Auto-populate via useLazyClientLookupQuery tenant-scoped client-lookup"

key-files:
  created:
    - packages/backend/src/modules/callcenter/migrate-callcenter-card-queue-binding-phase7.ts
    - packages/frontend/src/features/callcenter/model/types/callCard.ts
    - packages/frontend/src/shared/ui/Sheet/Sheet.tsx
    - packages/frontend/src/features/callcenter/ui/FieldRenderer/FieldRenderer.tsx
    - packages/frontend/src/features/callcenter/ui/TemplateBuilder/TemplateBuilder.tsx
    - packages/frontend/src/features/callcenter/ui/CallCardPopup/CallCardPopup.tsx
    - packages/frontend/src/features/callcenter/lib/useCallCardPopup.ts
    - packages/frontend/src/pages/CallCenterSettingsPage/ui/CardTemplatesTab/CardTemplatesTab.tsx
  modified:
    - packages/backend/src/modules/callcenter/models/card-template.model.ts
    - packages/backend/src/modules/callcenter/dto/callcenter-cards.dto.ts
    - packages/backend/src/modules/callcenter/callcenter-cards.service.ts
    - packages/frontend/src/shared/api/endpoints/callCenterApi.ts
    - packages/frontend/src/shared/api/rtkApi.ts
    - packages/frontend/src/pages/CallCenterSettingsPage/CallCenterSettingsPage.tsx
    - packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts

key-decisions:
  - "Sheet reuses @radix-ui/react-dialog with side-variant positioning (no new npm deps)"
  - "FieldRenderer is the only field render path for builder preview and operator popup"
  - "Wrap-up keeps card open when agent status is WRAPUP even if activeCall cleared"

patterns-established:
  - "Pattern: callCard RTK endpoints in callCenterApi with CardTemplates/Cards cache tags"
  - "Pattern: DnD template builder follows DialplanAppsEditor useSortable + arrayMove idiom"

requirements-completed: [D-10, D-11, D-12]

duration: 45min
completed: 2026-07-16
---

# Phase 07 Plan 11: Call Cards frontend Summary

**DnD call card template builder with live FieldRenderer preview, queue-bound runtime Sheet popup with auto_open_on and phonebook auto-populate**

## Performance

- **Duration:** 45 min
- **Started:** 2026-07-15T17:15:00Z
- **Completed:** 2026-07-15T18:00:00Z
- **Tasks:** 3
- **Files modified:** 22

## Accomplishments

- Additive `queue_names` JSON on `cc_card_templates` with idempotent migration, DTO and service persistence
- `shared/ui/Sheet` 480px right panel; `callCard` types; RTK card-templates/cards endpoints
- `FieldRenderer` covers 14 v1 field types (no file); `TemplateBuilder` DnD on @dnd-kit with live preview
- `CardTemplatesTab` replaces settings placeholder; `CallCardPopup` + `useCallCardPopup` auto-opens per template, saves with `call_uniqueid`

## Task Commits

1. **Task 1: Data layer queue-binding + RTK + Sheet** - `212ddf1` (feat)
2. **Task 2: DnD builder + FieldRenderer + settings tab** - `48ff65d` (feat)
3. **Task 3: Runtime CallCardPopup + agent mount** - `33fcd22` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `migrate-callcenter-card-queue-binding-phase7.ts` — additive `queue_names` column
- `callCard.ts` — CardFieldType (14), ICardTemplate, ICardData, CARD_FIELD_TYPES
- `Sheet/Sheet.tsx` — Radix Dialog side-variant 480px
- `FieldRenderer.tsx` — unified field render (preview + runtime)
- `TemplateBuilder.tsx` / `FieldRow.tsx` / `FieldConfig.tsx` — DnD constructor (D-10)
- `CardTemplatesTab.tsx` — list/create/edit/delete in /callcenter/settings
- `useCallCardPopup.ts` — template resolve by queue, auto_open_on, phonebook populate
- `CallCardPopup.tsx` — Sheet popup with dependent fields and save
- `CallCenterAgentPage.tsx` — mounts popup + manual open button

## Decisions Made

- Sheet imports `cn` from Dialog to avoid duplicate export conflict
- Card stays open during WRAPUP for post-call editing with countdown in footer
- Reused `callcenter.wrapup.draftSaved` toast key pattern; popup uses `callcenter.cards.popup.draftSaved`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Sheet cn export conflict with Dialog**
- **Found during:** Task 1 verification (`tsc` duplicate export `cn`)
- **Issue:** `Sheet.tsx` re-exported `cn` already exported from `./Dialog`
- **Fix:** Import `cn` from Dialog instead of defining locally
- **Files modified:** `packages/frontend/src/shared/ui/Sheet/Sheet.tsx`
- **Committed in:** `212ddf1`

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** No scope change.

## Issues Encountered

- `gsd-tools` SDK not built in repo — STATE/ROADMAP updated manually
- Pre-existing `tsc --noEmit` errors in unrelated files; new plan files typecheck clean
- `npm run lint` exits 0 with warnings only (none in new files)

## User Setup Required

Run additive migration once per environment:

`cd packages/backend && npx ts-node src/modules/callcenter/migrate-callcenter-card-queue-binding-phase7.ts`

## Next Phase Readiness

- Supervisors can build card templates in /callcenter/settings
- Operators get auto-opening runtime card per queue template and auto_open_on
- Manual UAT: create template bound to queue, answer call, verify auto-populate and POST /callcenter/cards

## Self-Check: PASSED

- FOUND: packages/frontend/src/features/callcenter/ui/TemplateBuilder/TemplateBuilder.tsx
- FOUND: packages/frontend/src/features/callcenter/ui/FieldRenderer/FieldRenderer.tsx
- FOUND: packages/frontend/src/features/callcenter/ui/CallCardPopup/CallCardPopup.tsx
- FOUND: packages/frontend/src/features/callcenter/lib/useCallCardPopup.ts
- FOUND: packages/backend/src/modules/callcenter/migrate-callcenter-card-queue-binding-phase7.ts
- FOUND: .planning/phases/07-call-center-overhaul-professional-agent-supervisor-workspace/07-11-SUMMARY.md
- FOUND commits: 212ddf1, 48ff65d, 33fcd22

---
*Phase: 07-call-center-overhaul-professional-agent-supervisor-workspace*
*Completed: 2026-07-16*
