# Аудит поверхности AI / MCP — 2026-09-17

Каталог получен через аутентифицированный tools/list локального backend с текущей БД: 92 инструментов, 27 skills. Таблица сверяет каталог с исходниками адаптеров и module-coverage.registry. Это структурная инвентаризация, **не доказательство работоспособности всех CRUD или сценариев**. Общие фасады могут находиться в соседнем модуле.

| Модуль | Заявлено в registry | Реальные инструменты в адаптере | Skills |
|---|---|---|---|
| ai-agents | infrastructure | — | — |
| ai-chat | covered / read | get_pbx_state, propose_plan | diagnostics |
| ai-platform | covered / read | — | developer-convention |
| ami | infrastructure | — | — |
| ari | infrastructure | — | — |
| auth | infrastructure | — | — |
| autodial | covered / configure | list_autodial_campaigns, list_autodial_bases, get_autodial_stats, pause_autodial_campaign, add_autodial_dnc | autodial |
| call-groups | covered / configure | list_call_groups, create_call_group, update_call_group_members, delete_call_group | call-groups |
| callback-requests | excluded | — | — |
| callcenter | covered / operation | cc_get_queue_snapshot, cc_get_agents, cc_get_today_kpi, cc_force_pause_agent, cc_force_unpause_agent | callcenter |
| cloud-admin | excluded | — | — |
| conferences | covered / configure | list_conference_rooms, create_conference_room, update_conference_room, cf_force_mute_participant, cf_force_kick_participant | conferences |
| config | infrastructure | — | — |
| contexts | covered / configure | list_contexts, create_context, update_context, delete_context | contexts |
| diagnostics | covered / read | get_live_channels, get_recent_call_events, get_compiled_dialplan, get_endpoint_registration | call-support, diagnostics, registration-support |
| dialplan-bridge | infrastructure | — | — |
| dialplan-dry-run | covered / operation | dialplan_dry_run | routes |
| directories | covered / configure | list_directories, create_directory, update_directory, delete_directory, list_directory_records, add_directory_records, remove_directory_records | directories |
| endpoints | covered / configure | list_endpoints, create_endpoint, create_endpoints_bulk, delete_endpoint | endpoints, registration-support |
| health | infrastructure | — | — |
| ivrs | covered / configure | list_ivrs, create_ivr, update_ivr, delete_ivr | ivrs |
| komandor-claims | covered / operation | list_claims | operations |
| logger | infrastructure | — | — |
| mailer | infrastructure | — | — |
| mcp | infrastructure | — | — |
| moh | covered / configure | list_moh_classes, describe_moh_class, assign_moh_class | moh |
| notifications | covered / configure | list_notifications | operations |
| numbers | covered / read | list_numbers, describe_number | numbers |
| plan | covered / configure | — | pbx-setup |
| prompts | covered / configure | list_audio_prompts | operations |
| queues | covered / configure | list_queues, create_queue, update_queue, delete_queue | queues |
| redis | infrastructure | — | — |
| reports | covered / read | get_cdr_summary, find_cdr_calls | reports |
| roles | infrastructure | — | — |
| route-references | excluded | — | — |
| route-templates | covered / read | list_templates, apply_template, build_from_description | routes |
| routes | covered / configure | list_routes, list_dialplan_apps, describe_route_chain, create_route, delete_route | call-support, routes |
| service-requests | covered / operation | list_service_requests | operations |
| sms | covered / configure | get_sms_channel, list_sms_deliveries | messaging |
| stt-engines | covered / configure | list_stt_engines | speech-engines |
| system-settings | covered / immutable | get_platform_settings | settings |
| telegram | covered / configure | get_telegram_channel, list_telegram_deliveries | messaging |
| tenant-settings | covered / configure | get_tenant_settings, update_tenant_setting | settings |
| time-groups | covered / configure | list_time_groups, evaluate_time_group, create_time_group, update_time_group | call-support, time-groups |
| trunks | covered / configure | list_trunks, create_trunk, delete_trunk | trunks |
| tts-engines | covered / configure | list_tts_engines | speech-engines |
| users | covered / immutable | list_portal_users, describe_portal_user | users |
| voice-robots | covered / configure | list_voice_robots, describe_voice_robot | voice-robots |
| voicemail | covered / configure | list_voicemail_messages, get_voicemail_message | voicemail |

