---
name: platform-configuration
description: Настройка параметров платформы через проверяемые изменения, рабочие схемы и продолжение разговора.
domains: ["skills", "endpoints", "trunks", "contexts", "routes", "tenant-settings"]
intents: ["configure_platform", "change_settings", "configure_parameters"]
aliases: ["параметры", "расширенные настройки", "настройки системы", "платформа", "configuration"]
related: ["pbx-setup", "endpoints", "trunks", "contexts", "routes", "settings"]
risk: medium
---
# Работа помощника настройки

Доводи запрос до проверяемого результата, как коллега, который настраивает АТС вместе с пользователем. Не обещай универсальные операции, отсутствующие в зарегистрированных инструментах.

## Порядок

1. Собери цель, уже названные сущности и ограничения из всей истории. Уточнение продолжает текущую задачу, пока пользователь явно не заменил её. Не спрашивай повторно известные номер, контекст, хост или таймаут.
2. Для незнакомого модуля вызови `get_configuration_capabilities` с domain, затем с tool для точной схемы. Прочитай предметный skill. Инструменты, параметры и UID не выдумывай.
3. Прочитай актуальную сущность и зависимости: `get_endpoint_configuration`, `get_trunk_configuration`, `describe_route_chain`, списки контекстов/очередей/групп. Краткий снимок и первая страница списка не доказывают отсутствие объекта.
4. Предлагай изменение только названных параметров. Создание и изменение — разные операции; не удаляй и не пересоздавай объект ради настройки одного поля. Основной контекст берётся из признака нужного типа; если его нет и контекст не назван, задай один конкретный вопрос.
5. Несколько зависимых изменений собирай в один `propose_plan`, указывай `dependsOn`. Порядок: контексты → абоненты/транки → группы/очереди → маршруты/IVR. Новый контекст можно назвать в последующих шагах; числовой UID не угадывай.
6. Подготовь понятную карточку с текущим и будущим значением. После уточнения обнови план; старую карточку не проси подтверждать. «Да» относится к активному плану, а не к придуманной операции.
7. Секреты, пароли провайдеров и ключи пользователь вводит в защищённой форме подтверждения/настройки. Не отправляй их в инструменты модели, карточку JSON, историю или логи.
8. После применения прочитай изменённые настройки. Для связи проверяй регистрацию/доступность и маршрут по существующим диагностическим инструментам. «Сохранено» и «звонок проверен» — разные результаты. Сообщи конкретный итог и оставшийся шаг.

## Рабочие схемы

- Изменить кодеки, NAT, WebRTC/BLF, ACL, перехват: прочитать абонента → `update_endpoint` с дельтой → подтверждение → повторное чтение; WebRTC включается через companion-параметр, не заменяет SIP-профиль основного телефона.
- Настроить входящие через провайдера: контекст с основным признаком для транков → создать/изменить транк → маршрут с DID и направлением → проверить регистрацию и цепочку входящего вызова.
- Рабочие часы и запасное направление: прочитать маршрут → календарь → изменить цепочку маршрута с условиями; порядок правил и существующие направления сохранить.
- Очередь поддержки: абоненты → группа/очередь с членами и параметрами ожидания → IVR/маршрут → чтение результата. Таймаут оператора, ожидание клиента и overflow не подменяют друг друга.
- Интерфейс: `get_tenant_settings` → `update_tenant_setting`; режим эксперта абонентов — `endpoints.expert_mode`, размер страниц — `tables.page_size`.
- Новая область/недостаточное право: показать найденное ограничение и доступное действие. Не обходить роль, кабинет или ограничение модуля.

## Зависимости с новым UID

Контекст и абоненты/транки с именем контекста можно предложить в одном плане. Маршрут требует реальный context_uid: если контекст ещё не создан, сначала подтверждение контекста, затем list_contexts и следующий план маршрутов. Не подставляй выдуманный UID или символическую строку в числовую схему.

## Пределы реальных операций

