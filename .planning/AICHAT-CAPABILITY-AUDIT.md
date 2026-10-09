# AiChat: фактические возможности и рабочие схемы

Проверка 2026-10-07, coordinator `/root`, codex-direct. План: [CONTEXT-DEFAULTS-AICHAT-EXECUTION.md](CONTEXT-DEFAULTS-AICHAT-EXECUTION.md).

Проверены реальные фабрики: **35 доменов, 119 инструментов, 49 исполняемых mutation-контрактов**. Чат и MCP берут инструменты из AiAdapterRegistry; исполняемые входные/канонические схемы принадлежат адаптерам. Это unit/static evidence, не запуск Nest с реальной БД и не live LLM eval. JSON: [artifacts/aichat-capabilities.json](artifacts/aichat-capabilities.json).

## Матрица реальных операций

| Домен | Чтение / discovery | Изменения с контрактом | Прочие предложения |
|---|---|---|---|
| autodial | list_autodial_campaigns, get_autodial_campaign, list_autodial_bases, get_autodial_stats | create_autodial_campaign, update_autodial_campaign, pause_autodial_campaign, add_autodial_dnc | — |
| call-groups | list_call_groups | create_call_group, update_call_group_members, update_call_group, delete_call_group | — |
| callcenter | cc_get_queue_snapshot, cc_get_agents, cc_get_today_kpi, cc_force_pause_agent, cc_force_unpause_agent | — | — |
| conferences | list_conference_rooms, cf_force_mute_participant, cf_force_kick_participant | create_conference_room, update_conference_room | — |
| contexts | list_contexts | create_context, update_context, delete_context | — |
| diagnostics | get_live_channels, get_recent_call_events, get_compiled_dialplan, get_endpoint_registration | — | — |
| dialplan_dry_run | dialplan_dry_run | — | — |
| directories | list_directories, list_directory_records | create_directory, update_directory, delete_directory, add_directory_records, remove_directory_records | — |
| endpoints | list_endpoints, get_endpoint_configuration, list_pickup_groups, list_provision_templates | create_endpoint, create_endpoints_bulk, delete_endpoint, update_endpoint | — |
| ivrs | list_ivrs | create_ivr, update_ivr, delete_ivr | — |
| komandor-claims | list_claims | — | — |
| moh | list_moh_classes, describe_moh_class | assign_moh_class, update_moh_class | — |
| notifications | list_notifications, list_notification_integrations | update_notification_integration | — |
| numbers | list_numbers, describe_number | — | — |
| pbx | get_pbx_state | — | — |
| plan | — | — | propose_plan |
| prompts | list_audio_prompts | update_audio_prompt | — |
| queues | list_queues, get_queue_configuration | create_queue, update_queue, delete_queue | — |
| reports | get_cdr_summary, find_cdr_calls | — | — |
| route_templates | list_templates, apply_template, build_from_description | — | — |
| routes | list_routes, list_dialplan_apps, describe_route_chain, list_route_analytics_projects | create_route, delete_route, update_route, set_route_analytics_project, clear_route_analytics_project | — |
| service-requests | list_service_requests | — | — |
| skills | list_skills, read_skill, get_configuration_capabilities | — | — |
| sms | get_sms_channel, list_sms_deliveries | — | — |
| speech-analytics | — | pause_speech_analytics, edit_speech_analytics_project, issue_speech_analytics_token | — |
| stt-engines | list_stt_engines | update_stt_engine | — |
| system-settings | get_platform_settings | — | — |
| telegram | get_telegram_channel, list_telegram_deliveries | — | — |
| tenant-settings | get_tenant_settings | update_tenant_setting | — |
| time-groups | list_time_groups, evaluate_time_group | create_time_group, update_time_group | — |
| trunks | list_trunks, get_trunk_configuration | create_trunk, delete_trunk, update_trunk | — |
| tts-engines | list_tts_engines | update_tts_engine | — |
| users | list_portal_users, describe_portal_user | — | — |
| voice-robots | list_voice_robots, describe_voice_robot | — | — |
| voicemail | list_voicemail_messages, get_voicemail_message | — | — |

