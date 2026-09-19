# AI-роботы: спецификация продукта

Уточнение proposed API/contracts r3: [AI-08](AI-08-PLAN.md), [AI-09](AI-09-PLAN.md) и [ADVANCED-PRODUCT-CONTRACTS](ADVANCED-PRODUCT-CONTRACTS.md) фиксируют voice namespace/scopes/outcomes и границу business tools. Ранние примеры ниже не означают второй API или административные права телефонного caller.

Дата: 2026-09-18. Статус: проектный контракт для поэтапной реализации. Функциональность и показатели ниже ещё не считаются реализованными или достигнутыми.

Связанные документы: [общая архитектура](ARCHITECTURE.md), [аудит aiPBX](AIPBX-ROBOTS-AUDIT.md). Roadmap инициативы определяет порядок выполнения; эта спецификация фиксирует WHAT и критерии продукта.

## 1. Продукт и границы

По решению пользователя продукты развиваются параллельно, с поставками SaaS и self-hosted и OpenSource базовым модулем. Контракт пакетов/лицензий/локальных данных: [DEPLOYMENT-LICENSING](DEPLOYMENT-LICENSING.md). Self-hosted local/BYOK admission проверяет лицензию и resource quotas, не требует SaaS-кошелька. Общие provider/media primitives относятся к нейтральному core/connectivity, а не делают OpenSource core зависимым от коммерческого robot package.

**AI-робот** — настраиваемый голосовой агент, который ведёт диалог через realtime speech-to-speech модель либо каскад **VAD → STT → LLM → TTS**, обращается к разрешённым бизнес-инструментам/знаниям и при необходимости передаёт звонок человеку.

Отдельное entitlement `ai_voice_robots`. Пользователь покупает продукт независимо от речевой аналитики, сценарных роботов, административного AI-чата и КЦ. Встроенный режим использует телефонию Krasterisk. Самостоятельный режим получает звонки по SIP-транку от сторонней PBX на наш SIP edge и имеет собственные onboarding, кабинет, подключения, журнал, лимиты и usage. Для работы standalone клиента не заставляют настраивать внутренние extensions/очереди Krasterisk.

Сценарные `voice-robots`/`voiceRobots` сохраняют собственные сущности и UX. PBX AI-assistant (`ai-chat`/`ai-platform`/административный MCP) также остаётся отдельным продуктом: звонящий не становится администратором АТС.

В `packages/backend/src/modules/ai-agents/models/ai-agent.model.ts:10` уже есть `cc_ai_agents`, режимы realtime/cascade, providers, prompt, toolset и tenant. **Развить или безопасно мигрировать этот inventory**, не создать параллельную редактируемую конфигурацию роботов. Foundation включает read-only inventory существующих записей/ссылок, mapping UID, backfill первоначальной draft/version и совместимость прежних API. До разрешения миграции новых исполнений не включать.

## 2. Требования VR-01…VR-12

