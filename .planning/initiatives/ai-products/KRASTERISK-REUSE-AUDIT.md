# Krasterisk: база для AI-роботов и речевой аналитики

Дата среза: 2026-09-18. Область: существующий код Krasterisk, архитектура, GSD-артефакты и модульная документация. Отдельный аудит aiPBX и проектирование маршрутов/записей входят в соседние документы инициативы.

## 1. Вывод и границы доказательств

Создавать оба продукта с нуля на новом стеке не требуется. Уже есть практически полезный медиатранспорт сценарных роботов, каталог AI-провайдеров, инфраструктура пользовательского AI-помощника АТС, tenant identity, модульный shell/маркетплейс и отчётность КЦ. При этом **исполняемых LLM-голосовых роботов и самостоятельного продукта речевой аналитики в просмотренном коде нет**. Наличие таблиц, страницы «AI-агенты» и capability `realtime` не доказывает наличие звонкового runtime.

Нужно сохранить три разных сущности: сценарный робот, голосовой AI-робот и административный AI-помощник АТС. У них разные задачи, пользователи, разрешения и жизненные циклы. Голосовая аналитика становится четвёртым, независимым продуктовым доменом; она принимает записи как из Krasterisk, так и через внешний API.

Статусы в этом аудите:

- **Код:** найден реализованный путь и его вызовы; это статический аудит, не обещание production readiness.
- **Каркас:** схема/CRUD/UI присутствуют, исполнитель не найден.
- **Историческое свидетельство:** результат, записанный в ранее существовавшем UAT/аудите; в этой задаче не повторялся.
- **Предложение:** рекомендуемое устройство нового продукта, ещё не реализация.

Новые звонки, внешние provider requests, миграции, запись в БД, нагрузочные и production проверки в рамках этого аудита не выполнялись. В рабочем дереве уже есть многочисленные изменения других задач, включая AI-chat, auth и autodial; они не изменялись и не откатывались. Ссылки на строки относятся к текущему рабочему дереву и могут сместиться.

## 2. Реестр переиспользования

| Область | Что найдено | Решение | Чего это не заменяет |
|---|---|---|---|
| Сценарные роботы | ARI Stasis, per-call session, RTP, VAD, STT/TTS, barge-in, fallback/transfer, CDR | **Адаптировать:** извлечь общий transport/audio слой, оставить FSM отдельным потребителем | LLM turn manager, realtime sessions, tools/knowledge, release lifecycle |
| AI-агенты | `cc_ai_agents`, CRUD, realtime/cascade config, instruction, ссылки на provider/toolset; UI `/ai-agents` | **Адаптировать:** миграция каркаса в продукт AI-роботов с явной совместимостью | Исполнение звонков: не обнаружено |
| Провайдеры | `cc_ai_providers`, capabilities, encrypted key, tenant CRUD, текущая token pricing | **Адаптировать:** capability-specific adapters, версии/валидация, единый secure connection contract | Поддержка провайдера в runtime не следует из его карточки |
| STT/TTS engines | Отдельные `stt_engines`/`tts_engines`; streaming Yandex и custom batch STT | **Адаптировать:** мост к unified provider profiles без двух независимых хранилищ одного секрета | Длительные stereo batch jobs, diarization, все провайдеры |
| PBX AI-chat | OpenAI-compatible client, streaming text, model/tool loop, stop/max-steps, persisted threads, proposals | **Переиспользовать паттерны/компоненты:** model client, JSON/schema, audit, cancellation | Телефонному caller нельзя наследовать права администратора АТС |
| Tools/MCP | Tenant-scoped registry и dispatch, MCP server, schema sanitization, propose/apply | **Адаптировать:** отдельный voice runtime tool policy и execution principal | Внешний MCP client, credentials, per-robot allowlist и защита tool side effects |
| Знания | Skills для PBX-admin; fuzzy/embedding поиск по structured data lists | **Частично переиспользовать:** retrieval/testing patterns | Документная KB, ingestion, chunking, index versions, ACL, citations, удаления |
| Voicemail STT/summary | WAV → STT → LLM summary, статусы, повтор обработки | **Переиспользовать паттерны и часть адаптеров** | Многоканальная аналитика проектов, масштабируемая очередь, long-call обработка |
| Отчёты КЦ | Табличные contracts, CSV/XLSX, расписания, доставка, daily rollups | **Адаптировать** | Версионируемые метрики разговора, evidence, аналитические datasets |
| Marketplace/shell | Hub/page registry, license states, module access guard, покупки, баланс | **Адаптировать:** два независимых SKU и серверная проверка runtime/API | Коммерческая изоляция готовых продуктов сейчас не обеспечивается полностью |
| Биллинг | Баланс в копейках, transaction rows, subscription scheduler; chat usage aggregate | **Адаптировать баланс; построить usage ledger** | Идемпотентный metering, holds, rating versions, provider reconciliation |
| Фоновые задачи | Redis DI с fallback, scheduled scanners; BullMQ dependencies | **Построить durable jobs/outbox** | Зависимость в package.json не равна работающим workers |
| Storage | Локальные recordings, WAV helpers, TTS cache | **Построить общий media asset/storage contract** | Object storage, presigned upload, checksum/finalization, retention/delete |
| Auth/tenancy | JWT, tenant-scoped services, admin/user levels, отдельные роли КЦ | **Переиспользовать identity; расширить authorization** | Customer API credentials, scopes/project ACL, external SIP identity |

