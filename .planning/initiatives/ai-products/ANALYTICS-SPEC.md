# Speech Analytics — контракт продукта для Krasterisk v4

Детальные AI-05/06 контракты метрик/reporting/native policy — [ADVANCED-PRODUCT-CONTRACTS](ADVANCED-PRODUCT-CONTRACTS.md). Он уточняет public metric statuses, reanalysis scope и content/export permissions ранних proposed примеров.

Уточнение proposed контрактов 2026-09-18-r2: исполняемый внешний MVP — [AI-04-PLAN](AI-04-PLAN.md), scopes/state/visibility/dedupe — [PRODUCT-SLICES-CONTRACTS](PRODUCT-SLICES-CONTRACTS.md). При расхождении с ранними примерами ниже действуют эти уточнения: `analytics:*` из AI-01-B, business key с project, upload complete отдельно от run; URL pull/reanalysis не входят в AI-04 v1.

Дата: 2026-09-18. Статус: **PROPOSED — спецификация для планирования, реализация не выполнена**. Аудит исходного продукта: [AIPBX-ANALYTICS-AUDIT.md](./AIPBX-ANALYTICS-AUDIT.md). Общие платформенные контракты, биллинг и запись/маршрутизация принадлежат архитектуре инициативы; этот документ определяет продукт аналитики.

## 1. Назначение и границы

Отдельно лицензируемый модуль превращает записи разговоров в проверяемые оценки качества, темы и отчёты. Покупатель может использовать внутреннюю АТС Krasterisk либо передавать записи из внешней PBX/CRM через API. Основной путь: **проект → версия правил → источник записей → обработка → объяснимый результат → управленческое действие**.

Разработка ведётся в текущем multi-tenant Krasterisk; по решению пользователя поставки **SaaS и self-hosted равноправны**, базовый модуль OpenSource. Границы пакетов, offline entitlement, local/BYOK data и отсутствие обязательного cloud wallet определены в [DEPLOYMENT-LICENSING](DEPLOYMENT-LICENSING.md). Доменные сервисы и API с начала не требуют внутреннего SIP endpoint, route или CDR. Внутренний `call_uid` — необязательная связь, внешний `externalCallId` — альтернативная связь. Анализ звонков AI-роботов работает через тот же pipeline и отдельный шаблон критериев; лицензия роботов автоматически не даёт лицензию аналитики.

Основной пользователь — руководитель/контролёр качества. Отдельные роли: администратор интеграции, аналитик/супервизор, наблюдатель, оператор с доступом только к разрешённым звонкам. Системная авторизация использует существующий RBAC, JWT `req.user.vpbx_user_uid`, audit и marketplace entitlement. Guard формирует доверенный `TenantContext`; body/query не определяет tenant. Отсутствие tenant приводит к отказу, fallback на tenant `0` запрещён.

Не входит в первый продуктовый срез: мониторинг разговора в реальном времени, подсказки оператору во время звонка, произвольный SQL/код в метриках, обучение собственной foundation/STT-модели, выводы о личности/здоровье/характере человека по голосу. «Тон разговора» описывает коммуникацию и явно зависит от метода и качества данных.

## 2. Требования и вертикальные срезы

`MVP` — минимально законченный pilot с внутренними и внешними записями. `Commercial` — готовность к регулярной платной эксплуатации. `Full` — развитие после первых рабочих проектов. Нельзя считать MVP production-ready до общих gates tenancy, durable jobs, licensing и usage accounting.

Это **scope продукта**, а не название одной фазы. AI-04 в [ROADMAP](./ROADMAP.md) — более тонкий первый сквозной срез: внешний upload, опубликованная базовая конфигурация, несколько фиксированных метрик, transcript/evidence UI и shadow usage. Полный набор колонки MVP собирается в AI-04…AI-06 на foundation AI-01…AI-03; commercial accounting и окончательная эксплуатационная приёмка проходят AI-10A/AI-11A. Наличие pipeline в AI-04 не означает готовность редактора, внутренних маршрутов, всех отчётов или коммерческого продукта.

