# Phase 18: Полный рефакторинг речевой аналитики - Pattern Map

**Mapped:** 2026-09-22
**Files analyzed:** 34
**Analogs found:** 32 / 34

> **Anti-pattern gate:** Do **not** copy product behavior from the current speech-analytics skeleton (`pipeline.ts` `fakeStt`, stub `SpeechAnalyticsReportsPage`, `putUploadContent` that does not store bytes, inherit/off/on route modes as the UX floor). Those files may be **edit targets** only. Behavioral analogs are working cabinet modules below. Charge seams are **named persist-only** (`SA-CHARGE-RUN`, `SA-CHARGE-INSIGHTS`) — do **not** call `settleShadow`, `BillingBalanceService`, or aiPBX `decrementUserBalance`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/backend/database/migrations/00XX-sa-multi-run-charges.sql` (+ postgres twin + manifest) | migration | CRUD | `packages/backend/database/migrations/0011-speech-analytics.sql` | exact |
| `packages/backend/src/modules/speech-analytics/charging/sa-charge-run.ts` | utility | transform | `packages/backend/src/modules/ai-usage/money.ts` + `usage.models.ts` (`AiPriceRevision`) + `idempotent-charge.ts` (key shape only) | role-match |
| `packages/backend/src/modules/speech-analytics/charging/sa-charge-insights.ts` | utility | transform | same as `sa-charge-run.ts` | role-match |
| `packages/backend/src/modules/speech-analytics/pipeline/*` (STT + energy diarize; replace `fakeStt`) | service | transform / batch | `packages/backend/src/modules/routes/route-recording.util.ts` (stereo `D` / `.raw`) + aiPBX `channel-diarize` behavior floor (out-of-repo reference) | role-match |
| `packages/backend/src/modules/speech-analytics/journal/*` (list/filter/export/access) | service | CRUD / file-I/O | `packages/backend/src/modules/reports/cdr/cdr.service.ts` + `cdr-access-scope.ts` + `callcenter/reports/exporters/xlsx-exporter.ts` | exact |
| `packages/backend/src/modules/speech-analytics/projects/*` (draft/publish editor config) | service | CRUD | existing `speech-analytics.service.ts` draft/publish methods + `integration-credentials.service.ts` (hash secrets) for token side | role-match |
| `packages/backend/src/modules/speech-analytics/eval/*` (golden CLI) | utility | batch | harness CLI style + aiPBX `dryRunAnalyze` behavior (no journal / no charge) | role-match |
| `packages/backend/src/modules/routes/dialplan-webhooks.controller.ts` | controller | request-response | self (keep fire-and-forget) | exact |
| `packages/backend/src/modules/routes/dialplan-webhooks.service.ts` | service | event-driven | self + `speech-analytics/reporting/internal-admission.ts` | exact |
| `packages/backend/src/modules/routes/route-recording.util.ts` | utility | transform | self (`hangup_handler_push` when project set) | exact |
| `packages/backend/src/shared/utils/dialplan-subroutines.util.ts` | utility | event-driven | self (`[krsk-hangup-handler]` StopMixMonitor → ffmpeg → CURL) | exact |
| `packages/backend/src/modules/speech-analytics/reporting/capture-policy.ts` | utility | transform | self (rewrite inherit/default → project-only; keep `pauseNew`) | exact |
| `packages/backend/src/modules/routes/routes-ai.adapter.ts` | service | request-response | self (`proposal` + `includesDialplanReload`) | exact |
| `packages/backend/src/modules/routes/webhook-queue.service.ts` | service | pub-sub | self (reuse `enqueue` for SA events) | exact |
| `packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.ts` | controller | request-response / streaming | `integration-credentials` + `TenantContextGuard` pattern; flesh upload/analyze-url | role-match |
| `packages/backend/src/modules/speech-analytics/speech-analytics-jwt.controller.ts` | controller | CRUD | self shell + `cdr.controller.ts` tenant/`UserLevel` access style | role-match |
| `packages/backend/src/modules/integration-credentials/integration-credentials.service.ts` | service | CRUD | self (hash-only token + project grant) | exact |
| `packages/shared/src/types/speech-analytics.types.ts` | config | transform | expand beyond narrow `SaProjectConfigV1` (aiPBX editor sections) | role-match |
| `packages/frontend/src/pages/SpeechAnalyticsJournalPage/*` | component | CRUD | `features/trunks/ui/TrunksPage/TrunksPage.tsx` | exact |
| `packages/frontend/src/features/speechAnalytics/ui/*ConversationsTable*` | component | CRUD | `features/contexts/ui/ContextsTable/useContextsTableColumns.tsx` | exact |
| `packages/frontend/src/features/speechAnalytics/ui/*ConversationSheet*` | component | request-response | `features/dialplan-apps/ui/StepSheet/StepSheet.tsx` | exact |
| `packages/frontend/src/features/speechAnalytics/ui/*Upload*` | component | file-I/O | `features/directories/ui/DirectoryCsvPanel/DirectoryCsvPanel.tsx` + `UserFormModal` Dialog shell | role-match |
| `packages/frontend/src/features/speechAnalytics/ui/*MetricEditor*` / Projects page | component | CRUD | `NotificationIntegrationsPage` list shell + `UserFormModal` large Dialog | role-match |
| `packages/frontend/src/pages/SpeechAnalyticsDashboardPage/*` | component | request-response | `TrunksPage` shell + Recharts in feature SCSS (no DashboardBuilder) | role-match |
| `packages/frontend/src/features/speechAnalytics/ui/*Tokens*` | component | CRUD | `NotificationIntegrationsPage` + `integration-credentials` one-time secret UX | role-match |
| `packages/frontend/src/features/speechAnalytics/ui/*Settings*` (pause Switch) | component | request-response | `callCenterApi.ts` optimistic `updateMyNotifications` / `updateMyUiCustomization` | exact |
| `packages/frontend/src/features/routes/ui/RouteFormModal/RouteGeneralTab.tsx` | component | CRUD | self (replace inherit/off/on with `Select` + `InfoTooltip`; no new Tailwind) | exact |
| `packages/frontend/src/features/cdr/ui/CdrTable/*` | component | request-response | self (`RecordingButton` column + add Analytics / Get analytics actions) | exact |
| `packages/frontend/src/features/speechAnalytics/api/speechAnalyticsApi.ts` | store | request-response | `callCenterApi.ts` optimistic Switch pattern | exact |
| `packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/*` | component | request-response | self (reuse; no new chrome) | exact |
| `packages/backend/src/skills/speech-analytics/*` (+ insights skill) | config | transform | Phase 15 skill + adapter pairing (`routes-ai.adapter` / module skills) | role-match |
| `harness/scenarios/manual/speech-analytics-uat-*.cjs` | test | file-I/O | `harness/scenarios/manual/autodial-uat-live-20260921.cjs` | exact |
| Channel energy diarize port | utility | transform | **No in-repo energy diarize** — port from aiPBX `channel-diarize.ts` (behavior floor); wire maps per D-24 | none |
| Insights prompt skill text | config | transform | **No in-repo insights skill** — port rules from aiPBX `insights-prompt.ts` into repo skill | none |

## Pattern Assignments

### `packages/backend/database/migrations/00XX-sa-multi-run-charges.sql` (migration, CRUD)

**Analog:** `packages/backend/database/migrations/0011-speech-analytics.sql`

**Core pattern** (schema spine + CHECK discipline):
```sql
-- Source: 0011-speech-analytics.sql:1-15, 35-47, 87 area
CREATE TABLE sa_projects ( ... PRIMARY KEY (id), UNIQUE KEY uq_sa_project_tenant (vpbx_user_uid, id), ... );
-- Wave 0 MUST: DROP/replace UNIQUE KEY uq_sa_run_initial (recording_id) so D-12 multi-run works.
-- Add charge columns on sa_analysis_runs (amount, currency, audio_ms, provider_tokens, charged=false label).
-- Do NOT productize role 'analyst' even if CHECK still lists it (D-10).
```

**Apply:** MySQL + `postgres/` twin + `manifest.json` entry; `synchronize: false`.

---

### `charging/sa-charge-run.ts` / `sa-charge-insights.ts` (utility, transform)

**Analogs:** `packages/backend/src/modules/ai-usage/money.ts`, `usage.models.ts`, `cloud-admin/billing/idempotent-charge.ts`

**Money math** (`money.ts` 1-21):
```typescript
/** Integer decimal arithmetic. Never use IEEE floats for money. */
export function parseDecimal(value: string): { digits: bigint; scale: number } { ... }
export function formatDecimal(digits: bigint, scale: number): string { ... }
```

**Rate row shape** (`usage.models.ts` 18-31):
```typescript
@Table({ tableName: 'ai_price_revisions', timestamps: false })
export class AiPriceRevision extends Model {
  // product, unit ('audio_ms' | 'provider_tokens'), currency, rate, money_policy, ...
}
```

**Future idempotent key shape only** (`idempotent-charge.ts` 20-22):
```typescript
export function usageChargeOperationKey(reservationId: string): string {
  return `ai-usage:${reservationId}`;
}
// SA future keys: run id (SA-CHARGE-RUN) / insights request id (SA-CHARGE-INSIGHTS) — persist now, debit later.
```

**Anti-copy** (`shadow-settlement.ts` 119-144): `settleShadow` asserts wallet untouched — **do not call** from SA-CHARGE seams in this phase. Seams compute amount from `ai_price_revisions`, write onto run/insights with `charged: false` / UI label «Посчитано, не списано», invoke even when amount is `0`.

---

### Hangup → enqueue (controller + service + dialplan)

**Analogs:** `dialplan-webhooks.controller.ts`, `dialplan-webhooks.service.ts`, `dialplan-subroutines.util.ts`, `route-recording.util.ts`, `internal-admission.ts`, `capture-policy.ts`

**Controller fire-and-forget** (`dialplan-webhooks.controller.ts` 100-117):
```typescript
@Post('on-hangup')
@HttpCode(200)
async onHangup(...): Promise<string> {
  // ...
  void this.webhooksService.handleOnHangup({ ... });
  return 'ok'; // never await STT
}
```

**Handler today (gap)** (`dialplan-webhooks.service.ts` 160-193): only route webhook delivery — **extend** after file closed: resolve route project → `resolveCapturePolicy` / `admitInternalAssetReady` → enqueue job; worker waits non-empty file. Keep existing webhook path.

**Dialplan order** (`dialplan-subroutines.util.ts` 83-109): `StopMixMonitor` → ffmpeg → CURL `/internal/dialplan/on-hangup`. Note current early `Return()` when `WH_OH != 1` — analytics project must still notify backend (push hangup_handler when project selected even without route webhook).

**Recording attach** (`route-recording.util.ts` 13-18, 90-93):
```typescript
export function buildMixMonitorFlags(opts: RouteRecordingOptions): string {
  let flags = '';
  if (opts.record_all !== true) flags += 'b';
  if (opts.record_stereo === true) flags += 'D';
  return flags;
}
// hangup_handler_push when hangupWebhook || durable — extend: also when analytics projectId set
```

**Pause only new autos** (`capture-policy.ts` 33-37):
```typescript
if (input.pauseNew) return { enabled: false, reason: 'pause_new', projectId: null, policyRevision: revision };
```
Rewrite `inherit`/`defaultProjectId` away (D-01); keep `pause_new` reason for D-19/D-20. Manual upload / Get analytics bypass pause.

**Admission** (`internal-admission.ts` 32-52): reuse skip reasons (`entitlement`, `pause_new`, `privacy_deny`); do not invent parallel gates.

---

### `routes-ai.adapter.ts` (service, request-response)

**Analog:** self

**Registration + proposal** (`routes-ai.adapter.ts` 92-105, 461-477):
```typescript
onModuleInit(): void {
  this.registry.register(this);
}
private proposal(...): AgentDiffProposal {
  return {
    entityType: 'route',
    entityLabel: label,
    summary, before, after,
    applyPayload: { tool, args },
    includesDialplanReload: true,
  };
}
```

**Apply:** Add list/set/clear analytics project tools here (D-04). Recording-off → refuse set. Confirm card UI = `DiffConfirmCard` (no new chrome). Token create confirm with one-time secret also uses same card path (D-33).

---

### Journal list / Excel / access (service, CRUD + file-I/O)

**Analogs:** `cdr-access-scope.ts`, `cdr.service.ts`, `xlsx-exporter.ts`

**Access** (`cdr-access-scope.ts` 19-43):
```typescript
export function parseCdrAccessBlob(raw: unknown): { operators; queues; operatorUserIds } { ... }
export function isCdrUnrestricted(scope): boolean {
  return scope.operators.length === 0 && scope.queues.length === 0
    && (scope.operatorUserIds?.length ?? 0) === 0;
}
```

**Resolve pattern** (`cdr.service.ts` 81-93): ADMIN/SUPERADMIN → unrestricted (`null` scope); else build clause from numbers CDR tab. Journal/dashboard/export **must** reuse this.

**Excel** (`xlsx-exporter.ts` 8-30):
```typescript
export async function buildReportXlsx(sheetName, columns, rows): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  // tenant-scoped rows only — no DB inside exporter
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
```
Port aiPBX `truncateCell` for long transcripts (D-37). No robot columns.

---

### External API tokens (service/controller, CRUD)

**Analog:** `integration-credentials.service.ts` / `.controller.ts`

**Scopes already defined** (`integration-credentials.service.ts` 22-28):
```typescript
speech_analytics: { kind: 'project', values: new Set([
  'analytics:upload', 'analytics:read', 'analytics:transcript',
  'analytics:audio', 'analytics:cancel',
]) },
```

**Controller guard** (`integration-credentials.controller.ts` 24-26): `@UseGuards(TenantContextGuard)` + hash-only rotate/create. One token ↔ one project grant (D-32). Public SA controller already uses same guard (`speech-analytics-public.controller.ts` 13-22) — flesh real byte storage + analyze-url/sync; do not leave stub `putUploadContent`.

---

### Event webhooks (service, pub-sub)

**Analog:** `packages/backend/src/modules/routes/webhook-queue.service.ts`

**Enqueue** (lines 40-42, 6-11):
```typescript
export interface WebhookJobData {
  url: string; payload: Record<string, any>; headers: Record<string, string>; tag: string;
}
async enqueue(data: WebhookJobData): Promise<void> {
  this.deliverWithRetry(data, 1);
}
```
SA events (`analysis.completed`, `analysis.error`, `budget.exceeded`, `anomaly.detected`) → this queue; failures → existing `webhook_failures` tab. Do not add Redis/BullMQ.

---

### Digest/alert recipients (frontend + model)

**Analog:** `NotificationIntegrationsPage.tsx` + `notification-integration.model.ts`

**Page shell** (`NotificationIntegrationsPage.tsx` 12-46): iconBadge + gradient title + table + form modal. Project editor stores `integrationUid[]` links only — Button link to this page when empty (D-29).

---

### Frontend journal / table / sheet / forms

**List page** — `TrunksPage.tsx` 12-48:
```tsx
<VStack gap="24" max className={cls.page}>
  <Flex justify="between" ...> {/* iconBadge + Text h1 + CTA */} </Flex>
  <Flex ... className={cls.tableWrap}><TrunksTable /></Flex>