## 3. Голосовой транспорт и сценарные роботы

### Подтверждённая база

`packages/backend/src/modules/voice-robots/voice-robots.service.ts:504` принимает ARI `StasisStart`, создаёт `VoiceRobotSession` (`:601`), хранит её в process-local `activeSessions`, обрабатывает RTP-ready (`:641`) и завершение (`:653`). `voice-robot-session.ts:236` отвечает на звонок, создаёт mixing bridge, подключает caller и ExternalMedia, создаёт UDP-сессию и запускает диалог. В том же файле есть pipeline cancellation/barge-in (`:1972`), передача обратно в dialplan (`:1104`), сохранение CDR (`:2040`) и idempotent cleanup (`:2245`).

Низкоуровневая база:

- `packages/backend/src/modules/ari/ari-http-client.service.ts:129` — bridges; `:189` — originate с заранее назначенным channel ID; `:218` — передача в dialplan.
- `packages/backend/src/modules/ari/ari-connection.service.ts:16` — reconnect, heartbeat, связь ExternalMedia → parent channel.
- `packages/backend/src/modules/voice-robots/services/rtp-udp-server.service.ts:11` — UDP per session, decode A-law → PCM16/Float32; `:126` — создание сокета.
- `packages/backend/src/modules/voice-robots/services/stream-audio.service.ts` — RTP send/timing; `services/tts-pipeline-abort.ts` и соответствующий spec — отмена pipeline.
- `packages/backend/src/modules/voice-robots/providers/provider-factory.ts:24` — STT factory; Yandex streaming и custom HTTP batch. Streaming TTS factory поддерживает Yandex; комментарии о Google/custom TTS не означают реализацию.
- `packages/backend/src/modules/voice-robots/services/tts-cache.service.ts:42` — key из text/voice/speed/engineType; локальные синхронные disk операции.

FSM содержит keyword matching, slots, webhook, data-list и бизнес-логику сценарного диалога в одном большом классе. Добавление `if (isAi)` внутри этого класса создаст связанность и увеличит риск регрессий. Общий слой должен выделяться малыми шагами под тестами существующих сценарных звонков: media session/transport, audio format, playback cancellation, termination и safe transfer. Orchestrator LLM-диалога остаётся самостоятельным.

### Интеграционные риски, которые надо закрыть до общего runtime