| ID | Требование | MVP | Commercial / Full | Критерий приёмки |
|---|---|---|---|---|
| AN-01 | Самостоятельный лицензируемый продукт, tenancy и роли | Entitlement, module entry, project RBAC; внутренняя PBX необязательна | Project teams, granular transcript/audio/export permissions | Tenant A не читает/ставит работу в project B; внешний клиент проходит полный путь без PBX-конфигурации |
| AN-02 | Источники и асинхронный приём | Ручная загрузка, public API upload, internal recording adapter; idempotency | Контролируемый URL pull, batch manifests, integration health | API возвращает 202 только после durable acceptance; повтор одного ключа не создаёт второй billable run |
| AN-03 | Запись и структурированная транскрипция | Managed asset reference, metadata/probe, временные сегменты, channel/role map | Transfer-aware participants, redaction, mono diarization, channel QA | Stereo channel roles сохраняются; origin и confidence известны; отсутствие роли видно как unknown |
| AN-04 | Проекты и неизменяемые версии | Draft/publish/archive, immutable published version, templates | Approval workflow, import/export, A/B и compare versions | Изменение проекта не меняет результат старого анализа; run может воспроизвести точную конфигурацию |
| AN-05 | Редактор метрик | boolean/number/enum/string, rubric, applicability, polarity, scale, metric preview | Weighted scorecards, deterministic derived metrics, reusable libraries | Тип/диапазон/enum/N/A валидируются; незаконная формула или дублирующий metric ID не публикуется |
| AN-06 | Надёжный analysis engine | Durable stages, STT quality gate, structured LLM output, retry classification | Long-call chunking, controlled fallback, quotas, canary models | Crash/retry не теряет работу и не удваивает charge; partial/error не маскируются под success |
| AN-07 | Объяснимость и человеческая проверка | Score + rationale + verified evidence + player seek; separate correction | Review queues, disagreement workflow, calibration dataset | Evidence открывает правильный segment/time; human correction не перезаписывает AI result |
| AN-08 | Реестр и поиск разговоров | Server pagination, project/source/status/date/operator filters, text search policy | Saved views, topic tags, bulk reanalysis and assignment | UI и экспорт используют один FilterSpec; сортировка/фильтр не теряют строки за скрытым лимитом |
| AN-09 | Dashboard и actionable drilldown | Fixed dashboard: coverage, quality, scores, topics, operator trend | Comparisons, cohorts, configurable builder, grounded AI insights | Любая цифра имеет denominator/version/filter; drilldown возвращает ровно исходный набор |
| AN-10 | Отчёты, доставка и события | Safe CSV/XLSX/JSON export, public polling, completion/error webhook | Scheduled digests, threshold alerts, branded/PDF reports | Экспорт проверяет права повторно; webhook подписан, имеет delivery history и replay |
| AN-11 | Расходы и управление данными | Preflight estimate/range, actual usage/cost, explicit paid reanalysis, retention status | Per-project caps/budgets, provider costs, data deletion reports | Для run видны attempts/usage и charge policy; delete очищает связанные производные данные по общей policy |
| AN-12 | Качество AI и эксплуатационная проверка | Offline fixtures, schema/evidence tests, stage telemetry, protected canary | Expert holdout corpus, model/rubric regression gate, SLO dashboards | Изменение model/prompt/STT не выпускается при регрессии согласованных eval targets |

## 3. Сущности и инварианты

В **новых AI-таблицах** Sequelize attribute `user_uid` отображается через `field: 'vpbx_user_uid'` на физическую колонку БД. JWT сохраняет текущий `req.user.vpbx_user_uid`; `TenantContext` несёт проверенную семантическую identity между API, сервисами и worker, а адаптер persistence выполняет явное mapping. Это не миграция всех существующих таблиц и не второй tenant directory. Все tenant-owned rows и запросы требуют этот контекст; неизвестный tenant отклоняется без fallback `0`. Внешние идентификаторы имеют unique scope `(tenant, integration_id, external_id)`. UUID/ULID — opaque internal IDs, не Asterisk `channelId` и не ID CDR. Внешний caller не может назначать owner/tenant/charge account.