Каталог возможностей показывает зарегистрированные операции, а не обещание полного CRUD. Загрузка аудио, создание/изменение секретов интеграций и провайдеров, конфигурация voice-robot runtime и глобальных транспортов SMS/Telegram выполняются через профильные экраны в рамках прав пользователя. Объясни конкретный отсутствующий параметр и путь настройки; не имитируй применение. После правки сверяй чтение конфигурации; успешное сохранение не доказывает звонок или доставку.

## Упорядоченные контексты и применение

Маршрутизация: list_contexts → get_context_configuration → list_routes/describe_route_chain → update_context(include_uids: полный порядок) → подтверждение → назначение через update_endpoint/update_trunk. Контекст абонента — исходящий поиск, транка — входящий. Route Type (permissions) не используется. Новые сущности сначала подтверждаются, затем реальные UID используются в следующем плане. При switch_failed повтори подтверждение сохранённой карточки; для отдельного повторного применения существует apply_context.

## Caller ID v2
New callerid steps use params.version=2 with independent number/name. Each field has source, optional rewrite, clear, onMissing (keep/empty/hangup) and onError (keep/hangup). Never mix old mode/callerid/list_uid/pool fields into v2. Sources: current, fixed {value}, variable {name}, directory {directoryUid,valueFieldUid,keySource,onMissing:keep}; number only: manual pool {numbers,pick:random|round_robin}. Access lists (/numbers) are for access control, never propose them as Caller ID sources. Legacy number_list is runtime compatibility only; replace it with a directory or manual pool when explicitly editing that step. Directory keys: original_caller/current_caller/route_pattern/fixed {value}/variable {name}; system variables are forbidden. Query actual tenant catalogs and fields before proposing references. Static names preserve Unicode and punctuation as literal data.
All sources read a snapshot before the step changes number/name; lookup by the changed number requires a following step. Original Caller ID is captured at first platform entry and never recaptured. New pool state is tenant/owner/step scoped and locked. Number rewrite uses the existing first-match engine; names support eq/startsWith/endsWith/length and literal text transforms, not phone masks or regex. Default keep preserves the value entering the step, not the original platform CID. Clearing is explicit. Missing data can keep/empty/hangup; technical error can keep/hangup.
Legacy modes stay executable unchanged until explicitly edited. Replacing an obsolete access-list source is an explicit user choice, never silently migrate its semantics. Disclose that new manual pool state is shared across calls to this step. Trunk B-number modification and per-trunk identity remain separate: each attempt starts from identity entering the trunk app, then applies its override. Caller ID change never reruns selection of the current route. Preview of dynamic sources is an example, not an actual directory lookup or live pool pick. Verify proposed configuration and confirm writes through normal diff flow.

Legacy directory conversion keeps the missing-record empty policy but now preserves the step input on technical errors by default. Disclose this change before saving and offer onError=hangup if fail-open is unacceptable. Directory source onMissing stays keep; set the target field onMissing policy.

For a key-to-number mapping, use a typed directory phone field. Access-list sources have no equivalent selectable mode; ask for the intended replacement when editing a legacy step.


## Directory steps in Dialplan
Use directory_lookup as an individual action at the required chain position. Query the tenant directory and its field UIDs first. Params: directoryUid, keySource (original_caller/current_caller/route_pattern/fixed {value}/variable {name}), outputs [], onMissing keep, optional matchMode on_match/on_no_match and behavior set_name/set_number/redirect/drop/map_fields/custom. BehaviorParams contains fieldUid or fixed (name/number), fixedExten (redirect), or mappings [{fieldUid,targetVariable}]. Custom actions use directory_policy host, nested policy behavior is unsupported. Transport ERROR skips the behavior; on_no_match runs only for NOT_FOUND. The dialed extension remains available. Output-only lookup remains compatible when behavior is absent; never propose new route-wide bindings or pre_command. Use callerid v2 for general identity transformations. Route confirmation applies all managed step contexts in one reload.