1. **Коллизия Stasis dispatch.** `AriConnectionService` подключается к одному `getAppName()` (`ari-connection.service.ts:65`); default — `krasterisk_voicerobots` (`ari-app-name.ts:2`). Сценарный handler проверяет только app и UnicastRTP/Snoop, затем преобразует первый аргумент в число; при invalid вызывает hangup (`voice-robots.service.ts:505`). Автообзвон уже использует тот же app с `appArgs: autodial,...` (`autodial-originator.service.ts:97`), а его handler выбирает `ac-` channels (`:150`). Из кода следует риск, что чужой handler завершит звонок. Нужен явный dispatcher по типу сессии/namespace и тест одновременных scripted/autodial/AI сессий. Реальный PBX в этом аудите не проверялся.
2. **Tenant check допускает отсутствие identity.** `voice-robots.service.ts:536` отклоняет явное несовпадение tenant, но отсутствие `VPBX_USER_UID` и ошибку проверки допускает ради compatibility. Для нового runtime tenant определяется доверенным ingress binding и обязателен до загрузки agent/provider/knowledge; missing identity должен завершаться контролируемым отказом.
3. **Один ARI target из глобальных настроек и process-local session maps.** Это пригодно как стартовый adapter одного медиашлюза, но не готовое распределение вызовов между worker hosts. Нужны ownership/lease, drain, runtime health, лимит одновременных сессий и восстановление учёта после потери worker.
4. **Codec/format узко задан.** RTP pipeline заточен под A-law 8 kHz. Realtime/другие STT/TTS могут требовать иной sample rate/framing. Нужно согласование форматов и проверяемый ресемплинг, backpressure, ограничения buffers и метрики пропущенных frames. Нельзя считать наличие PCM buffer готовой совместимостью с любым realtime API.
5. **Cache не является tenant asset store.** Текущий TTS key не включает tenant/provider ID/полную конфигурацию. Для нового продукта использовать безопасный namespace, полные параметры синтеза, retention и асинхронное хранилище; не распространять нынешний локальный cache на PII произвольных диалогов без изменения контракта.

## 4. Каркас AI-агентов и AI-платформа

### Что реально есть

`packages/backend/src/modules/ai-agents/models/ai-agent.model.ts:10` определяет `cc_ai_agents` с `mode=realtime|cascade`, instruction, model/STT/TTS profile IDs и toolset. `ai-agents.service.ts:17` — CRUD/validation; `ai-agents.module.ts:24` регистрирует модели и три административных сервиса. Внедрения session executor и аудиопровайдеров в модуль нет. Поиск references `CcAiCdr`, `CcAiBilling`, `CcAiInvoice` нашёл модели и регистрацию, но не writers звонкового runtime.

Фронтенд не пустой: `packages/frontend/src/app/router/router.tsx:178` подключает страницы AI providers/agents; `features/modules/lib/moduleRegistry.ts:247` показывает их в AI Hub; `pages/AiAgentsPage/AiAgentsPage.tsx:20` имеет вкладки agents/toolsets; `features/ai-agents/ui/AiAgentModal/AiAgentModal.tsx:31` редактирует realtime/cascade, instruction и providers. Это стартовый CRUD, не редактор опубликованных конфигураций с playground, логами сессии, инструментами и KB.

**Рекомендуемая эволюция:** продукт «AI-роботы» использует существующую `/ai-agents` точку входа или совместимый redirect на новый URL; существующие записи мигрируются осознанно. Не создавать третью дублирующую agent table без inventory фактических данных и ADR. Внешние идентификаторы/queue member hints должны оставаться однозначно отделены от `voice_robots`.

### Две несовместимые семантики provider profiles

Рабочие сценарные STT/TTS используют `SttEngine`/`TtsEngine`. Каркас AI agents ссылается на `CcAiProvider`; это разные модели и API. `AiProvidersService` явно tenant-owned (`ai-providers.service.ts:12`, `:68`), тогда как `AiAgentsService.validateLinkedEntities` всё ещё допускает provider rows `[0, userUid]` (`ai-agents.service.ts:116`). В `ai-provider.model.ts:60` прямо отмечено, что tenant 0 является настоящим BOX tenant, а не глобальным шаблоном.

