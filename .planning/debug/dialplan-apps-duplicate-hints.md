---
status: diagnosed
trigger: "Investigate issue: dialplan-apps-duplicate-hints — CallerIdApp and TrunkCarouselApp show the same help text twice: once as visible inline Text and again in an InfoTooltip popup on a button, wasting vertical space."
created: 2026-07-16T12:28:00+07:00
updated: 2026-07-16T12:30:00+07:00
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CallerIdApp and TrunkCarouselApp intentionally render the same i18n string as both inline Text and InfoTooltip text prop in one `.hint` row — D-16 over-delivered as dual surfaces.
test: Read JSX in CallerIdApp, TrunkCarouselApp, NotifyApp; grep dialplan-apps for InfoTooltip + hint patterns.
expecting: Identical t() keys for Text and InfoTooltip in CallerId/TrunkCarousel; NotifyApp uses tooltip-only (no duplicate).
next_action: Return ROOT CAUSE FOUND (diagnose-only; no code fix).

## Symptoms

expected: Clear per-mode/app hints (D-16) without duplication — either compact inline text OR tooltip, not both with overlapping content.
actual: User (RU): "подсказки дублируются текстом и потом во всплывающей подсказке на кнопке" / "подсказка опять дублируется. много места всё занимает"
errors: None
reproduction: Tests 5 and 6 in .planning/phases/06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove/06-UAT.md — open CallerID and Trunk Carousel actions in route dialplan editor
started: Discovered during Phase 6 UAT

## Eliminated

- hypothesis: NotifyApp / GroupApp share the same dual Text+InfoTooltip pattern
  evidence: NotifyApp uses InfoTooltip alone next to the message label with a distinct key `routes.apps.notify.varsHint` (no sibling Text with that content). GroupApp has no InfoTooltip/hint dual block in dialplan-apps grep.
  timestamp: 2026-07-16T12:29:00+07:00

## Evidence

- timestamp: 2026-07-16T12:28:30+07:00
  checked: CallerIdApp.tsx lines 149–152
  found: Single `.hint` div renders `<Text>{t(MODE_HINT_KEYS[mode], ...)}</Text>` AND `<InfoTooltip text={t(MODE_HINT_KEYS[mode], ...)} />` with the exact same key/fallback.
  implication: Visible paragraph and tooltip popup show identical copy for every mode.

- timestamp: 2026-07-16T12:28:45+07:00
  checked: TrunkCarouselApp.tsx lines 106–119
  found: Same dual pattern — `<Text>` and `<InfoTooltip text=...>` both call `t('routes.apps.trunkCarousel.hint', ...)`.
  implication: App-level hint duplicated; matches UAT test 6 report.

- timestamp: 2026-07-16T12:29:00+07:00
  checked: NotifyApp.tsx lines 91–99; dialplan-apps InfoTooltip grep
  found: NotifyApp only mounts InfoTooltip on the label row with `routes.apps.notify.varsHint` — no inline Text duplicating that string. HangupApp/ActionTypeSelect/etc. use tooltip-only. GroupApp not in InfoTooltip set.
  implication: Bug is localized to CallerIdApp + TrunkCarouselApp hint rows, not a shared dialplan-apps wrapper.

- timestamp: 2026-07-16T12:29:15+07:00
  checked: common-bug-patterns + knowledge base
  found: No knowledge-base file. Pattern matches dual presentation of same content (UX over-delivery), not async/state/API.
  implication: Fix is remove one surface; prefer existing NotifyApp/HangupApp tooltip-on-label pattern or single short Text.

## Resolution

root_cause: CallerIdApp and TrunkCarouselApp each render the same i18n hint string twice in one `.hint` block — once as visible `<Text variant="small">` and again as `InfoTooltip` `text` — so users see the full help inline and again in the info-button popup. Keys: `MODE_HINT_KEYS[mode]` / `routes.apps.callerid.hint*` and `routes.apps.trunkCarousel.hint`.
fix: (diagnose-only — not applied)
verification: (n/a)
files_changed: []
