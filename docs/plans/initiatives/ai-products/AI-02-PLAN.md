---
initiative: ai-products
phase: AI-02
revision: 2026-09-18-r2
status: planned_dependency_gated
tasks: [D1, D2, D3, D4, D5, D6]
depends_on: [AI-01]
---

# AI-02 — задачи, медиа и учёт расхода

Будущие domain integrations уточнены в [PRODUCT-SLICES-CONTRACTS](PRODUCT-SLICES-CONTRACTS.md): caller transaction для atomic domain/job commit и additive voice-session usage subject в AI-07. Это не запуск следующих фаз и не второй ledger.

Чтение: [IMPLEMENTATION-SEQUENCE](IMPLEMENTATION-SEQUENCE.md), [ARCHITECTURE](ARCHITECTURE.md), [DATABASE-PORTABILITY](DATABASE-PORTABILITY.md), [RECORDING-INTEGRATION](RECORDING-INTEGRATION.md), [DEPLOYMENT-LICENSING](DEPLOYMENT-LICENSING.md), AI-01 A/B/C. Требования PL-05…10, AN-02/03, VR-12, DEP-06…08, DBR-02/03/05/08. Исполнение после AI-01 gates; не подменяет предметные AI-03/04/07.

Результат: API может долговечно принять разрешённую операцию, worker восстановится после сбоя, asset не станет ready до проверки, одна операция не создаст повторный usage/settlement. Реальный STT/LLM и списание денег здесь не запускаются: fault-capable test provider, shadow metering и контракты будущих adapters. Состояние принятых jobs хранится в SQL; Redis — доставка и распределение работы.

## D1 — схема и конечные автоматы

**Вход:** AI-01 TenantContext/policy/profiles, C1 provider contract; reviewed dual-DB baseline. **Owned paths:** новые `ai-jobs/**`, `media-assets/**`, `ai-usage/**` model/contracts, `ai-connectivity` provider revisions; `packages/shared` event/DTO, dual-engine migrations/manifest, DB contract fixtures. Один schema writer. Новые modules классифицируются по D-16.

Таблицы используют UUID IDs, trusted tenant UID и composite tenant/resource constraints. Limits по tenant principal не означают отдельную tenant directory. Все mutable state rows имеют `version` и timestamps UTC. JSON — versioned sanitized metadata, не secret/path/огромный transcript. Физические FK/index lengths и collation сверить на обеих DB до migration merge.

| Таблица | Основные поля и ограничения |
|---|---|
| `ai_provider_revisions` | tenant, provider_uid, revision, configuration JSON, capability digest, credential_ref/key_version, created_at; UNIQUE(tenant,provider_uid,revision), immutable; secret bytes отсутствуют |
| `ai_media_assets` | tenant,id, source_kind, storage_key, state, sha256, bytes BIGINT, duration_ms BIGINT, media metadata JSON, retention_at, parent_asset_id, deleted_at; UNIQUE(tenant,id), UNIQUE(storage_key); indices tenant/state/created, state/retention |
| `ai_uploads` | tenant,id, principal_id, resource_kind/id, asset_id, state, expected_bytes/checksum nullable, received_bytes, expires_at, request_hash; tenant/principal/id scoped; UNIQUE(asset_id) |
| `ai_jobs` | tenant,id, product, kind, resource_kind/id, state, policy/config/provider revision refs, priority, cancel_requested_at, admitted_at, terminal_at, version; indices tenant/state/created, state/next_run_at; source idempotency FK |
| `ai_job_stages` | tenant,id,job_id, stage_key, state, attempt_count, next_run_at, lease_owner, lease_until, fence BIGINT, output_ref, error_code; UNIQUE(job_id,stage_key); index state/next_run_at/lease_until |
| `ai_provider_operations` | tenant,id,stage_id, ordinal, provider_revision_id, state, idempotency_token, request_hash, provider_request_id, response_ref, usage_ref, started/completed_at; UNIQUE(stage_id,ordinal); secrets/полный prompt не хранить в queue |
| `ai_outbox` | tenant,id, aggregate_kind,aggregate_id, aggregate_version, event_type, schema_version, payload, available_at, lease_until/owner/fence, delivered_at, attempts; UNIQUE(aggregate_kind,aggregate_id,aggregate_version,event_type); pending index |
| `ai_idempotency` | tenant, stable_principal_id, operation_namespace, key_digest (32 bytes), request_hash, state, resource_id, response_status, safe_response JSON, expires_at; composite PK без nullable; index expires_at |
| `ai_job_events` | tenant,id,job_id,event_type,from/to_state,actor,reason,occurred_at; append-only, index tenant/job/time; без transcript и secret |