До активации voice runtime необходимо исправить семантику tenant 0 и проверять ownership + enabled + capability каждой ссылки на сервере. Нужен единый connection/profile contract с adapters для legacy speech engines, а не автоматический перенос всех существующих ключей в новую таблицу. Публичный DTO должен возвращать `configured`, а не secret/ciphertext. `ai-agents.module.ts:42` предупреждает о development encryption fallback при отсутствии `CC_AI_KEY_SECRET`: коммерческий режим должен иметь явную рабочую конфигурацию секрета, ротацию и отказ запуска соответствующего runtime без неё.

### Что взять из PBX AI-chat

- `packages/backend/src/modules/ai-chat/pbx-agent-llm.client.ts:28` — OpenAI-compatible text client, stream, usage и AbortSignal; его HTTP timeout рассчитан на административный чат, а не latency budget звонка.
- `pbx-agent-loop.service.ts:100` — ограничение шагов, persistence, tool loop; `:309` — usage; `:511` — dispatch инструментов.
- `packages/backend/src/modules/mcp/mcp-tools.service.ts:99` — единый dispatch с tenant из контекста; `:227` — sanitization model args; `:128` — proposal path.
- `packages/backend/src/modules/ai-platform/ai-mutation.contract.ts` — строгие схемы и согласованный propose/apply contract.
- `packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts` + `module-coverage.registry.ts` — новый backend домен обязан быть классифицирован и, когда он доступен PBX-помощнику, иметь adapter/skill.

Не переносить административный prompt, PBX mutation permissions и кнопку Apply как разрешение на действия голосового caller. Для voice runtime нужен отдельный principal, неизменяемая опубликованная версия tool policy, per-tool budgets/timeouts, idempotency keys, детерминированное исполнение side effects и передача человеку там, где robot не уполномочен действовать. Caller transcript, KB и ответы tools считаются данными, не инструкциями для расширения прав.

### MCP и база знаний: сервер уже есть, клиенты и KB требуют разработки

`packages/backend/src/modules/mcp/mcp.controller.ts:37` предоставляет MCP server по JWT; это не управление подключениями к сторонним MCP servers. Внешний MCP client, customer connection credentials, discovery/capability filtering и per-robot allowlists в просмотренном исходнике не найдены. `cc_ai_toolsets.tools` — JSON каркас (`models/ai-toolset.model.ts:20`), не доказательство tool execution.

Skills административного помощника — знания о Krasterisk, а `data-list-search.service.ts` — поиск по структурированным таблицам. Они не заменяют KB продукта: documents/sources → extraction/chunks → versioned index → ACL-filtered retrieval → ссылки на источники. Нужны состояния ingestion, stale/rebuild, лимиты, контроль удаления исходников/индекса и eval retrieval; выбор хранилища векторов делается отдельно после sizing и сравнения вариантов.

## 5. Аналитика: полезные существующие части и отсутствующий домен

`packages/backend/src/modules/voicemail/voicemail-scanner.service.ts:47` уже опрашивает pending сообщения; `:109` обрабатывает audio, `:130` читает WAV, `:136` зовёт STT, `:146` делает LLM summary, хранит статусы и retry count. Есть tenant-scoped engine/provider resolution, WAV parser и валидатор summary. Это полезный образец объединения speech engine + LLM в бизнес-фиче.

Его ограничения не подходят для копирования в аналитику разговоров: максимум 20 MiB, весь файл в памяти, только PCM16 mono 8 kHz, русский язык задан вызовом, sequential polling и process-local running flag; transcript выборка не является атомарным claim durable job. Нужны длительные/stereo записи, channel roles, diarization для mono, сегменты с timestamps, partial/retry states, идемпотентность и самостоятельные workers.

Отчётная база:

- `packages/backend/src/modules/callcenter/reports/callcenter-reports.service.ts` — tenant scoped report contract.
- `callcenter-report-delivery.service.ts:24` — CSV/XLSX и доставка через notification integration; `:114` — tenant-scoped запрос отчёта.
- `callcenter-report-scheduler.service.ts:26` — расписания; `callcenter-rollup.service.ts:179` — daily aggregates.
- `packages/backend/src/modules/notifications/` — существующие email/messenger connection и delivery patterns.

