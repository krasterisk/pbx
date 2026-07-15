# Phase 7: Call Center overhaul — Plan Outline

**Mode:** standard · chunked (outline-only)
**Generated:** 2026-07-15
**Plan count:** 16 plans across 5 waves
**Decision coverage:** D-01 … D-45 (all 45 locked decisions mapped)

Brownfield rework organized as **horizontal layers** with wave dependencies. Wave 1 delivers the
persistence/metrics foundation (D-03 mandated first) that every reporting/wallboard/timeline feature
reads from. AI-ready foundation (D-41…D-45) is sequenced LAST (Wave 4) so it builds on top of the
domain entities (history, metrics, supervisor state) rather than ahead of them. The expert audit (D-02)
was completed inside `07-RESEARCH.md`; Wave 1 acts on its findings (agentTransfer channel bug, AMI
reconnect resync gap, missing history layer).

## Outline

| Plan ID | Objective | Wave | Depends On | Requirements (D-NN decisions covered) |
|---------|-----------|------|------------|----------------------------------------|
| 07-01 | History persistence foundation: `cc_queue_calls` model + migration, batched-async history writer (in-memory buffer → `bulkCreate` on interval/threshold flush), wire AMI handlers to enqueue without blocking hot path; act on audit — fix `agentTransfer` channel bug (use `callerChannel` not `callerIdNum`) and re-run `loadInitialState()` resync on AMI reconnect | 1 | — | D-01, D-02, D-03, D-04, D-05, D-09 |
| 07-02 | Roles, navigation & settings shell: migrate routes to `/callcenter/*` (agent, supervisor, wallboard, reports, settings) + redirects from legacy `/operator`, `/supervisor`; role-based Sidebar filtering (level 2 operator vs 3+ supervisor vs admin, built from scratch); supervisor-can-work-as-operator entry; `/callcenter/settings` page skeleton with tabs | 1 | — | D-37, D-38, D-39, D-40 |
| 07-03 | Metrics engine: SLA/ASR/AHT/ASA/Occupancy/Abandon accumulators over in-memory + history layer; restore "today" accumulators from DB on backend restart; per-queue SLA threshold (`queue.servicelevel`) + tenant-level default | 2 | 07-01 | D-03, D-06, D-07 |
| 07-04 | queue_log reconciliation + rollup: `QueueLogReader` interface (file-tail vs realtime-table, chosen at runtime), backfill missing rows on AMI reconnect + hourly safety-net job; `cc_daily_queue_stats`/`cc_daily_agent_stats` rollup tables + nightly cron; hybrid SQL-on-raw (≤90d) vs rollup aggregation strategy + composite indexes | 2 | 07-01 | D-05, D-08 |
| 07-05 | CC settings entities: `cc_operator_settings` (per-operator: pickup permission, auto-answer, wrap-up timers, sound/notification prefs) + `cc_settings` (per-tenant singleton: default SLA, alert thresholds) models + migrations + CRUD; wire into `/callcenter/settings` tabs | 2 | 07-02 | D-22, D-27 |
| 07-06 | Call Cards backend: `cc_card_templates` / `cc_card_fields` / `cc_card_data` schema + migrations + CRUD; per-template `auto_open_on` (answer/ring/manual); CRM webhook on card save via Phase 6 `notification_integration` (extend `WebhookProvider.send` with `extraVars` card fields — no new credential store) | 2 | 07-01 | D-11, D-12, D-13 |
| 07-07 | Internal chat: `cc_chat_messages` model + migration + history persistence; REST POST send + SSE delivery over existing tenant-filtered stream (no WebSocket); personal supervisor↔operator / operator↔operator, supervisor broadcast (all/queue), group channels | 2 | 07-02 | D-30, D-31, D-32 |
| 07-08 | Operator workspace rework (4-zone concept): pick-call from own queues gated by per-user permission; wrap-up UX (extend +N sec button + autosave draft card on final timeout → READY, all timers per-operator); full notifications (incoming/missed sound + Browser Notification API on inactive tab + volume/mute); DnD transfer with blind/attended/cancel confirm modal | 3 | 07-02, 07-05 | D-18, D-19, D-20, D-21 |
| 07-09 | Supervisor workspace (all features): grid↔table (TanStack) toggle with remembered choice; agent detail modal (day timeline + stats); queue management modal (add/remove/penalty + DnD agents between queues); bulk actions (mass pause/unpause/logout); live-calls actions (pickup/transfer/hangup from table); KPI sparklines; spy/whisper/barge via Originate (as-is) | 3 | 07-02, 07-03 | D-23, D-24, D-25 |
| 07-10 | Wallboard backend: `cc_display_tokens` model + migration; long-lived opaque display-token guard (separate from `JwtAuthGuard`, read-only wallboard SSE topic only) + supervisor generate/revoke endpoints; threshold-breach alerts via Phase 6 `notification_integration` (Telegram/email to supervisor) | 3 | 07-03 | D-26, D-28 |
| 07-11 | Call Cards DnD builder + runtime card: full drag-and-drop template constructor with live preview (`@dnd-kit`, no intermediate list form), v1 field types; auto-populate from phonebook (`PhonebooksService.lookupNumber`); bind template to queues/CDR; render runtime card per `auto_open_on` | 3 | 07-06, 07-02 | D-10, D-11, D-12 |
| 07-12 | Reports v1 + export: 7 reports (queue summary, call detail, operator stats, pause report, hourly heatmap, agent timeline, missed with callback flag); reuses the Agent Timeline component owned by 07-09 (segments contract — does NOT create its own); CSV (reuse builder) + XLSX (`exceljs`) + PDF (`@react-pdf/renderer`) export | 4 | 07-03, 07-04, 07-09 | D-33, D-34, D-36 |
| 07-13 | Wallboard UI: fixed layout per concept (KPI cards + live chart + agents + queues) at `/callcenter/wallboard`; TV display-mode consuming read-only SSE via display-token; alert-threshold config UI on settings tab (reuses `shared/ui/Progress` owned by 07-08 for SLA bars) | 4 | 07-10, 07-05, 07-08 | D-27, D-29 |
| 07-14 | WebRTC softphone (full scope, `sip.js`): register/answer/hangup + hold/mute/DTMF + blind/attended transfer + audio device selection + call-quality indicator; mode-select modal at shift login (SIP device / browser) + extension choice; per-operator auto-answer + zip tone; STUN + env-configurable TURN | 4 | 07-05, 07-08 | D-14, D-15, D-16, D-17 |
| 07-15 | Scheduled report delivery: schedule + template + delivery via Phase 6 `notification_integration` (email/messenger); reuses report generation + export from 07-12 | 5 | 07-12 | D-35 |
| 07-16 | AI-ready foundation: typed CC event bus (discriminated-union over existing `CallCenterStateService` Subject); `CallCenterAiAdapter` + MCP tools via `AiAdapterRegistryService` (Phase 5 pattern, `vpbxUserUid` as param — closes ARCHITECTURE §6 gap); ARI `externalMedia` PCM skeleton (reuse voice-robots RTP pipeline, no STT); paid-module isolation + license-gate design (reuse billing infra) + no ai-agent-type in schema; reuse voice-robots/aiPBX concepts | 4 | 07-01, 07-03, 07-09 | D-41, D-42, D-43, D-44, D-45 |

