---
initiative: ai-products
phase: AI-06
revision: 2026-09-18-r3
status: planned_dependency_gated
tasks: [REP1, REP2, REP3, REP4, INT1, INT2, INT3]
depends_on: [AI-05]
native_depends_on: [AI-03, DB-03]
---

# AI-06 — отчёты и внутренняя аналитика

Чтение: [ANALYTICS-SPEC](ANALYTICS-SPEC.md), [RECORDING-INTEGRATION](RECORDING-INTEGRATION.md), [AI-03](AI-03-PLAN.md), [AI-05](AI-05-PLAN.md), [ADVANCED-PRODUCT-CONTRACTS](ADVANCED-PRODUCT-CONTRACTS.md). Требования AN-08…12 и INT-01/02/06/07. **06A=REP1–4**, без Asterisk/CDR. **06P=INT1–3**, после CAP5/DB-03 и06A. Коммерческий standalone релиз не ждёт06P, но внутренний scope пользователя остаётся обязательным.

## REP1 — FilterSpec, выбор run и агрегаты

**Owned paths:** `speech-analytics/reporting/**`, shared FilterSpec, typed metric repositories/SQL adapters, индексы и DB fixtures. Не импортировать CallcenterReportsService/CDR tables в standalone.

`AnalyticsFilterSpec` v1: project IDs, explicit projectVersions, occurredAt range [from,to), IANA timezone, integration/source, external team/participant labels, direction, run/quality statuses, metric predicates, tags, view `ai|reviewed`, run selector `latest_completed|explicit`. Server validates project permissions, limits и typed predicates, builds parameterized SQL. Columns/sort/operator из allowlist, не client SQL. Token cursor содержит filter digest+stable sort tuple и подписан; новый filter инвалидирует cursor.

Latest выбирается на conversation/recording в рамках **всего selector**, а не отдельным latest для каждой метрики. Default latest завершённый допустимый run, order completion_at+id; pending reanalysis не скрывает прежний результат. Метрики разных semantic revisions отдельными рядами; global total calls считает уникальные recordings, не все attempts. Human view разрешает reviewed corrections только по explicit view, не смешивает незаметно с AI.

Dashboard row содержит eligible/applicable/scored/unknown/N/A/unscorable counts, numerator/denominator, revision, filterDigest, calculatedAt. MET2 score/coverage contract общий. Для ranking pilot min scored calls20 на оператора/версию; ниже — insufficient sample, не лидерборд. Team/agent metadata внешнего клиента — labels/provenance, не авторизуют пользователей и не требуют внутренних КЦ IDs.

Начальная реализация parameterized SQL по bounded range (default30d,max366d) с indexes tenant/project/occurred/status/version. Если measured query SLO не выполнен — versioned rollups: bucket/project/version/view/metric/reducer + processed event watermark; source events dedupe по eventId, correction/reanalysis invalidate affected buckets. Rollup не может молча вернуть устаревший result как exact: stale indicator или query fallback. Не добавлять второй ORM/search DB до benchmark evidence.

**Приёмка:** null/false/zero, DST boundaries, same timestamp cursor, latest run changing version, review correction, duplicate outbox, foreign project, mixed scales, top-N скрытые записи. MySQL/PG counts/drilldown совпадают по golden dataset; EXPLAIN и latency на согласованном объёме, без загрузки всей истории в JS.

## REP2 — dashboard и drilldown

**Вход:** REP1. **Owned paths:** speechAnalytics dashboard/list/cards + RTK/locales/tests. Использовать существующий player/result view AN5.

Fixed dashboard: обработано/failed/quality coverage, metric distributions с denominator, topics, time trend, operator/team series только при достаточной роли/выборке, usage с measured/estimated/shadow labels. Не добавлять произвольный dashboard builder и LLM insights в этот срез.

Любой KPI открывает exact FilterSpec+revision/run selector в списке; back сохраняет период/scroll. Multi-version series раздельно подписаны. Comparison одинаковых полных периодов/timezone, отсутствие данных не линия0. Filter share URL содержит opaque validated state без secrets/PII. Вход по deep link заново проверяет ACL.

Показывать failed/partial/reconciliation и denominator рядом с красивым средним. CSV export соответствует видимому filter digest, а не current page. No audio/transcript permission — не выполнять скрытый fetch цитат; free text labels/rationale под content ACL. Empty/no data/forbidden/stale/error UI различимы.