Для нового продукта строятся projects, sources/connectors, media assets, immutable processing runs, transcript revisions, metric definitions + metric versions, typed metric results + evidence, review/corrections, dashboards, saved filters, report snapshots/schedules, API credentials, usage ledger. Ни CDR-таблица, ни report row КЦ не должны стать единственной сущностью аналитики: внешний клиент может вообще не иметь местного callcenter/route/user.

Историческое важное ограничение: `.planning/PRODUCTION-READINESS-2026-09-17.md:41` фиксирует незакрытый live P0 потери CDR (`usrc`/legacy trigger и attribution без tenant scope). Этот факт не перепроверялся здесь. Внутренняя интеграция аналитики должна иметь собственный устойчивый call/media correlation contract и отдельный gate восстановления CDR. Внешний ingestion можно разрабатывать независимо от этого legacy дефекта.

## 6. Marketplace, лицензии и standalone режим

Существуют два слоя: page-level `module_registry` и Hub modules/pages. Backend seed: `packages/backend/src/modules/cloud-admin/hub-modules.seed.ts:32`, `:94`; frontend: `features/modules/lib/moduleRegistry.ts:64`. «Analytics» Hub сейчас содержит CDR/отчёты, AI Hub — providers/agents; это не названия самостоятельных готовых speech products.

`modules-registry.service.ts:21` содержит page codes и цены; `:54` связывает старые licenses: `voice_robot`/`cc_ai_voice` могут открывать AI Hub. `:107`/`:124` возвращают true для всех модулей вне CLOUD. `module-access.guard.ts:26` проверяет `@RequiresModule`; UI nav сам по себе не защищает сервер. Сценарные robots имеют guard (`voice-robots.controller.ts:36`); `ai-agents.controller.ts:22` сейчас имеет только JWT+admin checks.

Предложение: два отдельных продуктовых entitlement codes, например `ai_voice_robots` и `speech_analytics`. Это рабочие имена, не уже созданный каталог. Раздел providers/KB/integrations — общая инфраструктура, доступная тому клиенту, у которого активен хотя бы один продукт. Новые commercial rights проверяются в UI, REST, worker admission, internal hooks и при запуске SIP сессии; эти проверки должны использовать один policy service. Деактивация задаёт явное поведение для новых вызовов/jobs, текущих jobs/звонков и сохранённых данных.

Отдельно определить коммерческую политику BOX/OPENSOURCE: нынешнее `mode !== CLOUD → true` несовместимо с предположением, что модуль всегда покупается независимо от режима. Не менять молча старые права существующих клиентов. Требуется migration/compatibility policy для `cc_ai_voice` и прежних AI Hub aliases.

**Standalone означает независимые customer workflows и границы продукта**, а не обязательное выделение всех сервисов в отдельные репозитории с первого дня. У клиента аналитики есть tenant/project/API и storage, но нет требования создать местные extensions/queues/routes. У клиента AI-роботов есть SIP ingress binding и опубликованный робот; медиашлюз может быть управляемым Krasterisk Asterisk, к которому внешняя PBX подключается транком. Прямой ARI-доступ к каждой сторонней PBX — отдельный connector, не обязательное условие SIP-транка.

Техническая зависимость standalone уже видна: `packages/backend/src/app.module.ts:245`…`:278` безусловно импортирует Ami/Ari/Voicemail/Autodial/CloudAdmin, а `auth/tenant-registration.service.ts:35` безусловно создаёт PBX contexts при регистрации организации. Отделить identity signup от PBX provisioning и завести composition roots/profiles API/media/analytics. Запуск текущего `AppModule` в каждом worker также повторно загрузит cron billing/scanners; владелец scheduled jobs должен быть явным. Acceptance analytics-only включает старт без ARI/AMI credentials и PBX realtime schema, регистрацию клиента и полный API analysis flow.

## 7. Auth, внешние API и нежелательные legacy shortcuts