Для outbox точный unique key: `(aggregate_kind, aggregate_id, aggregate_version, event_type)`. Payload содержит ID и schema version, consumer перечитывает SQL. Отдельная queue table вместо Redis truth не нужна. `ai_provider_operations.ordinal` увеличивается только при разрешённом новом внешнем вызове, а не каждом перезапуске worker.

State machines:

- Asset: `allocated → uploading → probing → ready`; ошибки → `quarantined` или `failed`; `ready → deleting → deleted`. Нельзя читать non-ready. Duplicate finalize возвращает существующий результат, не делает второй asset.
- Job: `queued → running → succeeded | failed | cancelled`; `running → retry_wait → queued`; `running → awaiting_reconciliation` при unknown provider outcome; возможны `blocked` с документированной причиной и явным resume. Cancel request — отдельный флаг до безопасной terminalization.
- Stage: `pending → leased → executing → succeeded`; retry только по классифицированной ошибке; `executing → unknown` при внешнем неопределённом результате; `failed/cancelled` terminal. `succeeded` immutable, повтор completion сравнивает output digest.
- Provider operation: `prepared → dispatched → observed_success | observed_failure | unknown → reconciled_success | reconciled_failure`. Запись dispatched до network call не позволяет отличить crash до отправки от crash после отправки: оба идут через unknown handling, не blind retry.

**Приёмка D1:** state transition table tests; rejected illegal transitions; concurrent CAS/unique collisions; immutable revision; tenant FK conflicts; migration upgrade/replay обе DB и profile subset. SQL constraints не заменять одной DTO валидацией.

## D2 — admission, outbox, leases, recovery

**Вход:** D1, real Redis dependency выбранного профиля. **Owned paths:** `ai-jobs/**`, narrow Redis factory/health adapter (не менять глобальную optional семантику), outbox dispatcher, test provider, `harness/database/**` fault suite. BullMQ использовать после проверки pinned package/runtime compatibility; lockfile только один writer. Точный public analysis endpoint остаётся AI-04.

### Atomic admission

1. Authentication/policy/resource authorization, request size/type/quotas; сервер определяет tenant и config revisions. Client не выбирает provider credential или job status.
2. В одной SQL transaction повторно проверить tenant/product/principal permission revision под соответствующими row locks; claim idempotency row и сравнить canonical request hash; lock tenant quota row; reserve resource capacity; создать job/stages, immutable admission snapshot и outbox event, сохранить receipt; commit. Revoke/disable сериализуется с admission: нельзя принять новую работу по stale authentication snapshot.
3. Только после commit вернуть 202 с job ID/status URL. Redis failure не откатывает принятую SQL работу; pending dispatcher её восстановит. При переполненном backlog/недоступной SQL admission возвращает 503 до commit. Gateway timeout после commit обрабатывается idempotency replay.

Idempotency-Key обязателен для внешнего create/finalize/run; допустимо 1…128 ASCII символов, хранить digest. Namespace различает endpoint+resource kind/action. Stable principal сохраняется при rotation. Hash: versioned canonical JSON allowlist с сортировкой полей; raw audio связан checksum/bytes, не stream stringify. Для streaming create hash описывает upload intent, финальный digest проверяется отдельно; отличающиеся bytes не становятся тем же succeeded result. Same key+same hash → прежний receipt; same key+different hash →409; другой principal не может читать receipt. Retention v1 30 дней и не меньше terminal job + заявленного retry window; purge не стирает operation/ledger uniqueness. После retention это новая операция, API честно документирует границу, не обещает вечное dedupe.

### Доставка и владение

Dispatcher claims outbox короткой SQL transaction, отправляет BullMQ job с stable event UUID, затем отмечает delivery. Crash между enqueue и mark создаёт повтор: handler дедуплицирует по SQL stage state. Redis dedupe retention — оптимизация. Все dispatchers могут работать, но SQL lease определяет одного владельца каждой записи; отдельный scheduler leader для периодических scans с TTL/fence в SQL. Не использовать OS PID как глобальный owner.

Worker claims ready stage atomic compare-and-set + row lock, увеличивает fence. Default lease30s/heartbeat10s, configurable; долгий call heartbeats не продлевают права бесконечно после cancel. Только текущий fence может коммитить stage/result/usage; stale completion игнорируется и записывается audit event без повторного billing. SQL транзакция никогда не держится во время provider network call.