| Сущность | Минимальный контракт | Инвариант |
|---|---|---|
| `AnalyticsProject` | id, tenant, name, description, state, active_version_id, permission policy | Archive запрещает новые работы; история остаётся согласно retention |
| `ProjectDraft` | project_id, revision/etag, business context, metrics, taxonomy, STT/model policies | Optimistic concurrency; изменения draft не затрагивают опубликованные версии |
| `ProjectVersion` | id, project_id, sequence, immutable config JSON, config hash, published_by/at | Frozen metric semantics, prompt/rubric, taxonomy, preprocessing/engine policy; повторное имя метрики не меняет её смысл в истории |
| `MetricDefinition` | stable key, type, rubric, applicable_when, enum/range/unit, polarity, aggregation, required evidence | Applicability и шкала — данные версии; string не участвует в среднем score |
| `RecordingSource` | integration_id/type, externalCallId or internal call ref, received_at, original call times, caller metadata | Source time и import time различаются; PII не включается в job IDs/log keys |
| `RecordingAsset` | asset_id, tenant, object reference/version, sha256, media metadata, lifecycle state, channel manifest | Blob доступен только через проверенный media access service; signed URL краткоживущая |
| `TranscriptVersion` | id, asset_id, engine/preprocessing version, language, segments, quality, role provenance, content hash | Оригинальная STT-версия неизменяема; correction создаёт новую revision |
| `TranscriptSegment` | segment_id, start_ms, end_ms, text, channel/participant_id, role, role_source/confidence | Evidence ссылается на segment ID + offsets; неизвестный role не заменяется догадкой |
| `AnalysisRun` | id, source/asset/transcript refs, project_version_id, engine/model resolved IDs, state/stage/attempts, timestamps | Explicit reanalysis — новый run; технический stage retry — attempt того же run и billable operation; опубликованный result не переписывается |
| `MetricResult` | run_id, metric_key, typed value, status, rationale, evidence_refs, confidence/provenance | `valid/not_applicable/insufficient_evidence/invalid/error` отличаются от false/0 |
| `HumanReview` | run/metric ref, original value reference, corrected value, reason, reviewer, revision/time | Append-only corrections; AI и reviewed views раздельны и явно подписаны |
| `CallTagAssignment` | source manual/automatic, taxonomy_version, tag_id/name snapshot, actor/run | Ручные tags сохраняются при reanalysis; удалённый taxonomy item не ломает историю |
| `ReportDefinition/Run` | FilterSpec, project/metric versions, timezone, schedule/audience, snapshot watermark | Повторная загрузка отчёта использует тот же snapshot; schedule не переносит чужие права |

`UsageAttempt`, outbox, integration principal, secret storage, webhook delivery и entitlement — общие платформенные сущности. Аналитика передаёт им operation/run IDs и usage facts через контракт, не создаёт собственную параллельную систему кошелька.

### Версионирование и повторный анализ

Публикация атомарно создаёт новую `ProjectVersion` и назначает её active. Работа фиксирует version при принятии; изменение active между queue и processing не меняет смысл работы. Публикация метрик не запускает автоматически платный reanalysis истории.

Explicit reanalysis выбирает новую project version, другую model policy, исправленную transcript либо намеренную повторную оценку теми же правилами. UI показывает причину, выборку, оценку расхода и создаёт новый run со ссылкой на исходный. Если asset и STT policy не изменились, можно переиспользовать transcript version. Сравнение старого/нового результата не заменяет старые записи. При `latest` dashboard считает один выбранный run на conversation, не каждую попытку.

