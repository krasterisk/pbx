# AI-роботы и речевая аналитика для Krasterisk v4

Дата: **18 сентября 2026**. Подготовлены архитектура, roadmap и детальные планы ближайших [AI-01/02 срезов](IMPLEMENTATION-SEQUENCE.md). DB-01 и несколько DB-02 срезов проверены; полная DB-02 ещё имеет открытые gates. AI-00/01 реализованы частично: исследования, ARI naming slice, начальный access resolver и inventory. **Новые AI production-функции пока не готовы.** Первое следующее implementation assignment — [A1: серверный доступ](AI-01-A-ACCESS-PLAN.md); актуальное назначение — в [EXECUTION](EXECUTION.md).

## Рекомендация

Разработать **два независимо продаваемых продукта на общей платформе Krasterisk**. AI-роботы и сценарные голосовые роботы остаются разными сущностями. Аналитика имеет ядро без зависимости от внутренней АТС. AI-роботы используют собственный SIP/media edge для клиентов с внешней PBX. Общими остаются identity, tenancy, providers, credentials, storage, наблюдаемость и финансовый учёт.

**Уточнение пользователя:** нужны SaaS и коробочная установка, базовый модуль — OpenSource. Закладываем открытое PBX-ядро и два подключаемых коммерческих AI-продукта; способ установки отделён от entitlements. Детальный контракт: [DEPLOYMENT-LICENSING](DEPLOYMENT-LICENSING.md). SaaS/self-hosted входят в приёмку каждого продукта, а OpenSource core собирается без AI-модулей.

**Выбор СУБД:** PostgreSQL или MySQL на установку, для приложения и Asterisk CDR/queue_log/realtime, через Sequelize и соответствующие Asterisk drivers. Требование пользователя заменяет прежнее MySQL-only допущение. Полная поддержка PostgreSQL ещё не реализована; подготовлены [DATABASE-PORTABILITY](DATABASE-PORTABILITY.md) и первый [DB-01-PLAN](DB-01-PLAN.md). Существующий MySQL остаётся поддерживаемым; одновременно держать оба engine не требуется.

Брать из aiPBX проверенные алгоритмы и продуктовые находки, но не переносить приложение целиком. В Krasterisk уже есть полезный ARI/media foundation; строить ещё один независимый диалер, кошелёк или административный MCP dispatch не нужно.

Для разработки: **Codex + существующая GSD-система документов**. Astra high — ближайший foundation/архитектура/review; Sol high — основной исполнитель последующих ограниченных задач. Обоснование и официальные источники: [DELIVERY-WORKFLOW](DELIVERY-WORKFLOW.md). Один координатор, небольшой исполняемый план следующей фазы, независимые workers/review, реальные тесты и live/eval evidence. Смена orchestration framework сейчас не даёт доказанного выигрыша.

**Готовность:** roadmap охватывает все фазы. Детализированы DB-01/02, AI-00…10 и DB-04 — 60 AI-задач (01…09) плюс COM1–4/10A/10R и I1–I4. Измеряемые provider/SIP/MCP/KB gates выделены явно; исполнять после upstream checks. Task-level AI-11 release/pilot ещё впереди. Это не production readiness и не завершённая реализация продуктов.

**Перед началом или продолжением:** прочитать [HYBRID-WORKFLOW](../../HYBRID-WORKFLOW.md) и [EXECUTION](EXECUTION.md). Режим — codex-direct, один координатор на фазу; GSD-workflow включается через явный handoff. EXECUTION хранит актуальное назначение, а ROADMAP — последовательность результатов.

## Что изучено

- Krasterisk: обе канонические архитектуры, `.planning/PROJECT`, `STATE`, `ROADMAP`, `CANONICAL_REFS`, конфигурация GSD, фазовые и свежие production/AI/autodial артефакты; voice-robots, ARI, AI/chat/providers/MCP, marketplace/auth/billing, маршруты/записи/CDR, voicemail/КЦ/автообзвон и frontend patterns.
- aiPBX frontend: `C:/Users/Professional/WebstormProjects/aiPBX`; GSD `.planning`, roadmap/requirements/research/UAT, UI voice/analytics.
- aiPBX backend: **`C:/Users/Professional/WebstormProjects/aiPBX_backend`**. Указанная папка `aiPBX/_backend` отсутствует; фактический соседний backend подтверждён workspace-файлом и GSD самого aiPBX.
- Первичная документация Asterisk, OpenAI, GSD Core и Spec Kit в части предложенных решений. Ссылки рядом с решениями; наличие API в документации не означает доступность конкретной модели в аккаунте заказчика.

Audit-файлы содержат ссылки на конкретные исходники и строки. Прочитанные production/UAT результаты обозначены историческими свидетельствами. Новых живых звонков, provider requests, платежей, миграций или deployment не выполнялось.

## Основные находки