## Расхождения и недостающие операции

- `configure` в registry часто означает только наличие адаптера: voice-robots, voicemail, prompts, speech engines, SMS/Telegram/notifications имеют преимущественно чтение. Статус нельзя использовать как процент готовности продукта.
- Абоненты: создать/пакет/удалить; нет update_endpoint. Транки: создать/удалить; нет update_trunk. Маршруты: создать/удалить; нет update_route. Для редактирования нужен контракт diff/revalidate/apply с сохранением ссылок.
- Конференции: добавлено создание. Приглашения, гостевые права, модераторы, участники/состояние комнаты, запись и восстановление доставки диалплана требуют отдельных контрактов и UAT.
- Пользователи и тарифы: создание сотрудников через защищённый REST/UI; AI не должен выдавать себе права или менять подписку. Регистрация организации — отдельный onboarding.
- Нет безопасного tenant-scoped инструмента чтения Asterisk full/queue_log с correlation ID и редактированием секретов. CDR и AMI-снимок не заменяют такие логи.
- Нет единой матрицы модуль × сущность × CRUD × право × транспорт × модель × живой сценарий. Эта таблица — начальная инвентаризация для её построения.

## Полный живой каталог MCP

| Tool | Назначение |
|---|---|
| `list_skills` | Catalog of available skills: name and one-line description only. Use read_skill for the body. |
| `read_skill` | Read one skill body by name. Catalog entries never include the body. |
| `get_telegram_channel` | Состояние Telegram-канала тенанта: настроен и включён или нет. Токен и webhook secret не возвращаются. Отправка недоступна. |
| `list_telegram_deliveries` | Недавние попытки доставки Telegram тенанта: статус и время. Текст сообщения не отдаётся. Отправка и повтор недоступны. |
| `list_endpoints` | Точечная проверка абонентов: всегда передавай extensions ("101-103" или "101,102"). Без фильтра вернётся только счётчик и короткий образец, не весь список. Без SIP id и без изменений. |
| `create_endpoint` | Предлагает создать одного SIP-абонента. Номер и контекст по умолчанию берутся из абонентов тенанта. Пароль не возвращается. |
| `create_endpoints_bulk` | Предлагает создать пачку SIP-абонентов по паттерну или count+startExtension. Один proposal на всю пачку. Потолок 50. |
| `delete_endpoint` | Предлагает удалить SIP-абонента по внутреннему номеру. Деструктивная операция, только внутри тенанта. |
| `get_tenant_settings` | Настройки тенанта по областям с текущими значениями. Секреты — только configured/not configured. |
| `update_tenant_setting` | Изменяет allowlisted value-флаг тенанта (например routes.show_flowchart). Секреты и identity запрещены. |
| `list_tts_engines` | TTS-движки тенанта: имя, вендор, enabled, безопасные capabilities и configured. Без ключа, URL и заголовков. Синтез недоступен. |
| `list_call_groups` | Список групп вызова тенанта: номер, стратегия и состав. Без изменений. |
| `create_call_group` | Предлагает создать группу вызова. Члены-абоненты проверяются по тенанту. |
| `update_call_group_members` | Предлагает заменить состав группы. В карточке — кого добавляем и кого убираем, не итоговый список. |
| `delete_call_group` | Предлагает удалить группу. В карточке — маршруты и меню, которые на неё звонят. |
| `list_time_groups` | Список расписаний тенанта с интервалами в читаемом виде. Без изменений. Оценка «сейчас внутри/снаружи» — evaluate_time_group. |
| `evaluate_time_group` | Отвечает, находится ли названное расписание внутри своих интервалов в поясе тенанта, и когда состояние следующее изменится. |
| `create_time_group` | Предлагает создать календарь (time group) с интервалами. На маршрут вешается через condition.time_group_uid. |
| `update_time_group` | Предлагает изменить имя, комментарий или интервалы существующего календаря тенанта. |
| `list_contexts` | Возвращает все контексты маршрутизации с UID. Используй перед create_route. |
| `create_context` | Создаёт контекст маршрутизации. Нужны name и опциональный comment. |
| `update_context` | Изменяет имя или комментарий контекста по uid. |
| `delete_context` | Удаляет контекст по uid. Деструктивная операция. |
| `list_queues` | Список очередей тенанта: стратегия, timeout, overflow и состав. Без изменений. |
| `create_queue` | Предлагает создать очередь. overflow и члены проверяются по сущностям тенанта. |
| `update_queue` | Предлагает изменить очередь. Смена стратегии, состава или overflow — маршрутизация, не безопасная правка. |
| `delete_queue` | Предлагает удалить очередь по имени. В карточке — маршруты и меню, которые на неё шлют. |
| `list_ivrs` | Список голосовых меню тенанта с картой цифр и назначениями. Без изменений. |
| `create_ivr` | Предлагает создать голосовое меню. Каждая цифра должна указывать на существующее назначение тенанта. |
| `update_ivr` | Предлагает изменить голосовое меню. Смена цифры — изменение маршрутизации, не безопасная правка. Назначение должно существовать у тенанта. |
| `delete_ivr` | Предлагает удалить голосовое меню по UID. Деструктивно, только внутри тенанта. |
| `list_directories` | Список справочников тенанта: uid, имя, описание, поля, число записей. Полные записи — через list_directory_records. |
| `create_directory` | Создаёт справочник. Нужны name, lookupFieldKey, key_normalization, fields. records опциональны. |
| `update_directory` | Изменяет справочник. records полностью заменяет текущий список. Для добавления записей используй add_directory_records. |
| `delete_directory` | Удаляет справочник, если на него нет ссылок в маршрутах и действиях. Деструктивная операция. |
| `list_directory_records` | Полные записи справочника (values по ключам полей). |
| `add_directory_records` | Добавляет записи инкрементально. Существующие записи сохраняются. |
| `remove_directory_records` | Удаляет записи по lookup_values или record_uids. Деструктивная операция. |
| `list_trunks` | Список транков тенанта: id, имя, хост, тип (auth/ip). Без паролей. |
| `create_trunk` | Предлагает создать исходящий SIP-транк. Тип auth — регистрация, ip — пиринг. |
| `delete_trunk` | Предлагает удалить транк. В карточке — маршруты, которые на него ссылаются. Деструктивно. |
| `list_routes` | Список маршрутов тенанта: контекст, шаблоны и краткая цепочка. Без изменений. |
| `list_dialplan_apps` | Каталог приложений редактора маршрутов/IVR: тип, зачем, обязательные поля, сколько раз уже есть у тенанта. Не сырые приложения Asterisk. |
| `describe_route_chain` | Собранная цепочка действий всех маршрутов контекста по приоритету. Без изменений. |
| `create_route` | Предлагает создать маршрут как типизированную цепочку действий. Не принимает сырое приложение Asterisk и аргументы. |
| `delete_route` | Предлагает удалить маршрут по UID. Деструктивно, только внутри тенанта. |
| `get_platform_settings` | Лимиты и возможности платформы для вызывающего тенанта. Не сырая таблица настроек. Секреты и чужие квоты недоступны. Изменить нельзя. |
| `list_portal_users` | Список пользователей портала тенанта: имя, роль, последняя активность. Без паролей и без изменения ролей. |
| `describe_portal_user` | Один пользователь портала: имя, роль, активность. Секреты и смена роли недоступны. |
| `get_cdr_summary` | Сводка CDR за период: количество звонков, ASR, средняя длительность. Параметры dateFrom/dateTo в формате YYYY-MM-DD. |
| `find_cdr_calls` | Поиск звонков CDR (одна запись на звонок, GROUP BY linkedid). Лимит до 50. |
| `list_voice_robots` | Список голосовых роботов тенанта: статус и точки входа (маршруты, которые на них ссылаются). Состояние движков — describe_voice_robot. |
| `describe_voice_robot` | Один робот: сценарий (приветствие, группы) и речевые движки с configured/missing. Битую ссылку не пропускает. Изменить робота нельзя. |
| `list_conference_rooms` | Список комнат тенанта: uid, короткий номер и имя. Без SIP, канала и ConfBridge id. Без изменений. |
| `create_conference_room` | Подготовить создание внутренней комнаты конференций. Требует подтверждения. Без гостевых ссылок и PIN; запись по умолчанию выключена. |
| `update_conference_room` | Предлагает изменить настройки существующей комнаты тенанта. Не пишет сразу — только diff. |
| `cf_force_mute_participant` | Заглушить участника живой комнаты. Деструктивная операция — confirm/dispatch, не draft. |
| `cf_force_kick_participant` | Исключить участника из живой комнаты. Деструктивная операция — confirm/dispatch, не draft. |
| `get_sms_channel` | Состояние SMS-канала тенанта: настроен и включён или нет. Токен и секреты не возвращаются. Отправка недоступна. |
| `list_sms_deliveries` | Недавние попытки доставки SMS тенанта: статус и время. Тело сообщения не отдаётся. Отправка и повтор недоступны. |
| `list_notifications` | Недавние уведомления тенанта: канал, статус, время и усечённое превью. Отправка недоступна. |
| `cc_get_queue_snapshot` | Сводка очередей КЦ тенанта: waiting/talking, агенты (total/available/paused), SLA и counters за сегодня. |
| `cc_get_agents` | Список агентов КЦ тенанта со статусами, паузами и очередями. |
| `cc_get_today_kpi` | KPI очередей за сегодня из in-memory аккумуляторов: SLA, answered, abandoned, avgWait, avgTalk. |
| `cc_force_pause_agent` | Принудительно поставить агента на паузу (supervisor force-pause). Деструктивная операция — требует confirm. |
| `cc_force_unpause_agent` | Снять агента с паузы (supervisor force-unpause). Деструктивная операция — требует confirm. |
| `list_numbers` | Список номеров тенанта со статусом и назначенным маршрутом. Куда ведёт номер — describe_number. |
| `describe_number` | Один номер: статус, маршрут и текущее назначение. Если маршрута нет — unrouted, не пропуск. |
| `get_live_channels` | Живые каналы вызывающего тенанта. Общий свитч фильтруется по своим контекстам и endpoint. Усечение сообщается. |
| `get_recent_call_events` | Недавние события звонков тенанта в ограниченном окне и количестве. Не причина сама по себе — только улика. |
| `get_compiled_dialplan` | Скомпилированные правила одного своего контекста в порядке оценки. Чужой контекст отвергается. |
| `get_endpoint_registration` | Проверить регистрацию своего SIP-абонента в Asterisk по внутреннему номеру. Только состояния; без паролей и raw AuthDetail. |
| `list_audio_prompts` | Аудиоподсказки тенанта: имя, длительность и сущности, которые на них ссылаются. Без аудио и без путей. |
| `list_stt_engines` | STT-движки тенанта: имя, вендор, enabled, безопасные capabilities и configured. Без ключа, URL и заголовков. Транскрипция недоступна. |
| `list_moh_classes` | Список классов музыки на удержании тенанта: режим и число треков. Без аудио. |
| `describe_moh_class` | Один класс и упорядоченные имена треков. Без байтов и без путей к файлам. |
| `assign_moh_class` | Предлагает назначить класс очереди или маршруту. Класс должен принадлежать тенанту. Загрузка аудио недоступна. |
| `list_service_requests` | Обращения тенанта: статус, время и усечённая тема. Полный текст и контакты не отдаются. Создание недоступно. |
| `list_claims` | Претензии тенанта: статус, время и усечённая тема. Полный текст и контакты не отдаются. Изменение недоступно. |
| `dialplan_dry_run` | Прогон черновика маршрута или IVR без Asterisk. Те же поля, что POST /dialplan/dry-run. Тенант берётся из vpbxUserUid вызова, не из тела. |
| `list_templates` | Список шаблонов маршрутов тенанта: встроенные и свои. Возвращает uid, имя, слоты, число действий. |
| `apply_template` | Подставляет слоты шаблона и возвращает новую цепочку actions. Dialplan не применяется. |
| `build_from_description` | Собрать черновик шаблона из текстового описания. В этой фазе возвращает пустой draft (Phase 15 заполнит). |
| `list_voicemail_messages` | Список сообщений голосовой почты тенанта: uniqueid, caller, exten, две оси статуса, краткое summary. Без URL воспроизведения. |
| `get_voicemail_message` | Одно сообщение голосовой почты по uniqueid в пределах тенанта. Чужой uniqueid — not-found. Без URL воспроизведения. |
| `list_autodial_campaigns` | Кампании автообзвона тенанта: статус, режим набора, база, очереди, счётчики обработанных и необработанных задач. Без изменений. |
| `list_autodial_bases` | Клиентские базы автообзвона: схема пользовательских полей, политика дедупликации, число контактов. Без изменений. |
| `get_autodial_stats` | KPI автообзвона за период: наборы, отвеченные, успешные, contact rate, RPC, AHT, ACD, звонков в час. Даты YYYY-MM-DD. |
| `pause_autodial_campaign` | Предлагает поставить кампанию автообзвона на паузу. Новые звонки прекращаются, текущие доигрывают. |
| `add_autodial_dnc` | Предлагает внести номер в стоп-лист автообзвона (Do Not Call). Действующие задачи с этим номером больше не набираются. |
| `get_pbx_state` | Compact tenant PBX snapshot: per-domain counts and a bounded name sample. Optional domain filter (endpoints, trunks, ivrs, queues, contexts, adapters). |
| `propose_plan` | Собрать несколько мутаций в один план (одна карточка). Две и более сущности в одном запросе — этот инструмент, не серия create_*. |

