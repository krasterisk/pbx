# PBX dashboard read model

Full PBX composition only. DEPLOYMENT_MODE chooses CLOUD or BOX; OPENSOURCE uses BOX monitoring. API reads precomputed state rather than endpoint/trunk services or AMI on request.

## Providers

| Provider | Responsibility |
|---|---|
| DashboardAccessService | Verified tenant, fresh role/interfaces/modules, effective CDR scope and permission fingerprint |
| DashboardCollectorService | One SQL-leased collector per DASHBOARD_NODE_ID; AMI events and complete bulk resync; bounded durable last-good state |
| DashboardProjectionService | Incremental CDR/CEL/AI logical-call projection, durable checkpoints, bounded pending completion replay |
| DashboardReadStore | Portable indexed queries, repeatable-read detail/count/revision, fenced atomic call/bucket correction |
| DashboardCacheService | Bounded memory/entry cache, TTL and single-flight |
| DashboardCloudService | Existing tenant tariff/limits/timezone and actual tenants.id billing binding |
| DashboardSystemService | Background configured Node Exporter hosts, thresholds, 7-day persisted history with average/max |
| DashboardGateway | Authorized Socket.IO version notifications, current rights and JWT expiry checks |
| DashboardAiAdapter | Read-only get_pbx_dashboard using the same access path |

## Public API

JWT GET /api/dashboard/overview, /calls, /endpoints, /trunks, /system. Shared contracts: packages/shared/src/types/dashboard.types.ts. Query parsing bounds date range to31days, detail50/default100/max and cursor/search/filter sizes. Optional history version mismatch returns409 DASHBOARD_SNAPSHOT_EXPIRED.

Overview <=50KiB and300buckets; complete timeline includes quiet bins and explicit until boundary. Totals/bucket grouping and detail filters count the same logical calls. Warning groups <=5 plus total groups. System overview retains the most-used disk plus explicit omittedDisks/omittedMissingFilesystems; full paths/status are unchanged in lazy /system detail. A final bytes check rejects any oversized successful response. No arrays of the whole PBX appear in overview.

Every source reports state ok/stale/unavailable/notConfigured and updatedAt. Unknown results are not fabricated as zero. Last-good calls/inventory are independent and retain their original timestamp across reconnect/restart until successful complete replacement, including a successful empty snapshot.

## Background cadence and ownership

AMI channels:30s, inventory:5min; publication:5s. Inventory is detached with bounded default120s timeout and15s lease heartbeat, preserving channel refresh while a large realtime list is slow. Channels timeout15s. Snapshot acceptance requires completion, generation/lease ownership and no replay overflow after the last await. No regular per-endpoint PJSIPShowEndpoint loop. The exact empty PJSIPShowContacts Error/No Contacts found response with zero observed rows is terminal success; other errors/partial lists remain incomplete. Initial call direction/source is preserved before snapshot event replay and across transfers/restart.

Projection: bounded500-record input batches/checkpoints;100-call grouped evidence queries; repeatable/idempotent SQL transaction corrects prior/new5minbuckets and revision. Bootstrap covers last31days and exposes progress. Tenant+node+linkedid (uniqueid fallback) is the logical key. A finalized CDR leg alone is insufficient completion; use tenant-owned CEL terminal evidence or fresh live absence. Pending replay completes quiet calls without new CDR. Semantics v3 replay uses a fixed upper key and node+call_key index, up to500 existing calls per continuation over the frozen31-day window; readiness includes its checkpoint. CEL linkedid/uniqueid lookups use indexed branches.

IVR/voicemail are not employee/AI answers. Caller Answer alone is technical pickup. A destination answer or distinct owned SIP bridge peer must bind to tenant-owned CDR uniqueid/channel/linkedid; answered Dial/Queue destination is the CDR fallback. Technical app evidence and explicit busy/error survive final Hangup. Only durable v3:human/v3:ai answer provenance survives a later evidence outage; a prior accepted outcome is never proof by itself. V2 played_until_ms>0 supplies working AI proof. Legacy recognized_text/ai_response logs only establish AI presence; without successful playback proof result remains unknown/aiPlaybackUnconfirmed. Adjacent AI writer modules are not changed here.

Personal CDR access uses indexed participant EXISTS and does not sum overlapping operator totals. Summary/detail revision includes tenant, effective scope and rights. Detail rows and total share one REPEATABLE_READ snapshot. Cache entries are bounded and keyed by effective access, period/timezone/filter/revision.

Exporter:15s, lease per configured target, <=8hosts, bounded HTTP2MiB/5s, no redirect or browser-provided URL. CPU/RAM85/95% require5min; disk85/95%; age45s gives stale. Only actual host metrics; mountpoints are server-configured. Technical history is lazy and <=300buckets retaining average/max.

## Schema and configuration

Apply portable additive0033-pbx-dashboard through the canonical migration runner, full PBX profiles only. It creates dashboard_calls/participants/buckets/checkpoints/leases/live_state/system_samples and tenant tariff/timezone fields. Deployment was not performed by implementation tests.

Configure DASHBOARD_NODE_ID, DASHBOARD_CDR_TIMEZONE (actual legacy writer timezone), PBX_DEFAULT_TIMEZONE, DASHBOARD_AMI_INVENTORY_TIMEOUT_MS and PBX_MONITORING_TARGETS; examples are in root .env.example. Each target has id/label/role/URL and optional recordsMount/filesystems. Empty targets are explicitly not configured. CLOUD never exposes host metrics.

Implementation/verification details, reproducible browser/SQL/live scripts and known external gates: .planning/pbx-dashboard/SUMMARY.md and EXECUTION.md. Unit mocks, seeded SQL HTTP load, actual source probes, full live application acceptance and release are recorded separately.
