# D8 — Dashboard publication and MySQL binlog optimization

Status: implemented, automated-tests-passed, server-deployed and live-verified for this bounded assignment. Coordinator /root, chat01a11af4-afac-7a90-9f33-b52556c634de, codex-direct; no agents/independent reviewer. Prior dashboard release/UI/load gates are unchanged. Date2026-10-18.

## Source and ownership

Local main baseline10308472; production baseline427a5059724f3884e131da4b7bfa09c772f5a2aa. Separate managed worktree and local branch `codex/dashboard-binlog-20261018`, commit `a74405446c6a28dead3a0c817e3e8675b8a6558f`. Commit contains only collector/service tests and new snapshot-storage/helper tests. No remote push. Main workspace mirrors the own source patch; unrelated dirty files were neither committed nor deployed. Production build used the exact deployed baseline plus these four files;2090 other backend artifacts verified byte-identical. Current release `/var/lib/krasterisk-v4/releases/a74405446c6a28dead3a0c817e3e8675b8a6558f`, version4.7.1.1, health SHA matches. No schema/manifest, frontend, role, PBX dialplan or neighboring feature deployment.

## Module review and change

Root cause: collector ticks every5s; `buildPayload()` changes version every tick and mixes a large endpoint inventory with small live/freshness state. ROW/FULL therefore emitted full inventory before/after each publication. Inventory remains complete, rather than truncating cached data or suppressing business changes.

Inventory now lives in one deterministic bounded74-character per-node key in the existing table. Its complete JSON is SHA256-fingerprinted and written only on content change or owner reacquisition. Original node row keeps calls, source/inventorySource, summary, version and reference; its5s heartbeat remains. Both writes occur in the same lease-fenced transaction. In-memory hash advances only after commit; rollback/retry/expired lease behavior verified. Main and inventory read in one primary-key JOIN, with32MiB combined fallback budget and reference/node/hash checks. Legacy inline snapshots remain readable. Internal storage references are removed before returning the payload. Missing/corrupt chunk fails closed to last-good stale data, never a fabricated fresh empty inventory.

Existing source ages and the45s stopped-publication stale threshold remain. Added finite/future heartbeat validation (future beyond1s becomes stale). Gateway still uses original node heartbeat. Completion projection still receives calls/source/updated_at unchanged. Existing viewer cache is retained; actual6-tenant check required one SQL read. Cold fallback retains complete inventory and original source ages. Live call durations remain updated in compact snapshots; no lossy debounce or call/event deletion.

Further module audit: read-store/classifier/projection contain neighboring dirty changes and were inspected, not edited. Their cache/revision and scope behavior was preserved. No new global optimization loop, broad module rewrite, schema migration or frontier UI change was needed. Synthetic10k-endpoint/1k-call coverage is unit evidence, not production high-load evidence.

## MySQL compatibility and activation

Server, mysqlbinlog and mysqldump8.0.46. No configured, registered or connected replicas detected. A private disposable InnoDB fixture was dumped, changed in a compressed transaction (event40 confirmed), restored from dump and replayed using the installed mysqlbinlog. Database filter and final row hashes matched; fixture dropped. This is a real isolated backup+replay test, not a full production restore.

`SET PERSIST binlog_transaction_compression=ON` applied and verified globally, in fresh sessions and persisted_variables. Dashboard sessions ON. One pre-existing legacy root session remained OFF; no unrelated connection was killed. ROW/FULL, sync_binlog=1, innodb_flush_log_at_trx_commit=1 and7-day retention604800 unchanged. Existing old binlogs are not recompressed and were not purged by D8.

## Gates / evidence

- PASS production-baseline TypeScript build: isolated-build-final.log.
- PASS isolated production-baseline dashboard:17suites/255tests, isolated-dashboard-tests.log.
- PASS final root backend:486passed suites/4641passed tests,27skipped; root-backend-final.log. Initial development failures are superseded by this final run.
- PASS root frontend:453files/2426tests, runner exit0; root-frontend.log.
- PASS root lint (existing warnings only), root-lint.log; final scoped lint PASS (exit0), final-scoped-lint.log.
- PASS server health/API, frontend and static asset HTTP200; mysql/asterisk/nginx/krasterisk-v4 active.
- PASS actual deployed collector:1444 inventory records,6tenants, one SQL read; calls/inventory sources ok; tenant detail boundaries checked. Direct service+real MySQL integration, not an authenticated browser acceptance claim.
- PASS isolated real SQL:6unchanged publications of583bytes, zero inventory rewrites; atomic rollback/retry, lease expiry, cold fallback, stale/last-good, downgrade legacy reader and re-upgrade; all own fixture rows/leases removed.
- PASS live comparison (compression ON in both windows):47689bytes/30.7359s before dashboard patch vs15433bytes/30.7125s after,1551.57→502.50B/s (3.0877x lower). Short uncontrolled windows, not a throughput benchmark or a daily-volume guarantee. No concurrent binlog deletion in either window.
- PASS main row176816→1655bytes (106.84x smaller);7distinct heartbeat updates and zero inventory rewrites during after window. Complete1444-record inventory preserved.
- PASS cumulative MySQL ZSTD stats at final check:124640371uncompressed bytes→2632068compressed bytes,98% compression percentage; includes compatibility/integration fixture traffic, not a pure customer-only measurement.
- NOT PERFORMED: full production DB restore, browser visual acceptance, actual10k/1k PBX stress. These were not necessary to claim the bounded publication fix and are not implied by unit/service checks.

Private server evidence/backups: `/root/server-maintenance/20261018T142802Z-dashboard-optimization/`; compression.json, deployment.json, live-check.json, before/after-metrics.json and result.json copied here without credentials or customer payloads. Full snapshot-table dump and prior env retained privately on server. Previous runtime retained. Application restart was gated on0active calls; Asterisk/MySQL/nginx not restarted. Parent release directories kept traversable for nginx; frontend and asset verified200.

## Rollback and next action

The pre-upgrade binary expects inline inventory. A downgrade must stop only krasterisk-v4 when idle, resolve each main inventoryRef against its node-key/hash-checked chunk, write a complete legacy inline payload (preserve updated_at), switch current back to427a5059 and set only APP_GIT_SHA back while preserving unrelated env changes, then start and check health. `server-deploy.py` contains immediate failure rollback; the old-reader contract after conversion and subsequent new-reader upgrade was tested on isolated real SQL rows. Do not simply switch to the old binary while leaving compact rows. Do not roll back additive business schemas or restore a whole DB for this cache-format change. Compression can remain ON; disabling it is not needed for the previous MySQL8.0.46-compatible binary.

No own test process, fixture or credential temp file remains. No further required implementation pending. Normal next action: observe ordinary workload/backup operations; this document does not create a monitor or automation. For future main-branch release, integrate/cherry-pick the bounded commit deliberately; do not stage foreign work. Current source branch is local only.