## Wave Structure

| Wave | Plans | Focus |
|------|-------|-------|
| 1 | 07-01, 07-02 | Persistence + AMI-audit fixes; roles/nav/settings shell (independent) |
| 2 | 07-03, 07-04, 07-05, 07-06, 07-07 | Metrics, reconciliation/rollup, CC settings, cards backend, chat |
| 3 | 07-08, 07-09, 07-10, 07-11 | Operator + supervisor panels, wallboard backend, cards builder |
| 4 | 07-12, 07-13, 07-14, 07-16 | Reports (reuses 07-09 AgentTimeline), wallboard UI, WebRTC softphone, AI-ready foundation |
| 5 | 07-15 | Scheduled report delivery (depends on 07-12 reports) |

## Decision Coverage Matrix

Every D-NN decision maps to ≥1 plan:

- **Structure/priorities:** D-01 (07-01), D-02 (07-01), D-03 (07-01, 07-03), D-04 (07-01)
- **Metrics/data:** D-05 (07-01, 07-04), D-06 (07-03), D-07 (07-03), D-08 (07-04), D-09 (07-01)
- **Call Cards:** D-10 (07-11), D-11 (07-06, 07-11), D-12 (07-06, 07-11), D-13 (07-06)
- **WebRTC:** D-14 (07-14), D-15 (07-14), D-16 (07-14), D-17 (07-14)
- **Operator panel:** D-18 (07-08), D-19 (07-08), D-20 (07-08), D-21 (07-08), D-22 (07-05)
- **Supervisor panel:** D-23 (07-09), D-24 (07-09), D-25 (07-09)
- **Wallboard:** D-26 (07-10), D-27 (07-05, 07-13), D-28 (07-10), D-29 (07-13)
- **Internal chat:** D-30 (07-07), D-31 (07-07), D-32 (07-07)
- **Reports:** D-33 (07-12), D-34 (07-12), D-35 (07-15), D-36 (07-12)
- **Roles/nav:** D-37 (07-02), D-38 (07-02), D-39 (07-02), D-40 (07-02)
- **AI-ready:** D-41 (07-16), D-42 (07-16), D-43 (07-16), D-44 (07-16), D-45 (07-16)