| Область | Что уже есть / что предстоит |
|---|---|
| Сценарные роботы Krasterisk | ARI/RTP, VAD, streaming STT/TTS, barge-in и call lifecycle. Выделить media primitives без слияния доменов |
| AI-агенты Krasterisk | CRUD и модели realtime/cascade/CDR/billing есть; готовый телефонный LLM executor в просмотренном коде не найден |
| Административный AI | Рабочие model/tools/proposals/confirmation patterns. Полномочия помощника АТС нельзя передавать звонящему |
| Речевая аналитика | Нет product domain проектов/версий метрик; есть providers, voicemail STT/summary и отчёты КЦ для частичного reuse |
| Записи | Stereo уже существует. Нужны lossless originals, роли дорожек, готовность файла, durable spool/queue и совместимость MP3 playback |
| aiPBX robots | Полезны realtime/cascade adapters, tool contract, voice-test UX, interruption ideas. Не переносить shared VAD state, неоднозначную RTP привязку, TTS races, resource-auth gaps |
| aiPBX analytics | Полезны typed metrics, snapshots, validation/repair, evidence, quality gates, stereo checks и drilldown. Заново спроектировать jobs, credentials, ownership, result/charge transactions |
| Коммерческая независимость | Module aliases и non-CLOUD bypass требуют compatibility policy; usage ledger и reservations нужны обоим продуктам |
| Standalone | Нужны отдельные composition roots, signup без PBX provisioning и закрытие legacy unauthenticated surfaces |

Каскад: **VAD → STT → LLM → TTS**. Realtime — вторая runtime strategy с теми же ограничениями доступа, версиями, журналом и metering.

## Решение по маршрутизации

Tenant default + route override `inherit/off/on` + project selection. Начальное состояние OFF; покупка модуля не включает запись всех разговоров. UI показывает эффективную политику и необходимость записи. Глобальная пауза прекращает новые analyses, не портит настройки маршрутов.

После завершения recorder: lossless asset + trusted manifest → local spool → durable ingestion/outbox → analytics worker. Hangup hook подаёт короткий сигнал, не ждёт STT/LLM. Внешний API приводит к тому же ingestion. Provider processing, callbacks и списание имеют отдельные стадии и идемпотентность.

`Analytics OFF` не равно `Recording OFF`. Privacy exclusions задаются отдельно. Роли stereo tracks определяются из leg/participant metadata; канал 0 не объявляется оператором для всех направлений и переводов.

## Документы

