# Frontend visual refresh — EXECUTION / PLAN

- Coordinator / sole writer: current chat `/root`; codex-direct, no delegated workers.
- Revision: 2026-10-06-r1. Baseline: main/c63d7c23 plus completed Endpoints repairs.
- Assignment: centered query error/retry states across modules and canonical rule;
  dark theme matching aiPBX redesigned; modern AiChat widget launcher.
- Required reads: AGENTS, canonical architectures/index, hybrid/registry; aiPBX
  index.scss, redesigned dark theme/design tokens; completed ai-chat widget plan.
- Owned: frontend architecture, global/design tokens, shared load error state,
  page/table query placeholders across frontend, AssistantPanel launcher/styles,
  related tests and this registry row. Backend and previous dirty work retained.
- V1: inventory all page/table load error branches and absent query errors;
  shared centered placeholder, migrate callers, document rule and audit evidence.
- V2: map aiPBX redesigned surfaces/text/accent/status/glass to existing semantic
  Tailwind + SCSS tokens; preserve light mode and global layering contracts.
- V3: dimensional launcher with icon medallion, depth, hover/focus/busy/badge,
  keeping pointer/keyboard geometry and reduced-motion behavior.
- V4: targeted state/launcher/theme checks, TS, required lint/backend/frontend
  suites, browser checks at desktop/mobile and both themes; own diff review.
- Gates: implemented pass; automated checks completed with corrected frontend
  failure and targeted retest (details below); representative visual checks pass;
  release N/A (not requested).
- Status: implemented. No active workers or remaining implementation assignments.
  Next: user review of the local changes; no commit/publication requested.

## Query error migration inventory