| ID | Требование | Проверяемая приёмка |
|---|---|---|
| **VR-01** | Самостоятельный продукт и отдельная сущность AI-робота | Доступен из Hub и подраздела «AI-роботы», entitlement включается независимо. Сценарный робот и AI-робот имеют разные идентификаторы/редакторы. У standalone tenant без PBX/КЦ работает создание → тест → SIP-публикация → журнал |
| **VR-02** | Версии конфигурации, тестирование, публикация и откат | Draft autosave не меняет production. Publish создаёт immutable snapshot; новый звонок получает опубликованную версию, текущий сохраняет старую. Rollback атомарно меняет published pointer, пишет audit. Конкурентная правка обнаруживается по revision/ETag |
| **VR-03** | Realtime-диалог и поддерживаемый provider adapter | Хотя бы один актуальный provider проходит контракт звонка с greeting, transcript/events, VAD/barge-in, tools, usage, hangup. Неподдержанные опции скрыты/объяснены до публикации; provider auth/fatal error прекращает bounded reconnect и вызывает установленный fallback |
| **VR-04** | Каскад VAD → streaming STT → LLM → TTS | Хотя бы одна комбинация providers проходит ту же продуктовую приёмку. VAD state изолирован по session; предложения звучат строго по порядку; новая речь отменяет старую generation на любой стадии. Финальный вывод STT используется по контракту; provisional text не запускает небезопасное действие |
| **VR-05** | Внутренний маршрут и корректное владение ARI | «AI-робот» доступен как отдельная destination, сервер проверяет module, tenant, publication и admission. Explicit dispatcher разводит scripted/autodial/ai-voice/media legs. Звонок одного типа никогда не завершает чужой listener. Duplicate Stasis не создаёт вторую сессию |
| **VR-06** | Внешняя PBX по SIP и законченная публикация | Wizard создаёт tenant-owned connection, DID→robot binding, credentials/ACL и readiness. Тест внешней PBX достигает того же published runtime; caller ID/SIP headers не выбирают tenant. Документированы incoming и transfer capabilities. Клиенту не нужны ARI-доступ и частный aiPBX REST API |
| **VR-07** | Бизнес-tools и исходящий MCP с ограниченными правами | Published версия фиксирует tool allowlist/schema/policies. Gateway проверяет principal, tenant/resource ownership, JSON Schema, deadline и budget. Повторы безопасны по контракту idempotency; неизвестный результат внешней операции не повторяется вслепую. Чужой MCP/KB/tool недоступен даже при подделанном имени. Phone principal не может вызвать административный PBX tool |
| **VR-08** | Базы знаний и воспроизводимый RAG | Документ проходит parse/chunk/embed/index с наблюдаемым статусом и retry. Tenant ACL действует на upload/search/delete. Публикация KB даёт immutable release. Ответ с retrieval связывается с источниками; unsupported/no-evidence ответ не выдаёт выдуманную цитату. Удаление исключает serving и индекс по retention policy |
| **VR-09** | Передача в КЦ и работа в автообзвоне | Transfer использует разрешённые queue/extension/external targets и подтверждённый результат; при ошибке агент продолжает установленный fallback. КЦ получает summary+session link по правам. Автообзвон сохраняет владение pacing/DNC/schedule/retry; runtime возвращает typed outcome ровно одному attempt |
| **VR-10** | Удобная настройка, браузерный тест и диагностика | Designer создаёт draft из шаблона, выбирает pipeline, тестирует голосом, видит transcript и tool trace; Debug скрыт по умолчанию. Настройки заблокированы для текущего тестового разговора. Ошибка autosave/микрофона/подключения понятна и предотвращает ложный Start. RU/EN, клавиатура и мобильный экран проходят UAT |
| **VR-11** | Журнал, usage, запись и опциональная аналитика | Session содержит version, ingress, timeline, outcome и ссылки на media/usage; секреты скрыты. Новый платный session допускается по reservation/entitlement. Hangup/retry/provider replay не создаёт повторную оплату. Анализ записей включается независимо и получает asset-ready через общую архитектуру |
| **VR-12** | Эксплуатационная устойчивость, изоляция и проверяемое качество | Одновременные звонки не смешивают PCM/VAD/transcript/tools; очереди bounded; падение worker получает итог/reconciliation. Drain deploy не принимает новые sessions. Fixtures, load tests, adversarial tool/RAG eval и стендовая SIP/UAT матрица приложены к release evidence; показатели latency измерены и ограничения опубликованы |

Все 12 требований входят в целевой продукт. Вертикальные срезы roadmap могут выпускать ограниченный pilot, но не объявлять невыполненные требования закрытыми.

## 3. Сущности и инварианты

Имена ниже логические; миграционный план определяет, какие текущие `cc_ai_*` таблицы расширять. Общие credentials/assets/outbox/ledger определены в ARCHITECTURE.md и не дублируются.