**Приёмка:** KPI→list→recording даёт тот же набор; tenant switch; reviewed selector; mixed project access; RU/EN/keyboard360/1440; negative/unknown metrics не окрашены как success.

## REP3 — export, расписания и доставка

**Owned paths:** reporting export/schedule workers/controllers, `integration-delivery` adapters, SQL migrations, private storage/retention, existing mailer facade (без импорта PBX cron); frontend schedules/export UI. Никакой отправки реальным получателям во время development tests.

Таблицы: `sa_report_definitions` (tenant/id/owner/filter/template/version/timezone/schedule/recipients/revision/status), `sa_report_runs` (definition/version/slot_key/filter_digest/snapshot/state/job/artifact_ref/expires), `sa_report_snapshot_items` (run/recording/result/review revision IDs + required projected values), `sa_report_deliveries` через общий delivery contract. UNIQUE(definition_id,slot_key); scheduler lease AI-02, re-delivery не повторяет export.

V1 snapshot limit50k recordings. В одной bounded REPEATABLE READ transaction выбрать membership+versioned projected data и зафиксировать snapshot rows; max30s, при превышении fail с предложением сузить диапазон, не молча обрезать. Точный snapshot экспортируется вне transaction streaming chunks; timestamp max(id) сам по себе не доказывает snapshot consistency из-за commit races. CSV/XLSX bounded memory, PDF фиксированная сводка и таблица до documented limit со ссылкой на полный export; не обещать 50k строк readable PDF.

CSV/XLSX neutralize spreadsheet formula injection для пользовательских строк, explicit timezone/encoding/decimal types. PDF renderer sandbox без URL/remote font fetch из данных; templates server-owned, HTML escaped. Artefacts private, download повторно проверяет tenant/project/export/content ACL; metadata содержит snapshot/hash/template version. Retention deletion/revocation делает прошлый URL недоступным, sensitive snapshot payload очищается по policy. Не рассылать attachments v1: сообщение с авторизованной ссылкой, без transcript/PII. Recipient — проверенный tenant user с текущим project access; arbitrary external recipients отдельный будущий approval flow.

Schedule v1 daily/weekly+IANA zone; DST repeated local slot выполняется один раз (ранний occurrence), nonexistent slot пропускается с visible reason; UNIQUE slot local date+schedule revision. Изменение timezone/schedule создаёт новую revision, прошлые runs неизменны. Перед каждым запуском/скачиванием/delivery проверить текущего owner/service grant и recipient; revoked owner →paused, не повышать до superadmin. Missed-run backlog bounded (last slot только), ручной catch-up явный command.

**Приёмка:** snapshot во время reanalysis/review/delete, identical re-download bytes, formula-injection strings, streaming memory limit, schedule duplicate/DST, two schedulers, revoked owner/recipient, delivery timeout, artifact expiry. Все tests с локальным fake receiver на выделенном сервере; media/data не уходят реальным адресатам.

## REP4 — бюджеты, bulk reanalysis и standalone acceptance

**Owned paths:** reporting usage/project-budget UI and admission adapter, bulk operation manifest, integration tests/evidence. Денежный debit по-прежнему AI-10; здесь resource limits и shadow estimate.

Project cap в ресурсных units, monetary estimate отдельно с currency/price revision или unknown. Budget parent tenant quota, child project cap; reservation в одной transaction, одинаковый lock order tenant→project→job. Не создавать отдельный project wallet. Concurrent batch items не переполняют cap.

Bulk reanalysis: materialize authorised recording selection + version/price/estimate, ограничение1000 items pilot; подтверждение digest/expiry и максимального budget. Job per item через MET3; UNIQUE(batch,item), cancel оставшихся items не отменяет понесённый usage. Progress accepted/running/succeeded/failed/skipped counts и per-item reasons, resume не дублирует успешные items. Unknown outcomes ждут reconciliation, не bulk retry all.

06A acceptance: MySQL/PG analytics-only без Asterisk/CDR — filters/drilldown/export/schedule/review/budget/reanalysis; profile build, lint/backend/frontend и browser evidence. Rollback disable report scheduler/new bulk admissions, preserve snapshots/results/ledger и drain safe jobs. Перед коммерческим выпуском отдельно AI-10A/11A и DB-04.

## INT1 — tenant policy и RouteFormModal