| Документ | Содержание |
|---|---|
| [IMPLEMENTATION-SEQUENCE](IMPLEMENTATION-SEQUENCE.md) | Актуальная оценка готовности, порядок A1…D6, общий SQL/API/verification contract |
| [DETAILED-DESIGN-REVIEW](DETAILED-DESIGN-REVIEW.md) | Self-review новых планов, устранённые пробелы и границы проверок |
| [AI-01-PLAN](AI-01-PLAN.md) | Индекс A: доступ/лицензии, B: API-ключи/identity, C: состав установки/UI |
| [AI-02-PLAN](AI-02-PLAN.md) | Подробные schema/state machines, outbox/recovery, storage, usage и fault matrix |
| [AI-03-PLAN](AI-03-PLAN.md) | Capture/spool/finalization, совместимость CDR playback и robot-only запись |
| [AI-04-PLAN](AI-04-PLAN.md) | Projects/API, STT и фиксированные метрики, evidence UI, callbacks и eval |
| [AI-07-PLAN](AI-07-PLAN.md) | Versions/cascade, ARI/media ownership, interruption, маршрут/AutoDial и голосовой тест |
| [PRODUCT-SLICES-CONTRACTS](PRODUCT-SLICES-CONTRACTS.md) | Границы трёх продуктовых планов и согласованные дополнения к foundation |
| [AI-05-PLAN](AI-05-PLAN.md) | Метрики, applicability/scoring, preview/reanalysis, человеческие corrections |
| [AI-06-PLAN](AI-06-PLAN.md) | Standalone dashboard/отчёты и отдельная интеграция native маршрутов |
| [AI-08-PLAN](AI-08-PLAN.md) | Realtime, tenant SIP connections, внешний call API, lifecycle/live profiles |
| [AI-09-PLAN](AI-09-PLAN.md) | Tools/MCP permissions, knowledge ingestion/retrieval/releases и adversarial eval |
| [ADVANCED-PRODUCT-CONTRACTS](ADVANCED-PRODUCT-CONTRACTS.md) | Интерфейсы новых срезов, decision gates и граница дальнейшего планирования |
| [AI-00-CLOSURE-PLAN](AI-00-CLOSURE-PLAN.md) | Незакрытые ARI ownership, запись/fixtures и prerequisites |
| [ROADMAP](ROADMAP.md) | 12 этапов, зависимости, отдельные коммерческие выпуски, задачи, файлы, acceptance и rollback |
| [ARCHITECTURE](ARCHITECTURE.md) | Доменные границы, standalone, runtime, providers/tools/KB, tenancy, jobs/storage, биллинг и ADR |
| [ROBOTS-SPEC](ROBOTS-SPEC.md) | VR-01…12: версии, prompt, realtime/cascade, SIP/API, tools/MCP/KB, UX, КЦ/автообзвон, eval |
| [ANALYTICS-SPEC](ANALYTICS-SPEC.md) | AN-01…12: проекты, редактор метрик, pipeline, API, evidence, dashboards/reports, качество |
| [RECORDING-INTEGRATION](RECORDING-INTEGRATION.md) | INT-01…08: маршруты, формат/стерео, finalization, spool, API, CDR и rollout |
| [KRASTERISK-REUSE-AUDIT](KRASTERISK-REUSE-AUDIT.md) | Что переиспользовать, расширять и строить, gaps и ограничения |
| [AIPBX-ROBOTS-AUDIT](AIPBX-ROBOTS-AUDIT.md) | Отбор решений aiPBX для роботов с доказательствами |
| [AIPBX-ANALYTICS-AUDIT](AIPBX-ANALYTICS-AUDIT.md) | Отбор решений aiPBX для аналитики и расхождения GSD с кодом |
| [DELIVERY-WORKFLOW](DELIVERY-WORKFLOW.md) | Выбор GSD/Codex, оркестрация, state и приёмка |
| [DEPLOYMENT-LICENSING](DEPLOYMENT-LICENSING.md) | OpenSource-ядро, SaaS/self-hosted, offline licensing, local/BYOK AI, packaging и data boundaries |
| [DATABASE-PORTABILITY](DATABASE-PORTABILITY.md) | PostgreSQL/MySQL для всей платформы, Asterisk/ODBC, migration/query parity, DB-01…04 и DBR-01…08 |
| [AI-00-PLAN](AI-00-PLAN.md) | Конкретный план следующего этапа |
| [DB-01-PLAN](DB-01-PLAN.md) | Первый implementation slice: config, drivers, migration adapters и dual-DB harness |
| [DB-01-SUMMARY](DB-01-SUMMARY.md) / [VERIFICATION](DB-01-VERIFICATION.md) / [REVIEW](DB-01-REVIEW.md) | Реализованный foundation, реальные DB-контракты и независимое ревью |
| [DB-02-A-SUMMARY](DB-02-A-SUMMARY.md) / [VERIFICATION](DB-02-A-VERIFICATION.md) / [REVIEW](DB-02-A-REVIEW.md) | PostgreSQL clean baseline и schema inventory; границы до полного PG runtime |
| [SQL-PORTABILITY-INVENTORY](SQL-PORTABILITY-INVENTORY.md) | Известные runtime/legacy SQL несовместимости, owners и parity fixtures |
| [DB-02-PLAN](DB-02-PLAN.md) | Schema/upgrade, core startup/auth, CDR/КЦ/autodial/scripted-robots parity |
| [PLAN-REVIEW](PLAN-REVIEW.md) | Независимые замечания и их disposition |
| [VALIDATION](VALIDATION.md) | Проверки рабочей копии и ограничения результатов |

## Порядок поставки

1. DB-01→02 параллельно AI-00: фундамент PostgreSQL/MySQL и исследование/UX/fixtures обоих продуктов. Затем AI-01/02; DB-03 Asterisk выполняется параллельно им и закрывается до native PBX integration. DB-04 install/upgrade/restore — release gates каждой установки.
2. Общий AI-03 capture/spool и AI-04 внешний analysis slice выполняются параллельно.
3. Ветка аналитики: AI-04 → 05 → 06A (отчёты) → 10A/11A, свой коммерческий выпуск без Asterisk. Срез 06P (внутренние маршруты/КЦ) дополнительно ждёт shared capture03 и обязателен для встроенного PBX-профиля.
4. Ветка роботов: AI-03 → 07 → 08/09 → 10R/11R, свой коммерческий выпуск.

**Параллельное развитие, SaaS/коробка, OpenSource-база и выбор PostgreSQL/MySQL заданы пользователем в этой задаче.** Волны и зависимости — в ROADMAP. Shared changes имеют одного владельца; выпуски не ждут друг друга. Самостоятельность проверяется аккаунтами robot-only и analytics-only в SaaS и self-hosted на обеих СУБД. Точный hardware/OS/local-provider профиль уточняется в AI-00.

## Неизвестности

Первый provider набор, регион обработки, проверенный local-model/hardware профиль; нагрузка/retention/SLO; состав community release, условия коммерческих лицензий и legacy mapping; ставки; стенд и разрешённый corpus для human-labelled eval. SaaS/self-hosted/OpenSource-направления уже определены. В SPEC заданы измеримые **предлагаемые** цели, не обещания достигнутого SLA.

Эти вопросы не мешают контрактам/fixtures и последовательной локальной реализации; закрываются до зависимого provider/deployment/commercial gate. Неполученный ответ не считается согласием на платные вызовы или изменение production.

Пакет добавляется к существующему GSD как отдельная инициатива; исходные проекты и implementation-фазы не переинициализируются. Предложенные исправления безопасности/recording/ARI ещё **planned**. Ревью плана не означает, что дефекты исправлены в коде.
