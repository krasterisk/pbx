---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 12
current_phase_name: dialplan-apps-editor-refactor-reusable-route-chain-builder
status: executing
stopped_at: Completed 12-07-PLAN.md
last_updated: "2026-08-19T08:22:38.979Z"
progress:
  total_phases: 12
  completed_phases: 8
  total_plans: 120
  completed_plans: 106
---

# State

## Current position

Phase: 12 (dialplan-apps-editor-refactor-reusable-route-chain-builder) — EXECUTING
Plan 12-01 (Wave 0 characterization) complete: 3/3 tasks. Plan 12-02 (queue-by-route-mask tracer) complete: 2/2 tasks (human-approved). Plan 12-03 (per-type DTO expansion) complete: 3/3 tasks. Plan 12-04 (tenant-settings module) complete: 3/3 tasks. Plan 12-05 (generator core / Congestion()) complete: 3/3 tasks. Plan 12-07 (FE editor core) complete: 4/4 tasks. Next sequential: 12-06 (hop-counter / unreachable-tail). After wave-3 siblings: 12-08 (host wiring).
Migrations applied (2026-07-24): `cc_contacts` table + `cc_settings.journal_depth`. Live Asterisk A1/A3 checkpoint still deferred in WINDOWS.md.

Also Phase 9 (complete, verify/UAT open):
Plan 09-01 (schema/model foundation, wave 1): 3/3 tasks committed + migration applied to live DB.
Plan 09-02 (Tabs primitive + AgentStatus model, wave 1): 3/3 tasks committed.
Plan 09-03 (all-channel AMI listener + dual shift/day KPI, wave 1): 3/3 tasks committed.
Plan 09-05 (PermissionsService + peer ChanSpy + audit, wave 2): 3/3 tasks committed.
Plan 09-06 (SoftphoneWidget FAB + IncomingCallToast, wave 2): 3/3 tasks committed.
Plan 09-04 (status bar redesign + KPI + call-control bar, wave 3): 3/3 tasks committed.
Plan 09-07 (backend call-control: park/conference/zombie-reset/warm-transfer/click-to-call, wave 3): 3/3 tasks committed. Next: 09-08+.
Plan 09-13 (backend settings API: UI customization/granular permissions/notification matrix, wave 3): 2/2 tasks committed. Next: 09-08+ or 09-14.
Plan 09-08 (CallCenterAgentPage hybrid orchestrator rework + WaitingTab/QueuesTab/CoworkersTab, wave 4): 3/3 tasks committed. Next: 09-09+.
Plan 09-09 (backend smart missed-calls engine + auto-pause rule engine, wave 4): 3/3 tasks committed (TDD RED/GREEN per task). Next: 09-10+.
Plan 09-10 (smart missed-calls UI rework + ParkedCallsIndicator + CallControlBar full-variant actions, wave 5): 3/3 tasks committed. Next: 09-11+.
Plan 09-11 (backend unified call history + transfer directory + BLF presence, wave 5): 3/3 tasks committed (TDD RED/GREEN Tasks 1-2). Next: 09-12+.
Plan 09-12 (TransferDirectory + CallHistoryPanel frontend, wave 6): 3/3 tasks committed.
Plan 09-14 (operator settings UI + notification engine + mobile verification + i18n, wave 7): 3/3 tasks committed.
Plan 09-15 (gap closure: wire CallControlBar/ParkedCallsIndicator/TransferDirectory/CallHistoryPanel into CallCenterAgentPage): 3/3 tasks committed.
Plan 09-16 (UAT gap G-09-1: single global throttler + AI POST route-scoped 10/min): 2/2 tasks committed.
Plan 09-17 (UAT gap G-09-2: tenant autopause_rules API + AutoPauseRulesForm): 2/2 tasks committed. Gap closure done.
Also: Phase 8 (navigation-redesign-android-port-foundation) — EXECUTING
Plan 08-11: Tasks 1–2 committed; **blocked on Task 3 human-verify** (Android WebRTC + FCM device smoke)

Await resume signal for 08-11: type `approved` or describe device failures. Partial SUMMARY: `08-11-SUMMARY.md`.