**Вход:** REP4, CAP contracts; DB-03 для apply/live. **Owned paths:** routes DTO/model/options validation/service, shared route schema, `RouteFormModal.tsx`, `RouteGeneralTab.tsx`/новый `RouteAnalyticsSection`, tenant analytics settings/API/RTK, RU/EN, migrations.

`sa_tenant_capture_policies`: tenant PK/default_enabled=false/default_project_id/pause_new=false/revision/updated_by. Route options `analytics:{mode:inherit|off|on,projectId?}`; отсутствующее поле=inherit при default OFF. Keep existing record/record_all/record_stereo flags. Effective resolver server-only: privacy deny → entitlement → pause → route override/default → recording enabled → project active/published/tenant → ready policy. Returns enabled/reason/projectVersion/capture requirement и policyRevision. Project change или module purchase не включает запись автоматически.

Route form — local draft с общей Save, включая кнопку «Включить запись и анализ» с видимой правкой recording settings. Server instant company-default/pause switches — RTK optimistic+undo. Для недоступного marketplace продукта показывать locked explanation, сохранённые настройки не стирать. Error/validation до apply; forged payload не обходит gate. Copy/reopen/raw/actions/nested routes сохраняют policy через один schema-driven путь.

Версия проекта/политики snapshot при создании capture intent; route change действует на новые intents. Pause/отзыв лицензии повторно проверяются до нового processing/provider stage; не ломают звонок и не меняют recording flags. Если pause снят, backlog сам не становится оплачиваемым: explicit bounded replay/preview. Route `off` — не privacy deny и не остановка обычной записи.

**Приёмка:** вся таблица inherit/off/on x default x pause x entitlement x recording x project; invalid cross-tenant project; unchanged legacy routes; switch undo; Save cancel; raw/copy/nested actions; no implicit recording on purchase.

## INT2 — internal admission, CDR/КЦ/AutoDial links и backfill

**Owned paths:** capture→analytics consumer, reports/CDR/callcenter/autodial read adapters, recording relation table, bounded backfill command/harness. Никакого нового STT в hangup или прямого calls между UI services.

`asset.ready` consumer CAP4 проверяет trusted intent/project snapshot и current pause/entitlement/privacy, затем вызывает AN2 domain ingestion. UNIQUE internal origin (tenant,node,recordingUid,project,policy snapshot) и initial run guard исключают duplicate. Channel segments принадлежат recording/conversation, linkedid не единственный ключ. Short/no-speech outcome виден skipped/unscorable, не failed с пустым score. Late CDR только enrichment, не новая analysis job.

CDR/КЦ/AutoDial views получают status+link через нейтральный relation read adapter с двумя permissions (исходный звонок и analytics project). Без transcript/audio rights никаких snippets. External analytics remains independent, optional internal links скрыты при отсутствии исходного module/data. Native agent/team ID mapping tenant-validated; external labels не становятся internal IDs.

Backfill legacy MP3 отдельный admin preview: period+count+bytes+missing ownership/format, source_quality=legacy_lossy, estimate и cap; disabled default. Прямой arbitrary file path из API запрещён; backend выбирает файлы по доверенному tenant CDR/storage mapping. Неустановленный tenant →skip, не0. При утверждении stable batch/item ID и обычный ingest; повтор/worker restart не создаёт новый run. Нельзя запускать все записи при активации модуля.

**Приёмка:** duplicate ready, late/absent CDR, privacy change before provider call, default pause resume без backfill, malformed ownership, transferred recording, same linkedid different nodes, baseline MP3 playback и two-engine attribution.

## INT3 — native матрица и закрытие 06P

**Owned paths:** remote harness/fixtures, UI UAT, AI-06A/06P отдельные SUMMARY/VERIFICATION. Runtime fixes отдельными scoped assignments.

На disposable `root@ipbx.krasterisk.ru`: inbound/outbound/IVR/robot/transfer, mono/stereo/record_all, default/override/pause, recordingOff, moduleOff, backend outage, duplicate finalizer, CAP quarantine, invalid tenant; MySQL и PG, DB-03 writer schema. User calls работают при analytics outage; accepted jobs восстановимы; запрещённый segment не уходит provider. Не local Docker и не production campaigns.

Проверить CDR/КЦ/AutoDial links и standalone regression, project checks. Rollback analysis consumer/default OFF + pause, сохранить route config, spool и playback; drain accepted работы по policy. Отключение аналитики не прекращает телефонные calls и не удаляет записи. 06A/06P readiness публикуется отдельно.