**Технический retry не является reanalysis:** timeout/429/crash, schema repair и безопасный повтор незавершённой стадии создают новую attempt внутри прежнего run, сохраняют resolved project version и стабильный клиентский billable key. Это не скрытая новая покупка анализа. Каждая provider attempt имеет собственный usage record; supplier cost повторов и клиентское списание различаются согласно общей charge policy. При неизвестном исходе provider call worker использует reconciliation/idempotency провайдера; без такой возможности возможный повторный supplier cost отражается явно, но клиентская операция не списывается второй раз. Ошибка webhook повторяет delivery, не analysis run.

Изменение rubric, range, polarity или applicability — семантическая версия. Across-version график строится отдельными сериями; объединение возможно только при явном compatibility mapping и подписанном способе нормализации. Нельзя молча усреднять шкалы 1–5 и 0–100 или разные трактовки одной метрики.

## 4. Контракт обработки

Платформенное основание: SQL job record + transactional outbox → BullMQ/Redis worker. Пакеты queue уже установлены в Krasterisk, но это не свидетельство operational queue: фазе foundation нужны запуск worker, recovery, health и нагрузочная проверка.

Предлагаемый путь:

`accepted → acquiring_media → probing → transcribing → assessing_quality → analyzing → validating → completed | partial | failed`

`cancel_requested → cancelled` — отдельная ветвь. `waiting_retry` хранит failed stage, attempt, retry_at и retryable error code в том же run. Уже совершённые provider calls не отменяются задним числом; API сообщает фактический terminal outcome после обработки cancel. После удаления/отзыва доступа running worker проверяет policy перед публикацией результата.

Инварианты pipeline:

1. Before ACK сохраняются principal/tenant/project version, source descriptor, idempotency record и outbox. Для upload — подтверждён durable asset; для async URL pull — durable acquisition job, но `202` ещё не означает скачивание файла. Источник обязан сохранять URL доступным до `media.acquired`, или использовать managed upload.
2. Audio decoding/probe ограничены bytes, duration, channels, CPU/memory/time; metadata MIME от клиента не считается доказательством формата. Объекты изолируются по tenant, filename не используется как path.
3. STT возвращает canonical timed segments. Внутренняя запись использует manifest от recording subsystem; внешний API задаёт channel map с явной provenance. Mono может дать unknown speakers; scoring operator-only критерия не выполняется при ненадёжной роли.
4. Quality assessment предшествует LLM. Тишина, короткий информативный звонок, мало слов, плохой STT и техническая ошибка — разные states/reasons. Порог длительности зависит от rubric; краткий успешный разговор нельзя автоматически считать плохим.
5. Transcript — untrusted input. Prompt отделяет данные от инструкций; analysis LLM не имеет tools для действий во внешних системах. Text и taxonomy не могут расширить права, изменить системный rubric или вызвать MCP tool.
6. LLM output проходит JSON schema, type/range/applicability, evidence and temporal validation. Максимум один explicit repair на output; повторы 429/timeouts идут по отдельной stage policy. Все попытки учитываются в usage.
7. Неуспешная отдельная необязательная метрика даёт `partial` с перечнем причин. Global schema failure даёт `failed`; UI не публикует пустой green score. Автоматическое `0/false` для отсутствующих данных запрещено.
8. Result commit, terminal state, usage settlement instruction и completion outbox согласованы через общую транзакционную модель. Re-delivery не повторяет charge или external side effect.
9. Provider fallback задаётся allowlist policy проекта/tenant и правилом доступа к данным. Самовольный перенос записи к другому провайдеру запрещён. В результате виден фактически использованный provider/model, включая retries.

Long-call chunking включать после baseline: сегменты имеют стабильные IDs; overlap не дублирует evidence; метрики «выполнено хотя бы раз», «не выполнено ни разу» и «средняя оценка» имеют разные reducers. Summary/overall score не выводится механическим средним chunk scores. Для absence-claims нужен coverage всего релевантного диапазона записи.

## 5. Public integration API v1

