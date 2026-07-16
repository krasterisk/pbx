---
status: diagnosed
phase: 06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md, 06-05-SUMMARY.md, 06-06-SUMMARY.md, 06-07-SUMMARY.md, 06-08-SUMMARY.md, 06-09-SUMMARY.md, 06-10-SUMMARY.md, 06-11-SUMMARY.md, 06-12-SUMMARY.md, 06-13-SUMMARY.md, 06-14-SUMMARY.md]
started: 2026-07-15T14:00:00+07:00
updated: 2026-07-16T12:30:00+07:00
---

## Current Test

[testing complete]

## Tests

### 1. Call Groups page — list & CRUD
expected: Navigating to /call-groups shows a table of call groups (name, strategy, member count, actions). "Create" opens a modal to set name/strategy/ring_time/external_context and add reorderable internal/external members with per-member ring_time. Saving adds the group to the list; Edit/Copy work prefilled.
result: issue
reported: |
  After Sequelize model fix + migration: save still fails.
  1) DialplanApplyService: Failed to create category [group_1_0]: File requires escalated privileges
  2) Then ExceptionsHandler: Transaction cannot be rolled back because it has been finished with state: commit
severity: blocker
root_cause: |
  Two stacked defects:
  A) AMI UpdateConfig to krasterisk/groups/group_<vpbx>.conf returns "File requires escalated privileges" — likely missing groups/ include dir on Asterisk (ops) and/or path/permissions vs how routes/phonebooks write; needs diagnosis vs DialplanApplyService + Asterisk stand.
  B) CallGroupsService.create commits the DB transaction BEFORE applyGroup(); on AMI failure the catch still calls transaction.rollback() → secondary "Transaction cannot be rolled back... state: commit". Code bug: catch must not rollback after commit; AMI failure should not mask a successful DB write with a 500 (or should apply before commit / compensate).
artifacts:
  - packages/backend/src/modules/call-groups/call-groups.service.ts
  - packages/backend/src/modules/ami/dialplan-apply.service.ts
missing:
  - "Safe post-commit error handling (no rollback after commit)"
  - "Asterisk groups conf path/permissions or include setup for krasterisk/groups/"
fix_applied: "Partial: CallGroup/CallGroupMember registered in app.module.ts; migrate-call-groups-phase6.ts run. AMI privileges + transaction rollback still open."

### 2. Group action in Route editor (GroupApp) — inline create/edit
expected: In a Route's dialplan editor, adding a "Group" action shows a Select of existing call groups plus a Create/Edit button that opens the same Call Group form inline, without leaving the route editor. Selecting a group stores it on the action and the route can be saved.
result: pass

### 3. Notification Integrations page — list & CRUD per channel
expected: Navigating to /integrations shows a table of integrations. "Create" lets you pick a channel (Telegram/Email/WhatsApp/Webhook/MAX/VK); form fields and hints change per channel. Secret fields (tokens/API keys) are write-only — editing an existing integration shows them blank with a "keep existing" hint, never revealing the real value.
result: pass
notes: "Initially failed (table missing); after migrate-notifications-phase6.ts — user confirmed pass on retest."

### 4. Notify action in Route editor (NotifyApp)
expected: Adding a "Notify" action lets you pick one of your saved integrations, write or pick a preset message template with channel variables (e.g. caller number), and optionally override the target. No credentials are entered here — only an integration is selected.
result: pass

### 5. CallerID editor action (CallerIdApp) — 4 modes
expected: Adding a "CallerID" action shows a mode selector: static number/name, phonebook lookup, setclid list, or CID-carousel (pool of numbers, random pick). Each mode shows only its relevant fields with an explanatory hint. Carousel mode lets you add/reorder/remove pool numbers. There is no "retry on no-answer" option here — that behavior intentionally lives only in Trunk Carousel.
result: issue
reported: "подсказки дублируются текстом и потом во всплывающей подсказке на кнопке"
severity: cosmetic
root_cause: "CallerIdApp renders mode/field hints both as visible Text and via InfoTooltip on a button with the same (or overlapping) content — D-16 over-delivered as dual surfaces."
artifacts: [packages/frontend/src/features/dialplan-apps/ui/apps/CallerIdApp/CallerIdApp.tsx]
missing: ["Single hint surface per mode/field (text OR tooltip, not both)"]