Phase 7 — Call Center: gap closure complete (07-21, 07-22); re-UAT / `/gsd-verify-work 7` still available in parallel.
Phase 5 — Phonebooks AI: plans executed (verify/UAT may remain).  
Phase 6 — Dialplan Apps: **06-01–06-16 executed** (gap closures done). Re-UAT after ops mkdir for krasterisk subdirs; UAT Tests 5–6 hint duplication fixed.

Phase 4 — IVR TTS phrases: **executed** (verify pending).  
Phase 3 — IVR UI: **executed** (verify pending).  
Phase 2 — MohPage: executed.  
Phase 1 — MOH: pending verify.

## Blockers

- [Phase 08 / 08-11 Task 3]: Human Android device/emulator smoke (FCM registration + softphone foreground audio). Requires `google-services.json` (see `08-USER-SETUP.md`).

## Decisions

- [Phase 12]: Wave 0 froze current generator output only — no production files changed
- [Phase 12]: ActionType (shared) and ActionTypesList (DTO) already match at Wave 0; completeness test is green
- [Phase 12]: voice-robots.service.ts:444 is max_retries_action and :456 is fallback_action (PLAN.md labels were swapped)
- [Phase 12]: dialplan.util.ts Wave 0 coverage: 100% stmts/lines, 93.06% branch; all 29 case arms reached
- [Phase 12]: Phonebook ValueSource requires varKey; lookup uses ?var_key= value-only into PB_TARGET
- [Phase 12]: Empty queue allowed with confirm on Sheet close and RouteFormModal save
- [Phase 12]: Sheet desktop width 50vw; queue Select uses Dynamic/Static optgroups
- [Phase 12]: UI never shows dialplan internals in tooltips (ARCHITECTURE rich InfoTooltip pattern)
- [Phase 12]: 12-02 locales skipped in close-out — ru.ts/en.ts mixed with unrelated WIP; commit chain keys later
- [Phase 12]: 30 ActionTypes are the live 29 plus congestion, not the planner setvar/goto taxonomy
- [Phase 12]: ACTION_PARAM_DTO is null only for hangup/busy/congestion
- [Phase 12]: 12-03 locales skipped — ru.ts/en.ts mixed with unrelated WIP; t(key, type) fallback
- [Phase 08]: 08-11 FCM POST `/marketplace/device-token`; JWT `sub` bind; foreground-only WebRTC notes (D-36)
- [Phase 08]: 08-10 human approved — assembleDebug with Studio JBR 21; gradlew empty-classpath + proguard-optimize fixes
- [Phase 08]: D-27 Hub-mapped reachable set closed with 08-09 + 08-14…08-17 (exclusions: wallboard, auth, legacy redirects)
- [Phase 08]: CDR/VR-CDR/ServiceRequests/AiAgents page-level overflow hybrid (08-17)
- [Phase 08]: Settings phone stack; TTS/STT/AuditLog/SystemModules page-level overflow hybrid (08-16)
- [Phase 08]: Apps remaining lists page-level overflow hybrid; VoiceRobotEditPage page-dir containment (08-15)
- [Phase 08]: Trunks phone cards; Contexts/TimeGroups/ProvisionTemplates page-level overflow (08-14)
- [Phase 08]: Critical Core lists phone cards; secondary wave-A pages page-level overflow hybrid (08-09)
- [Phase 08]: CC softphone fixed above 60px+safe-area bottom bar; agent pads softphone height only (08-09)
- [Phase 08]: Keep backend roles.role TEXT; Hub grants mapped in frontend (08-08)
- [Phase 08]: Tenant role-start on System Modules tab; SUPERADMIN only via PLATFORM_LEVEL_OPTIONS (08-08)
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
- [Phase 09]: 09-01 role_permission_defaults JSON on cc_settings singleton (not new table); Phase 9 schema migration applied to live DB
- [Phase 09]: 09-02 shared/ui/Tabs (Radix data-state driven underline); AgentStatus 9-member union + authoritative agentStatusLabel/agentStatusColorFamily maps; ru/en status+tabs i18n keys
- [Phase 09]: 09-03 findAgentByChannel channel-substring resolver (userId>0 guard, T-09-03-01); DIALING journaled via logStatusJournalEnter/Exit direct create+update (not CallCenterHistoryWriterService); dual sinceLogin/sinceMidnight KPI accumulators (agent + agent:queue) with agentKpiUpdate SSE delta; CONSULT/ACW journal path exists but no producer yet
- [Phase 09]: 09-05 CallCenterPermissionsService.getEffective merges role default + per-operator override with lock precedence; added permission_locks JSON column to cc_settings (09-01 gap — ui_visibility_locks/notification_locks shipped but no permissions sibling); peerSpy adds coworker ChanSpy scoped by shared online queue (no tenant-wide supervisor bypass), audited via LoggerService.logAction before AMI originate; noted (not fixed) the pre-existing assertSupervisor Set-vs-numeric divergence between callcenter.controller.ts and callcenter-settings.controller.ts
- [Phase 09]: 09-06 SoftphoneWidget takes phone (useWebRTCPhone return value) as required prop, not internal hook - single SIP session owned by 09-08 orchestrator; mobile (<768) branch renders structurally different sticky-bar tree (no floating FAB), per D-46 superseding UI-SPEC Sheet-on-phone wording; IncomingCallToast is non-modal plain div with CSS keyframes (no Sheet/motion lib); new callcenter.softphone.*/callcenter.incoming.* i18n keys genuinely translated in ru.ts (not falling back to English like pre-existing callcenter.agent.* keys)
- [Phase 09]: 09-04 added missing GET /callcenter/agent/kpi + CallCenterService.getAgentKpi (self-scoped from req.user.sub, T-09-04-01) since 09-03 only shipped the in-memory accumulator + SSE emission, not an endpoint; CallControlBar (compact/full) + AgentStatusBar built standalone and NOT wired into CallCenterAgentPage.tsx — that integration belongs to 09-08 (page not in this plan's files_modified); live status timer tracked client-side (ref+interval) since IAgent has no server "status changed at" field yet
- [Phase 09]: 09-07 fixed AmiService.getActiveChannels() (was a pre-existing dead-on-arrival CoreShowChannels event-list bug — resolved on ack, never collected the CoreShowChannel/Complete events) using the same actionid+rawevent pattern as pjsipShowRegistrations(); CallCenterZombieService polls every 45s, flags zombieCandidate on CallState after a fixed 10-min grace floor, never auto-hangs (D-27 reset stays operator-triggered); parkCall/retrieveParkedCall/addToConference/resetZombieCall/warmTransferToQueue all enforce getCall->tenant->own-call-ownership->channel guards; addToConference uses Redirect(Channel+ExtraChannel) into ConfBridge(room) + Originate for the 3rd party, same ad hoc dialplan-app-string convention as supervisorSpy/peerSpy; resetZombieCall audits via LoggerService.logAction (not a new cc_agent_events ENUM value — avoids an out-of-scope migration); clickToCall branches WebRTC-direct (no AMI) vs PJSIP-Originate-with-Call-Info-header, gated by permissionsService.assert('click_to_call'); Park/ConfBridge/Call-Info field-name assumptions flagged [ASSUMED] for 09-VALIDATION
- [Phase 09]: 09-13 extended CallCenterSettingsService/Controller with 18 self/:operatorId/tenant/matrix routes for UI customization (D-05/D-06), granular permissions (D-38/D-39), bulk matrix (D-40), notification matrix (D-41/D-42/D-43) — all merge/lock logic delegated to CallCenterPermissionsService.getEffective (09-05), never reimplemented; notification locks are per-event (not per-channel); ui_visibility_locks doubles as the lock map for softphone_placement; fixed a route-ordering bug where operator/:operatorId wildcard was shadowing the new operator/ui|permissions|notifications self routes (self routes now registered first)
- [Phase 09]: 09-08 CallCenterAgentPage hybrid orchestrator (Coworkers/Queues/Waiting panels >=1024px, shared Tabs default Waiting <768px); WaitingTab extraction + QueuesTab + CoworkersTab; added missing GET /callcenter/agent/queues-kpi backend endpoint; getEffectivePermissions RTK query bridges CoworkersTab ChanSpy/hangup gating until 09-14 usePermissions; queue self-service join/leave omitted (no backend endpoint yet)
- [Phase 09]: 09-09 getMissedCallsGrouped aggregates cc_missed_calls at the read layer (GROUP BY caller_id_num+personal, COUNT/MAX) — table stays call-level, UNIQUE(call_uniqueid) untouched, no unique index on caller_id_num (Pitfall 4); personal misses persist queue_name=direct:<agentInterface> (NOT NULL column, doubles as ownership marker); autoResolveOnAnswer lives on CallCenterService, invoked from CallCenterAmiService.handleAgentConnect via ModuleRef.get('CallCenterService') string alias (avoids circular constructor dep, mirrors existing 'CallCenterAmiService' alias); callbackMissedCall reuses clickToCall's WebRTC/PJSIP branching via extracted originateDial helper, success/failure decided by subscribing to the operator's own SSE agentUpdate stream (IN_CALL -> not-IN_CALL) and timing the gap against a >5s threshold; CallCenterAutoPauseService models rules as the AutoPauseRule[] typed union already on cc_settings.autopause_rules (09-01, Pitfall 7 — no per-type columns); RONA is fixed/always-on (pauses agents still RINGING in the abandoned queue), missed_count/idle_time/status_duration are configurable and evaluated from the existing handleCallerAbandon/handleAgentStatusEvent/handleDialEnd/handleAgentHangup call sites; auto-pause reuses queuePause+stateService.setAgent(PAUSED) exactly like supervisorForcePause (no forked pause path)
- [Phase 09]: 09-10 fixed AmiService.parkedCalls() dead-on-arrival bug (same class as getActiveChannels, 09-07) + added missing GET /callcenter/agent/parked-calls + CallCenterService.getParkedCalls + queueName MAX-aggregate on getMissedCallsGrouped (Task 1, Rule 2); MissedCallsPanel reworked around getMissedCallsGrouped with claim/callback/resolve/attempt-history, dropped the client-side tel: onCallback fallback now that callback flows server-side (CallCenterAgentPage call site updated); ParkedCallsIndicator built mirroring MissedCallsPanel 1:1 with --color-info tint; CallControlBar full variant now self-wires RTK mutations for park/warm-transfer-to-queue(DropdownMenu picker)/zombie-reset(confirm dialog, isZombie-gated) given a uniqueid prop — conference-add stays a host callback prop pending 09-12's transfer directory; fixed a mid-rework regression that dropped cc:missed-call-new/-update -> MissedCalls tag SSE invalidation, and a stale IMissedCall type missing personal/client_called_back; ParkedCallsIndicator/CallControlBar full variant built standalone, not yet mounted into CallCenterAgentPage (same precedent as SoftphoneWidget in 09-04/09-08) — next mounting plan must supply uniqueid/isZombie from active-call state
- [Phase 09]: 09-11 kept CallCenterHistoryWriterService untouched (already generic Partial<CcQueueCall>) — added a nonQueueCallStates Map (keyed like journalKey) to CallCenterAmiService, seeded at DialBegin/Newchannel, consumed at DialEnd/AgentHangup, writing all-direction cc_queue_calls rows (outbound/personal/internal, answered/missed/cancelled); direction=internal via a short-all-digit destination heuristic ([ASSUMED], 09-VALIDATION); personal-ring answer_time approximated as ring-start (no distinct answered AMI event in current listener set — documented limitation); getOperatorCallHistory shift period resolves the operator's open cc_agent_sessions row, falls back to start-of-day; new CallCenterPresenceService debounces DeviceState/ExtensionState (300ms per-extension coalescing) into presenceUpdate SSE deltas via existing emitEvent, wired into ami.service.ts via the same ModuleRef lazy-resolve + string-alias pattern as CallCenterAmiService; reused CallCenterAmiService.parseQueueTenant + endpoint-ids.util interfaceToExtension/extractExtension instead of duplicating regexes; getTransferDirectory reuses recalcQueueStats' agents.available for queue free counts (no parallel scheme), derives call-group free counts from the live agent map (no existing aggregation to reuse there)
- [Phase 09]: 09-12 TransferDirectory unfiltered+client-filtered getTransferDirectory cache so presenceUpdate SSE always patches one known cache key (D-45); SoftphoneWidget gets its own built-in conference-add control (Sheet+TransferDirectory conference-add mode) rather than routing through CallControlBar full variant; useCallCenterSSE dispatch switched to typed useAppDispatch for RTK updateQueryData; CallHistoryPanel open-card fetches getCardByCall+getCardTemplates directly and renders CallCardPopup (useCallCardPopup stays scoped to the live active call)
- [Phase 09]: 09-14 CallCenterSettings + NotificationMatrix lock-aware editor; useCallCenterNotifications fully replaces useCallNotifications with matrix-driven sound/popup/chat dispatch; backend read-side lock enforcement gap closed on getOperatorUiCustomization/getOperatorNotifications; D-43/D-46 mobile/tablet verified already complete from 09-08/09-06; ru/en i18n pass complete
- [Phase 09]: Gate CallControlBar full on showCallControls; uniqueid/isZombie from live activeCall only
- [Phase 09]: Directory transfer closes endpoint targets only; queue/group CTA follow-up
- [Phase 09]: history panel default-visible via IUiVisibility open map (D-05)
- [Phase 09]: Removed forRoot named ai profile; AI 10/min is route-scoped @Throttle on global only
- [Phase 09]: SkipThrottle on bypass routes names both default and global because AuthModule forRootAsync still registers default
- [Phase 09]: Did not SkipThrottle callcenter operator/notifications — fix is app-wide scope, not a paper-over
- [Phase 10]: cc_contacts net-new (not Phase 5 phonebooks); D-13 ownership in where clause
- [Phase 10]: historyRow SSE after successful writer flush/createOne; journal_depth tenant setting default 50
- [Phase 10]: PlayDTMF own-channel DTMF; registration-state from presence with WebRTC-to-primary mapping
- [Phase ?]: HealthModule public liveness before AuthModule; harness runner sequential default with --parallel opt-in
- [Phase ?]: USE_TESTCONTAINERS=1 selects Testcontainers MySQL; default uses DB_* env for GHA compatibility
- [Phase ?]: Runner drains registerCleanup queue in finally block on scenario failure
- [Phase ?]: apiRequest/apiFetch split enables negative auth status assertions without try/catch
- [Phase ?]: JwtAuthGuard on MohController prevents unauthenticated MOH writes with user_uid 0
- [Phase ?]: Auth fixture uses HARNESS_API_URL for worker-scoped login
- [Phase ?]: filterScenarios --kind api includes realtime for harness:api --tag sse
- [Phase ?]: Partial JUnit merge preserves D-11 completeness with D-19 per-scenario timing
- [Phase ?]: Harness OTel + pino logs only in /harness; packages/* untouched per D-H05
- [Phase ?]: pino mixin for per-log trace_id; ConsoleSpanExporter default, OTLP when env set
- [Phase 12]: D-17 both flags default true (ON); empty-table getAll returns toBe(true)
- [Phase 12]: GLOBAL_SETTING_KEYS is a live Set from system-settings MANAGED_KEYS
- [Phase 12]: No @Roles(UserLevel.ADMIN) on tenant-settings; JWT tenant only (D-19)
- [Phase 12]: cmd_apply writes ActionLog.create from the static generator
- [Phase 12]: toivr stays Goto(ivr_{uid},start,1) without tenant suffix
- [Phase 12]: totrunk dest is a PSTN/ValueSource number, not normalizeTarget(exten)
- [Phase 12]: Empty congestion params emit Congestion() with no default timeout
- [Phase 12]: 12-07 undo is a removed-step stack of 20, not full editor snapshots
- [Phase 12]: 12-07 vertical DnD lock is local restrictToVerticalAxisLocal; @dnd-kit/modifiers stays uninstalled
- [Phase 12]: 12-07 readOnly/allowedTypes/maxSteps are UI hints; server validation remains the access barrier

## Roadmap Evolution

- Phase 12 context extended (2026-08-18): +D-51…D-59. Единое приложение «Воспроизведение» складывает `Playback`/`BackGround`/`ControlPlayback` (приложение Asterisk выбирается по режиму; `Read`/`MusicOnHold`/`Say*` остаются отдельными типами) — попутно снимает инверсию имён `playprompt`/`playback`. `VoiceMail()` заменяется кастомной голосовой почтой целиком: обоснование — MWI/папки/`VoiceMailMain` в проекте никогда не были подключены (`mailboxes` и `incoming_mwi_mailbox` — пассивные колонки PJSIP, никем не заполняются). Критично: опция `Record()` `k` обязательна, иначе при отбое абонента теряются все сообщения. Расшифровка и саммаризация — в Phase 12 через существующие `stt-engines` + `ai-agents`. Доступ к сообщениям — вкладка/фильтр в CDR-отчёте поверх существующих `hasRecording`/`streamRecording`/access-scope; ссылка в уведомлении обязана быть с истекающим токеном (`cdr-public.controller.ts` без JWT переиспользовать нельзя). Отложенная фаза тенантности voicemail снята как ненужная. Sizing risk обновлён: голосовая почта — отдельный workstream и главный кандидат на вынос.
- Phase 12 context gathered (2026-08-18): D-01…D-50 в `12-CONTEXT.md`. **Граница фазы расширена** — бэкенд включён в scope по прямому указанию пользователя: типизация `params` через весь стек (shared discriminated union → per-type DTO → генератор), тенант-скоупинг целей набора (`${EXTEN}` никогда напрямую в `Dial`/`Queue`; `q{exten}_{uid}` / `e{exten}_{uid}` / `group_{exten}_{uid}`), фиксы генератора dialplan, расширение условий за пределы `DIALSTATUS` (`QUEUESTATUS`/`DEVICE_STATE`/переменная/`CURL`), per-app усиление функциональности до конкурентного уровня, подсистема тенантных настроек. Отменено относительно первоначального запроса: удаление `raw_dialplan` (колонка и UI остаются, видимость через настройку). Отложено: блок-схема + MCP/LLM → Phase 13; ConfBridge-модуль и тенантный контекст voicemail → отдельные фазы. Зафиксирован sizing risk с рекомендацией разбить на 7 workstream-ов. Next: `/gsd-ui-phase 12` или `/gsd-plan-phase 12`.
- Phase 12 added (2026-08-18): DialplanAppsEditor refactor — переиспользуемый конструктор цепочек маршрутов (параметры действий в модалку, summary/validate контракт в registry, типизированные обновления вместо `(field: string, value: any)`, конфигурируемость под 3 host-а, design tokens + a11y). 11 зафиксированных слабых мест (W1–W11) в ROADMAP. Next: `/gsd-discuss-phase 12`.
- Phase 11 planned (2026-08-04): 8 plans (`11-01`…`11-08`), waves W1–W8; RESEARCH + PATTERNS + VALIDATION; plan-checker PASSED (iter 2). Next: `/gsd-execute-phase 11`.
- Phase 11 context gathered (2026-08-04): D-H01…D-H06 + D-01…D-24 in `11-CONTEXT.md` (MVP auth/MOH/agent+supervisor/SSE; Asterisk originate path; CI/seed/CLI/package). Next: `/gsd-plan-phase 11`.
- Phase 11 architecture approved (2026-08-04): D-H01 absorb e2e; D-H02 API+SSE+UI default (SQL opt-in Asterisk/CC); D-H03 Asterisk/realtime in plan; D-H04 Vitest@harness / Jest@backend; D-H05 harness-only OTel v1; D-H06 `/api/health`. Next: `/gsd-discuss-phase 11`.
- Phase 11 added (2026-08-04): Harness Layer — external black-box runner/environment/scenarios/metrics/observability around existing app (`/harness`, absorb `e2e/`). Architecture pending user approval before plan/execute.
- Phase 10 executed (2026-07-24): 9/9 plans (`10-01`…`10-09`). Dual-mode softphone chrome shipped; A1/A3 live Asterisk verify deferred. Next: `/gsd-verify-work 10`.
- Phase 10 plan 10-04 complete (2026-07-24): FE foundation RTK/SSE/i18n. Next: Wave 4 (10-05…10-07).
- Phase 10 plan 10-03 complete (2026-07-24): PlayDTMF + registration-state. Next: 10-04.
- Phase 10 plan 10-02 complete (2026-07-24): historyRow SSE + journal_depth. Next: 10-03.
- Phase 10 plan 10-01 complete (2026-07-24): cc_contacts tenant book + D-13 ownership CRUD. Next: 10-02.
- Phase 10 planned (2026-07-24): 9 plans (`10-01`…`10-09`), 6 waves; RESEARCH + PATTERNS + VALIDATION + UI-SPEC; plan-checker PASSED (D-01…D-35). Dual-mode WebRTC+SIP/AMI; Journal≠History; cc_contacts book; chrome-only (FAB removed). Next: `/gsd-execute-phase 10`.
- Phase 10 context gathered (2026-07-24): 6 областей; D-01…D-30 в `10-CONTEXT.md`. Dual Journal≠History; Contacts=directory+shared book; Recover UX; quality+devices; chrome-only (FAB removed); multi-call deferred. Next: `/gsd-ui-phase 10` или `/gsd-plan-phase 10`.
- Phase 10 prepared (2026-07-24): Full Softphone — WebRTC dial / journal / contacts in ARM chrome (no FAB); resilience WSS/re-REGISTER; call quality + device picker. Brief: `10-BRIEF.md`. Next: `/gsd-discuss-phase 10`.
- Phase 9 planned (2026-07-22): 14 plans (`09-01`…`09-14`), 7 waves; RESEARCH + PATTERNS + VALIDATION + UI-SPEC; plan-checker PASSED (D-01…D-46). Softphone widget, status bar, hybrid tabs, missed-calls, ChanSpy/permissions, call-control, history/directory, settings. Next: `/gsd-execute-phase 9`.
- Phase 9 UI-SPEC approved (2026-07-22): design contract verified 6/6 (2 non-blocking FLAGs — single-word softphone CTAs; aria-label for icon-only controls). Softphone widget, status bar, hybrid tabs/panels, missed-calls tool, transfer directory, settings; hand-built Radix/`shared/ui` + existing `--color-*` tokens; new `shared/ui/Tabs` required. See `09-UI-SPEC.md`.
- Phase 9 context gathered (2026-07-22): 14 областей обсуждено; 46 решений (D-01…D-46) в `09-CONTEXT.md`. Ключевое: softphone-виджет + hybrid tabs/panels; KPI по всем каналам (расширение AMI); умный модуль пропущенных (group-by-number, callback >5с, claim); ChanSpy peer (can_spy/spyable); supervisor scope=назначенные очереди; call-control (conference/park/warm-transfer/zombie-clear/click-to-call), запись — отложена; granular-права + матрица уведомлений; mobile-first rework.
- Phase 9 added: Call Center Agent Panel — softphone widget & professional call control (tabs Коллеги/Очереди/Waiting; status «Ожидание звонка» + answered/missed KPIs; transfer/chanspy/hangup; queue pickup).
- Phase 8 planned (2026-07-16): 17 plans (`08-01`…`08-17`), waves 0–10; RESEARCH + PATTERNS + VALIDATION; plan-checker PASSED (NAV-01…16, D-01…41). Hub ships 002-E list (not bento).
- Phase 8 UI-SPEC approved (2026-07-16): design contract verified 6/6 — Hub E list, tabs B, mobile bottom bar, marketplace section, platform separate apps; see `08-UI-SPEC.md`.
- Phase 8 context gathered (2026-07-16): Module Hub + marketplace catalog/billing skeleton + full responsive + Capacitor Android foundation; see `08-CONTEXT.md`.
- Phase 8 added: Navigation redesign & Android port foundation — масштабируемая модульная навигация (IA, command palette, mobile-first), design-system shell touchpoints, Capacitor-first подготовка стека к Android (WebRTC/SSE/auth gaps).
- Phase 7 added: Call Center overhaul — корпоративный колл-центр (аудит + rework ядра, АРМ оператора/супервизора, wallboard + metrics, call cards, отчётность/аналитика, WebRTC, AI-ready foundation).
- Phase 6 added: Dialplan Apps — ring groups / call lists, multi-channel notifications, UX overhaul DialplanAppsEditor.
- Phase 5 added: Phonebooks AI — универсальные механизмы справочников, MCP tools и настройка через AI Chat module.
- Phase 4 added: IVR «Фразы» — TTS-текст с движком и per-phrase voice/settings (TtsEngines).

## Next GSD command

**Phase 12:** 12-01…12-05 and **12-07** complete. Next sequential: **12-06** (hop-counter / unreachable-tail). After wave-3 siblings: **12-08** (host wiring / conditions Sheet). Do not start 12-08 from the 12-07 close-out.

Also open: Phase 11 harness verify; Phase 10 `/gsd-verify-work 10`; Phase 9 verify; Phase 8 / 08-11 Android smoke.

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 08 P11 | ~12min partial | 2/3 tasks | FCM+docs; await human smoke |
| Phase 08 P17 | 6min | 2 tasks | 12 files |
| Phase 08 P16 | 7min | 2 tasks | 15 files |
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
| Phase 08 P08 | 12min | 3 tasks | 28 files |
| Phase 08 P09 | 12min | 3 tasks | 24 files |
| Phase 08 P14 | 10min | 2 tasks | 11 files |
| Phase 08 P15 | 8min | 2 tasks | 15 files |
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 9 P01 | 24min | 3 tasks | 8 files |
| Phase 9 P02 | 42min | 3 tasks | 14 files |
| Phase 9 P03 | 70min | 3 tasks | 11 files |
| Phase 9 P05 | ~40min | 3 tasks | 10 files |
| Phase 9 P06 | ~25min | 3 tasks | 9 files |
| Phase 9 P04 | ~35min | 3 tasks | 16 files |
| Phase 9 P07 | ~30min | 3 tasks | 9 files |
| Phase 9 P13 | ~35min | 2 tasks | 4 files |
| Phase 9 P08 | ~40min | 3 tasks | 16 files |
| Phase 9 P09 | ~50min | 3 tasks | 7 files |
| Phase 9 P10 | ~55min | 3 tasks | 16 files |
| Phase 09 P12 | ~40min | 3 tasks | 14 files |
| Phase 09 P14 | ~35min | 3 tasks | 13 files |
| Phase 09 P15 | 14min | 3 tasks | 5 files |
| Phase 09-call-center-agent-panel P16 | 12min | 2 tasks | 3 files |
| Phase 09-call-center-agent-panel P17 | 44min | 2 tasks | 9 files |
| Phase 10 P01 | 25min | 2 tasks | 8 files |
| Phase 10 P02 | 20min | 2 tasks | 7 files |
| Phase 10 P03 | 25min | 2 tasks | 5 files |
| Phase 10 P04 | 35min | 3 tasks | 7 files |
| Phase 11-harness-layer-external-scenario-runner-environment-observabi P01 | 15min | 2 tasks | 11 files |
| Phase 11-harness-layer-external-scenario-runner-environment-observabi P02 | 44min | 3 tasks | 9 files |
| Phase 11-harness-layer-external-scenario-runner-environment-observabi P03 | 25min | 2 tasks | 5 files |
| Phase 11-harness-layer-external-scenario-runner-environment-observabi P04 | 45min | 3 tasks | 11 files |
| Phase 11-harness-layer-external-scenario-runner-environment-observabi P05 | 25min | 3 tasks | 11 files |
| Phase 11 P06 | 18min | 2 tasks | 5 files |
| Phase 12 P01 | 25min | 3 tasks | 6 files |
| Phase 12 P02 | multi-session | 2 tasks | 24 files (close-out; locales skipped) |
| Phase 12-dialplan-apps-editor-refactor-reusable-route-chain-builder P04 | 15min | 3 tasks | 12 files |
| Phase 12 P03 | 100min | 3 tasks | 25 files |
| Phase 12 P05 | 55 | 3 tasks | 22 files |
| Phase 12 P07 | 46 | 4 tasks | 40 files |

## Session

**Last session:** 2026-08-19T08:22:38.816Z
**Stopped at:** Completed 12-07-PLAN.md
**Resume file:** None