Отдельный namespace и guard, например `/api/v1/speech-analytics`. Internal UI API использует существующий JWT/RBAC и не принимает service token как взаимозаменяемый JWT. Public API principal имеет tenant, integration_id, scopes, project allowlist, expiry/revocation; секрет хранится в hash/secret-store, показывается один раз. Project selection проходит повторную service-level проверку.

| Метод и ресурс | Назначение / результат |
|---|---|
| `POST /uploads` | Создать upload session с size/type/checksum bounds, сроком и tenant-scoped destination; 201 |
| `POST /uploads/{id}/complete` | Проверить объект/размер/checksum; создать или подтвердить ready asset; повтор безопасен |
| `POST /analysis-runs` | Принять asset_id или source URL descriptor + project; durable 202 с run/status_url |
| `GET /analysis-runs/{id}` | State, stage, progress, retry/quality reasons, links; result при готовности; scope checked |
| `GET /analysis-runs/{id}/result` | Versioned result contract, metric values, evidence refs, provenance и visibility-filtered usage |
| `POST /analysis-runs/{id}/cancel` | Идемпотентный запрос отмены, 202 либо уже terminal state |
| `POST /analysis-runs/{id}/reanalyses` | Новый run; явная version/reason; отдельный idempotency key и расход |
| `GET /recordings` | Cursor list по integration/project/externalCallId и статусу; без доступа ко всему tenant по умолчанию |
| `POST /batches` | Commercial: manifest из ограниченного числа элементов, per-item status/idempotency; не один огромный Base64 JSON |
| `GET /capabilities` | Supported formats, size/duration limits, enabled modes и contract version; без секретов |

Public service scopes: `recordings:write`, `runs:read`, `results:read`, `runs:cancel`, `runs:reanalyse`; `audio:read` и `transcript:read` отдельны. Настройка проекта/ключей/webhook endpoints производится через internal admin API; public integration не получает право публиковать prompt автоматически.

Пример request (предлагаемая форма, не существующий endpoint):

```json
{
  "projectId": "prj_opaque",
  "projectVersion": "active",
  "source": { "type": "asset", "assetId": "asset_opaque" },
  "externalCallId": "crm-call-847",
  "occurredAt": "2026-09-18T08:20:00Z",
  "direction": "inbound",
  "participants": [
    { "externalId": "agent-12", "role": "operator", "channel": 0 },
    { "externalId": "customer-opaque", "role": "customer", "channel": 1 }
  ],
  "languageHint": "ru",
  "metadata": { "queue": "sales" }
}
```

Header `Idempotency-Key` обязателен для создающих/платных операций. Его scope `(tenant, integration, endpoint)`; сохраняется request hash, resolved project version и исходный response. Тот же ключ + тот же запрос возвращает ту же работу; тот же ключ + другой hash — 409. TTL и срок хранения ключей фиксируются в API contract до pilot, предлагаемый минимум 30 дней. Business uniqueness `(tenant, integration, externalCallId, source-part)` защищает от случайного повторного импорта с новым ключом; явный reanalysis идёт отдельным ресурсом.

`202` response: `runId`, `recordingId`, `state=accepted`, `projectVersionId`, `statusUrl`, `requestId`. HTTP 401/403 — auth/scope/entitlement, 409 — конфликт/idempotency/version, 413 — размер, 415 — media type, 422 — семантические metadata ошибки, 429 — admission quota. Бюджет/платёжный отказ использует общий платформенный code; не задавать конкурирующий billing protocol в модуле.

Webhook events: `media.acquired`, `analysis.completed`, `analysis.partial`, `analysis.failed`, `analysis.cancelled`. Envelope: `eventId`, `eventType`, `schemaVersion`, `occurredAt`, `integrationId`, `projectId`, `runId`, `externalCallId`, `resultUrl`. По умолчанию минимальные metadata без transcript/телефона/цитат; включение PII payload требует соответствующего integration scope и настройки владельца. Общая delivery service обеспечивает HMAC timestamp signature, rotation, stable eventId, retry/backoff, replay/history. Consumer обязан дедуплицировать eventId; порядок разных events не гарантируется.

