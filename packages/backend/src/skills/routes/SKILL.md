---
name: routes
description: Типизированная цепочка маршрута, приоритет шаблонов, контекст тенанта, политики справочников.
domains: ["routes"]
intents: ["configure_route", "inbound_did"]
aliases: ["маршрут", "route", "did"]
related: ["contexts", "ivrs", "trunks", "time-groups"]
risk: high
---
# Маршруты

Маршрут в этом продукте — не сырое приложение Asterisk и строка аргументов. Это **шаблон** (`extensions`) внутри **контекста** плюс **типизированная цепочка действий** (`type` + `params`), та же форма, что открывает редактор интерфейса.

## Рецепт

1. **Что прочитать.** `list_contexts`, затем `list_routes` / `describe_route_chain`. Перед нетривиальной цепочкой — `list_dialplan_apps(host=route)`: реальные типы редактора, зачем шаг и что уже есть у тенанта. Ссылки в цепочке — через `get_pbx_state` или `list_*` целевого домена.
2. **Чеклист из слов пользователя.** Бери факты из **любой** реплики треда, не только из последней. Только названные шаблон и шаги. Не предлагай `app` + `appdata`. Не добавляй catch-all, если его не просили.
3. **Висит карточка.** Попроси подтвердить и назови влияние на входящие / аварийные шаблоны.
4. **Когда остановиться.** Спрашивать можно только то, чего нет ни в одной реплике треда: `context_uid` или тип шага. Уже названный шаблон не переспрашивай. Полный ТЗ не закрывай меню «что настроить».

## Контекст, шаблон, цепочка

- Контекст — контейнер маршрутов одного тенанта. UID бери из `list_contexts`, не конструируй имя Asterisk сам (к имени добавляется суффикс тенанта).
- Шаблон — `_2XX`, точный DID, аварийный короткий номер или catch-all `_X.`.
- Цепочка — упорядоченные шаги `toqueue`, `toivr`, `hangup` и остальные типы из `list_dialplan_apps`. Не выдумывай приложения Asterisk. Сначала `list_routes` и `describe_route_chain` выбранного контекста, затем proposal.

Не предлагай `app` + `appdata`. Неверный тип, отсутствующий обязательный параметр или ссылка на чужую/несуществующую сущность отвергается до карточки: в отказе назван индекс шага.

Пункты голосового меню собираются **тем же редактором и теми же `type` + `params`**, что и маршрут (host `ivr` в `DialplanAppsEditor`). После `togroup` можно сразу `totrunk` / `voicemail` / `hangup`. Overflow очереди и настройки группы сюда не относятся.

## Приоритет шаблонов

Редактор дополнительно проверяет порядок catch-all как консервативную политику. Asterisk в одном контексте ищет точные номера раньше шаблонов; порядок строк не переопределяет его алгоритм.

Отказ валидатора (инверсия):

1. В контексте уже есть `_X.` (любой остаток).
2. Ниже предлагается `112` или входящий DID.
3. Предложение отвергается консервативной политикой редактора из-за положения catch-all. Это не означает, что Asterisk игнорирует точный `112` ради шаблона в том же контексте.

Правильный порядок: сначала точные и аварийные (`112`, `101`, DID), затем узкие маски (`_2XX`), catch-all `_X.` — последним. Проверка идёт и при предложении, и при подтверждении.

## Именование контекста

Агент передаёт `context_uid` из `list_contexts`. Имя файла и суффикс тенанта собирает оркестратор применения. Не склеивай `name + tenant` сам. Обычное подтверждение применяет изменение; apply_context нужен для повторного применения после ошибки.

## Политика справочника

Новые политики задавай приложением directory_lookup в нужном месте actions. Старые route bindings сохраняются только для исполнения совместимых цепочек; при явном сохранении редактор превращает их в начальные шаги и очищает bindings атомарно.

## Что читать перед изменением

1. `list_contexts` — выбрать свой контекст.
2. `list_routes` / `describe_route_chain` — текущие шаблоны и цепочка, без записи.
3. `list_dialplan_apps` — каталог типов редактора (`totrunk`, `togroup`, …), обязательные поля и сколько раз тип уже есть у тенанта.
4. `get_pbx_state` — очереди, меню, абоненты, на которые ссылается цепочка.

Входящий DID или catch-all в карточке должен нести пометку влияния: основные входящие и аварийные шаблоны этого контекста.

## Шаблоны и dry-run (если есть)

Доступность маршрута определяется context_uid и графом include_uids входного контекста абонента.
route_type — устаревшее сохранённое поле, не механизм разрешений и не параметр новых изменений.
Одинаковые extensions допустимы в разных контекстах: свой контекст раньше включений; включения
ищутся по порядку, в глубину. Для резервирования транков задавай явную цепочку действий.

