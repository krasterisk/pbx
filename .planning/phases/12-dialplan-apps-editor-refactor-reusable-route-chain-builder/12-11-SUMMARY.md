---
phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder
plan: 11
subsystem: dialplan
tags: [dialplan-bridge, CURL, DIALPLAN_API_KEY, TTS, notify, dual-read]

requires:
  - phase: 12-10
    provides: emitPlayback + dual-read offerOnCreate + HTTP_RESULT_VAR from 12-06
provides:
  - DialplanBridgeModule POST /internal/dialplan/{setclid,webhook,sendmailpeer,telegram,tts}
  - buildCurlCall with httptimeout + KRSK_HTTP_RESULT
  - text2speech via IvrTtsService (no AGI/say.php)
  - sendmail/sendmailpeer/telegram dual-read → notify CURL
affects:
  - 12-12 data migration (must delete dual-read legacy notify aliases)
  - 12-17 live notify/TTS UAT

tech-stack:
  added: []
  patterns:
    - "buildCurlCall is the only generator path from dialplan to Nest"
    - "DIALPLAN_API_KEY compared timing-safe; missing env key is 401"
    - "dual-read: sendmail/sendmailpeer/telegram generate notify until 12-12"

key-files:
  created:
    - packages/backend/src/modules/dialplan-bridge/dialplan-bridge.controller.ts
    - packages/backend/src/modules/dialplan-bridge/dialplan-bridge.service.ts
    - packages/backend/src/shared/utils/dialplan-curl.util.ts
    - packages/frontend/src/features/dialplan-apps/ui/apps/Text2SpeechApp/Text2SpeechApp.tsx
  modified:
    - packages/backend/src/shared/utils/dialplan.util.ts
    - packages/frontend/src/features/dialplan-apps/model/registry.ts
    - packages/frontend/src/features/dialplan-apps/ui/apps/NotifyApp/NotifyApp.tsx

key-decisions:
  - "PHP functions replaced: exten_setclid.php, sendmailpeer.php, telegram.php, webhook.php, say.php"
  - "Internal access: DIALPLAN_API_KEY guard (timing-safe). Network bind is a deploy recommendation, not implemented"
  - "t(key, fallback) instead of staging dirty locale files"
  - "No supertest package: controller unit tests cover 401/200"

patterns-established:
  - "emitNotifyDialplan is the single notify/sendmail/telegram generator"
  - "TTS engine uid comes from the tenant catalog; unknown uid is 400"

requirements-completed: [D-28, D-30, D-31]

coverage:
  - id: D1
    description: SHELL/System/PHP gone; CURL to guarded internal endpoints with timeout
    requirement: D-31
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan-curl.util.spec.ts#emits CURL() with an explicit httptimeout
        status: pass
      - kind: unit
        ref: packages/backend/src/modules/dialplan-bridge/dialplan-bridge.controller.spec.ts#returns 401 semantics without an API key
        status: pass
    human_judgment: false
  - id: D2
    description: text2speech uses IvrTtsService; engine catalog; failure is logged and empty http_result
    requirement: D-30
    verification:
      - kind: unit
        ref: packages/backend/src/modules/dialplan-bridge/dialplan-bridge.service.spec.ts#tts writes a sanitized basename
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/apps/Text2SpeechApp/Text2SpeechApp.test.tsx#renders an engine select
        status: pass
    human_judgment: false
  - id: D3
    description: notify covers channels; legacy sendmail/telegram dual-read; hidden on create
    requirement: D-28
    verification:
      - kind: unit
        ref: packages/backend/src/shared/utils/dialplan.util.spec.ts#sendmail old params match notify equivalent payload
        status: pass
      - kind: unit
        ref: packages/frontend/src/features/dialplan-apps/ui/apps/NotifyApp/NotifyApp.test.tsx#hides sendmail
        status: pass
    human_judgment: false
  - id: D4
    description: Live notify and TTS on a real Asterisk/Nest pair
    verification: []
    human_judgment: true
    rationale: Plan defers live notify/TTS to 12-17

