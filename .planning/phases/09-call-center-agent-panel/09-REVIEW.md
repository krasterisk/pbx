---
phase: 09-call-center-agent-panel
reviewed: 2026-07-23T09:23:00Z
depth: quick
scope: gap-closure-09-16-09-17
files_reviewed: 11
files_reviewed_list:
  - packages/backend/src/app.module.ts
  - packages/backend/src/modules/ai-chat/ai-chat.controller.ts
  - packages/backend/src/modules/callcenter/dto/callcenter-settings.dto.ts
  - packages/backend/src/modules/callcenter/callcenter-settings.service.ts
  - packages/backend/src/modules/callcenter/callcenter-settings.service.spec.ts
  - packages/frontend/src/features/callcenter/ui/AutoPauseRulesForm/AutoPauseRulesForm.tsx
  - packages/frontend/src/features/callcenter/ui/AutoPauseRulesForm/AutoPauseRulesForm.module.scss
  - packages/frontend/src/pages/CallCenterSettingsPage/CallCenterSettingsPage.tsx
  - packages/frontend/src/shared/api/endpoints/callCenterApi.ts
  - packages/frontend/src/shared/config/locales/en.ts
  - packages/frontend/src/shared/config/locales/ru.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues
---

# Phase 09: Code Review Report (Gap Closure 09-16 / 09-17)

**Reviewed:** 2026-07-23T09:23:00Z
**Depth:** quick
**Files Reviewed:** 11
**Status:** issues

## Summary

Advisory quick scan of G-09-1 (throttle) and G-09-2 (autopause config) gap-closure surfaces. No Critical findings: `PUT` tenant settings remains supervisor-gated (`assertSupervisor` on controller write path), `sanitizeAutopauseRules` drops `rona`/unknown types, and AI Chat uses named `@SkipThrottle({ default: true, global: true })` plus route-scoped `@Throttle({ global: … })` without bare `@SkipThrottle()`. Two Warnings remain around threshold sanitization and silent rule-cap truncation.

## Warnings

### WR-01: `sanitizeAutopauseRules` accepts non-positive thresholds

**File:** `packages/backend/src/modules/callcenter/callcenter-settings.service.ts:118-134`
**Issue:** Whitelist only checks `Number.isFinite` for `threshold` / `thresholdSec`. Values `0`, negatives, and non-integers (e.g. `0.5`) persist. Engine compares with `>=` (`callcenter-autopause.service.ts`), so `threshold: 0` / `thresholdSec: 0` can fire immediately; negatives fire on first evaluation. UI `min={1}` is HTML-only and does not clamp `onChange`.
**Fix:** Reject non-finite or `< 1` thresholds (and optionally require integers):

```typescript
if (type === 'missed_count') {
  const threshold = Number(row.threshold);
  if (!Number.isFinite(threshold) || threshold < 1) continue;
  out.push({ type: 'missed_count', threshold: Math.trunc(threshold), ...optional });
  continue;
}
// same floor for idle_time / status_duration thresholdSec
```

### WR-02: Soft cap of 20 rules silently truncates without UI feedback

**File:** `packages/backend/src/modules/callcenter/callcenter-settings.service.ts:108-109`
**Also:** `packages/frontend/src/features/callcenter/ui/AutoPauseRulesForm/AutoPauseRulesForm.tsx:69-72`
**Issue:** Server stops appending at `MAX_AUTOPAUSE_RULES` (20). Frontend `addRule` has no cap, so a supervisor can save >20 rules and quietly lose the tail — looks like a successful save (`toast.success`) while config is incomplete.
**Fix:** Disable/hide Add when `rules.length >= 20`, and/or return a 400 from the API when the raw array exceeds the cap instead of silent truncate.

## Info

### IN-01: Dual throttler registration still in play (`default` + `global`)

**File:** `packages/backend/src/app.module.ts:174-178`
**Cross-check:** `packages/backend/src/modules/ai-chat/ai-chat.controller.ts:78-133`; Auth still registers unnamed `ThrottlerModule.forRootAsync` + `@Throttle({ default: … })` on login.
**Issue:** G-09-1 correctly removed the parallel `ai` 10/min profile and scopes AI POST to named `global`. Residual Auth `default` + App `global` dual-`forRoot` remains; intentional bypasses skip both names. Not a bare-SkipThrottle regression, but profile merge behavior should stay monitored so notifications are not re-crushed by a leftover named limiter.
**Fix:** Prefer a single app-wide `forRoot` (or document that Auth `default` is login-route-only and does not stack under `APP_GUARD`).

### IN-02: Free-text `status_duration.status` has no length/whitelist bound

**File:** `packages/backend/src/modules/callcenter/callcenter-settings.service.ts:130-134`
**Issue:** Any non-empty trimmed string is accepted. Harmless for RONA integrity, but unbounded JSON / pause-reason message text. Frontend is a free text `Input`, not a status enum select.
**Fix:** Optionally whitelist known agent statuses (e.g. `WRAPUP`, `PAUSE`) and/or cap string length in sanitize.

## Security / throttle checklist (quick)

| Check | Result |
|-------|--------|
| `assertSupervisor` on tenant settings PUT (autopause write) | Pass (controller gate; service trusts caller) |
| `sanitizeAutopauseRules` drops `rona` / unknown / non-array | Pass |
| No bare `@SkipThrottle()` on AI Chat | Pass |
| App `ThrottlerModule` single named `global` (60/min); AI POST 10/min on `global` | Pass for G-09-1 intent |
| Frontend edit gate SUPERVISOR/ADMIN (UI-only; matches AlertThresholdsForm) | Pass (server remains source of truth) |

---

_Reviewed: 2026-07-23T09:23:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
_Advisory only — no source fixes applied_