| Сущность | Назначение и ключевые поля |
|---|---|
| `AiVoiceRobot` | Стабильные id/tenant, name, status, publishedVersionId, draftRevision, tags, archivedAt. Удаление referenced робота ограничивается или заменяется архивированием |
| `AiVoiceRobotDraft` | Mutable конфигурация с optimistic concurrency, editor, updatedAt, schemaVersion; autosave только сюда |
| `AiVoiceRobotVersion` | Immutable prompt+variables schema, pipeline и provider profile revisions/capability snapshot, VAD/turn settings, voice, tools, KB releases, call policy, test/eval summary, publishedBy/At |
| `RobotDeployment` | Привязка robot к environment/channel: internal route, external connection+DID, autodial campaign; activation, selected version policy, admission limits. Секреты хранятся ссылками |
| `VoiceConnection` | SIP ingress connection, auth/ACL, allowed DIDs, transfer targets, caller metadata policy, capabilities, readiness/probe result. PBX собственного tenant может использовать native adapter |
| `VoiceSession` | Tenant, runtime owner, robotVersionId, ingress kind, call correlation, source connection, state, termination reason, time/duration, source IDs, usageReservationId |
| `VoiceTurn` / events | Sequential turn/generation ids, partial/final transcript, start/end, model response ids, produced/played audio cursor, citations/tool ids, timings. Event IDs идемпотентны |
| `ToolBinding` / execution | Logical name, schema revision, executor kind, allowed resources, read/write policy, timeout, idempotency semantics; execution carries principal, call/turn correlation and terminal status |
| `KnowledgeBaseRelease` | Tenant, document versions/ACL, embedding/index revision и provenance; активная voice session фиксирует release |
| `RobotTestCase` / `RobotEvaluationRun` | Текст/аудио fixture, expected business outcome/tool constraints, rubric/version, results/evidence/cost; version comparison без правки production |

Tenant определяется серверным principal. В терминах Krasterisk JWT-контекст содержит `vpbx_user_uid`; Sequelize attribute `user_uid` явно отображается в **физическую колонку `vpbx_user_uid`** через `field: 'vpbx_user_uid'`. Это не основание создавать физическую колонку `user_uid` или переименовывать существующую. DTO внутреннего API, jobs/events и stream metadata используют единый `TenantContext` из shared-контракта общей архитектуры, с явным mapper JWT/key/SIP principal → context → model field. Не вводить отдельные несовместимые wire-поля в voice-модуле. Публичный body/query/SIP header не устанавливает tenant. Worker повторно проверяет доверенный context и принадлежность всех providers, tools, KB, queue, media и deployment ссылок.

Session фиксирует эффективную конфигурацию **до** обращения к провайдеру. Публикация и аварийное выключение агента — разные операции: обычное выключение прекращает новые admissions, kill-switch имеет отдельное право и явно прекращает активные звонки по политике.

## 4. Режимы исполнения

### Realtime

Сессия адаптера принимает audio input, отдаёт нормализованные audio/transcript/tool/usage events и предоставляет cancel/truncate/close согласно capabilities. Provider-native события не становятся публичной схемой frontend. Не переносить конкретный протокол OpenAI в доменные DTO всех моделей.

Отключение input transcription допустимо только при честном UI: «транскрипция недоступна/не запрошена». Нельзя выдавать модельный пересказ за дословный transcript. Usage и фактический аудиопоток сохраняют свои correlation IDs.

### Cascade

Pipeline включает per-session VAD и ring prefix buffer; STT adapter объявляет interim/final/cancel возможности; LLM выполняет ограниченный tool loop; TTS синтезирует небольшими фрагментами. Синтез может иметь ограниченный prefetch, **playback всегда последовательный**.

