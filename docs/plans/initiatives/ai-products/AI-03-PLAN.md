---
initiative: ai-products
phase: AI-03
revision: 2026-09-18-r2
status: planned_dependency_gated
tasks: [CAP1, CAP2, CAP3, CAP4, CAP5]
depends_on: [AI-02, AI-00-G2]
---

# AI-03 — запись, завершение и надёжная передача медиа

Чтение: [RECORDING-INTEGRATION](RECORDING-INTEGRATION.md), [AI-02](AI-02-PLAN.md), [AI-00 closure](AI-00-CLOSURE-PLAN.md), [PRODUCT-SLICES-CONTRACTS](PRODUCT-SLICES-CONTRACTS.md). Требования INT-03/04/07/08, PL-09, VR-11 recording, DBR-04. Native PBX приёмка дополнительно требует DB-03; domain contracts/robot capture adapter не зависят от CDR. Это shared capability: лицензия аналитики не требуется, существующая запись PBX не становится платной AI-функцией.

## CAP1 — capture intent, node identity, manifest

**Вход:** AI-02 D1–D3 contracts приняты. **Owned paths:** новый `packages/backend/src/modules/recording-capture/**`, bounded `media-assets` interface, shared manifest/DTO, additive dual-DB migrations, module coverage registry. Схему пишет один coordinator; никаких новых кошельков/очередей вместо AI-02.

`CaptureIntent` до старта записи содержит UUID `recordingUid`, `nodeId`, verified tenant binding, source `pbx_route|robot_session`, source reference, capture policy revision, recorder profile/format и correlation. Channel/linkedid — metadata, не identity tenant. Snapshot аналитики optional; CAP не обязан иметь projectId. `analysis_export=deny` и `capture=deny` имеют приоритет над обычной записью; новая AI policy default OFF.

Новые таблицы:

| Таблица | Контракт |
|---|---|
| `ai_capture_intents` | tenant+id, node_id, recording_uid, origin_kind/id, recorder_id, state, policy_snapshot, call_ref, created/closed_at; UNIQUE(node_id,recording_uid); composite tenant/id key |
| `ai_capture_segments` | tenant,id,intent_id,ordinal,leg_ref,start/end_ms,track_map,privacy_decision; UNIQUE(intent_id,ordinal); FK tenant/intent |
| `ai_capture_receipts` | tenant,node_id,recording_uid,manifest_revision,digest,asset_id,status,acked_at; UNIQUE(node_id,recording_uid,manifest_revision); FK tenant/asset |

Node registry/auth reuse существующего доверенного server identity, если он удовлетворяет контракту; иначе минимальный отдельный `capture_node_credentials` adapter с mTLS identity/rotation. Это технический machine principal без права читать transcript/providers/выполнять звонки. Не применять tenant integration API key одного клиента ко всем tenants узла. Регистрация узла — platform admin, server-owned allowlist deployment/tenant bindings. Manifest содержит binding ID+revision; backend сверяет его с identity узла, не верит присланному tenant ID.

Для переживания API outage node хранит последнюю подписанную конфигурацию capture bindings и expiry; не создаёт произвольные grants из файла звонка. Локальный helper генерирует UUID и intent journal перед записью; backend mirror может появиться позже. Нет действующей binding — не export в AI; обычный звонок продолжает fallback/legacy recording policy. Отозванная binding при reconnect не даёт upload чужих данных: spool quarantine с machine reason и operator action, без auto-grant.

Manifest v1: schemaVersion, node/binding/recording IDs, source ref, recorderId, start/end UTC, sample format/rate/channels, bytes, SHA-256, capture-profile revision, relative spool object key, segment track roles с provenance/confidence, privacy/export flags. Caller names/numbers не входят в filename или command args. Transcript/secret в manifest отсутствуют. Immutable ready manifest; исправление mapping — новая metadata revision, original bytes неизменны.

**Приёмка:** tenant A/B/0; spoof node/binding/tenant; expired/revoked configuration; duplicate recording ID; foreign asset reference; replay manifest same digest возвращает receipt, иной digest —409 и quarantine. Две реальные SQL DB, без PBX для этих tests.