</VStack>
```
SCSS modules + `var(--color-*)`; Stack only; no Tailwind in feature JSX.

**Row actions** — `useContextsTableColumns.tsx` 32-45:
```tsx
<TableRowActions>
  <TableRowAction title={t('common.edit')} aria-label={t('common.edit')} onClick={...}>
    <Pencil />
  </TableRowAction>
  ...
</TableRowActions>
```

**Sheet** — `StepSheet.tsx` 4-12, 69+:
```tsx
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
```
Conversation detail: stable URL + Tabs (Analytics / Transcript / Cost). PBX calls: no second `AudioPlayer` in sheet (player stays in CDR via `RecordingButton`).

**Upload dialog** — `UserFormModal.tsx` 4-20 (Dialog/Label/Select/InfoTooltip imports) + `DirectoryCsvPanel.tsx` 10-16 (`FileImportButton`). One form for single/batch (D-14); no channel-swap UI.

**Optimistic pause Switch** — `callCenterApi.ts` 531-553:
```typescript
async onQueryStarted(arg, { dispatch, queryFulfilled }) {
  const patchResult = dispatch(api.util.updateQueryData(...));
  try { await queryFulfilled; /* write server data */ }
  catch { patchResult.undo(); }
}
```
Copy into `speechAnalyticsApi` pause/models toggles (ARCHITECTURE MUST).

**CDR actions** — `features/cdr/ui/CdrTable/useCdrTableColumns.tsx` + `RecordingButton`: add «Аналитика» / «Получить аналитику» without breaking hybrid overflow; upload creates journal row, never Asterisk CDR.

**AI confirm** — `DiffConfirmCard.tsx`: reuse for route project set/clear and token secret once.

**Route select** — edit `RouteGeneralTab.tsx`: remove inherit/off/on `<select>`; show `Select` projects only when module on and recording enabled (D-02); `InfoTooltip` from UI-SPEC copy.

---

### Golden eval + live UAT (test / batch)

**UAT harness** — `harness/scenarios/manual/autodial-uat-live-20260921.cjs` 14-58 (`mint` JWT, `request` helper, evidence JSON under `.planning/evidence/`). New script reads `SPEECH_ANALYTICS_SAMPLES_DIR` (default `Z:\temp\speech-analytics-samples`); never commit audio.

**Golden:** CLI calling scoring-only path (aiPBX `dryRunAnalyze` behavior): no journal rows, no `SA-CHARGE-RUN`, exit non-zero only on empty/failed model response (D-43…D-45).

---

## Shared Patterns

### Authentication / tenancy
**Source:** backend ARCHITECTURE + `TenantContextGuard` / JWT `vpbx_user_uid` from `req.user`  
**Apply to:** all SA controllers/services  
Never trust tenant id from body/query. Integration principal vs user principal as in public controller `integration()`.

### RBAC (`UserLevel`)
**Source:** `packages/shared/src/enums/index.ts`  
**Apply to:** delete/rebuild (ADMIN+SUPERADMIN), publish (ADMIN+SUPERVISOR+SUPERADMIN), token mint (ADMIN+SUPERADMIN), score edit (SUPERVISOR+ADMIN+SUPERADMIN). No `analyst` role product path (D-10).

### CDR visibility
**Source:** `cdr-access-scope.ts` + `CdrService.resolveCdrAccess`  
**Apply to:** journal list, sheet open, dashboard aggregates, Excel export (D-11).

### Webhook delivery
**Source:** `WebhookQueueService`  
**Apply to:** project event webhooks (D-30).

### Optimistic Switch
**Source:** `callCenterApi.ts` `updateMyUiCustomization` / `updateMyNotifications`  
**Apply to:** company pause + any server-bound Switch in SA settings/dashboard.

### FSD / layout / styling
**Source:** `packages/frontend/.idea/ARCHITECTURE.md`  
**Apply to:** all Phase 18 UI — Stack, `Text`, SCSS + `var(--color-*)`, Tailwind only in `shared/ui`, `TableRowActions`, `InfoTooltip`, Sheet/Dialog canons from UI-SPEC.

### Charge seam naming
**Source:** CONTEXT D-46…D-49  
**Apply to:** every successful analysis path → `SA-CHARGE-RUN`; successful insights → `SA-CHARGE-INSIGHTS`; never wallet; no `SA-CHARGE-GATE` this phase.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Energy channel diarize implementation | utility | transform | No tracked Krasterisk energy-diarize module; port aiPBX `channel-diarize.ts` (energy only; dual-stt off) with D-24 channel maps |
| Insights instruction skill body | config | transform | No in-repo insights skill yet; port aiPBX `insights-prompt.ts` types/rules into `src/skills/...` (cabinet cannot edit) |

## Metadata

**Analog search scope:** `packages/backend/src/modules/{routes,reports/cdr,speech-analytics,integration-credentials,ai-usage,cloud-admin/billing,notifications,callcenter/reports}`, `packages/frontend/src/{features,pages,shared}`, `harness/scenarios/manual`, `packages/backend/database/migrations`  
**Files scanned:** ~90 tracked candidates; analogs verified with `git ls-files`  
**Pattern extraction date:** 2026-09-22  
**Untracked excluded as analogs:** `cloud-admin/platform-prices.*` (use tracked `AiPriceRevision` / `money.ts` / `idempotent-charge.ts` instead)  
**Skeleton excluded as product analogs:** `speech-analytics/pipeline.ts` fakeStt, `SpeechAnalyticsReportsPage`, inherit/off/on UX