Иерархия row locks: tenant/product policy → integration principal → idempotency → tenant quota → job → stage → provider operation → reservation; когда ряд не нужен, его пропускают. Несколько policy/quota rows брать в стабильном key order. Ledger insert последним; wallet в будущем AI-10 берёт место перед tenant quota (общий порядок для всех денежных операций). Deadlock/serialization retries ограничены, выполняют transaction целиком и не повторяют network call. Lock order зафиксировать в tests; stage-only heartbeat не берёт предшествующие job/quota locks.

Reconciler восстанавливает: committed outbox not delivered; queued SQL job без Redis item; истёкшую lease; orphan temporary media; held reservations при terminal jobs. Повтор scheduler event безопасен. Не превращает `unknown` provider operation в новую платную попытку. Retry budget v1: 3 transient attempts, exponential backoff с jitter и ceiling5min; protocol validation/provider permanent errors без retries; DLQ/failed видны администратору. Manual retry создаёт новый разрешённый attempt/run с audit, не перезаписывает succeeded result.

Provider adapter capability сообщает поддержку idempotency token, status lookup и cancel. Для unknown сначала status lookup; reuse того же upstream token только при документированном upstream dedupe contract. Если ни lookup, ни dedupe нет — awaiting_reconciliation, budget остаётся held до решения/истечения policy, затем bounded conservative settlement/release по проверенным usage данным. Не обещать exactly-once внешнего вызова.

Fairness: configurable per-tenant running cap и queue cap в SQL; round-robin eligible tenants/limited batch dispatcher не даёт одному tenant занять весь worker pool. Redis concurrency — вторичный предохранитель. Отмена: queued — terminal atomic release; executing — cancel_requested, best-effort provider cancel, запрет следующих stages; уже понесённый usage не обнулять. Provider/tenant revoke запрещает новый внешний call при повторном policy check; accepted result storage/cleanup всё равно безопасно завершаются.

**Приёмка D2:** kill before/after SQL commit; Redis unavailable/restart/data loss; enqueue-before-mark; stale fence double completion; simultaneous workers; tenant fairness; cancel vs success; cross-tenant forged queue payload; bounded retries/DLQ; provider unknown без blind retry. Fault injection выполняется deterministic barriers, не только sleep.

## D3 — streaming media и storage

**Вход:** D1/D2. **Owned paths:** `media-assets/**`, storage local/S3 adapters, media worker probe/normalization contracts, shared upload DTO, fixture harness. PBX routes/hangup здесь не менять.

Storage interface: `writeTemporary(stream, limits)`, `commitImmutable`, `stat`, `openRange`, `delete`; возвращает opaque storage reference, никогда user-supplied filesystem path. Local adapter — первая обязательная реализация, S3-compatible adapter — в этом срезе для того же contract; если отложен, D3 отмечается partial, не обещать обе поставки. S3 network только разрешённый deployment endpoint, tenant не вводит произвольный URL. V1 external HTTP fetch recording URL отключён: внешний клиент отправляет bytes. SSRF policy для URL ingestion — отдельный будущий план.

Поток: authenticated allocate upload → stream temp with byte limit+hash → close writer/fsync для local → probe в ограниченном процессе → immutable commit → SQL asset ready + outbox transaction. До ready API возвращает probing, даже если файл уже существует. Для S3 multipart complete/HEAD checksum/readability вместо предположения POSIX rename/fsync. Crash object exists/SQL pending исправляет reconciler по expected key+checksum, не объявляет ready по одному имени.

V1 defaults для тестируемого admission: audio WAV/FLAC/MP3, max256MiB, max60min, max2 channels, decoded sample rate8–48kHz; размер/длительность ограничены с обеих сторон probe. Это предел инфраструктуры, не обещание качества STT длинного звонка; AI-04 может быть строже. Probe определяет реальный контейнер, header/extension не доверять. Multi-channel >2 отклонять. Codec errors/quota violations не доходят до provider. CPU/memory/walltime limits, process kill, ffprobe/ffmpeg spawn argument array без shell, protocol/network input запрещён.

Local root configured installation admin; generated keys из validated UUID, tenant prefix берётся из context. Не позволять `..`, absolute drive/UNC paths, alternate stream, symlink/reparse escape. Проверять resolved root и открытие без follow по возможностям OS, temporary и final на одном filesystem для atomic rename. Права service user минимальны; shared parent не writable tenants. S3 bucket/key генерирует сервер, private ACL; оригинал immutable. Шифрование storage/access keys — deployment settings, не query/log.