## Закрытые пробелы

- Реестр ранее проверял наличие домена через заглушки, а не возможность настроить параметр. Добавлена проверка реальных фабрик, MCP discovery, навыков, конфигурационных операций и лимита 128 инструментов.
- Добавлен get_configuration_capabilities: точные схемы операции/поля, доступные инструменты домена, требования подтверждения и фактическая регистрация. Большие advanced-схемы можно читать по одному полю.
- Абоненты и транки: get/update вместо удаления и пересоздания; публичные основные и расширенные PJSIP-параметры, ACL, BLF/WebRTC, перехват и провижинг. Общий каталог полей вынесен в shared, чтобы форма и агент не расходились. Каталоги групп/шаблонов и принадлежность tenant проверяются.
- Контексты: два независимых основных назначения; обязательный контекст, никаких догадок по существующим абонентам. Два UID в tenant_settings, одна scalar-запись на тип, общий transaction и compare-and-clear. Занятый основной нельзя заменить: сначала снять признак у прежнего, затем назначить новый; сервер проверяет под блокировкой записи. В модалке занятые другим контекстом признаки скрыты, таблица показывает выбранные назначения. Не меняет контексты существующих объектов.
- Маршруты: update_route, active и публичные recording options. Частичный options patch сохраняет настройки аналитики/музыки. Аналитика имеет отдельный инструмент с проверкой проекта; raw dialplan/pre_command не входят в новую generic-схему.
- Очереди: основные, announcement и advanced-параметры, расширенные поля членов; стратегия linear/wrandom; полное чтение get_queue_configuration. Ссылки участников и state_interface проверяются внутри кабинета.
- Группы вызова: update_call_group для стратегии, ring_time, CallerID и подтверждения внешнего вызова; состав сохраняется при изменении настроек.
- MOH: sort существующего класса; prompts: comment/description; notifications: публичный config с merge и сохранением credentials; STT/TTS: имя/активность tenant-провайдера без платного запуска.
- Исправлена ложная трактовка конфигурации уведомлений как истории доставок. SMS/Telegram, voice-robots и voicemail классифицированы по фактической текущей read-поверхности.
- Пароль нового auth-транка: защищённое поле подтверждения, передача только в execution context. Запрещён в model args/canonical args, persisted plan, audit и ответе; прямой createProposal также проверяет секреты. Проверка перенесена из одного MCP-пути в общий parse-контракт.
- Карточки показывают before/after, сохраняют серверные шаги workflow, не показывают секреты; applied invalidation обновляет затронутые каталоги интерфейса.
- Убран IVR/group-9010 шаблон из общего продолжения подтверждения; добавлен platform-configuration skill, обновлены предметные навыки и RU/EN подписи инструментов.
- Текстовое «подтверждаю / примени» применяет последнюю карточку текущего tenant/author/thread, а не создаёт новый сценарий. При protected input выполнение не начинается; после применения обновляются карточка и каталоги UI.
- Исправлена нормализация контекстов транков: готовые ctx-100 / ctx-100-ext не обрезаются и не получают второй tenant suffix.

## Рабочие схемы

1. Уточнение продолжает исходную задачу: цель/факты из всей истории → чтение сущностей → точная schema → только запрошенный patch → проверяемая карточка → confirmation → перечитать конфигурацию.
2. Контекст и абоненты: create_context с основным назначением → create_endpoint/bulk с зависимостью; compiler учитывает будущие имена и смену основного. Для маршрута в новом контексте нужен реальный UID: после первого подтверждения list_contexts и второй план; не выдумывать числовую ссылку.
3. SIP-провайдер: прочитать текущий транк/контекст → create/update с известными фактами провайдера → пароль через защищённую карточку → проверить сохранённые настройки и отдельно регистрацию.
4. Входящий DID/рабочие часы: контексты, существующие маршруты, календарь и реальные назначения → план с условиями и сохранённым порядком шаблонов → dialplan reload → чтение цепочки/диагностика вызова.
5. Очередь/группа: абоненты и текущий состав → разделить timeout оператора, общее ожидание и последующий шаг маршрута → patch очереди/группы → перечитать сохранённую конфигурацию, отдельно live state.
6. Ошибка применения: applied шаги не выполнять повторно; при committed write повторять только reload; неоднозначный результат записи требует reconciliation. Секрет после ошибки вводится повторно и не берётся из истории.

