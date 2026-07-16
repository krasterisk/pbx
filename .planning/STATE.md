---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to execute
last_updated: "2026-07-16T17:54:17.383Z"
progress:
  total_phases: 8
  completed_phases: 5
  total_plans: 68
  completed_plans: 59
  percent: 63
---

# State

## Current position

Phase: 8 (navigation-redesign-android-port-foundation) — EXECUTING
Plan: 08-07 complete (MobileBottomBar 004-B + chip Sheet); next incomplete 08-08
Phase 7 — Call Center: gap closure complete (07-21, 07-22); re-UAT / `/gsd-verify-work 7` still available in parallel.
Phase 5 — Phonebooks AI: plans executed (verify/UAT may remain).  
Phase 6 — Dialplan Apps: **06-01–06-16 executed** (gap closures done). Re-UAT after ops mkdir for krasterisk subdirs; UAT Tests 5–6 hint duplication fixed.

Phase 4 — IVR TTS phrases: **executed** (verify pending).  
Phase 3 — IVR UI: **executed** (verify pending).  
Phase 2 — MohPage: executed.  
Phase 1 — MOH: pending verify.

## Decisions

- Used IsDialstatusOrArrayConstraint custom validator for reliable array dialstatus validation (06-01)
- [Phase 06]: Preserved legacy NoOp for single invalid dialstatus string; arrays silently drop invalids
- [Phase 06]: trunk_carousel uses labeled same=>n(tN) rotation from RAND pick with Return on ANSWER
- [Phase 06]: Inline ExecIfTime guard for time_group_uid (A8) — Set(__WT_uid) + outer ExecIf wrapper
- [Phase 06]: call_groups schema uses vpbx_user_uid tenant column with FK cascade on members (06-04)
- [Phase 06]: generateGroupDialplan pure fn with Return() termination for all 4 ring strategies (06-05)
- [Phase 06]: Notification integrations encrypt credentials via shared secret-cipher.util; CRUD never returns encrypted_credentials (06-07)
- [Phase 06]: findByUidInternal skips tenant filter — dispatcher resolves globally-unique integration uid (06-07)
- [Phase 06]: callGroupApi + notificationApi RTK slices with CallGroups/Notifications cache tags (06-10)
- [Phase 06]: CallGroupsService Pattern 2 — generateGroupDialplan + DialplanApplyService on every CRUD (06-06)
- [Phase 06]: Member replace-all only when members !== undefined on update (queues idiom) (06-06)
- [Phase 06]: Local NotifyDialplanBody until 06-09 formalizes DTO; axios direct in providers (HttpModule wiring in 06-09)
- [Phase 06]: NotificationIntegrationsPage with channelFields-driven modal; secrets write-only via credentials object (06-12)
- [Phase 06]: CallGroupsPage + CallGroupFormModal with members editor; external_context from useGetContextsQuery (06-11)
- [Phase 06]: POST /api/internal/dialplan/notify with DIALPLAN_API_KEY auth and fire-and-forget dispatch; NotificationsModule fully wired (06-09)
- [Phase 06]: params.group always String(call_group.uid) for Gosub name consistency (Pitfall 2)
- [Phase 06]: CallGroupFormModal gained optional onSaved so GroupApp refreshes selection after create/edit
- [Phase 06]: Prefer tooltip-on-label (NotifyApp) over dual Text+InfoTooltip for D-16 hints (06-16)
- [Phase 06]: callerid + trunk_carousel registered as GenericApp placeholders until 06-14 dedicated apps
- [Phase 06]: CallerIdApp is a PURE CallerID modifier; carousel mode is random/rotation only — no re-dial/failover (failover lives in TrunkCarouselApp)
- [Phase 06]: setclid_custom/setclid_list ids preserved; registry points both at CallerIdApp with mode inference for legacy records
- [Phase 06]: trunk_carousel defaultParams.mode = random_then_failover with empty trunks array
- [Phase 07]: History rows only on terminal AMI events (complete/abandon) due to UNIQUE call_uniqueid
- [Phase 07]: Blind Redirect uses callerChannel; AMI reconnect schedules loadInitialState
- [Phase 07]: CC routes under /callcenter/* with RequireRole client gate; UserLevel set membership (not numeric compare)
- [Phase 07]: /callcenter/agent unguarded so supervisors/admins can work as operators (D-39)
- [Phase 07]: CallCenterMetricsService in-memory accumulators with restoreToday from cc_queue_calls (D-03/D-06/D-07)
- [Phase 07]: queueMetrics SSE + GET /callcenter/metrics/queues tenant-scoped via req.user.vpbx_user_uid
- [Phase 07]: queue_log default backend realtime (Task 1 DB verify); CC_QUEUE_LOG_BACKEND env override
- [Phase 07]: Hybrid rollup RAW_MAX_DAYS=90; sla_met_calls uses DEFAULT_SLA_THRESHOLD_SEC in rollup
- [Phase 07]: Settings assertSupervisor uses UserLevel set membership so ADMIN can write tenant cc_settings
- [Phase 07]: GET operator/tenant settings returns defaults without creating rows
- [Phase 07]: Call card v1 field types — 14 types; file upload excluded (D-11)
- [Phase 07]: auto_open_on ENUM answer/ring/manual per D-12 (not concept never)
- [Phase 07]: CRM card save webhook via notification_integration + extraVars tenant guard (D-13)
- [Phase 07]: Internal chat v1 REST+SSE ccChatMessage with recipientUserIds server filter (D-30)
- [Phase 07]: Chat channel_key dm:min:max / group:uid / broadcast:all / broadcast:queue:q (D-31)
- [Phase 07]: cc_chat_messages history with vpbx_user_uid tenant isolation (D-32)

- [Phase 07]: pickup_enabled server 403 + UI hidden pick; wrapup extend via wrapupDeadlines (D-18/D-19)
- [Phase 07]: Transfer target tenant allow-list; Browser Notification only when tab hidden (D-20/D-21)
- [Phase 07]: Agent ARM 4-zone layout; DragTransfer blind/attended/cancel Dialog; shared/ui Progress
- [Phase 07]: DisplayTokenGuard sets req.user without level/id (Pitfall 5)
- [Phase 07]: Alert thresholds (WHEN) in cc_settings; routing (WHERE) in cc_alert_config (D-27/D-28)
- [Phase 07]: Call card frontend DnD builder + FieldRenderer single source of truth (D-10/D-11)
- [Phase 07]: CallCardPopup Sheet auto_open_on ring/answer/manual + queue_names template resolve (D-12)
- [Phase 07]: exceljs 4.4.0 for XLSX export after supply-chain verify; PDF client-side in 07-18
- [Phase 07]: Penalty drafts local (IAgent.queues has no penalty); bulk selection table-only
- [Phase 07]: Wallboard uses local WALLBOARD_DEFAULT_THRESHOLDS on public TV (no JWT settings fetch)
- [Phase 07]: Public /callcenter/wallboard outside AppLayout; display-token SSE only (never localStorage)
- [Phase 07]: UserAgent+Registerer for WebRTC REFER/getStats (not SimpleUser); connect(overrides) for credential race
- [Phase 07]: ICE/TURN only via GET /callcenter/webrtc/config; sip.js@0.21.2 exact pin after supply-chain verify
- [Phase 07]: Reports UI reuses AgentTimeline from 07-09; PDF client-side with 2000-row cap (07-18)
- [Phase 07]: Reuse Subject via getTypedEventStream; no EventEmitter2 (D-41a)
- [Phase 07]: externalMedia format alaw; NestJS+license-gate over external-service (D-45)
- [Phase 07]: runReport(reportId, user_uid, dto) for schedule delivery (07-12 signature)
- [Phase 07]: Report schedules supervisor-gated; email attach / messenger summary via notification_integration (D-35)
- [Phase 07]: PauseReasonsManager reuses existing pause-reasons RTK hooks; no new API paths
- [Phase 07]: Operator settings: self uses my-operator endpoints; other operators use GET/PUT /operator/:operatorId with id only in path
- [Phase 07]: Track SIP MuteAudio as DEF-07-MUTE-AMI rather than implement AMI action in gap closure (no MuteAudio helper in repo)
- [Phase 06]: Prefer tooltip-on-label (NotifyApp) over dual Text+InfoTooltip for D-16 hints
- [Phase 07]: Bind myAgentInterface from ShiftLoginResult.interface, not API unwrap
- [Phase 07]: UI-only ≥1 queue gate; backend AgentLoginDto queues remain optional
- [Phase 07]: SSE fallback never overwrites non-null myAgentInterface; logout owns clear
- [Phase 07]: Document ASTERISK_WSS_URL + SIP_DOMAIN + optional WEBRTC_TURN_* in .env.example only — no invented pjsip/http.conf
- [Phase 07]: UI copy names the env var so operators can escalate to admins with an actionable message
- [Phase 08]: Hub module code callcenter (not call-center) for BASELINE_MODULES consistency
- [Phase 08]: LEVEL_OPTIONS omits SUPERADMIN — platform-only (D-21)
- [Phase 08]: Locale seeds written to shared/config/locales (actual path), not plan i18n/locales typo
- [Phase 08]: createTokenStorage native returns null until Secure Storage wired in 08-10
- [Phase 08]: SuperAdminGuard tested against production class; purchase/device-token NotImplemented stubs owned by 08-06/08-11
- [Phase 08]: Hub catalog additive over MODULES_SEED; licenseStatus server-side; role_start_defaults+tenant_role_start
- [Phase 08]: Hub ships 002-E dense list (UI-SPEC supersedes D-05 bento/dock)
- [Phase 08]: ModuleShell logo to /modules; Overview chip without product tabs (D-14)
- [Phase 08]: CommandPalette uses Dialog+Input only — cmdk forbidden (T-08-SC)
- [Phase 08]: /platform stub Navigate target until 08-05 PlatformLayout
- [Phase 08]: Platform routes outside AppLayout with console-chrome (006-B)
- [Phase 08]: Tenant Modules at /system/modules; /my-modules redirects there
- [Phase 08]: Buy stub navigates Hub until 08-06 checkout
- [Phase 08]: Hub market prices via LEGACY_HUB_LICENSE_CODES paid registry codes (08-06)
- [Phase 08]: Purchase JWT tenant_id with vpbx_user_uid fallback to tenants.id (08-06)
- [Phase 08]: CheckoutSheet 005-B plan→confirm→success wired to POST /marketplace/purchase (08-06)
- [Phase 08]: Phone More sheet lists non-primary modules; locked shortcuts go Hub (T-08-12)
- [Phase 08]: ModuleChip Sheet on phone / DropdownMenu on desktop via useIsMobile(768)

## Roadmap Evolution

- Phase 8 planned (2026-07-16): 17 plans (`08-01`…`08-17`), waves 0–10; RESEARCH + PATTERNS + VALIDATION; plan-checker PASSED (NAV-01…16, D-01…41). Hub ships 002-E list (not bento).
- Phase 8 UI-SPEC approved (2026-07-16): design contract verified 6/6 — Hub E list, tabs B, mobile bottom bar, marketplace section, platform separate apps; see `08-UI-SPEC.md`.
- Phase 8 context gathered (2026-07-16): Module Hub + marketplace catalog/billing skeleton + full responsive + Capacitor Android foundation; see `08-CONTEXT.md`.
- Phase 8 added: Navigation redesign & Android port foundation — масштабируемая модульная навигация (IA, command palette, mobile-first), design-system shell touchpoints, Capacitor-first подготовка стека к Android (WebRTC/SSE/auth gaps).
- Phase 7 added: Call Center overhaul — корпоративный колл-центр (аудит + rework ядра, АРМ оператора/супервизора, wallboard + metrics, call cards, отчётность/аналитика, WebRTC, AI-ready foundation).
- Phase 6 added: Dialplan Apps — ring groups / call lists, multi-channel notifications, UX overhaul DialplanAppsEditor.
- Phase 5 added: Phonebooks AI — универсальные механизмы справочников, MCP tools и настройка через AI Chat module.
- Phase 4 added: IVR «Фразы» — TTS-текст с движком и per-phrase voice/settings (TtsEngines).

## Next GSD command

`/gsd-execute-phase 8` — or finish Phase 7 via `/gsd-verify-work 7`

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 06 P02 | 34min | 2 tasks | 2 files |
| Phase 06 P03 | 18min | 2 tasks | 3 files |
| Phase 06 P04 | 12min | 2 tasks | 3 files |
| Phase 06 P05 | 25min | 2 tasks | 2 files |
| Phase 06 P07 | 30min | 3 tasks | 8 files |
| Phase 06 P10 | 15min | 1 task | 3 files |
| Phase 06 P08 | 12min | 2 tasks | 10 files |
| Phase 06 P12 | 7min | 2 tasks | 16 files |
| Phase 06 P11 | 8min | 3 tasks | 15 files |
| Phase 06 P09 | 8min | 2 tasks | 4 files |
| Phase 06 P13 | 12min | 3 tasks | 12 files |
| Phase 06 P14 | 9min | 3 tasks | 9 files |
| Phase 07 P01 | 8min | 3 tasks | 11 files |
| Phase 07 P02 | 18min | 3 tasks | 9 files |
| Phase 07 P03 | 22min | 3 tasks | 7 files |
| Phase 07 P04 | 16min | 4 tasks | 14 files |
| Phase 07 P05 | 16min | 3 tasks | 22 files |
| Phase 07 P06 | 15min | 3 tasks | 15 files |
| Phase 07 P07 | 28min | 3 tasks | 24 files |
| Phase 07 P08 | 35min | 3 tasks | 17 files |
| Phase 07 P10 | 12min | 3 tasks | 13 files |
| Phase 07 P12 | 45min | 3 tasks | 9 files |
| Phase 07 P17 | 6min | 2 tasks | 7 files |
| Phase 07 P13 | 10min | 3 tasks | 20 files |
| Phase 07 P14 | 25min | 4 tasks | 18 files |
| Phase 07 P18 | 12min | 2 tasks | 8 files |
| Phase 07 P16 | 10min | 3 tasks | 10 files |
| Phase 07 P15 | 20min | 4 tasks | 19 files |
| Phase 07 P19 | 5min | 2 tasks | 8 files |
| Phase 07 P20 | 4min | 1 tasks | 2 files |
| Phase 06 P16 | 5min | 2 tasks | 6 files |
| Phase 07 P21 | 8min | 2 tasks | 9 files |
| Phase 07 P22 | 6min | 1 tasks | 4 files |
| Phase 08 P01 | 7min | 2 tasks | 8 files |
| Phase 08 P12 | 8min | 2 tasks | 6 files |
| Phase 08 P13 | 8min | 2 tasks | 5 files |
| Phase 08 P02 | 25min | 3 tasks | 22 files |
| Phase 08 P03 | 20min | 3 tasks | 26 files |
| Phase 08 P04 | 10min | 2 tasks | 11 files |
| Phase 08 P05 | 11min | 3 tasks | 22 files |
| Phase 08 P06 | 12min | 2 tasks | 16 files |
| Phase 08 P07 | 8min | 2 tasks | 9 files |