## Действия диалплана после сверки required params

Сокращённый каталог возвращает все типы в пределах бюджета; `types` выбирает подробности до трёх типов. Это устраняет потерю конца JSON при ограничении tool result 4000 символами.

| Тип | Название | Обязательные параметры |
|---|---|---|
| totrunk | Набор через транк | trunk, dest |
| toexten | Внутренний абонент | target |
| toqueue | Очередь | target |
| togroup | Группа вызова | target |
| tolist | Обзвон списка | numbers |
| toivr | Голосовое меню | ivr_uid |
| toroute | В другой контекст | context |
| playback | Проиграть файл | file |
| notify | Уведомление | channel |
| callerid | Подменить CallerID | number |
| voicemail | Голосовая почта | target |
| text2speech | Произнести текст | text |
| voicerobot | Голосовой робот | robot_uid |
| webhook | Webhook | url |
| confbridge | Конференция | room |
| cmd | Команда Asterisk | command |
| label | Метка | label_name |
| goto | Переход к метке | label_name |
| schedule | Расписание | intervals |
| http_request | HTTP-запрос | url |
| collect_input | Сбор DTMF | variableName |
| hangup | Завершить вызов |  |
| directory_lookup | Поиск в справочнике | directoryUid |
| callback | Обратный звонок | queue |