## Границы и оставшиеся ограничения

Наличие mutation не означает полный CRUD и все поля каждого модуля. Фактическую схему показывает discovery. Остались операции профильных интерфейсов: загрузка/пересинтез аудио; новые credentials уведомлений/AI-провайдеров и ротация паролей; редактирование файловых шаблонов провижинга; часть advanced call-group media/context настроек; конфигурация callcenter сверх live pause/unpause; полный CRUD autodial/voice-robots; управление глобальными транспортами SMS/Telegram. Voice runtime/AI product configuration принадлежит отдельной активной инициативе и этой работой не изменён. Tenant identity, RBAC, billing и platform administration не превращаются в tenant tools.

Навыки требуют объяснить конкретное ограничение и указать профильный экран, сохраняя уже выполненные части запроса. Нельзя обходить отсутствие операции произвольным HTTP/SQL или выдавать сохранение за успешный реальный звонок. Реальные звонки, внешний провайдер и live LLM пока не проверены в этой сессии.

## Проверки

Обязательные lint/backend/frontend пройдены: backend 381 suites / 3588 pass / 11 skip; frontend 312 файлов / 1641 pass; lint без ошибок, backend 116 / frontend 85 warnings. Shared 69 pass; оба TypeScript checks pass. Последняя stream/card delta: 35 pass; контекстные транзакции/план: 8 pass. Полные статусы и границы evidence — в EXECUTION. Unit fixtures проверяют контекстные зависимости, CAS/tenant settings, частичные изменения, protected confirmation, отсутствие секретов, RBAC и повторные применения. Они не заменяют live database / SIP / LLM evidence.

## Обновление контекстов / маршрутов — 2026-10-08

get_context_configuration показывает прямые включения с именами и own-first depth-first поиск из БД. apply_context — каноническая подтверждаемая операция повторного применения без записи. update_context использует центральный checkpoint перед reload: switch_failed позволяет повторить только reload. create_context при ошибке АТС возвращает сообщение с сохранённым UID для отдельного apply_context, не повторного create. Проверяются граф и tenant перед карточкой и при подтверждении, финальная транзакционная защита остаётся в ContextsService. Карточки показывают порядок имён до/после. Обновлены contexts/routes/endpoints/trunks/pbx-setup/platform-configuration и knowledge адаптеров; UI/route_type не являются альтернативной ACL.

Проверки R6: backend build и scoped ESLint PASS; 6 suites / 77 tests PASS, последняя ORM/getter/adapter/checkpoint/registry/skills delta: 4 suites / 43 tests PASS. Live LLM и новые вызовы АТС в R6 не выполнялись; предыдущие изолированные R5 HTTP/DB/AMI/Local tests приведены в ROUTES-CONTEXTS-REFACTOR-PLAN.md.

## Caller ID v2 — R11, 2026-10-09

Existing route mutation tools accept Caller ID version 2 with independent number/name sources and transformations. The routes action schema description, runtime shared validation, tenant/field-type preflight, catalog summaries, knowledge and routes/pbx-setup/platform-configuration skills were updated. Discovery remains 119 tools; no separate arbitrary dialplan execution tool was added.

The assistant must read tenant directories/fields/lists before referencing them, distinguish strict key mapping from first/random/round-robin selection, explain snapshot semantics and use a following step for lookups by the changed number. Missing/error policies and legacy conversion changes belong in the proposed diff explanation. Confirmed writes follow the existing mutation workflow.

Evidence: registered-capabilities and routes adapter/preflight tests passed; live Asterisk cases are in artifacts/callerid-app-v2-live.json and the bounded list/pool follow-up in artifacts/callerid-app-v2-mapping-live.json. These prove configuration/runtime behavior; no live LLM conversation is claimed.