duration: 60min
completed: 2026-08-19
status: complete
---

# Phase 12 Plan 11: Legacy cleanup (PHP → Nest, TTS, notify) Summary

**Internal `dialplan-bridge` with timed `CURL()` + `DIALPLAN_API_KEY`, TTS via `IvrTtsService`, and dual-read `notify` replacing sendmail/telegram PHP**

## Performance

- **Duration:** 60 min
- **Started:** 2026-08-19T09:51:20Z
- **Completed:** 2026-08-19T10:51:00Z
- **Tasks:** 3
- **Files modified:** 28

## Accomplishments

- Removed host-exec (`SHELL` / `System` / `AGI` PHP) from `dialplan.util.ts`. Calls go through `buildCurlCall` → `POST /internal/dialplan/*` with `CURLOPT(httptimeout)=5` and result in `KRSK_HTTP_RESULT` (`http_result`).
- TTS synthesizes via existing `IvrTtsService` (no second TTS layer). Unknown engine → 400. Engine error → empty result + log. Playback uses sanitized basename.
- `sendmail` / `sendmailpeer` / `telegram` generate the same notify CURL payload. Hidden from create (`offerOnCreate: false`), still render existing steps.

## PHP functions audited (Task 1)

| PHP script | Former branch | New endpoint / path |
|---|---|---|
| `exten_setclid.php` | `setclid_list`, `callerid` mode `setclid_list` | `POST /internal/dialplan/setclid` |
| `sendmailpeer.php` | `sendmailpeer` | notify (after Task 3) |
| `telegram.php` | `telegram` | notify (after Task 3) |
| `webhook.php` | `webhook` | `POST /internal/dialplan/webhook` |
| `say.php` (AGI) | `text2speech` | `POST /internal/dialplan/tts` |

`sendmail` was already CURL to `/internal/dialplan/sendmail`; Task 3 folded it into notify.

**Internal access:** guard on `DIALPLAN_API_KEY` (timing-safe). Missing or wrong key → 401, not empty success. Network isolation (bind to Asterisk host / loopback) is a **deploy recommendation**, not implemented in code.

**Env:** `DIALPLAN_API_KEY` reused (same as Phase 6 notify). Also `DIALPLAN_BACKEND_URL` for the Asterisk-visible API base.

## Characterization rewrites

| Branch | 12-01 expectation | New expectation | Why |
|---|---|---|---|
| `setclid_list` / `callerid.setclid_list` | dual `SHELL(exten_setclid.php)` | `CURL` setclid + `ExecIf` on `KRSK_HTTP_RESULT` | D-31 |
| `sendmail` | `MAIL_RESULT` + `/sendmail` | notify-equivalent `CURL` | D-28 |
| `sendmailpeer` / `telegram` | `System(*.php)` | notify `CURL` | D-28 / D-31 |
| `webhook` | `WH_DATA=${SHELL(webhook.php)}` | `KRSK_HTTP_RESULT` + `/webhook` | D-31 |
| `text2speech` | `AGI(say.php)` | `CURL` tts + `Playback(.../${KRSK_HTTP_RESULT})` | D-30 / D-31 |
| `notify` | `NOTIFY_RESULT` without timeout | `buildCurlCall` + `httptimeout` + `KRSK_HTTP_RESULT` | D-31 |

## Task Commits

1. **Task 1 RED** - `1246ad6` (test)
2. **Task 1 GREEN** - `26b48e9` (feat)
3. **Task 2 RED** - `4fe44fb` (test)
4. **Task 2 GREEN** - `5bd0b17` (feat)
5. **Task 3** - `53921ea` (feat; tests + impl together)

**Plan metadata:** (docs commit after this file)

## Files Created/Modified