## Shared-File Coordination

Some files are **appended-to by multiple plans in the SAME wave**. Concurrent subagents editing the same file
race and clobber each other. `execute-phase` MUST either **serialize** (not parallelize) the subagents that touch
these files within a wave, OR apply their edits as **additive-only patches** (add to arrays / append object keys /
append i18n keys — never overwrite or replace the whole file). All listed edits are designed to be additive so
concurrent merges stay clean.

| File | Wave · Plans (same-wave writers) | Edit shape |
|------|----------------------------------|------------|
| `packages/backend/src/modules/callcenter/callcenter.module.ts` | Wave 2: 07-03, 07-04, 07-05, 07-06, 07-07 | additive: add to `forFeature` / `providers` / `controllers` arrays only |
| `packages/backend/src/app.module.ts` | Wave 2: 07-04, 07-05, 07-06, 07-07 | additive: add new Cc* models to `models` array only (`autoLoadModels:false`) |
| `packages/frontend/src/shared/api/endpoints/callCenterApi.ts` | Wave 2: 07-05, 07-07 | additive: add new `injectEndpoints` entries + hook exports only |
| `packages/frontend/src/shared/config/locales/ru.ts` / `en.ts` | Wave 2: 07-05, 07-07 · Wave 3: 07-09 (and 07-08/07-10/07-11) · Wave 4: 07-12, 07-13, 07-14 · Wave 5: 07-15 | additive: append new keys under `callcenter.*`, never overwrite existing keys |
| `packages/frontend/src/shared/ui/Progress/Progress.tsx` (+ `shared/ui/index.ts` export) | **Cross-wave: owned by 07-08 (Wave 3), reused by 07-13 (Wave 4)** | 07-08 CREATES `Progress` with `tone: 'info' \| 'success' \| 'warning' \| 'destructive'` (default `'info'`; `WrapupBar.tsx` uses `<Progress tone="info" />`). 07-13 must NOT recreate the file — it only **imports** `Progress` from `shared/ui` for queue SLA bars (tone `success`/`warning`/`destructive`). If a `'primary'` variant is ever needed it must be added **additively** without removing `'info'`, or `tsc --noEmit` breaks on 07-08's shipped `WrapupBar.tsx`. |

Note (D-36): the reusable `AgentTimeline` component is **owned by 07-09** (single presentational `segments` contract).
07-12 (reports) only **imports and reuses** it — it does not create its own timeline component. This is why
`07-12 depends_on 07-09` and 07-12 sits in Wave 4 (one wave after 07-09).

## Notes for Per-Plan Detailing

- **Package installs** (`sip.js` in 07-14, `exceljs` in 07-12) are `[ASSUMED]` in RESEARCH — each install task needs a `checkpoint:human-verify` gate and a `T-07-SC` supply-chain entry in the plan `<threat_model>`.
- **Threat models** (ASVS L1) per plan focus areas: display-token privilege leakage (07-10/07-13), cross-tenant MCP closure (07-16), webhook payload injection (07-06), batched-writer DoS cap (07-01), SSE auth (07-07/07-10).
- **queue_log format** (file vs realtime-table) is an Open Question — 07-04 must verify target Asterisk `queue_log.conf` before implementing the reconciler; build behind a `QueueLogReader` interface.
- **Do not** confuse existing read-only `ClientCard` widget with the new configurable Call Card entity (07-06/07-11).
- **PJSIP WSS / coturn** are ops-runbook items (outside git) — 07-14 documents them as infra prerequisites, not code tasks.