## CAP2 — управляемый recorder и compatibility playback

**Вход:** G2 live format/close evidence, CAP1; DB-03 для native rollout. **Owned paths:** `routes/routes.service.ts`, `routes/route-recording.util.ts`, `shared/utils/dialplan-subroutines.util.ts`, scoped recorder adapter/tests, `system-settings/dialplan-subroutines.service.ts` при необходимости. Не менять RouteFormModal analytics policy (AI-06P).

1. Feature flag `durable_capture` default OFF; сохранить legacy путь до принятия pilot. Запись включается только прежними recording settings либо явной robot deployment policy. В новой ветке имя server-generated UUID, не timestamp+caller. `CDR(record)` сохраняет безопасный совместимый relative playback base для MP3.
2. Capture start/stop работают с **конкретным recorderId**, не останавливают все MixMonitor на канале. Перед finalization закрыть recorder; hook пишет короткий локальный durable event, не вызывает STT/LLM, remote HTTP upload или ffmpeg. Ветка с пользовательским `on_hangup` и без него использует один finalizer contract.
3. Capture profile выбирается по G2 evidence: mono WAV либо проверенный D raw с известным layout; fallback r/t только после синхронизации fixture. Format из runtime/profile, не допущение «всё 8k». Временный raw преобразует bounded media worker, сохраняющий provenance; unknown layout quarantine.
4. Перенести ffmpeg из hangup для opt-in новой ветки; не запускать одновременно старый postprocess и новый finalizer. Existing webhook остаётся самостоятельным событием: `call.ended` не обещает ready media. Новый `recording.ready` callback доступен отдельно. Если старый клиент требует готовый MP3 в on_hangup, compatibility adapter задерживает **доставку callback**, а не телефонный hangup; contract regression и opt-in migration обязательны.
5. Legacy player до готовности derivative показывает processing/temporarily unavailable, не broken successful URL. Оригиналы новой ветки не удаляются ffmpeg postprocess. После derivative ready legacy `.mp3` lookup работает; старые CDR/files не переписываются.