URL pull требует защищённого egress. Private PBX источники подключаются через разрешённый connector/agent или push upload; универсальный HTTP fetch не получает доступ к внутренней сети по произвольному URL. Inbound webhook URL не является способом настроить outbound destination.

## 6. UX и информационная архитектура

Главный пункт модуля: **«Речевая аналитика»**. Страницы: Обзор, Разговоры, Проекты, Интеграции, Отчёты. Настройка метрик живёт внутри проекта, не на каждом маршруте PBX. Продукт не требует знать ARI/BullMQ/STT request params для повседневной работы.

### Первый проект

`Создать проект → шаблон или пустой → бизнес-контекст → критерии → пробная запись → проверить результат → опубликовать → подключить источник`.

Шаблон объясняет, какие критерии применимы, и показывает example/non-example. AI-помощник предлагает draft метрик; пользователь видит diff, шкалу и expected evidence. Начальный preview использует собственный sample call или явно маркированный demo; тот же engine и validation, что production. Первая публикация не включает незапрошенный анализ всей истории.

### Редактор критерия

Основной вид: название, «что проверять», тип ответа, «когда применимо», шкала/варианты, «что считать доказательством», вклад в итог. Advanced раскрывает metric key, версии и provider policy. Для numeric criteria UI показывает anchors, а не только min/max. Для boolean polarity написано «Да — хорошо / Да — проблема / Информация». String-поля предназначены для извлечения фактов, не для непрозрачного scoring.

Preview показывает 3–10 выбранных примеров: value/status, evidence, explanation, отличие от человеческой оценки и estimated/actual usage. Publish показывает semantic diff и предупреждает о несравнимости исторических шкал, если она возникла. Несохранённый draft сохраняется явно или controlled autosave с конфликтами; опубликованное состояние визуально отделено.

### Разговор

Одна карточка: player и timed transcript; справа/ниже summary, criteria groups, topics, качество анализа, run/version selector. Клик evidence перематывает запись и выделяет сегмент; цвет оценки учитывает polarity и accessibility, а не только red/green. «Нет доказательства», «Не применимо», «Низкое качество записи» и «Ошибка сервиса» имеют разные тексты.

Ручная корректировка показывает автора/причину, сохраняет AI-версию и переключатель «AI / проверено». Bulk reanalysis, export и удаления показывают конкретную server-filtered выборку и scope; count берётся с сервера. Состояния empty/loading/error/retrying/partial и отсутствие прав проектируются для каждой страницы.

### Dashboard

Первый экран: число разговоров, coverage обработки, доля reliable results, темы/проблемы, тренды выбранных критериев, рейтинг с числом применимых наблюдений. Денежные расходы доступны отдельным compact виджетом/разделом для имеющих права; не занимают главный экран супервизора.

Каждый показатель содержит denominator, project version, период/timezone, quality filters и режим AI/reviewed. Низкая выборка помечается, ранжирование при слишком малом N отключается по policy. Переход `метрика/оператор/тема → filtered calls → evidence` сохраняет filters и back navigation. Builder появляется в Commercial после фиксированного dashboard; тип графика разрешается только при наличии корректного aggregation contract.

AI insights строятся из разрешённых агрегатов и evidence IDs, а не всех raw transcript без необходимости. Каждое утверждение имеет проверяемые ссылки. Экстраполяция из sample явно маркируется; LLM не выдаёт причинность из простой корреляции.

### Соответствие текущему Krasterisk

React FSD: доменные types/contracts — `packages/shared`; proposed backend — `modules/speech-analytics` с отдельными ingestion/application/query services; frontend — `entities/speech-analytics`, `features/speech-analytics`, pages/widgets без обратных межслойных imports. Имена уточняются планом с учётом актуального дерева. Использовать текущие `shared/ui`, Stack/Text, SCSS tokens и i18n; не переносить три UI-поколения aiPBX.