Lossless original сохраняется если источник lossless; MP3 upload нельзя назвать восстановленным lossless original. Normalized PCM и playback — derivatives с parent/provenance. Stereo channels не равны speaker roles: `channelRoles=unknown` до verified manifest/mapping. mono/fake stereo/silence — quality flags для будущего pipeline, не выдуманные speaker labels.

Авторизованный playback через backend Range proxy v1; повтор policy/resource check на запрос, bounds/range limit. Storage adapter может поддержать short-lived signed GET отдельно, но v1 URL не выдаёт для немедленно отзываемого доступа; срок URL не трактовать как отзыв прав. Audio scope отдельно от result/transcript.

Retention: original/derivatives policy snapshot, quota accounting, reference holds активных jobs; purge tombstones + outbox deletion + retry. Никогда удалить underlying object до blocking новых readers/job references и проверки holds. Delete provider data не обещать, если adapter не поддерживает. Default temp uploads expiry24h, scheduled cleanup bounded batches; reconciler не удаляет активный stream по старому created_at без lease проверки.

**Приёмка D3:** chunked upload byte overflow; MIME lie/truncated WAV; long decoded media bomb; symlink/UNC traversal; interrupted upload/finalize twice; disk full; same checksum разных tenants не связывает assets; crash after file rename before DB; denied Range; retention vs running job. Local и disposable S3-compatible contract на обеих SQL DB, generated mono/stereo/silence/corrupt fixtures; real recordings не требуются.

## D4 — usage journal, quotas и shadow settlement

**Вход:** D1/D2. **Owned paths:** `ai-usage/**`, `ai-connectivity` immutable price contract, existing billing interface adapter только в shadow режиме, migrations/manifest/tests. Не создавать второй баланс; не подключать live auto-charge к `BillingBalanceService.charge`.

| Таблица | Контракт |
|---|---|
| `ai_quota_counters` | tenant + product + metric + period_start PK; limit/used/reserved в целых units, revision; реальные locks и rollover UTC |
| `ai_usage_reservations` | tenant,id,job_id обязательный FK,provider_operation_id nullable FK,parent_reservation_id nullable FK,owner_key (`job:<uuid>` или `operation:<uuid>`),metric,period_start,held_units,settled_units,state,expires_at,version; UNIQUE(owner_key,metric,period_start); tenant composite FK и CHECK допустимой формы parent/operation |
| `ai_usage_events` | tenant,id,provider_operation_id,event_key,quantity,unit,source measured/estimated/reconciled,price_revision_id,occurred_at; UNIQUE(provider_operation_id,event_key); append-only |
| `ai_price_revisions` | id,provider/product/unit,currency,rate DECIMAL,scale,rounding_mode,effective_at,config digest; immutable; BYOK/local может иметь rate unknown, не притворяться нулевой измеренной стоимостью |
| `ai_usage_ledger` | tenant,id,reservation_id,operation_id,entry_kind reserve/settle/release/adjust,sequence,units,amount_decimal nullable,currency nullable,price_revision_id,created_at; UNIQUE(operation_id,entry_kind,sequence), append-only |

На job admission резервировать upper bound ресурсного бюджета job, до каждого provider call — его долю. Родительский job reservation и child operation reservations не суммируются дважды: child выделяет долю held parent, settlement уменьшает parent held и увеличивает used один раз. Provider operation создаётся prepared до его reservation, parent/child shares блокируются в фиксированном порядке. Quota counter хранит parent held total; child held — распределение внутри него, не дополнительный reserve. В ledger operation_id — стабильный owner_key reservation, для usage events — конкретный provider_operation_id; не использовать один job UUID для всех STT/LLM/TTS event keys.

Обязательные quotas: concurrent jobs/sessions, bytes storage, audio milliseconds, provider-specific tokens при их наличии. Единицы именованы, разные метрики не складываются. Actual > reserved: для следующего этапа требуется дополнительный reserve; уже понесённый usage учитывается, overage flagged, будущий admission blocked при исчерпании. Unknown result удерживает только bounded reserve по policy и виден reconciliation, не тихо исчезает.

Денежная политика: `shadow`, `local_byok`, будущая `cloud_wallet`. В AI-02 первые две, cloud_wallet processing disabled до AI-10 atomic settlement adapter. Ledger хранит измерение/оценку, **баланс пользователя не изменяется**. Денежные количества decimal strings с фиксированным scale и documented rounding; исключить JS float accumulation и повторное округление каждого chunk. Финальная целая валюта рассчитывается один раз по snapshot, adjustments append-only. Reserve/settle/release и state update — одна SQL transaction с UNIQUE operation key.