MixMonitor документация описывает StopMixMonitor для доступности файла во время выполнения dialplan, `.raw` для D и bridged-only смысл b. Эти свойства требуют проверки выбранного профиля на стенде: [официальный MixMonitor](https://docs.asterisk.org/Latest_API/API_Documentation/Dialplan_Applications/MixMonitor/). Документация не доказывает track roles или пригодность текущей hardcoded ffmpeg команды.

**Приёмка:** обе webhook ветки; exactly-one finalizer, stop одного recorder; filename collision; old playback; Answer→IVR/robot без bridge; conversion error не ready. Dialplan golden tests плюс реальные controlled calls на выделенном узле.

## CAP3 — local spool, finalizer и восстановление

**Вход:** CAP1/CAP2 contracts, AI-02 D3. **Owned paths:** новый isolated entrypoint `packages/backend/src/recording-node.ts`, `recording-capture/node/**`, `deploy/recording-node/**` packaging/examples, recording-capture/media-worker adapters и fixtures. Entrypoint не импортирует AppModule и не требует локальный SQL; отдельного npm workspace не требуется. Node spool — local append journal + atomic manifests. Helper работает под ограниченным service user.

State: `recording → closed → probing → upload_pending → acknowledged → retained/purged`; ошибки `quarantined`. Запись manifest temp → fsync → atomic rename → fsync directory по поддержанной Linux filesystem семантике. Ready требует доказанного recorder close, успешного probe, полного hash и durable manifest; неизменный размер N секунд недостаточен. After crash открытая запись — reconciliation с recorder ownership либо quarantine, не фиктивный close.

Directory определяется конфигурацией узла; relative keys валидируются, symlink/path escape запрещены как D3. На том же диске reserve space и ограничение concurrent finalizers; file count/bytes/oldest age в health. При low space прекращать новые **opt-in** captures с явным recording_failed, не обрывать звонок. Не удалять unacknowledged запись ради лимита; retention/incident action требует отдельной политики. Квоты записи и аналитики различны.

Uploader отправляет bytes через storage ingestion AI-02; path из manifest не становится backend filesystem authority. Двухшагово: intent/register → stream → complete/probe → durable receipt. Ack означает, что backend хранит проверенный immutable original и SQL asset/receipt/outbox committed. Успешный HTTP при временной записи не позволяет чистить spool. При same-host установке v1 тоже явно передаёт владение/copy; два сервиса не удаляют общий pathname независимо.

Crash object uploaded/receipt not committed → повтор по node+recording UID+digest; crash after commit/before ack → прежний receipt. Ack не зависит от доступности Redis/аналитики. Cleanup только своего acknowledged object и по retention; manifest сохраняется для audit. Reconciler сверяет локальный journal/ready manifests/remote receipts, bounded batches/backoff+jitter. Никакого «удалить всю папку spool» как recovery инструкции.

**Приёмка:** процесс kill на close/probe/rename/upload/commit/ack; API/Redis down; disk full; permission denied; corrupt manifest/hash mismatch; node restart без duplicate asset. Все orphan states видимы, operator retry не обходит privacy/tenant проверки.

## CAP4 — transfer/privacy, robot-only и event consumers

**Owned paths:** recording policy resolver, capture segment repository, CDR enrichment adapter, shared asset-ready consumer interface; robot capture adapter contract. UI route selector и запуск аналитики по маршруту — AI-06P, не включаются скрыто в CAP.

Transfer/Local channel/bridge rejoin создаёт segments, recording UID не заменяется linkedid. Track role interval указывает monitored leg/source; если роль неизвестна — unknown. Conference mixed source не маркировать stereo operator/customer. При входе в privacy-denied segment остановить свой recorder до capture; если нельзя подтвердить границу, весь asset запрещён для AI export. `analysis off` не отключает обычную запись.

`asset.ready` v1: eventId, tenant context ref, assetId, captureIntentId, sourceKind/ref, media revision; никаких PII/raw paths. Consumers загружают SQL и проверяют право заново. CDR связывается асинхронно через node+call correlation; CDR отсутствие не блокирует robot-only запись. Одна session может иметь несколько segments/assets; один звонок не склеивается с другим по одному external linkedid.

Robot capture provider пишет те же intent/manifest/segments из trusted VoiceSession, без обязательных routes/CDR tables. Независимый playback/retention доступен с лицензией роботов. Analytics consumer подключается только в AI-06P/соответствующем adapter с отдельным entitlement/project policy; запись робота не запускает платный анализ автоматически.

**Приёмка:** missing/late CDR; recording without analytics license; robot-only profile без PBX schema; tenant mismatch enrichment; transfer role change; privacy deny mid-call; duplicate asset.ready. Expected recording failure не блокирует обычный маршрут, но виден в call status.

## CAP5 — итоговая матрица и rollout

**Вход:** CAP1–4, G2, DB-03 native evidence. **Owned paths:** `harness/scenarios/manual/` scoped capture scenarios, generated fixtures, AI-03 SUMMARY/VERIFICATION/runbook.

На `root@ipbx.krasterisk.ru` создать disposable Asterisk/SQL/storage namespace; не перенастраивать действующую PBX. MySQL/PostgreSQL обе: inbound/outbound/IVR/robot/transfer/early hangup, mono/stereo, same-second calls, two tenants+0, API outage/restart, ffmpeg failure, recorder stop duplicate. Левые/правые marker signals подтверждают mapping; raw audio не из production.

Пилот включается на одном test binding, admission/capture metrics до расширения. Rollback: запретить новые durable intents → drain finalizers/uploads → сохранить spool/receipts → вернуть legacy recording только новым calls. Не переключать работающий recorder посреди call и не удалять незагруженные originals. Проектные lint/backend/frontend + build/harness logs/exit codes, версии Asterisk и capture profile. Без этих результатов AI-03 остаётся partial.