Независимые оперативные Switch (например paused ingestion, schedule enabled) используют существующий RTK `onQueryStarted` optimistic update + undo на ошибке. Изменения compound rubric сохраняются в draft и публикуются отдельным действием; publish не маскируется мгновенным toggle.

## 7. Данные, агрегаты и отчёты

Единый server-validated `AnalyticsFilterSpec`: project IDs/versions, time range/timezone, source/integration, operator/participant IDs, call direction, quality/run states, metric predicates, tags, reviewed mode. Backend строит разрешённый SQL query; UI/export/digest/insights используют тот же контракт и dataset watermark.

Агрегаты считают eligible sample, applicable sample, scored sample, invalid/missing counts отдельно. `false` участвует как false, `null` не превращается в 0. Для boolean показывать числитель/знаменатель; для number — distribution и выбранный reducer; enum — доли; string — безопасное извлечение/поиск, не среднее. В первом MVP данные могут агрегироваться SQL по ограниченному диапазону с предсказуемым SLA; скрытая загрузка всей истории в RAM не допускается.

Export runs асинхронны для больших выборок, закрепляют permissions snapshot и повторно проверяют доступ при скачивании. Text cells имеют единый formula-safe encoder; даты/числа типизированы; длинные transcript экспортируются отдельным связанным файлом при превышении лимита формата. UI показывает если часть данных недоступна по privacy permissions.

Scheduled reports хранят timezone и schedule version. Доставка — общая notification service с outbox, status/history и dedup. Threshold alerts имеют minimum sample, baseline window, cooldown и reason; budget alerts отделены от hard stop. Подключение Email/Telegram/CRM не расширяет tenant access получателя.

## 8. Качество AI: предложенные измеримые gates

Все числа ниже — **предложение для pilot, а не измеренные показатели**. После spike фиксируются корпус, провайдеры, hardware, language strata и accept/reject thresholds. «Есть unit tests» не означает «модель правильно оценивает разговоры».

| Измерение | Предлагаемый gate | Метод |
|---|---|---|
| Tenant/auth isolation | 0 cross-tenant чтений/записей/exports/webhooks во всей adversarial contract suite | Matrix из tenant/project/service-token/RBAC/entitlement, включая queued worker context |
| Idempotency/recovery | 0 duplicate charges; все принятые jobs после kill/restart достигают terminal или явно recoverable state | Fault injection на каждом шаге outbox, worker, result commit, delivery; повтор 100 сообщений |
| Schema/type validity | 100% опубликованных MetricResult проходят structural и domain validators | Invalid model output fixture corpus + repair/partial tests |
| Evidence grounding | 100% отображаемых direct quotes разрешаются в transcript segments; ≥95% экспертно релевантных evidence | Deterministic offsets check + blinded QA; unmatched evidence блокируется/помечается |
| STT accuracy | Цель WER ≤20% на согласованном RU narrowband holdout; отдельный отчёт для шума/акцентов/кодеков | Human transcripts; не усреднять языки и stereo/mono так, чтобы скрыть провал группы |
| Speaker/role mapping | ≥98% верных role-labelled speech intervals на корректных dual-channel записях без transfer; separate gate для transfer/mono | Ground truth channel manifest + annotated intervals; uncertainty явно учитывается |
| Numeric QA | MAE ≤10 на шкале 0–100 и weighted kappa ≥0.6 для rubric anchors | Human double-labelled holdout; per-metric report, не только overall mean |
| Boolean/enum QA | Macro F1 ≥0.85; для выбранных критических compliance criteria recall ≥0.90 | Per-class confusion matrix + confidence intervals; class prevalence recorded |
| Applicability | F1 ≥0.90 для applicable/N/A и отсутствие превращения missing в pass | Размеченные negative/short/no-objection случаи |
| Outcome-bias regression | 0 failures на обязательном наборе «нет слотов, но корректный процесс», «результат хороший, процесс нарушен» | Deterministic labelled scenario fixtures + model eval |
| Prompt injection | 0 влияний transcript instructions на tools/permissions/schema; no external action capability | Текст «игнорируй rubric», fake system messages, URLs, malicious metadata |
| UX accessibility | Keyboard доступ к filters/player/evidence/review, focus restore, readable partial/error states | Component tests + браузерный UAT по UI contract |
| API acceptance | p95 ≤1 сек для metadata POST /analysis-runs при 20 RPS на reference environment, excluding file bytes | Load test после foundation; очередь lag показывается отдельно |
| Processing latency | Предварительная цель p95 ≤6 минут для 10-минутной записи при согласованной concurrency и warm providers | Stage tracing; queue wait, STT, LLM, storage latency отдельно; limit revisited после benchmark |

