---
phase: 18-polnyy-refaktoring-rechevoy-analitiki
plan: 12
subsystem: ui
tags: [speech-analytics, metric-editor, projects, rtk-query, i18n, tdd]
requires:
  - phase: 18-06
    provides: JWT project draft/publish/webhook APIs and SaProjectConfigV1
  - phase: 18-08
    provides: dashboard shell patterns and speechAnalytics locale baseline
provides:
  - MetricEditor with D-25 sections wired to draft/publish
  - SpeechAnalyticsProjectsPage empty/loading/error + DataTable
  - Project editor page shell
  - ru/en project-editor Copywriting Contract keys
affects: [18-13, 18-14, 18-15]
actuals:
  tokens: 18000
  tasks: 2
  commits: 5
plan_head_before: 2c02a2cf22564e33a04b742541baa1cb92fdc547
tech-stack:
  added: []
  patterns:
    - "Draft save via PUT If-Match then explicit publish"
    - "Horizontal tab strip + vertical form body with min-height 0"
    - "Integrations link-out instead of embedded channels page"
key-files:
  created:
    - packages/frontend/src/features/speechAnalytics/ui/MetricEditor.module.scss
    - packages/frontend/src/features/speechAnalytics/ui/MetricEditor.test.tsx
    - packages/frontend/src/pages/SpeechAnalyticsProjectsPage/SpeechAnalyticsProjectsPage.module.scss
    - packages/frontend/src/pages/SpeechAnalyticsProjectPage/SpeechAnalyticsProjectPage.module.scss
  modified:
    - packages/frontend/src/features/speechAnalytics/ui/MetricEditor.tsx
    - packages/frontend/src/features/speechAnalytics/api/speechAnalyticsApi.ts
    - packages/frontend/src/pages/SpeechAnalyticsProjectsPage/SpeechAnalyticsProjectsPage.tsx
    - packages/frontend/src/pages/SpeechAnalyticsProjectsPage/SpeechAnalyticsProjectsPage.test.tsx
    - packages/frontend/src/pages/SpeechAnalyticsProjectPage/SpeechAnalyticsProjectPage.tsx
    - packages/frontend/src/pages/SpeechAnalyticsProjectPage/SpeechAnalyticsProjectPage.test.tsx
    - packages/frontend/src/shared/config/locales/ru.ts
    - packages/frontend/src/shared/config/locales/en.ts
key-decisions:
  - "Replaced shared Tabs with a plain HStack tab strip to avoid TabsList MutationObserver update loops under many editor tabs"
  - "Model override fields default hidden (canEditModels=false); full tenant-right gating deferred to 18-15"
  - "Extended speechAnalyticsApi with updateSaProjectDraft and testSaProjectWebhook (Rule 2) so the editor can call 18-06 APIs"
patterns-established:
  - "Hydrate draft once per projectId:draft_revision to avoid RTK mock identity loops"
  - "Projects list keeps Create CTA in header for zero/one/many; empty body repeats CTA per Copywriting Contract"
requirements-completed: [REQ-SA-PARITY, REQ-SA-ARCH]
coverage:
  - id: D1
    description: Empty projects list shows locked copy and Create project CTA
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: packages/frontend/src/pages/SpeechAnalyticsProjectsPage/SpeechAnalyticsProjectsPage.test.tsx#shows empty projects heading and create CTA when list is empty
        status: pass
    human_judgment: false
  - id: D2
    description: MetricEditor exposes D-25 sections and disables publish while draft save is in flight
    requirement: REQ-SA-PARITY
    verification:
      - kind: unit
        ref: packages/frontend/src/features/speechAnalytics/ui/MetricEditor.test.tsx#renders every D-25 industry template and editor sections
        status: pass
      - kind: unit
        ref: packages/frontend/src/pages/SpeechAnalyticsProjectsPage/SpeechAnalyticsProjectsPage.test.tsx#renders D-25 templates and disables publish while saving
        status: pass
    human_judgment: false
duration: 45min
completed: 2026-09-22
status: complete
---

# Phase 18 Plan 12: MetricEditor and projects UI Summary

**Cabinet MetricEditor reaches aiPBX section parity against 18-06 draft/publish APIs, with a projects list that matches the D-36 empty/loading/error copy.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-22T14:22:00Z
- **Completed:** 2026-09-22T14:45:00Z
- **Tasks:** 2/2
- **Files modified:** 12 (+ SCSS modules, RED evidence)

