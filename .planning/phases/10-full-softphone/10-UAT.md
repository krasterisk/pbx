---
status: complete
phase: 10-full-softphone
source:
  - 10-01-SUMMARY.md
  - 10-02-SUMMARY.md
  - 10-03-SUMMARY.md
  - 10-04-SUMMARY.md
  - 10-05-SUMMARY.md
  - 10-06-SUMMARY.md
  - 10-07-SUMMARY.md
  - 10-08-SUMMARY.md
  - 10-09-SUMMARY.md
started: "2026-07-27T04:07:40.248Z"
updated: "2026-07-28T10:42:00.000Z"
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Stop running backend/frontend if needed. Start the stack from a clean boot. Server starts without errors; call-center migrations (cc_contacts, journal_depth) are present; operator panel loads and a basic authenticated API/health check returns live data.
result: pass

### 2. Миграция контактов на живой БД (Книга)
expected: В софтфоне раздел Контакты → Книга открывается без ошибки из‑за отсутствующей таблицы. Создание контакта проходит успешно (миграция cc_contacts применена).
result: pass
reported: "контакт создался; UX скролла исправлен; поле comment было без i18n — hotfix callcenter.contacts.noteLabel"
coverage_id: D1
requirement: D-15
rationale: Migration must be applied to live DB before FE Book section

### 3. Глубина журнала на живой БД
expected: В админ-настройках колл-центра есть journal_depth (по умолчанию 50). Журнал софтфона после сохранения соблюдает эту глубину.
result: pass
reported: "перенесено из «Пороги алертов» во вкладку «Моя панель» → Настройка панели → Софтфон"
coverage_id: D3
requirement: D-04
rationale: Migration must be applied to live DB before FE Journal depth reads the column

### 4. DTMF во время активного звонка (живой Asterisk)
expected: На активном звонке клавиатура софтфона отправляет цифры; удалённая сторона/IVR слышит DTMF (AMI PlayDTMF на своём канале). Неверный digit / чужой вызов отклоняются без падения UI.
result: pass
coverage_id: D1
requirement: D-32
rationale: PlayDTMF param shape A1 needs live Asterisk check

### 5. Состояние регистрации софтфона (live)
expected: Бейдж регистрации отражает реальное состояние SIP/WebRTC (online / registering / offline). Recover восстанавливает регистрацию после обрыва (путь ~10 с).
result: pass
reported: "retest после hotfix-softphone-registration-storm — бейдж/Recover ок, без contact storm и 429"
coverage_id: D2
requirement: D-35
rationale: DeviceState field names A3 need live check

### 6. Живая проверка Asterisk A1/A3
expected: Сессия с аппаратным/настольным телефоном подтверждает, что PlayDTMF Channel/Digit (A1) и имена полей DeviceState/ExtensionState (A3) совпадают с тем, что шлёт/читает бэкенд — без тихих no-op.
result: pass
reported: "да, dtmf работает в sip режиме"
coverage_id: D4
requirement: D-35
rationale: No live PBX in executor environment; shapes ship unconfirmed until hardware-phone session

### 7. GET /callcenter/contacts tenant-scoped via JWT
expected: GET /callcenter/contacts tenant-scoped via JWT vpbx_user_uid
result: pass
source: automated
coverage_id: D2
requirement: D-11

### 8. Operator create + own-only edit/delete; supervisor any tenant row
expected: Operator create + own-only edit/delete; supervisor any tenant row (ownership in where)
result: pass
source: automated
coverage_id: D3
requirement: D-13

### 9. Contact DTO MaxLength; update ignores client tenant/owner fields
expected: CreateContactDto/UpdateContactDto MaxLength on name/number/note; update ignores client tenant/owner fields
result: pass
source: automated
coverage_id: D4
requirement: D-14

### 10. historyRow SSE once per persisted row
expected: historyRow SSE once per persisted row on bulk flush and createOne, tenant-addressed
result: pass
source: automated
coverage_id: D1
requirement: D-05

### 11. No historyRow emit when bulkCreate throws
expected: No historyRow emit when bulkCreate throws
result: pass
source: automated
coverage_id: D2
requirement: D-05

### 12. SIP outbound reuses clickToCall/originateDial
expected: SIP outbound reuses clickToCall/originateDial (no new dial path)
result: pass
source: automated
coverage_id: D3
requirement: D-33

### 13. RTK contacts CRUD + DTMF + registration + journal_depth tags
expected: RTK contacts CRUD + sendDtmf + registration-state + journal_depth + CcContacts tag
result: pass
source: automated
coverage_id: D1
requirement: D-11, D-04, D-32, D-35

### 14. historyRow SSE prepend + cap N for own operator rows
expected: historyRow SSE prepend + cap N for own operator rows
result: pass
source: automated
coverage_id: D2
requirement: D-05

### 15. Dial buffer sessionStorage round-trip
expected: Dial buffer sessionStorage round-trip independent of shift
result: pass
source: automated
coverage_id: D3
requirement: D-19

### 16. Softphone copywriting ru+en
expected: Copywriting Contract strings in ru+en; dialFailed ru matches UI-SPEC
result: pass
source: automated
coverage_id: D4
requirement: D-16, D-18

### 17. Blended Journal feed with direction icons
expected: Blended most-recent-first Journal feed with direction icons (in/out/missed)
result: pass
source: automated
coverage_id: D1
requirement: D-02

### 18. Journal feed capped at journal_depth N
expected: Feed capped at journal_depth N (default 50)
result: pass
source: automated
coverage_id: D2
requirement: D-04