Основная модель `vpbx_user_uid` из JWT и обязательный scope в service queries сохраняется. Для независимых продуктов дополнительно нужны project/workspace ACL и отдельные действия `manage_robot`, `publish_robot`, `view_transcript`, `review_result`, `export`, `manage_credentials`, `view_usage`, с проверкой сервером.

Нельзя использовать следующие существующие shortcuts как дизайн external API:

- `packages/backend/src/modules/voice-robots/voice-robots-public.controller.ts:15` — public CRUD/CDR без guard, fixed tenant из `DEFAULT_VPBX_USER_UID`. Контроллер зарегистрирован в `voice-robots.module.ts:58`; глобально в `app.module.ts:287` обнаружен throttler, не JWT gate. Перед расширением внешних поверхностей нужно закрыть/изолировать этот legacy ingress отдельным compatibility решением. В этой задаче код не изменялся.
- `packages/backend/src/modules/auth/service-token.guard.ts:27` — один глобальный service token + tenant header и синтетический admin actor. Он не является customer-scoped API key model. На MCP этот путь уже снят; не возвращать его ради удобства интеграции.

Предложение: интеграционный principal, hashed/rotatable/revocable credentials, tenant и допустимые project scopes на стороне сервера, per-key rate limits/quotas, idempotency на ingestion/run-start, signed outgoing webhooks с replay protection, журнал доставки. Тело запроса и произвольный tenant header не назначают владельца. SIP tenant/robot binding определяется аутентифицированным endpoint/trunk, а не доверенным на слово CallerID/DID.

## 8. Биллинг, очереди, storage и эксплуатация

`packages/backend/src/modules/cloud-admin/billing/billing-balance.service.ts:147`/`:203` используют транзакцию и row lock для баланса; `billing-scheduler.service.ts:67` — месячные подписки. `purchase-module.service.ts:34` — покупка, списание и активация с compensation. Это полезная административная база, но не metering pipeline.

`packages/backend/src/modules/ai-chat/agent-usage.service.ts:52` агрегирует counters на threads и умножает их на **текущую** provider pricing (`:77` и далее). Такие aggregates подходят для ориентировочного admin usage, но не для юридически значимого расчёта каждой customer операции и восстановления после retry. `cc_ai_billing`/`cc_ai_invoice` пока остаются model каркасом.

Нужен неизменяемый usage event: tenant/product/session-or-run/stage/provider/model, units (audio seconds, input/output/text/audio/cached tokens при поддержке), provider request ID, price revision, timestamp, billable outcome и уникальный dedup key. Разделить provider cost, customer charge и BYOK. Резервирование бюджета/лимит до дорогого запуска, settlement/refund после; технический retry не должен повторно списывать один billable этап. Ledger связывается с балансом после выбора коммерческих правил, а не складывает floating-point цены из текущих profiles.

`packages/backend/package.json` содержит BullMQ/Nest BullMQ, но поиск `BullModule`, `@Processor`, `@InjectQueue`, `new Worker` по backend source не нашёл реального job pipeline. `packages/backend/src/modules/redis/redis.module.ts:11` предоставляет null stub без Redis. Поэтому для аналитики проектируется durable queue + transactional outbox и обязательная runtime health проверка; нельзя тихо принять файл и потерять job в null fallback. Локальный single-node режим может использовать иной надёжный backend очереди, но это отдельный явный контракт.

Общий media asset contract: tenant/project owner, checksum/размер/формат, channel layout, finalized state, storage locator, retention/delete state, ссылки на sessions/runs. Перенос local recordings за интерфейс и object-storage adapter выполняются постепенно. Права доступа и deletion policy относятся ко всему набору: исходное аудио, производные файлы, transcript, chunks/index, exports и provider copies по возможностям провайдера.

## 9. Call-center, autodial и UX

Автообзвон имеет `AcTask`/attempts, preassigned channel ID, pacer/resource/lease/reconciliation patterns; `autodial-originator.service.ts:55` можно использовать как ориентир корректной корреляции. Его dialplan builder умеет шаг `voicerobot` (`autodial-dialplan.util.ts:139`) — новый AI robot должен иметь отдельный typed step/reference и tenant/entitlement validation, не притворяться scripted robot ID. Перед включением outbound AI необходимо завершить ARI lifecycle и capacity gate существующего dialer.