`BillingBalanceService` остаётся единственным кошельком. Будущий AI-10 должен добавить idempotent transaction-aware debit/reservation contract, проверить concurrency с уже существующими module charges/deposits; shadow adapter не заявляет финансовый exactly-once до этой проверки. Price edit не меняет принятые jobs. Reanalysis имеет новый run/operation и отдельный estimate/approval, а не скрытое повторное списание старой операции.

**Приёмка D4:** concurrent reserves у лимита; duplicate usage/result; settle vs cancel; retry same operation; different stage new operation; expired reserve vs live heartbeat; cost rounding/chunks; period rollover; wrong tenant; provider unknown reconciliation. Ledger/counters invariant после kill+replay одинаков на MySQL/PG. Assert existing wallet unchanged; local BYOK без balance lookup/облачного egress.

## D5 — процессные роли, readiness и наблюдаемость

**Вход:** C2, D2–D4. **Owned paths:** explicit `main-ai-api`, `main-ai-worker`, `main-media-worker` entrypoints/composition, deployment examples без секретов, worker metrics/health, scripts. Имена файлов согласовать с C2 до assignment.

API не импортирует ARI/AMI или background billing cron. Analytics worker не запускает HTTP management/PBX listeners; media worker имеет только storage/probe. Scheduler/dispatcher с отдельной ролью и SQL lease; несколько replicas не создают несколько bills. Migration runner — отдельная deployment step, workers не начинают processing до schema readiness.

Liveness = процесс работает; readiness разделена на SQL/schema, real Redis connectivity, storage probe/capacity, required encryption config/provider capability. Missing/nullRedis → worker not ready с 503, core PBX optional Redis path неизменён. API может durable accept при Redis outage только до configured backlog cap, явно показывая delayed processing; не отвечать succeeded. Graceful shutdown прекращает claims, ждёт bounded inflight, сохраняет state/fence, не насильно release unknown usage.

Logs: request/job/stage/operation/asset IDs, tenant ID только внутренний audited context, error codes; без prompt/transcript/audio/keys/Authorization. Metrics: oldest pending age, outbox lag, lease expiry, unknown operations, retries, quota rejects, storage failure, processing duration. Низкая cardinality aggregate metrics, подробный tenant drilldown из authorized SQL. Alerts различают accepted-but-delayed и permanently failed.

**Приёмка D5:** отдельный boot каждой роли; SQL down/schema mismatch/Redis absent/storage full; SIGTERM in-flight; two schedulers; no cloud egress local profile; no Asterisk dependency analytics. Документировать operator recovery commands read-only preview→targeted action; не советовать truncate jobs/ledger.

## D6 — fault suite и закрытие foundation

**Owned paths:** harness/fixtures, AI-02 SUMMARY/VERIFICATION и runbooks. Runtime corrections только с task/owner записью.

Обязательная реальная матрица на `root@ipbx.krasterisk.ru`: MySQL+Redis и PostgreSQL+Redis; local storage и disposable S3-compatible service, никаких существующих buckets/containers. Генерированные fixtures, fake provider с controllable dispatch/response/timeout barriers. Для каждого fault сохранить before/after row digests, counts, receipt и invariants; output test и exit codes.

Минимальный end-to-end: authenticated test principal+resource fixture → upload → ready asset → admitted fake analysis job → provider operation → result ref → shadow usage → receipt replay → authorized read → retention. Test-only resource fixture не входит production descriptors. Отдельно two tenants и tenant0, потеря Redis, kill worker по каждой границе transaction/network/file, cancel race, stale lease, unknown upstream и resource deletion. Ни одна проверка не списывает реальные деньги и не звонит на реальные номера.

Проектные lint/backend/frontend, builds всех профилей, SQL upgrade/replay и обязательные сценарии D1–D5. Если требуется ручное reconciliation — UI/API статус и runbook, а не только строка в логе. В SUMMARY перечислить измеренные пределы и отсутствующие capabilities. Rollback: stop admission → drain/record unknown → stop workers → предыдущий совместимый application build; ledger/assets/schema не удалять. Смена engine/restore — DB-04 отдельный gate.

После D6 foundation готов для AI-03/04/07. Это ещё не готовый продукт аналитики, голосовой runtime, live billing или гарантированное восстановление при полном уничтожении всех persistent stores.