| Component | Finding/fix |
|---|---|
| features/komandorClaims/ui/KomandorClaimsTable.tsx | added missing query error/retry state |
| features/aiRobots/ui/RobotsTable/RobotsTable.tsx | added missing query error/retry state |
| features/autodial/ui/BaseFormModal/BaseFormModal.tsx | centered 1 query placeholder(s) |
| features/autodial/ui/BasesList/BasesList.tsx | centered 1 query placeholder(s) |
| features/autodial/ui/CampaignsTable/CampaignsTable.tsx | centered 1 query placeholder(s) |
| features/autodial/ui/ContactFormModal/ContactFormModal.tsx | centered 1 query placeholder(s) |
| features/autodial/ui/ContactsGrid/ContactsGrid.tsx | centered 1 query placeholder(s) |
| features/call-groups/ui/CallGroupsTable/CallGroupsTable.tsx | added missing query error/retry state |
| features/callcenter/ui/AgentDetailModal/AgentDetailModal.tsx | centered 1 query placeholder(s) |
| features/callcenter/ui/AlertRoutingForm/AlertRoutingForm.tsx | centered 1 query placeholder(s) |
| features/callcenter/ui/AlertThresholdsForm/AlertThresholdsForm.tsx | centered 1 query placeholder(s) |
| features/callcenter/ui/AutoPauseRulesForm/AutoPauseRulesForm.tsx | centered 1 query placeholder(s) |
| features/callcenter/ui/CallbackSettingsForm/CallbackSettingsForm.tsx | centered 1 query placeholder(s) |
| features/callcenter/ui/CallCenterSettings/CallCenterSettings.tsx | centered 2 query placeholder(s) |
| features/callcenter/ui/DisplayTokensManager/DisplayTokensManager.tsx | centered 1 query placeholder(s) |
| features/callcenter/ui/OperatorSettingsForm/OperatorSettingsForm.tsx | centered 1 query placeholder(s) |
| features/callcenter/ui/PauseReasonsManager/PauseReasonsManager.tsx | centered 1 query placeholder(s) |
| features/callcenter/ui/PermissionsMatrix/PermissionsMatrix.tsx | centered 1 query placeholder(s) |
| features/callcenter/ui/PermissionsMatrix/RolePermissionsDefaultsForm.tsx | centered 1 query placeholder(s) |
| features/callcenter/ui/ReportSchedulesManager/ReportSchedulesManager.tsx | centered 1 query placeholder(s) |
| features/callcenter/ui/ShiftPolicyForm/ShiftPolicyForm.tsx | centered 1 query placeholder(s) |
| features/callcenter/ui/SoftphoneWidget/SoftphoneContacts.tsx | centered 1 query placeholder(s) |
| features/callcenter/ui/SoftphoneWidget/SoftphoneJournal.tsx | centered 1 query placeholder(s) |
| features/cloud-admin/ui/SellersTable/SellersTable.tsx | added missing query error/retry state |
| features/cloud-admin/ui/TenantsTable/TenantsTable.tsx | added missing query error/retry state |
| features/conferences/ui/ConferencesTable/ConferencesTable.tsx | centered 1 query placeholder(s) |
| features/contexts/ui/ContextsTable/ContextsTable.tsx | added missing query error/retry state |
| features/directories/ui/DirectoriesTable/DirectoriesTable.tsx | added missing query error/retry state |
| features/endpoints/ui/EndpointsTable/EndpointsTable.tsx | centered 1 query placeholder(s) |
| features/ivrs/ui/IvrsTable/IvrsTable.tsx | added missing query error/retry state |
| features/moh/ui/MohTable/MohTable.tsx | added missing query error/retry state |
| features/notifications/ui/NotificationIntegrationsTable/NotificationIntegrationsTable.tsx | added missing query error/retry state |
| features/numbers/ui/NumbersTable/NumbersTable.tsx | added missing query error/retry state |
| features/prompts/ui/PromptsTable/PromptsTable.tsx | added missing query error/retry state |
| features/provisionTemplates/ui/ProvisionTemplatesTable/ProvisionTemplatesTable.tsx | added missing query error/retry state |
| features/queues/ui/QueuesTable/QueuesTable.tsx | added missing query error/retry state |
| features/roles/ui/RolesTable/RolesTable.tsx | added missing query error/retry state |
| features/routes/ui/RouteFormModal/RouteGeneralTab.tsx | centered 1 query placeholder(s) |
| features/routes/ui/RoutesTable/RoutesTable.tsx | added missing query error/retry state |
| features/serviceRequests/ui/ServiceRequestsTable/ServiceRequestsTable.tsx | added missing query error/retry state |
| features/speechAnalytics/ui/ConversationExpandedPanel/ConversationExpandedPanel.tsx | centered 1 query placeholder(s) |
| features/speechAnalytics/ui/TokensTable/TokensTable.tsx | centered 1 query placeholder(s) |
| features/stt-engines/ui/SttEnginesTable/SttEnginesTable.tsx | added missing query error/retry state |
| features/timeGroups/ui/TimeGroupsTable/TimeGroupsTable.tsx | added missing query error/retry state |
| features/trunks/ui/TrunksTable/TrunksTable.tsx | added missing query error/retry state |
| features/tts-engines/ui/TtsEnginesTable/TtsEnginesTable.tsx | added missing query error/retry state |
| features/users/ui/UsersTable/UsersTable.tsx | added missing query error/retry state |
| features/voiceRobots/ui/VoiceRobotsTable/VoiceRobotsTable.tsx | added missing query error/retry state |
| pages/CallCenterReportsPage/CallCenterReportsPage.tsx | centered 1 query placeholder(s) |
| pages/SpeechAnalyticsDashboardPage/SpeechAnalyticsDashboardPage.tsx | centered 1 query placeholder(s) |
| pages/SpeechAnalyticsJournalPage/SpeechAnalyticsJournalPage.tsx | centered 1 query placeholder(s) |
| pages/SpeechAnalyticsProjectsPage/SpeechAnalyticsProjectsPage.tsx | centered 1 query placeholder(s) |

## Query error migration inventory

| Component | Finding/fix |
|---|---|
| pages/AiRobotsKnowledgePage/AiRobotsKnowledgePage.tsx | added missing query error/retry state |
| pages/AiRobotsSipPage/AiRobotsSipPage.tsx | added missing query error/retry state |
| pages/AiRobotsToolsPage/AiRobotsToolsPage.tsx | added missing query error/retry state |
| pages/MarketplacePage/MarketplacePage.tsx | added missing query error/retry state |
| pages/ProfilePage/ProfilePage.tsx | added missing query error/retry state |

## Manual audit and acceptance evidence