Если в списке инструментов есть dry-run, предпочтительно прогнать его до карточки изменения маршрута. Если есть инструменты шаблонов цепочки, ими можно собрать черновик шагов. Это сильный обычный шаг, не обязательный: когда таких инструментов нет, предлагай типизированную цепочку как обычно — не останавливайся в ожидании отсутствующего вызова.

## Упорядоченные контексты и применение

Перед изменением области доступности прочитай get_context_configuration входного контекста и list_routes / describe_route_chain достижимых контекстов. Маршрут живёт в одном context_uid; доступ обычного набора определяется include_uids, а не route_type.
Внутри одного контекста Asterisk ищет точные extensions раньше шаблонов: позиция строки таблицы не отменяет это правило. Проверка catch-all инструментом — дополнительная консервативная политика редактора. Между включениями действует их порядок с обходом в глубину, после собственных правил. Порядок include меняется через update_context после подтверждения. Для ошибки применения сохранённого контекста есть apply_context.

## Caller ID в правилах набора

Используй dial_patterns: [{extension: "100", callerId: "201"}, {extension: "_8XXXXXXXXXX", callerId: "_2XX"}]. Без callerId правило подходит любому номеру; callerId: "" означает отсутствие номера. extensions содержит совместимые строки extension/callerId. Формы не смешивать. Совпадает текущий CALLERID(num), не SIP-логин и не номер исходящего представления после изменения в цепочке. CID-правила выбирают маршрут и переходят в изолированную цепочку, сохраняя набранный номер. Без CID цепочка остаётся прямой. Не обещай проверку масок по dry-run: этот resolver консервативен. Контексты остаются основным доступом. После изменения перечитай preview и при необходимости выполни разрешённые live проверки.

## Caller ID v2
New callerid steps use params.version=2 with independent number/name. Each field has source, optional rewrite, clear, onMissing (keep/empty/hangup) and onError (keep/hangup). Never mix old mode/callerid/list_uid/pool fields into v2. Sources: current, fixed {value}, variable {name}, directory {directoryUid,valueFieldUid,keySource,onMissing:keep}; number only: manual pool {numbers,pick:random|round_robin}. Access lists (/numbers) are for access control, never propose them as Caller ID sources. Legacy number_list is runtime compatibility only; replace it with a directory or manual pool when explicitly editing that step. Directory keys: original_caller/current_caller/route_pattern/fixed {value}/variable {name}; system variables are forbidden. Query actual tenant catalogs and fields before proposing references. Static names preserve Unicode and punctuation as literal data.
All sources read a snapshot before the step changes number/name; lookup by the changed number requires a following step. Original Caller ID is captured at first platform entry and never recaptured. New pool state is tenant/owner/step scoped and locked. Number rewrite uses the existing first-match engine; names support eq/startsWith/endsWith/length and literal text transforms, not phone masks or regex. Default keep preserves the value entering the step, not the original platform CID. Clearing is explicit. Missing data can keep/empty/hangup; technical error can keep/hangup.
Legacy modes stay executable unchanged until explicitly edited. Replacing an obsolete access-list source is an explicit user choice, never silently migrate its semantics. Disclose that new manual pool state is shared across calls to this step. Trunk B-number modification and per-trunk identity remain separate: each attempt starts from identity entering the trunk app, then applies its override. Caller ID change never reruns selection of the current route. Preview of dynamic sources is an example, not an actual directory lookup or live pool pick. Verify proposed configuration and confirm writes through normal diff flow.

Legacy directory conversion keeps the missing-record empty policy but now preserves the step input on technical errors by default. Disclose this change before saving and offer onError=hangup if fail-open is unacceptable. Directory source onMissing stays keep; set the target field onMissing policy.

For a key-to-number mapping, use a typed directory phone field. Access-list sources have no equivalent selectable mode; ask for the intended replacement when editing a legacy step.


## Directory steps in Dialplan
Use directory_lookup as an individual action at the required chain position. Query the tenant directory and its field UIDs first. Params: directoryUid, keySource (original_caller/current_caller/route_pattern/fixed {value}/variable {name}), outputs [], onMissing keep, optional matchMode on_match/on_no_match and behavior set_name/set_number/redirect/drop/map_fields/custom. BehaviorParams contains fieldUid or fixed (name/number), fixedExten (redirect), or mappings [{fieldUid,targetVariable}]. Custom actions use directory_policy host, nested policy behavior is unsupported. Transport ERROR skips the behavior; on_no_match runs only for NOT_FOUND. The dialed extension remains available. Output-only lookup remains compatible when behavior is absent; never propose new route-wide bindings or pre_command. Use callerid v2 for general identity transformations. Route confirmation applies all managed step contexts in one reload.

A step may carry enabled:false outside params. It remains saved but is not executed. Do not replace or erase its parameters when disabling it. Jumps must target enabled labels.