### 6. Trunk Carousel action (TrunkCarouselApp)
expected: Adding a "Trunk Carousel" action lets you add an ordered list of trunks, each with its own CallerID source (static number or phonebook), reorder/remove trunks, and shows a hint describing random-then-failover behavior (random trunk tried first; on no-answer, the next trunk is tried).
result: issue
reported: "да, подсказка опять дублируется. много места всё занимает"
severity: cosmetic
root_cause: "Same dual-hint pattern as CallerIdApp: inline Text + InfoTooltip with overlapping content wastes vertical space in TrunkCarouselApp."
artifacts: [packages/frontend/src/features/dialplan-apps/ui/apps/TrunkCarouselApp/TrunkCarouselApp.tsx]
missing: ["Single compact hint surface (prefer tooltip OR one short line, not both)"]

### 7. Existing dialplan apps preserved
expected: Other pre-existing apps in the route editor (e.g. Hangup, Play/Prompt, Webhook, time-group condition) still appear and behave exactly as before. Any action type without a dedicated app still falls back to the generic editor (GenericApp).
result: pass

### 8. Multi-value DIALSTATUS condition (bugfix)
expected: When setting a condition on an action, you can select multiple DIALSTATUS values at once (e.g. BUSY + NOANSWER) instead of only one, and saving the route does not error or silently drop the extra values.
result: pass

### 9. Hangup cause code persists (bugfix)
expected: The Hangup action lets you set a specific cause code. Saving and reopening the route keeps that cause code (previously it was accepted in the UI but silently ignored when the dialplan was generated).
result: pass

### 10. Live call: ring group strategy behavior (requires Asterisk stand)
expected: Dialing into a configured call group rings members according to the chosen strategy (ringall = all at once; hunt = one at a time in order; memoryhunt = growing set; random = random order), and control returns to the route for the next action if unanswered (never hangs up on its own).
result: blocked
blocked_by: prior-phase
reason: "не создаётся конфиг с группой: DialplanApplyService Failed to create category [group_1_0]: File requires escalated privileges; then Transaction cannot be rolled back (same as test 1, also on update)"

### 11. Live call: notification delivery to a real channel (requires configured integration)
expected: Triggering a Notify action during/after a call sends a real message to the configured channel (Telegram/Email/WhatsApp/Webhook/MAX/VK) with the expected text and caller info substituted.
result: blocked
blocked_by: server
reason: "не создаются конфигурационные файлы с маршрутами"

## Summary

total: 11
passed: 6
issues: 3
pending: 0
skipped: 0
blocked: 2

## Gaps

- truth: "Navigating to /call-groups shows a table of call groups; create/edit/copy persist via /call-groups API and apply dialplan"
  status: failed
  reason: "User reported after model+migration fix: DialplanApplyService Failed to create category [group_1_0]: File requires escalated privileges; then Transaction cannot be rolled back because it has been finished with state: commit"
  severity: blocker
  test: 1
  root_cause: "DialplanApplyService never AMI CreateConfig before UpdateConfig — missing .conf is mislabeled as escalated privileges (also blocks new route files). CallGroupsService commits then applyGroup; catch always rollback → Sequelize state: commit error."
  artifacts:
    - path: packages/backend/src/modules/ami/dialplan-apply.service.ts
      issue: "No CreateConfig / ensure-file before UpdateConfig DelCat/NewCat/Append"
    - path: packages/backend/src/modules/call-groups/call-groups.service.ts
      issue: "commit then apply inside try/catch that always calls rollback"
    - path: packages/backend/src/modules/routes/route-apply.service.ts
      issue: "Same DialplanApplyService — Test 11 route configs not created"
  missing:
    - "AMI CreateConfig (idempotent) before UpdateConfig in DialplanApplyService"
    - "Ensure/document mkdir krasterisk/groups (and peers) on Asterisk config dir"
    - "After commit: never rollback; handle AMI failure without masking DB success"
  debug_session: .planning/debug/call-groups-ami-apply.md

- truth: "CallerIdApp and TrunkCarouselApp show clear per-mode/app hints without duplicating the same help as inline text and tooltip"
  status: failed
  reason: "User reported duplicate hints on CallerIdApp (test 5) and TrunkCarouselApp (test 6): text + popup on button; wastes vertical space"
  severity: cosmetic
  test: 5
  root_cause: "Same i18n string rendered as both visible Text and InfoTooltip in one hint row; NotifyApp uses tooltip-only (correct)."
  artifacts:
    - path: packages/frontend/src/features/dialplan-apps/ui/apps/CallerIdApp/CallerIdApp.tsx
      issue: "Dual Text + InfoTooltip with MODE_HINT_KEYS"
    - path: packages/frontend/src/features/dialplan-apps/ui/apps/TrunkCarouselApp/TrunkCarouselApp.tsx
      issue: "Dual Text + InfoTooltip with routes.apps.trunkCarousel.hint"
  missing:
    - "Single hint surface (prefer InfoTooltip on label like NotifyApp)"
  debug_session: .planning/debug/dialplan-apps-duplicate-hints.md