- Static inventory inspected 418 production TSX files in pages/features/widgets.
  In addition to the scripted inventory above, migrated AiProvidersTable,
  ThreadList, route-references UsageTab, AiConnectionsPage, AiAgentsPage,
  AiProductLandingPage, AiProvidersPage, SpeechAnalyticsRecordingPage,
  CdrReportPage (including voicemail), VoiceRobotCdrPage, VoiceRobotEditPage,
  AuditLogPage (both tables), PlatformAiThreadsPage and ModuleHub.
  SpeechAnalyticsDashboardPage also distinguishes failed queries from empty data.
- Canonical architecture now requires shared QueryErrorState for failed table,
  page and standalone content queries: full width, minimum 12rem, centered text
  and retry vertically/horizontally. Field/mutation errors remain contextual;
  ancillary metadata/statistics queries are not substituted for table errors.
  Existing retry callbacks, translations and test IDs retained. Missing primary
  list error branches added instead of displaying a false successful empty list.
- aiPBX redesigned source palette: background #0c1214, sidebar #090f11,
  surface #151c1f, text #dbdbdb, cyan #5ed3f3/#3aa8c2, icon #74a2b2,
  success #6cd98b, destructive #d95757. SCSS source tokens feed semantic
  Tailwind globals and legacy/glass aliases. Light overrides retain the previous
  palette. Text inherits button foreground to keep cyan-button labels readable.
- Launcher retains pointer/keyboard activation, drag geometry, minimize/restore,
  busy status and badge. Added raised frame, cyan icon medallion, focus/hover
  treatment and reduced-motion handling; no LLM/API behavior changed.
- Own diff review completed, including retry handlers, skipped-query guards,
  imports, semantic token mapping and launcher controls. Not an independent audit.

| Gate | Evidence / result |
|---|---|
| Root lint | npm run lint: exit 0; existing frontend 85 warnings |
| Frontend types | tsc -p packages/frontend/tsconfig.json --noEmit: exit 0 |
| Backend | npm run test:backend: exit 0; 376 suites / 3567 tests passed; 1 suite / 11 tests skipped by existing setup |
| Full frontend | npm run test:frontend, VITEST_MAX_WORKERS=2 and VITEST_CHUNK=80: all 309 files processed; initial exit 1 from SoftphoneContacts Retry accessible-name regression |
| Corrected frontend failure | QueryErrorState now provides aria-label from retryLabel; targeted rerun QueryErrorState, SoftphoneContacts, EndpointsTable.integration, AssistantPanel: 4 files / 75 tests passed; no test weakened |
| Whitespace | git diff --check: exit 0 |
| Browser | Local app desktop dark/light and 360x800 dark: actual error states centered, no mobile horizontal overflow; launcher open/minimize/restore/close works |
| Browser measurements | Mobile error and retry center x=180 in width 360; body dark rgb(12,18,20), cyan #5ed3f3; light white body and #6366f1 primary retained |
| Publication | Not applicable; local changes only |

The complete frontend command was not rerun after the single accessibility fix;
all other files passed its full run and the affected behavior passed the scoped
rerun. Browser coverage is representative visual evidence, not live verification
of every module or backend/LLM operations. Temporary browser returned to dark
theme with the chat closed. Logs are in the host Temp directory as
krasterisk-design-{lint2,lint-final,types-final,backend,frontend,target}.log.

Screenshot: [desktop dark theme](artifacts/design-refresh-dark.jpg).
The bounded refresh-query-errors.cjs script is a one-off migration/audit helper;
do not rerun it as an application startup step.

## Follow-up: muted buttons (2026-10-06)

User requested button fills matching navbar items. Added separate semantic
button-primary tokens: 10% cyan over the dark sidebar surface, 15% on hover,
cyan foreground and a subtle border. Shared default Button and launcher medallion
use these tokens; accent/focus/status colors retain their purpose. Light button
tokens alias the existing light primary colors. Local dark browser confirms
the Add endpoint fill is approximately #112328 with readable #5ed3f3 text.
ESLint for Button and git diff --check pass. Pure styling follow-up; no new tests
or full suite rerun. Screenshot: [muted buttons](artifacts/design-refresh-muted-buttons.jpg).
