---
phase: 13-custom-voicemail-instead-of-voicemail
plan: 06
subsystem: voicemail
tags: [voicemail, notify, attach, telegram, email, d-62, d-64, d-65, d-66, tdd]

requires:
  - phase: 13-custom-voicemail-instead-of-voicemail
    provides: 13-05 mintPlayToken + 7-day opaque play URL; 13-11 ingest `{accepted:true}`
provides:
  - NotificationSendOptions attach + extraVars on INotificationProvider.send
  - Telegram sendDocument multipart; email attachments[]; link-only channels ignore attach
  - Ingest first notify: <2 MiB attach, >=2 MiB token link; D-66 same-channel fallback
affects:
  - 13-07 notify retry scanner (next_notify_at / notify_attempts / notify_error)
  - 13-08 JWT stream (unrelated to notify token)

actuals:
  tokens: 10072
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Native FormData + axios multipart to Telegram sendDocument (never sendVoice/sendAudio)
    - Webhook extraVars live on NotificationSendOptions, not a 4th positional Record
    - First notify runs inside ingest after insert; controller still fire-and-forgets ingest

key-files:
  created: []
  modified:
    - packages/backend/src/modules/notifications/providers/notification-provider.interface.ts
    - packages/backend/src/modules/notifications/providers/telegram.provider.ts
    - packages/backend/src/modules/notifications/providers/email.provider.ts
    - packages/backend/src/modules/notifications/providers/webhook.provider.ts
    - packages/backend/src/modules/notifications/notification-dispatcher.service.ts
    - packages/backend/src/modules/voicemail/voicemail.service.ts
    - packages/backend/src/modules/voicemail/voicemail.module.ts
    - packages/backend/src/modules/mailer/mailer.service.ts
    - packages/backend/src/modules/callcenter/callcenter-cards.service.ts

key-decisions:
  - "Telegram WAV goes as sendDocument, not sendVoice/sendAudio"
  - "Attach iff fs.stat size is strictly less than 2 * 1024 * 1024"
  - "Transport fail sets notify_attempts=1 and next_notify_at=now+1min; D-66 success leaves attempts at 0"
  - "Notify params (integration_uid/body/target/subject) come from ingest body — no new voicemail_messages columns this plan"

patterns-established:
  - "Pattern: attachment_rejected is a 4xx payload reject; 5xx stays a transport error"
  - "Pattern: first notify is Nest-side after insert; hangup CURL only gets {accepted:true}"

requirements-completed: [D-62, D-64, D-65, D-66]

coverage:
  - id: D1
    description: Telegram attach posts multipart sendDocument; 4xx → attachment_rejected; 5xx is a different error
    requirement: D-64
    verification:
      - kind: unit
        ref: packages/backend/src/modules/notifications/providers/notification-provider.spec.ts#POSTs multipart sendDocument when attach is present
        status: pass
    human_judgment: false
  - id: D2
    description: Email attach passes attachments[] into mailer; webhook/whatsapp/max/vk ignore attach (link-only)
    requirement: D-65
    verification:
      - kind: unit
        ref: packages/backend/src/modules/notifications/providers/notification-provider.spec.ts#passes attachments[] into mailer when attach is set
        status: pass
    human_judgment: false
  - id: D3
    description: Dispatcher forwards attach and keeps webhook extraVars as clid/exten/uniqueid
    requirement: D-62
    verification:
      - kind: unit
        ref: packages/backend/src/modules/notifications/notification-dispatcher.service.spec.ts#forwards attach to telegram and email
        status: pass
    human_judgment: false
  - id: D4
    description: Ingest size 2MiB-1 attaches; size 2MiB mints 13-05 play token link (never a raw file URL)
    requirement: D-64
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail.service.spec.ts#size 2MiB-1 takes the attach path
        status: pass
    human_judgment: false
  - id: D5
    description: attachment_rejected immediately resends same-channel text+link and does not increment notify_attempts (D-66)
    requirement: D-66
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail.service.spec.ts#attachment_rejected resends text+link and leaves notify_attempts unchanged
        status: pass
    human_judgment: false
  - id: D6
    description: Controller still returns {accepted:true} before ingest/notify settles; ingest does not start STT
    requirement: D-62
    verification:
      - kind: unit
        ref: packages/backend/src/modules/voicemail/voicemail-dialplan.controller.spec.ts#returns before ingest completes (fire-and-forget, not awaited)
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-03
status: complete
---

# Phase 13 Plan 06: First notify attach + 2 MiB gate Summary

**Nest-side first voicemail notify after `{accepted:true}` — Telegram/email attach under 2 MiB via `sendDocument`/`attachments[]`, else a 7-day `mintPlayToken` link; rejected attach resends the same channel as text+link without burning retries**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-03T03:03:09Z
- **Completed:** 2026-09-03T03:14:51Z
- **Tasks:** 3
- **Files modified:** 17

## Accomplishments
- `NotificationSendOptions` (`attach`, `extraVars`) is the 4th `INotificationProvider.send` argument
- Telegram attach is multipart `sendDocument` (not `sendVoice`/`sendAudio`); 4xx → `attachment_rejected`
- Email forwards `attachments[]` into `MailerService.sendNotification`; WhatsApp/MAX/VK/webhook stay link-only
- Ingest `sendFirstNotify`: `stat` byte gate, attach or opaque play URL, D-66 same-channel fallback, transport fail → `pending` + `attempts=1` + `next_notify_at=+1min`
- No STT/LLM on the hangup path; CURL still gets `{accepted:true}` before ingest settles