Speech-start увеличивает **assistant response generation** epoch, отменяет старую генерацию ответа/LLM/TTS, очищает её выходной буфер и отклоняет stale callbacks. Входной поток caller имеет независимый `inputTurnId` и собственный audio timeline: ring pre-roll, первые samples новой реплики и продолжающийся streaming STT **не очищаются и не отменяются** вместе с playback. STT-запрос уже вытесненной старой реплики можно отменить только по его turn id; continuous STT нового входа продолжает получать samples. Если endpointing решает объединить фрагменты одной реплики, аудио сохраняется и переиспользуется по input timeline, а не теряется при смене output epoch.

Уже выполненное бизнес-действие не отменяется автоматически вместе с речью; его результат учитывается отдельным execution state. История conversation остаётся валидной по целым message/tool exchange, а не обрезается произвольным числом записей. Fixture «пользователь перебил на первом слоге и продолжил фразу» должен доказать одновременно остановку старого ответа **и сохранность полного нового utterance**, включая pre-roll.

Базовый turn state machine: `listening → transcribing/thinking → acting? → speaking → listening`; interrupt возвращает в listening для новой generation. Terminal session states: `completed`, `transferred`, `failed`, `cancelled`. Хранить machine reason отдельно от пользовательского текста ошибки.

Оба режима используют общие CallControl, scoped tool executor, knowledge retriever, usage emitter и media abstraction. Выбор vendor/mode не меняет бизнес-права.

## 5. Media transport и ARI

