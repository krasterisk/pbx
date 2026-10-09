---
name: pbx-setup
description: Сквозной рецепт первичной настройки АТС — контексты, транк, абоненты, группа, IVR, входящий DID-маршрут и проверка.
domains: ["pbx-setup"]
intents: ["pbx_setup", "greenfield_pbx", "inbound_did_setup"]
aliases: ["настрой атс", "pbx setup", "первичная настройка", "greenfield"]
related: ["contexts", "trunks", "endpoints", "call-groups", "ivrs", "routes", "time-groups", "diagnostics"]
risk: high
---

# Сквозная настройка АТС (pbx-setup)

Оркестрационный рецепт. Не дублируй схемы доменных skills — читай их через `read_skill` / серверный injection и вызывай их mutation tools.

## Порядок зависимостей

1. **Собрать DID / provider requirements.** Нужны: точный DID pattern входящего маршрута (это `route.extensions` / pattern, **не** модуль `numbers`), тип транка (IP-peering или auth), имена контекстов, диапазон абонентов, IVR/группа.
2. **Контексты.** `list_contexts` → при отсутствии создать internal и inbound через `create_context`. Не выдумывай UID.
3. **Транк.** `list_trunks` → `create_trunk`. Для auth-trunk остановись на secure-input (пароль не принимай в chat/tool args). IP-peering проходит полностью диалогом.
4. **Абоненты.** `list_endpoints` только с фильтром названных номеров. `create_endpoints_bulk` сам оставит лишь отсутствующие; уже существующие в план не попадают.
5. **Группа.** Одна call-group на таймаут/очередь ожидания. Свободный `exten` 6xxx подставь сам — не спрашивай.
6. **IVR.** Перед цепочкой цифр — `list_dialplan_apps(host=ivr)`. `create_ivr`: цифры — типы из этого каталога (`destination` = первый шаг; после группы на `t` при необходимости `totrunk` / `hangup`). Greeting из brief.
7. **Календарь (если названы часы).** `list_time_groups` → `create_time_group` при отсутствии. На рабочем действии маршрута — `condition.time_group_uid`.
8. **Входящий DID route.** Exact-DID inbound route с typed `toivr` на созданное меню. Pattern = точный DID, не catch-all `_X.` выше emergency.
9. **Проверка.** Route/dialplan dry-run → compiled dialplan / lab verification если доступно.

## Частичная конфигурация

Если сущности уже есть — строй только недостающие/изменяемые шаги. Идемпотентность важнее «создать заново».

## Обязательные факты

Не придумывай: context UID, tenant suffix. Group extension и TTS-движок выбери сам (6xxx / Yandex или первый из списка). Отсутствующий обязательный факт, который нельзя выбрать, → **один** точный вопрос **без** карточки.

## HITL

План строится вызовом `propose_plan` — одна workflow-карточка на весь заказ, не серия `create_*`. Порядок шагов = порядок зависимостей: шаг ссылается на результат предыдущего (`steps.<id>.result.<поле>`). Apply идёт последовательно; при ошибке оставшиеся шаги `pending`, уже применённые `applied`. Не обещай атомарность БД↔AMI.

## Упорядоченные контексты и применение

Для классов доступа создавай контексты направлений и контекст абонента с упорядоченными include_uids. Читай list_contexts/get_context_configuration; подтверждай создание и получай UID. Следующим планом добавляй маршруты/включения, затем назначай контексты абонентам. Входящий контекст транка настрой отдельно. Свои правила раньше включений, вложения в глубину; route_type не используется. При ошибке АТС после сохранения перечитай состояние и повтори применение карточки либо предложи apply_context, не создавай сущности повторно. Порядок include не является резервированием транков.

## Caller ID v2
New callerid steps use params.version=2 with independent number/name. Each field has source, optional rewrite, clear, onMissing (keep/empty/hangup) and onError (keep/hangup). Never mix old mode/callerid/list_uid/pool fields into v2. Sources: current, fixed {value}, variable {name}, directory {directoryUid,valueFieldUid,keySource,onMissing:keep}; number only: manual pool {numbers,pick:random|round_robin}. Access lists (/numbers) are for access control, never propose them as Caller ID sources. Legacy number_list is runtime compatibility only; replace it with a directory or manual pool when explicitly editing that step. Directory keys: original_caller/current_caller/route_pattern/fixed {value}/variable {name}; system variables are forbidden. Query actual tenant catalogs and fields before proposing references. Static names preserve Unicode and punctuation as literal data.
All sources read a snapshot before the step changes number/name; lookup by the changed number requires a following step. Original Caller ID is captured at first platform entry and never recaptured. New pool state is tenant/owner/step scoped and locked. Number rewrite uses the existing first-match engine; names support eq/startsWith/endsWith/length and literal text transforms, not phone masks or regex. Default keep preserves the value entering the step, not the original platform CID. Clearing is explicit. Missing data can keep/empty/hangup; technical error can keep/hangup.
Legacy modes stay executable unchanged until explicitly edited. Replacing an obsolete access-list source is an explicit user choice, never silently migrate its semantics. Disclose that new manual pool state is shared across calls to this step. Trunk B-number modification and per-trunk identity remain separate: each attempt starts from identity entering the trunk app, then applies its override. Caller ID change never reruns selection of the current route. Preview of dynamic sources is an example, not an actual directory lookup or live pool pick. Verify proposed configuration and confirm writes through normal diff flow.

Legacy directory conversion keeps the missing-record empty policy but now preserves the step input on technical errors by default. Disclose this change before saving and offer onError=hangup if fail-open is unacceptable. Directory source onMissing stays keep; set the target field onMissing policy.

For a key-to-number mapping, use a typed directory phone field. Access-list sources have no equivalent selectable mode; ask for the intended replacement when editing a legacy step.


## Directory steps in Dialplan
Use directory_lookup as an individual action at the required chain position. Query the tenant directory and its field UIDs first. Params: directoryUid, keySource (original_caller/current_caller/route_pattern/fixed {value}/variable {name}), outputs [], onMissing keep, optional matchMode on_match/on_no_match and behavior set_name/set_number/redirect/drop/map_fields/custom. BehaviorParams contains fieldUid or fixed (name/number), fixedExten (redirect), or mappings [{fieldUid,targetVariable}]. Custom actions use directory_policy host, nested policy behavior is unsupported. Transport ERROR skips the behavior; on_no_match runs only for NOT_FOUND. The dialed extension remains available. Output-only lookup remains compatible when behavior is absent; never propose new route-wide bindings or pre_command. Use callerid v2 for general identity transformations. Route confirmation applies all managed step contexts in one reload.

A step may carry enabled:false outside params. It remains saved but is not executed. Do not replace or erase its parameters when disabling it. Jumps must target enabled labels.