## Accomplishments

- Projects list: empty «Проектов пока нет» / CTA «Создать проект», loader, error+retry, DataTable/cards for rows
- MetricEditor: industry templates, custom metrics, hideable scales, system prompt, topics, webhook (+ test), digest, alerts, budget; publish disabled while save in flight
- Digest/alerts pick notification integration uids and link to `/integrations` when empty (no second channels page)
- ru/en project-editor keys added without removing journal/CDR/dashboard keys; no U+2014 in new strings

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: empty projects list tests** - `89ed13c2` (test)
2. **Task 1 GREEN: projects list page** - `c51b32bb` (feat)
3. **Task 2 RED: MetricEditor D-25 section tests** - `405a95bc` (test)
4. **Task 2 GREEN: MetricEditor + draft APIs + i18n** - `4f80f9d9` (feat)

**Plan metadata:** `765d641d` (docs: complete plan)

## TDD Gate Compliance

| Task | RED commit | GREEN commit | REFACTOR | Evidence |
|------|------------|--------------|----------|----------|
| 1 Projects list | `89ed13c2` | `c51b32bb` | skipped | `tdd/18-12-t1-red-evidence.json` RED_EVIDENCE_OK |
| 2 MetricEditor | `405a95bc` | `4f80f9d9` | skipped | `tdd/18-12-t2-red-evidence.json` RED_EVIDENCE_OK |

## Files Created/Modified

- `MetricEditor.tsx` / `.module.scss` / `.test.tsx` - full D-25 editor UI
- `speechAnalyticsApi.ts` - draft update + webhook test mutations, draft_config normalize
- `SpeechAnalyticsProjectsPage.*` - list empty/loading/error + DataTable
- `SpeechAnalyticsProjectPage.*` - editor shell
- `ru.ts` / `en.ts` - project-editor keys only

## Decisions Made

- Plain HStack tab strip instead of shared `Tabs` to avoid overflow observer loops with many sections
- `canEditModels` prop defaults false on ProjectPage; SUPERADMIN/tenant-right wiring stays in 18-15
- RTK draft endpoints added as Rule 2 so UI never invents a wallet/bypass path

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added draft/webhook RTK endpoints**
- **Found during:** Task 2
- **Issue:** Plan `files_modified` omitted `speechAnalyticsApi.ts`, but MetricEditor must call PUT draft / POST webhook test from 18-06
- **Fix:** Added `updateSaProjectDraft` and `testSaProjectWebhook` with If-Match and draft_config normalization
- **Files modified:** `speechAnalyticsApi.ts`
- **Commit:** `4f80f9d9`

**2. [Rule 1 - Bug] Draft hydrate loop under unstable query identity**
- **Found during:** Task 2 GREEN (ProjectPage test)
- **Issue:** `useEffect([project])` re-set state whenever RTK/mock returned a new project object reference
- **Fix:** Hydrate once per `projectId:draft_revision`
- **Files modified:** `MetricEditor.tsx`
- **Commit:** `4f80f9d9`

**3. [Rule 3 - Blocking] Shared TabsList infinite update depth**
- **Found during:** Task 2 GREEN
- **Issue:** Radix TabsList MutationObserver + scrollIntoView looped with many editor tabs
- **Fix:** Custom horizontal tab buttons + conditional panels (still scrolls horizontally / form body vertically)
- **Files modified:** `MetricEditor.tsx`, `MetricEditor.module.scss`
- **Commit:** `4f80f9d9`

## Verify Results

```
npm run test -w @krasterisk/frontend -- --run src/pages/SpeechAnalyticsProjectsPage/SpeechAnalyticsProjectsPage.test.tsx
→ 6 passed (empty/loading/error/CTA + MetricEditor D-25/publish-disabled smoke)

Also: MetricEditor.test.tsx + ProjectPage.test.tsx → 9 passed total across the three files
```

## Self-Check: PASSED

- FOUND: MetricEditor.tsx, ProjectsPage, ProjectPage, ru/en keys, SUMMARY path
- FOUND commits: `89ed13c2`, `c51b32bb`, `405a95bc`, `4f80f9d9`