Предпочтение — capability-gated `chan_websocket` на поддерживающем его Asterisk; сертифицированный RTP fallback для другого поддержанного профиля. Не требовать upgrade всех АТС. Согласно [официальной документации Asterisk](https://docs.asterisk.org/Configuration/Channel-Drivers/WebSocket/), драйвер появился в линиях 20.16/21.11/22.6/23.0, а более новые возможности JSON-control зависят от версии. Проверять фактический module/protocol на хосте; одного номера версии недостаточно. WebSocket снимает timing/framing для многих кодеков, но сохраняет ограничения buffers, frames и flow control.

Spike должен дать таблицу реальных capabilities: codec/sample-rate, control format, buffer flush, XON/XOFF, played marker, channel correlation, disconnect, TLS. Только после этого выбирать конкретную реализацию media adapter. RTP fallback обязан разбирать headers, иметь точное session mapping, queue/jitter policy, bounds и packet-loss metrics. Unknown source нельзя прикреплять к «первому свободному» звонку.

Нельзя предполагать, что внешний клиентский Asterisk поддерживает ARI externalMedia/chan_websocket: клиент передаёт стандартный SIP-вызов на наш edge. Media adapter обслуживает **наш** edge/внутренний PBX, а не требует подключаться к ARI каждого покупателя.

В текущем коде `voice-robots.service.ts:513` читает numeric `event.args[0]`, тогда как `autodial-originator.service.ts:98` передаёт `autodial,...`. Foundation обязана убрать collision через единственного маршрутизатора события и явные namespaces. Старый numeric формат поддерживается отдельным legacy adapter. Неподходящий Stasis event не является основанием hangup.

Новый AI ingress требует доверенную tenant binding. Legacy ветка `voice-robots.service.ts:541–550`, допускающая отсутствие `VPBX_USER_UID`, не наследуется новым runtime. Event повтор/несовпадение owner/late cleanup не должен влиять на чужой session.

## 6. Публикация и внешние интеграции

### Внутренний маршрут

В destination chooser — отдельный тип «AI-робот» с выбором опубликованного активного робота. Настройщик видит readiness, доступную нагрузку и fallback назначения. Сервис независимо от UI валидирует module entitlement, ownership и published version. Dialplan/ARI receives opaque dispatch ticket либо ссылку, разрешаемую backend, без provider secret/prompt.

Параметры записи и аналитики принадлежат общей route/recording policy. В редакторе робота показывать эффективную политику и ссылку на настройку, не заводить второй конфликтующий recording toggle для того же вызова. В standalone SIP режиме, где внутреннего маршрута нет, policy привязывается к `RobotDeployment`/connection через тот же resolver; обязательной зависимости от `Route` или лицензии PBX не возникает. Session фиксирует effective policy и её источник до начала записи.

### Внешняя PBX

Wizard «Подключить свою АТС»: создать connection → выбрать auth/ACL и allowed DIDs → привязать номер к опубликованному роботу → показать SIP destination/transport и одноразовый secret → test call → readiness. Профили integration examples для Asterisk/FreePBX/других АТС добавляются по реально проверенной матрице; никаких обещаний универсальной совместимости по одному UI-полю.

SIP edge контролирует authentication, concurrency/CPS/duration и transfer allowlist. Tenant/robot определяется проверенным connection+DID mapping. Caller ID — только входные данные, не доказательство личности и не право на данные CRM.

Первая external версия — входящий вызов и согласованная стратегия transfer. Исходящий робот инициируется существующим AutoDial adapter или scoped integration API с idempotency, allowlist и квотами; отдельного hidden dialer внутри робота нет. Если standalone product ещё не имеет outbound API, это прямо указывается в UI/API capabilities, а входящий продукт остаётся полноценным.

### API и события

Versioned integration API даёт только разрешённые операции: robot/deployment readiness, sessions/read, optional sessions/start, call outcome/webhook subscription. Предлагаемые scopes `robots:read`, `robots:invoke`, `sessions:read`, `sessions:control`; названия финализирует общая API схема. Service credentials ограничиваются robot/deployment, не tenant-wide admin правами. Public invoke принимает только опубликованную deployment/version policy; произвольный prompt, provider secret, tenant и tool permissions во входных параметрах не допускаются.

Следующий минимальный контракт включается в OpenAPI и generated shared DTO; имена endpoints пока предлагаемые, существующий `/ai-agents` compatibility adapter использует тот же application service и не создаёт второй источник конфигурации.

| Операция | Request / права | Response и инвариант |
|---|---|---|
| `GET /api/integrations/v1/voice/deployments/:id` | `robots:read`, credential bound to deployment | Opaque id, robot/version id, `ready|disabled|unpublished|provider_unavailable|quota_exceeded`, pipeline/capabilities, sanitized reasons. Без credentials, prompt и внутренних ARI адресов |
| `GET .../sessions` / `GET .../sessions/:id` | `sessions:read`, resource binding; date/status filters, bounded cursor pagination | Session id/version/ingress/status/reason/outcome/timestamps, usage status, media availability. Transcript/audio требуют самостоятельного permission, download URL короткоживущий |
| Optional `POST .../sessions` | `robots:invoke`, `Idempotency-Key`; deploymentId, allowlisted destination, schema-validated variables, externalCallId, bounded metadata | `202 { operationId, sessionId?, status, statusUrl }`. Подтверждает durable admission, не SIP answer. Ответ `sessionId` появляется после allocation. Повтор того же key/body возвращает ту же operation; другой body → 409 |
| `POST .../sessions/:id/actions` | `sessions:control`, `Idempotency-Key`; typed `hangup` или `transfer` с target из allowlist | `202 { actionId, statusUrl }`; результат `succeeded|failed|outcome_unknown` получается после подтверждения CallControl, не сразу после event emit |
| Webhook subscription CRUD/test | Отдельное integration-management право; URL/egress validation, выбранные events, signing-secret reference | Subscription id/status, redacted endpoint, delivery test id; secret выдаётся только при создании/rotation |
| Browser test session (control API, не public invoke) | JWT designer permission; draft revision или published version, transport capabilities | Short-lived grant, session id, expiry и negotiated codec/sample rates. Grant привязан к tenant/user/robot/version/session и не раскрывает permanent provider/SIP credentials |

Error envelope: `{ code, message, requestId, details? }`, machine codes стабильны, details очищены от секретов. 400 — schema/capability mismatch, 401 — invalid/expired credential, 403 — entitlement/scope deny, 404 — ресурс недоступен в текущем tenant/binding, 409 — idempotency/revision/state conflict, 429 — admission/capacity limit с retry policy, 503 — временная недоступность обязательной runtime dependency. Отсутствие кредитов/права не маскируется под успешный вызов. Все timestamps — ISO 8601 UTC, duration — integer milliseconds, IDs — opaque strings; денежные значения по общему billing contract.

Публичный session DTO не принимает trusted `TenantContext`: backend создаёт его из credential binding. В доверенном внутреннем event envelope context передаётся по единой schemaVersion, подписанному/авторизованному transport и повторной resource validation. Для browser media session документация фиксирует start/ready/audio/transcript/interrupt/end/error, ordered sequence, binary audio framing, max frame size, backpressure и reconnect rules; клиент не угадывает protocol по provider event names.

Webhook `voice.session.completed|failed|transferred` включает eventId/schemaVersion, opaque IDs, timestamps, outcome, безопасный summary и ссылки на результаты с авторизацией. Signed delivery, retry и dedup — общий delivery subsystem; не вызывать LLM повторно из-за ошибки webhook.

## 7. Tools, MCP и знания

Designer выбирает инструменты из каталога и явно видит данные/действия каждого. Для бизнес-tool задаются параметры с JSON Schema, executor, ресурсы, timeout, максимальный размер результата, replay/idempotency поведение, допустимый auth context. URL, tenant, произвольный SIP target и credential не предоставляются модели как свободные полномочия.

Persisted execution key подавляет локальные повторы, но сам по себе не обеспечивает exactly-once действие у сторонней системы. Для mutating executor нужен upstream idempotency key либо проверка фактического результата. После timeout с неизвестным исходом — `outcome_unknown`, reconciliation/оператор и запрет слепого retry; агент не сообщает об успешном действии без подтверждения.

Отдельный service principal телефонного робота ограничен опубликованной policy. Права администратора на создание конфигурации не передаются сессии. Административные tools управления самим продуктом регистрируются по действующей схеме `AiAdapterRegistryService` + skill + classification и возвращают `AgentDiffProposal` для изменений. Это control plane. Бизнес-runtime policy не является обходом административного confirmation.

Caller identity verification, если нужна для конкретного CRM действия, выполняется отдельным доверенным бизнес-механизмом. Слова «я директор»/«подтверждаю» и caller ID не повышают права. При невозможности проверки — безопасный ответ/передача оператору.

Исходящий MCP connector — tenant-owned connection с encrypted secret reference, registry/schema revision, health, allowlist и request audit. Не предлагать произвольный stdio shell command в SaaS. Remote discovery не включает автоматически все discovered tools в опубликованного робота; изменение schema требует теста/обновления binding.

KB UX: список баз → источники/статус индексации → тест поиска с источниками → публикация release → привязка к draft робота. URL/file extraction живёт вне media event loop. Retrieval возвращает bounded excerpts с source/document/chunk ids. Документы/tool outputs — данные, их инструкции не меняют permissions/system policy. Низкая релевантность приводит к «нет достаточной информации» и handoff по сценарию, не к придуманному факту.

## 8. UX и информационная архитектура

Отдельные входы «Сценарные роботы» и «AI-роботы». В AI-продукте:

- **Роботы:** таблица name, published version, состояние, pipeline, подключения, последние результаты. Действия редактировать/копировать/архивировать следуют UI канону Krasterisk.
- **Редактор робота:** задача/приветствие; prompt+variables; голос и модель; turn-taking; инструменты; знания; call policy. Сложные knobs скрыты в «Дополнительно» и появляются по capabilities.
- **Тест:** call-first экран, mic readiness, Start/Stop, transcript, summary; Setup после завершения; Debug drawer с timings/errors/tool outcomes; сравнение draft с published.
- **Версии:** diff конфигурации, результаты тестов/eval, публикация, история и rollback. «Сохранено в черновик» и «Опубликовано» различаются.
- **Подключения:** внутренние маршруты / внешняя SIP PBX / кампании; readiness, связь с robot version, тест.
- **Сессии:** фильтры по robot/version/ingress/outcome/date; call timeline, запись при наличии прав, citations/tools, usage, correlation к CDR/AutoDial/аналитике.
- **Использование:** текущий quota/reservation, минуты/стоимость по единому billing, понятные причины admission denial; настройки ключей и прав доступны соответствующим ролям.

Один public FSD interface на domain slice, новые компоненты через `shared/ui`, SCSS-модули и design tokens, thin pages. Не переносить aiPBX MUI/redesign-v3 как вторую дизайн-систему. Instant server toggles используют RTK `onQueryStarted` optimistic patch + `undo` и error toast; draft fields сохраняются в draft, publish остаётся явным действием.

Onboarding должен вести к первому тесту и следующему шагу подключения, а не сразу раскрывать все VAD/MCP параметры. Ошибки показывают, что произошло и как продолжить: «провайдер недоступен», «нет опубликованной версии», «достигнут лимит», «не разрешён перевод», «микрофон недоступен».

## 9. Интеграция с КЦ, автообзвоном и аналитикой

КЦ: handoff target принадлежит tenant и разрешён deployment policy. Blind transfer — первый обязательный профиль; warm transfer — отдельная capability с чёткой приёмкой. Сводка оператору содержит collected fields, причину передачи, выполненные действия и ссылку на transcript. Не выдавать полную историю/секреты сотруднику без прав.

Автообзвон: campaign выбирает тип исполнителя «AI-робот» и robot/deployment. AutoDial инициирует/планирует attempt, проверяет DNC/расписание/пейсинг, runtime возвращает `completed|handoff|no_consent|failed|user_hangup` с business result schema. Не все итоги означают retry; campaign остаётся владельцем retry decision и attempt identity.

Аналитика: session передаёт asset-ready/correlation и опционально canonical transcript provenance. Речевая аналитика может использовать готовый transcript по совместимой политике, но сохраняет distinction STT/model-generated transcript и не предъявляет фиктивную STT оплату. Без entitlement аналитики робот полностью работает, а dashboard роботов показывает operational metrics и outcomes.

Запись и stereo role mapping, retention, route policy, delivery и billing не определяются заново в этом документе; source of truth — общая архитектура инициативы. Конец звонка и готовность записи — разные события.

## 10. Качество, наблюдаемость и предложенные SLO

Это **цели для стендовой проверки**, а не обещание достигнутой производительности. Условия измерения фиксируются: host sizing, concurrency, codec, audio sample rate, language, provider/model/version/region, сеть, warm/cold start, наличие tool. Tail latency анализируется отдельно по ingress/pipeline, не усредняется между режимами.

| Метрика | Предлагаемая стартовая цель | Измерение |
|---|---|---|
| Первый greeting после media-ready | p95 ≤ 1.5 s при warm session | Media-ready → первый реально отправленный/воспроизведённый audio frame; separately report call-answer→media-ready |
| Response latency realtime | p50 ≤ 0.8 s, p95 ≤ 1.5 s без tools | Конец человеческой фразы по fixture → первый слышимый ответ; отдельно latency endpoint detection |
| Response latency cascade | p50 ≤ 1.2 s, p95 ≤ 2.5 s без tools | Тот же clock/fixture; STT, LLM TTFT, TTS first-byte breakdown |
| Barge-in local stop | p95 ≤ 250 ms от подтверждённого speech-start | Детекция → прекращение старого playback; отдельно исходная speech-start detector latency |
| Application-added audio loss | 0 в nominal load profile | Входные/выходные sequence/sample counters; сетевые loss/jitter показывать отдельно |
| Cleanup после terminal session | p95 ≤ 5 s | ARI/media/provider/listener/budget resources освобождены либо назначен reconciliation job |
| Tenant/session crossover | 0 | Adversarial interleaved fixtures и concurrent integration tests; это строгий инвариант |
| Повторный business side effect / debit при replay | 0 | Duplicate tool/provider/webhook/hangup fault injection с persisted idempotency evidence |

В spike допускается изменить численные latency цели с зафиксированными измерениями и tradeoffs; нельзя тихо объявить неудобные замеры несущественными. Capacity в звонках/worker определяется load tests, не берётся из размеров Map или числа CPU без теста. Tools с долгим ответом сопровождаются естественным коротким сообщением ожидания, имеют deadline и fallback; их задержка не скрывается из отчёта.

Operational metrics: active sessions, admissions/rejections по причинам, provider error/timeout/rate-limit, queue backlog ms, generation cancels, stale callbacks, packet loss, RTP remaps rejected, transfer result, per-stage latency, usage pending settlement. Логи содержат correlation, не credentials. Аудио/transcript доступ ограничен policy и retention.

## 11. Acceptance scenarios и release evidence

| Сценарий | Требования | Evidence |
|---|---|---|
| Standalone tenant покупает только robots, настраивает draft, тестирует, публикует, принимает SIP вызов | VR-01/02/06/10 | UI UAT + SIP trace без секретов + session snapshot |
| Внутренний route выбирает AI-робота; параллельно идут scripted и AutoDial звонки | VR-05/09/12 | Dispatch regression suite + изолированные session/ARI histories |
| Один и тот же сценарий в realtime и cascade: речь, interrupt, tool, KB, transfer/hangup | VR-03/04/07/08/09 | Provider contract fixtures + реальный стенд по каждой поддержанной комбинации |
| Два tenant создают близкие DID/tool names/KB ids; поддельные headers и tool args | VR-05/06/07/08/12 | Negative isolation matrix и fail-closed events |
| Первый TTS fragment задержался, второй готов; caller перебивает в STT/thinking/tool/playback | VR-04/12 | Ordered audio golden fixture, cancellation timeline, отсутствие старого playback и полное новое utterance с pre-roll без отмены нового STT |
| Draft правится во время production call, затем publish и rollback | VR-02 | Старый session сохраняет version; новые переключаются атомарно; audit и concurrent edit test |
| Provider rate-limit/fatal disconnect; MCP timeout; KB injection | VR-03/07/08/12 | Bounded retries, safe fallback, нет privilege escalation и ложного успеха tool |
| Worker падает после side effect, но до ответа; replay usage/hangup | VR-07/11/12 | Upstream idempotency или проверка результата; иначе outcome_unknown без слепого retry; ledger/reconciliation evidence |
| Запись готовится позже hangup, аналитика то включена, то выключена | VR-11 | Asset-ready только после finalize; без дубликатов jobs и фиктивных списаний |
| Мобильный/keyboard UI, denied mic, неуспешное autosave и истёкший entitlement | VR-01/10/11 | RU/EN UI UAT и корректные disabled/error states |

Релиз содержит schema/migration evidence, provider compatibility matrix, accepted codec/transport matrix, regression scripted/AutoDial, нагрузочные результаты, eval set version, known limitations, rollback и runbook. Минимальные repo checks перед «готово»: `npm run lint`, `npm run test:backend`, `npm run test:frontend`, плюс профильные media/contract/eval tests; зелёные unit tests не заменяют звонок на стенде.

## 12. Что уточняется профильными spike/планами

Не блокирует подготовку foundation: точные hosting profiles, provider/model shortlist, векторное хранилище, рекомендуемые значения turn-taking, warm-transfer strategy, enterprise single-tenant profile. Решения фиксируются перед соответствующей реализацией по официальным документациям, доступному стенду и измерениям.

Не входят автоматически в первый pilot: произвольное клонирование голосов, визуальный universal agent graph, arbitrary user code/stdio, собственный outbound dialer, автономный доступ к административным инструментам АТС. Они требуют отдельного продуктового требования и приёмки, а не скрытого расширения tool permissions.