`.planning/AUTODIAL-REFACTOR-IMPLEMENTATION-2026-09-18.md` фиксирует только первый вертикальный data/import slice и прямо не закрывает весь R0–R6. Нельзя считать его реальный dialing/retry/trunk lifecycle уже принятым. Эти выводы не отменяют готовые части модели контактов/импорта.

КЦ предоставляет human queue transfer, session history, карточки, reports и notifications. AI runtime должен выдавать структурированный handoff packet: session ID, краткое резюме, собранные поля с provenance, причина передачи, ожидаемое действие; actual queue/extension проверяется адаптером. Учитывать busy/unavailable/timeout и продолжение разговора при невозможности перевода, вместо простого `continueInDialplan` без проверки результата.

Для UI применять существующий FSD shell и дизайн-систему: `VStack/HStack/Flex`, shared controls, SCSS tokens, TableRowActions, RU/EN, optimistic RTK cache update/undo для мгновенных переключателей. Канон shell: `.cursor/skills/sketch-findings-krasterisk-v4/SKILL.md` — Hub list, in-module sidebar, breadcrumbs, mobile bottom bar. Нельзя считать старую CRUD modal полноценным robot studio: нужны отдельные overview/configuration, prompt versioning, voice/pipeline, tools/knowledge, test conversation, sessions и release status. Аналитике нужны projects/sources, conversations, metrics, dashboard/report и usage/integrations, доступные при отсутствии PBX-конфигурации.

## 10. Реализационные зависимости и проверка

Порядок для дальнейшего планирования:

1. Зафиксировать продуктовые границы, два SKU, tenancy/API principal, ownership tenant 0, версионирование agent/metric configs и media/call IDs.
2. Устранить shared ingress blockers: ARI dispatcher, no-auth legacy surface и fail-open tenant admission. Добавить отрицательные проверки tenant и coexistence scripted/autodial/AI.
3. Общие foundation contracts: provider adapters, credentials, media assets, durable jobs/outbox, usage ledger, entitlement service. Эти части не должны ждать полного robot studio или dashboards.
4. Независимые вертикальные MVP: один cascade robot по внутреннему и внешнему SIP; один analytics project с внешним API upload и одной версионируемой метрикой. Внутренняя запись/маршрут подключаются к тому же ingestion.
5. Realtime adapter, external MCP/tools и KB; полноценные review/metrics/reports; автоматические handoff/outbound adapters.
6. Commercial/reliability gates: billing dedup, quota/concurrency, runtime drain, durable retries, recovery, frontend acceptance, реальные SIP/RTP и provider failover.

Критические acceptance, которых статический аудит не доказывает: двусторонний звук; отсутствие TTS после barge-in; корректное завершение media/provider ресурсов; поведение при ARI reconnect; tenant отрицательные сценарии SIP/HTTP/jobs/storage; повтор webhook/ingestion без дубля charge; долгий stereo call с сохранением timeline; корректные роли каналов после transfer; возобновление worker; trace от route/call до media/run/charge; продукт analytics-only без местной PBX и robots-only через внешний SIP trunk.

GSD-артефакты полезны как журнал решений и трассировка проверок, но их статусы сверяются с кодом. Например `15-VERIFICATION.md:4` заявляет passed, а `:117` уточняет, что полный suite в том проходе не запускался; последующий `15-UAT.md` хранит исторические human/automated results. Старый `ROADMAP.md:896` ещё утверждает отсутствие LLM-клиента, хотя `PbxAgentLlmClient` уже реализован. `.docs/VOICE_ROBOTS_MODULE.md` содержит численные оценки latency, которые не являются замером текущего стенда. Новые планы должны отдельно указывать source inspection, automated test, live PBX UAT и load evidence.

В рамках этого файла production-код не изменён. Полные `npm run lint`, `npm run test:backend`, `npm run test:frontend` относятся к implementation gates инициативы; результатов нового полного прогона этот аудит не заявляет.