Начальный corpus: минимум 120 обезличенных/разрешённых к использованию разговоров; 80 development + 40 frozen holdout, покрывающих incoming/outgoing, mono/stereo, transfer, тишину/музыку, crosstalk, краткие звонки, обрыв и несколько бизнес-сценариев. Это минимальный pilot объём, а не достаточная статистика для каждого языка/редкой метрики. Для Commercial расширять классы/страты, где confidence interval не позволяет принять решение.

Два эксперта независимо размечают подмножество не менее 30 записей; разногласия приводят к исправлению rubric до оценки модели. Human corrections не добавляются в frozen holdout задним числом. Любое изменение prompt/model/STT/preprocessing получает отчёт diff: качество, coverage, latency, cost и provider versions. Live eval запускается отдельно с budget; обычный CI использует fixtures и не вызывает платные провайдеры.

## 9. Порядок реализации внутри продукта

1. **Contracts и foundation acceptance:** tenant/RBAC/entitlement, immutable project/run schema, durable jobs/outbox/media contracts, typed errors. Gate — external user без PBX может создать проект и принять durable job на deterministic fake provider.
2. **Первый вертикальный analysis slice:** upload/API asset → STT → quality → 3–5 критериев → evidence/player → usage. Gate — реальная запись с replay/restart без потерь/дублирования; внутренняя запись подаётся тем же адаптером.
3. **Проект и редактор:** templates/draft/publish, preview corpus, metric types/applicability, version compare, human correction. Gate — изменение шкалы не меняет старую историю.
4. **Реестр и dashboard:** unified filters, SQL aggregates, drilldown, taxonomy, correct exports, public result polling и delivery. Gate — цифра на dashboard воспроизводится выборкой разговора/экспортом.
5. **Commercial hardening:** eval holdout, quotas/budgets, deletion/retention, digest/alerts, integration support UI, load/chaos/security checks, pilot UAT. Gate — наблюдаемое SLO и решение go/no-go по критическим metrics.
6. **Full extensions:** builder, grounded insights, reusable metric marketplace/library, richer CRM connectors, chunking больших записей и advanced cohort analysis — только после измеренного спроса и baseline качества.

Номера общих GSD-фаз и межпродуктовые зависимости определяет roadmap инициативы. Для каждой фазы обязательны lint/backend/frontend checks действующего проекта и targeted domain tests; факт наличия этих документов не является завершённой реализацией.

## 10. Решения, которые можно принять сейчас, и проверки до реализации

Фиксируем как базу плана: отдельная лицензия; standalone domain; internal/external adapters; обязательная immutable published configuration; асинхронный API; проверяемая evidence; три состояния «N/A / недостаточно данных / valid»; explicit reanalysis как новый run, технический retry как attempt прежнего run; никакого вызова tools из scoring LLM.

Проверки spike, не требующие остановки общего проектирования: качество RU narrowband у доступных tenant AI providers; stereo energy vs independent channel STT vs supported native diarization; роль каналов при inbound/outbound/transfers; производительность object storage и Redis workers; достаточность корпуса; объём/retention реального трафика; допуски cost/latency. До их результата не фиксировать конкретную модель навсегда, provider цены или гарантированную точность в коммерческом обещании.