### 19. Journal row actions — callback and open-card only
expected: Exactly two row actions - callback and open-card
result: pass
source: automated
coverage_id: D3
requirement: D-03

### 20. Journal empty/error/More footnote states
expected: Empty + error(retry) states and More in History footnote at N cap
result: pass
source: automated
coverage_id: D4
requirement: D-01

### 21. Admin journal_depth bound to updateTenantSettings
expected: Admin journal_depth numeric field bound to updateTenantSettings
result: pass
source: automated
coverage_id: D5
requirement: D-04

### 22. Contacts five sticky sections + unified search
expected: Five sticky sections Recent/Subscribers/Queues/Groups/Book with unified search collapsing empty headers
result: pass
source: automated
coverage_id: D1
requirement: D-11, D-14

### 23. Contacts click-to-call + Recent dedup
expected: Endpoints/Queues/Groups + Book dial via CTA-only click-to-call; Recent dedup slice
result: pass
source: automated
coverage_id: D2
requirement: D-25, D-11

### 24. ContactBookForm CRUD + ownership gate
expected: ContactBookForm Sheet CRUD + per-row ownership gate + own vs supervisor delete copy
result: pass
source: automated
coverage_id: D3
requirement: D-12, D-13

### 25. Contacts load error banner with retry
expected: Contacts load error banner with retry re-firing getMyContacts
result: pass
source: automated
coverage_id: D4
requirement: D-14

### 26. History Queue/Outbound/Personal segments (no Missed)
expected: Queue / Outbound / Personal segments; no Missed segment
result: pass
source: automated
coverage_id: D1
requirement: D-07

### 27. History client-side segment filter
expected: Client-side segment filter over existing history rows
result: pass
source: automated
coverage_id: D2
requirement: D-07

### 28. History per-segment search
expected: Per-segment search (queue: number/name/queue; out/personal: number/name/status)
result: pass
source: automated
coverage_id: D3
requirement: D-10

### 29. History shift/day period control
expected: Shift/day period control preserved
result: pass
source: automated
coverage_id: D4
requirement: D-08

### 30. Softphone chrome Tabs Dial/Journal/Contacts (no FAB)
expected: Fab variant fully removed; chrome shell with shared/ui/Tabs Dial/Journal/Contacts
result: pass
source: automated
coverage_id: D1
requirement: D-26

### 31. Softphone Redial + registration badge/Recover
expected: Journal/Contacts mounted; Redial dials lastNumber; registration badge/banner/Recover after 10s
result: pass
source: automated
coverage_id: D2
requirement: D-19

### 32. WebRTC quality+devices; SIP omits both
expected: WebRTC quality+devices present; SIP mode omits both from DOM; inline device-switch error
result: pass
source: automated
coverage_id: D3
requirement: D-34

### 33. useSipPhoneAmi WebRTC-compatible AMI surface
expected: useSipPhoneAmi exposes WebRTC-compatible control surface over AMI REST + sendDtmf + registration-state
result: pass
source: automated
coverage_id: D1
requirement: D-32

### 34. SIP-mode SoftphoneWidget (no quality/device rows)
expected: SIP-mode SoftphoneWidget mounts with mode=sip; quality/device rows absent (D-34)
result: pass
source: automated
coverage_id: D2
requirement: D-31

### 35. Shared SIP hold/mute/hangup/transfer/DTMF handlers
expected: Shared handler layer routes SIP hold/mute/hangup/transfer/DTMF through sipPhone (D-24)
result: pass
source: automated
coverage_id: D3
requirement: D-24

## Summary

total: 35
passed: 35
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-10-3
  truth: "Софтфон регистрируется один раз; Recover не вызывает шторм REGISTER/credentials"
  status: resolved
  reason: "Opening panel + recoverSoftphone refetched credentials on every disconnected flip → parallel connect() → Asterisk remove-existing contact loop; credentials throttled 429"
  severity: critical
  test: 5
  resolved_by: hotfix-softphone-registration-storm
  resolved_at: 2026-07-27
  root_cause: "SoftphoneWidget open effect called onRecover (credential refetch); no connect in-flight guard; GET credentials not SkipThrottle"
  artifacts:
    - path: "packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.tsx"
      issue: "open panel used onRecover instead of ensureConnected"
    - path: "packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx"
      issue: "recoverSoftphone refetched on every call"
    - path: "packages/frontend/src/features/callcenter/lib/useWebRTCPhone.ts"
      issue: "parallel connect() without in-flight guard"
    - path: "packages/backend/src/modules/endpoints/endpoints.controller.ts"
      issue: "credentials endpoint subject to global throttle"
  missing: []
  debug_session: ""

- gap_id: G-10-2
  truth: "Контакты → Книга: список скроллится внутри панели софтфона; созданный контакт доступен для открытия/редактирования"
  status: resolved
  reason: "User reported scroll UX; fixed chromePanel max-height + internal scroll + note i18n"
  severity: major
  test: 2
  resolved_by: hotfix-softphone-contacts-scroll-i18n
  resolved_at: 2026-07-27
  root_cause: "chromePanel без max-height; note label брал moh.description (несуществующий ключ → EN fallback)"
  artifacts:
    - path: "packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.module.scss"
      issue: "max-height + flex scroll chain"
    - path: "packages/frontend/src/shared/config/locales/ru.ts"
      issue: "callcenter.contacts.noteLabel / notePlaceholder"
  missing: []
  debug_session: ""