- `packages/backend/src/modules/dialplan-bridge/*` - internal controller, service, DTO, module, timing-safe key
- `packages/backend/src/shared/utils/dialplan-curl.util.ts` - `buildCurlCall`
- `packages/backend/src/shared/utils/dialplan.util.ts` - generator branches
- `packages/backend/src/app.module.ts` - `DialplanBridgeModule`
- `packages/frontend/src/features/dialplan-apps/ui/apps/Text2SpeechApp/Text2SpeechApp.tsx` - schema + catalog
- `packages/frontend/src/features/dialplan-apps/ui/apps/NotifyApp/NotifyApp.tsx` - channels + per-channel recipients
- `packages/frontend/src/features/dialplan-apps/model/registry.ts` - offerOnCreate + Text2SpeechApp

## Decisions Made

- Auth tests are Nest controller unit tests (no `supertest` install; Rule 3).
- Copy uses `t(key, fallback)` so dirty `ru.ts` / `en.ts` stay unstaged.
- TTS reuses `IvrTtsService` + `IvrTtsCacheService`, not `TtsProviderFactory` (yandex-only).
- Notify without `integration_uid` sends email via `MailerService` (Phase 6 SMTP). Telegram without an integration is accepted and logged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No supertest dependency**
- **Found during:** Task 1
- **Issue:** Plan asked for Supertest; package is not in `package.json`. Installing packages is not auto-fixable.
- **Fix:** Controller unit tests for 401 / 200 (same assertions).
- **Files modified:** `dialplan-bridge.controller.spec.ts`
- **Committed in:** `1246ad6` / `26b48e9`

**2. [Rule 3 - Blocking] routes.service.spec sendmail characterization**
- **Found during:** Task 3
- **Issue:** Exact `/sendmail` + `KMAIL_*` strings broke after notify fold.
- **Fix:** Assert notify `KNOTIFY_*` + `/internal/dialplan/notify`.
- **Files modified:** `routes.service.spec.ts`
- **Committed in:** `53921ea`

**3. [Rule 2 - Missing Critical] Dispatcher accepts channel-only notify**
- **Found during:** Task 3
- **Issue:** New notify payload has no `integration_uid`; existing DTO required it.
- **Fix:** Optional `integration_uid`; email-without-integration uses `MailerService`.
- **Files modified:** `notify-dialplan.dto.ts`, `notification-dispatcher.service.ts`
- **Committed in:** `53921ea`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** Needed for tests and runtime. No scope creep.

## Issues Encountered

- Jest `--testPathPattern` on Windows matches unrelated suites; ran explicit spec paths instead.
- `IvrTtsCacheService` writes under `IVR_TTS_CACHE_DIR`; generator `Playback` prefixes `/usr/records/{uid}/sounds/`. Live audio needs the synthesized basename available in that sounds dir (12-17 / deploy). Not a generator stub.

## Out of scope (deferred)

- `packages/backend/src/modules/routes/routes.service.ts` still emits `SHELL(check_blacklist.php)` and `SHELL(check_listbook.php)` — outside this plan's files. Track for a later cleanup.
- Locale keys `routes.chain.notify.*` / `routes.chain.tts.*` are fallback-only until a dedicated i18n pass.

## User Setup Required

If `DIALPLAN_API_KEY` is unset, new bridge endpoints return 401 (stricter than older notify/sendmail controllers that allowed empty key). Set the same env var Asterisk already uses in generated `CURL()`.

Recommend firewalling `/api/internal/dialplan/*` to the Asterisk host.

## Next Phase Readiness

- Ready for **12-12** (data migration; delete dual-read legacy branches).
- Live notify + TTS remain 12-17 UAT.

## Self-Check: PASSED

- `packages/backend/src/modules/dialplan-bridge/dialplan-bridge.controller.ts` FOUND
- `packages/backend/src/shared/utils/dialplan-curl.util.ts` FOUND
- Commits `1246ad6`, `26b48e9`, `4fe44fb`, `5bd0b17`, `53921ea` FOUND

---
*Phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder*
*Completed: 2026-08-19*