## Task Commits

Each task was committed atomically:

1. **Task 1: NotificationSendOptions + telegram/email attach** - `a61cd59` (test RED) + `17f86a0` (feat GREEN)
2. **Task 2: Dispatcher passes options through** - `c73d7aa` (feat)
3. **Task 3: Ingest first notify — 2 MiB gate + D-66 resend** - `61cc69c` (test RED) + `af4fa46` (feat GREEN)

**Plan metadata:** (this commit)

_Note: TDD tasks have RED → GREEN commits_

## Files Created/Modified
- `packages/backend/src/modules/notifications/providers/notification-provider.interface.ts` - `NotificationSendOptions`, `ATTACHMENT_REJECTED`
- `packages/backend/src/modules/notifications/providers/telegram.provider.ts` - `sendDocument` multipart + 4xx vs 5xx
- `packages/backend/src/modules/notifications/providers/email.provider.ts` - optional `attachments[]`
- `packages/backend/src/modules/notifications/providers/webhook.provider.ts` - `options.extraVars` (attach ignored)
- `packages/backend/src/modules/notifications/providers/{whatsapp,max,vk}.provider.ts` - 4-arg signature, attach ignored
- `packages/backend/src/modules/notifications/notification-dispatcher.service.ts` - forwards attach; returns send result without throwing
- `packages/backend/src/modules/voicemail/voicemail.service.ts` - `sendFirstNotify` after insert
- `packages/backend/src/modules/voicemail/voicemail.module.ts` - imports `NotificationsModule`
- `packages/backend/src/modules/mailer/mailer.service.ts` - optional `attachments` on `sendNotification`
- `packages/backend/src/modules/callcenter/callcenter-cards.service.ts` - CRM webhook caller uses `{ extraVars }`

## Decisions Made
- Telegram WAV is a document (`sendDocument`), matching Bot API (WAV is not OPUS/MP3).
- Strict `< 2 MiB` attach; `size === 2*1024*1024` is link-only (D-64/D-65).
- First transport fail sets `notify_attempts=1`; D-66 resend success leaves attempts at 0.
- Notify integration/body/target/subject are read from the ingest CURL body. No new `voicemail_messages` columns in this plan — 13-07 can persist them if retry needs a stored target.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Mailer `sendNotification` accepts `attachments[]`**
- **Found during:** Task 1 GREEN
- **Issue:** Email attach cannot reach SMTP unless mailer forwards `attachments`
- **Fix:** Extended `SendNotificationDto` and `sendMail` with optional `attachments`
- **Files modified:** packages/backend/src/modules/mailer/mailer.service.ts
- **Verification:** Email attach unit test
- **Committed in:** 17f86a0 (Task 1 GREEN)

**2. [Rule 1 - Bug] CRM card webhook still passed positional extraVars**
- **Found during:** Task 1 GREEN
- **Issue:** Folding extraVars into options would drop CRM `{{customer_name}}` substitution
- **Fix:** `webhook.send(..., { extraVars })` + spec update
- **Files modified:** packages/backend/src/modules/callcenter/callcenter-cards.service.ts, callcenter-cards.service.spec.ts
- **Verification:** callcenter-cards.service.spec.ts
- **Committed in:** 17f86a0 (Task 1 GREEN)

**3. [Rule 2 - Missing Critical] Dispatcher returns `NotificationSendResult`**
- **Found during:** Task 2
- **Issue:** D-66 needs the provider error string; fire-and-forget `void` hid `attachment_rejected`
- **Fix:** `dispatch` still never throws; it returns the provider result
- **Files modified:** packages/backend/src/modules/notifications/notification-dispatcher.service.ts
- **Verification:** ingest D-66 unit test
- **Committed in:** c73d7aa (Task 2)

---

**Total deviations:** 3 auto-fixed (2 missing critical, 1 bug)
**Impact on plan:** Required for attach + D-66. No new npm packages. Notify-param columns deferred to 13-07.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Ready for 13-07 (scanner retries honor `next_notify_at` / `notify_attempts`; do not start STT from ingest). Play links use only 13-05 opaque tokens.

## TDD Gate Compliance
- RED commits present: `a61cd59`, `61cc69c`
- GREEN commits: `17f86a0`, `af4fa46` (Task 2 was `type="auto"` without tdd — `c73d7aa`)
- No REFACTOR commit (implementation stayed minimal)

## Authentication Gates
None

## Known Stubs
None — first notify is wired; STT remains 13-07.

## Threat Flags
None — attach buffer gated at 2 MiB (T-13-14); links are 13-05 tokens only (T-13-13).

## Self-Check: PASSED
- FOUND: packages/backend/src/modules/notifications/providers/notification-provider.interface.ts
- FOUND: packages/backend/src/modules/voicemail/voicemail.service.ts
- FOUND: .planning/phases/13-custom-voicemail-instead-of-voicemail/13-06-SUMMARY.md
- FOUND: a61cd59
- FOUND: 17f86a0
- FOUND: c73d7aa
- FOUND: 61cc69c
- FOUND: af4fa46
- VERIFY: `npm run test -w @krasterisk/backend -- --testPathPattern="notification-dispatcher|notification-provider|voicemail" --no-coverage` — 69 passed
