# Phase 12: DialplanAppsEditor refactor — reusable route-chain builder · Research

**Researched:** 2026-08-18
**Domain:** Asterisk 22 dialplan generation · NestJS/Sequelize multi-tenant backend · React FSD form-builder UI · STT/LLM интеграция
**Confidence:** HIGH по состоянию кода (всё проверено чтением файлов), HIGH по семантике Asterisk (официальная документация), MEDIUM по объёму миграции данных (число legacy-строк в БД неизвестно без доступа к прод-базе)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Surface редактирования шага (D-01…D-05)

- **D-01:** Параметры шага редактируются в **боковом `Sheet`** (справа; снизу на мобиле), **не** в `Dialog`.
  Причина: редактор уже вложен в модалки — `RoutePhonebooksTab` внутри `RouteFormModal`, `IvrMenuItemsEditor` внутри
  модалки IVR. Ещё один `Dialog` даёт стек оверлеев из трёх уровней.
- **D-02:** Изменения в Sheet применяются **live** в черновик — без пары «OK / Отмена» внутри Sheet.
  Сохранение/отмена остаётся на уровне host-формы.
- **D-03:** Sheet открывается **автоматически сразу после выбора типа действия** — новый шаг не остаётся пустым.
- **D-04:** Строка списка — **сканируемое summary одним предложением** (человекочитаемое, i18n), а не набор полей.
  Источник summary — реестр (`summarize(action)`).
- **D-05:** Условия шага показываются **badge-ом в строке**, редактируются **в том же Sheet**.

#### Контракт редактора и типизация params (D-06…D-12)

- **D-06:** App-компонент получает **только свои `params` + `onChange(patch)`**. Уход от
  `onUpdate(id, field: string, value: any)` полностью. Это закрывает W1 и W2 (каскадные ре-рендеры).
- **D-07:** Схема полей — **гибрид**: декларативная схема (тип поля, обязательность, подсказка, опции) покрывает
  большинство приложений; для сложных остаётся возможность подставить кастомный компонент.
- **D-08:** `params` типизируются **discriminated union** в `packages/shared` по `ActionType`.
  В `route.types.ts` уже есть неиспользуемый union `DialplanAction` — он и становится основой, а не пишется заново.
- **D-09:** **Бэкенд в scope.** DTO валидирует `params` **per-type** через discriminated union вместо текущего
  свободного `Record<string, any>`. Все действующие `ActionType` выравниваются с генератором dialplan.
- **D-10:** Валидация **блокирует сохранение** (не warning): пустой `type` и незаполненные обязательные params
  не проходят.
- **D-11:** Ошибки поверхностятся **и на фронте** (per-step, в строке и в Sheet), **и с бэкенда** (ответ DTO-валидации
  маппится на конкретный шаг).
- **D-12:** Legacy-действия в существующих данных **миграются**, а не ломаются.

#### Операции и переиспользуемость (D-13…D-15)

- **D-13:** Операции шага: **дублировать, включить/выключить, копировать/вставить, вставить между, undo удаления.**
- **D-14:** Props редактора: **`readOnly`, `labels` (i18n-namespace), `allowedTypes`, `density`, `maxSteps`.**
- **D-15:** Набор разрешённых типов действий задаётся **per-host**: маршрут, справочники маршрута и IVR-меню видят
  разные наборы.

#### Raw dialplan и превью (D-16…D-18)

- **D-16:** Колонка `raw_dialplan` и её UI **остаются**. Видимость — через настройку системы.
- **D-17:** **Два флага** настроек: «показывать dialplan в маршруте» и «показывать блок-схему».
  Default для обоих — **включено**.
- **D-18:** Сама блок-схема (визуальное отображение + печать/экспорт в PDF) и MCP/LLM-построение маршрутов —
  **Phase 13**, не здесь. В Phase 12 делается только флаг.

#### Подсистема тенантных настроек (D-19)

- **D-19:** В Phase 12 реализуется **полноценная подсистема тенантных настроек** (`full_in_12`): помимо существующих
  глобальных настроек с ADMIN-guard появляются **тенантные**, где пользователь кастомизирует под себя параметры,
  **не пересекающиеся** с глобальными. Флаги D-17 живут на ней.
  Существующие паттерны для опоры: `system_settings` (глобальные), `cc_settings` (тенантные),
  `cc_operator_settings` (оператор), `ai_chat_settings` (тенантные), `tenant_modules`,
  `role_start_defaults` (глобальные с тенантным override).

#### Сквозные механики Asterisk (D-20…D-28)

- **D-20:** **Единый «источник значения»** для всех адресных действий вместо разрозненных флагов:
  `фиксированное` / `по маске маршрута (${EXTEN})` / `из переменной канала` / `из справочника`.
  Заменяет частный механизм `params.useExten` + сентинел `__USE_EXTEN__` у `toexten`.
- **D-21:** **Тенант-скоупинг цели обязателен и централизован.** `${EXTEN}` **никогда** не попадает в `Dial()` /
  `Queue()` / `Gosub()` напрямую — только через единую функцию нормализации в `dialplan.util`, по типу цели:
  очередь → `q{exten}_{uid}`, внутренний → `e{exten}_{uid}` (+ WebRTC-companion `ew{exten}_{uid}`),
  группа → `group_{exten}_{uid}`.
- **D-22:** **Условия расширяются за пределы `DIALSTATUS`:** `QUEUESTATUS` (TIMEOUT / FULL / JOINEMPTY / LEAVEEMPTY /
  CONTINUE), `DEVICE_STATE`, произвольная переменная канала, результат `CURL` (`NOTIFY_RESULT`, `PB_RAW` уже пишутся,
  но использовать их сейчас нельзя).
- **D-23:** **UI условий: пресеты понятным языком + expert-режим.**
- **D-24:** **Флаг `terminal` в реестре** для действий, не возвращающих управление (`toivr` → `Goto`, `toroute` → `Goto`,
  `hangup` → `Hangup`), и **предупреждение о недостижимых шагах** после них в редакторе.
- **D-25:** **Защита от петель** между маршрутами (счётчик переходов, напр. `Set(__KRSK_HOPS=…)` + guard).
- **D-26:** **Манипуляция номером** (strip / prepend цифр) как общий блок параметров для действий, набирающих
  через транк.
- **D-27:** **Опции приложений — структурированные чекбоксы + expert-строка, одно значение с двусторонней
  синхронизацией.** Неизвестные и параметризованные флаги (`U(...)`, `M(...)`, `L(x:y:z)`) сохраняются как есть.
- **D-28:** **`sendmail`, `sendmailpeer`, `telegram` сливаются в `notify`.**

#### Legacy: удаление и перевод (D-29…D-31)

- **D-29:** `tofax`, `asr`, `keywords` — **hard remove** (не deprecate).
- **D-30:** `text2speech` **переводится на внутренние TTS-движки** проекта вместо `AGI(say.php)`.
- **D-31:** Вызовы PHP через `SHELL()` / `System()` заменяются на **CURL → Nest endpoint**.

#### Per-app улучшения (D-32…D-43)

- **D-32 `toqueue`:** добавить **`QUEUE_PRIO`** и **`announceoverride`** (4-я позиция `Queue()`).
- **D-33 Группы вызова — новое поле номера:** добавить `call_group.exten` и перевести контекст на
  **`group_{exten}_{uid}`**.
- **D-34 Группы — функциональность до уровня FreePBX Ring Groups:** подтверждение вызова, пропуск занятых,
  приветствие абоненту, MOH вместо гудков, per-group опции Dial.
- **D-35 Группы — два фикса:** восстанавливать `CALLERID(name)` после `Return()`; стратегия `random` → настоящее
  перемешивание.
- **D-36 Карусель транков:** переписать с O(n²) на линейный цикл, per-trunk таймаут, реальные режимы.
- **D-37 `callerid`:** убрать двойной `SHELL()`; подставлять имя из справочника; анти-повтор в карусели CID.
- **D-38 Медиа:** выставить в UI `noanswer`/`n`, `skip`/`s`, `p`, `say`/`mix`, `langoverride`, `context`.
  **Явный `Answer()` НЕ добавляем.**
- **D-39 `toexten`:** флаг `webrtc` оживить или убрать; Mark Answered Elsewhere; пустой `exten` не должен молча
  давать `dp = ''`.
- **D-40 `voicemail`:** **ОТМЕНЕНО и заменено на D-54…D-59.**
- **D-41 `confbridge`:** отдельный модуль — отдельная фаза. В Phase 12 только перевод на схему параметров.
- **D-42 Мелкое:** добавить **`Congestion()`**; писать применение `cmd` в `action_logs`; исправить двойной суффикс
  контекста в `toroute`.
- **D-43 Фиксы генератора из аудита:** `label` эмитит битое `NoOp())`; условие в multi-line действиях применяется
  только к первой строке; отсутствует time-group guard в IVR- и phonebook-биндингах; `setclid_custom` /
  `setclid_list` теряют часть params; `sendmailpeer` имеет недостижимые params.

#### Единое приложение «Воспроизведение» (D-51…D-53)

- **D-51:** Одно приложение складывает **три** приложения Asterisk: без прерывания → `Playback`,
  с перемоткой/паузой → `ControlPlayback`, с выходом по цифре → `BackGround`.
  Не складываем `Read`, `MusicOnHold`, семейство `Say*`.
  Миграция: `playprompt` → режим без прерывания, `playback` → режим с прерыванием.
- **D-52:** Генератор берёт на себя расхождения: язык через `Set(CHANNEL(language)=xx)` для `Playback`;
  `Progress()` перед воспроизведением при `noanswer`.
- **D-53:** Режим «выход по цифре» **меняет поток управления** — маркируется тем же механизмом, что терминальные
  действия в D-24.

#### Кастомная голосовая почта вместо `VoiceMail()` (D-54…D-59)

- **D-54:** Кастомное приложение полностью заменяет `VoiceMail()`. Старый тип `voicemail` — hard remove с миграцией.
  Состав: опциональное приветствие → запись → уведомление через `notify` → расшифровка / саммаризация.
  Отдельный шаг beep не нужен.
- **D-55:** **Опция `k` («Keep recorded file upon hangup») обязательна, а не опциональна.**
- **D-56:** Родные возможности `Record()` в UI: `o`, `x`, `y`, `n`/`s`, лимит длительности, порог тишины, `u`.
  `%d` автоинкрементится. `RECORD_STATUS` подключается к условиям D-22; `RECORDED_FILE` идёт в payload уведомления.
- **D-57:** **Расшифровка и саммаризация — в Phase 12** (`full_in_12`), с опорой на `stt-engines` и `ai-agents`.
- **D-58:** **Доступ к сообщениям — вкладка/фильтр в CDR-отчёте.** Переиспользуется механизм записей разговоров
  и access-scope. Корреляция по `${UNIQUEID}`.
- **D-59:** **Ссылка в уведомлении обязана быть аутентифицированной с истекающим токеном.**
  `cdr-public.controller.ts` переиспользовать **нельзя**. Вложение — для коротких, ссылка — для длинных.

#### Новые возможности редактора (D-44…D-50)

- **D-44:** Логические примитивы — метка / переход / ветвление.
- **D-45:** Расписание как действие.
- **D-46:** Шаблоны цепочек маршрутов.
- **D-47:** HTTP-запрос → переменная.
- **D-48:** Dry-run / тест маршрута без реального звонка.
- **D-49:** Сбор ввода пользователя (`Read` / `WaitExten`).
- **D-50:** Обратный звонок (callback) как действие маршрута.

### Claude's Discretion

- Конкретная форма discriminated union в `packages/shared` и то, как он переиспользуется DTO-валидацией
  (class-validator discriminator vs кастомный pipe).
- Схема таблиц подсистемы тенантных настроек и способ их наложения на глобальные (merge / override / whitelist ключей).
- Точный формат декларативной схемы полей (`IDialplanAppConfig` расширение) и правило порога показа expert-режима.
- Точный dialplan для подтверждения вызова и пропуска занятых в группах.
- Конкретная реализация счётчика переходов и его лимита.
- Формат хранения источника значения (`source` + `value` vs sentinel) при условии, что сентинел `__USE_EXTEN__` уходит.

### Deferred Ideas (OUT OF SCOPE)

- **Блок-схема dialplan** (визуальное отображение, печать, экспорт в PDF) — **Phase 13**.
  В Phase 12 закладывается только флаг видимости (D-17).
- **MCP-сервер + построение и редактирование маршрутов с помощью LLM** — **Phase 13**.
- **ConfBridge как отдельный модуль** со своим UI — **отдельная фаза** (D-41).
  Известный риск на время ожидания: одинаковый номер комнаты у разных клиентов = одна конференция.
- ~~**Тенантный контекст ящиков voicemail**~~ — снято (D-54).
- ~~**`ControlPlayback`** как отдельное действие~~ — снято, складывается в D-51.
- **MWI** для кастомной голосовой почты — явно вне Phase 12.
- **Прослушивание сообщений с трубки** (аналог `VoiceMailMain`) — отдельная задача.
- **LCR / приоритеты операторов** сверх карусели транков — backlog.
- Полный редизайн `RouteFormModal` целиком (только вкладки-потребители редактора).
</user_constraints>

---

## Summary

Фаза делает шесть вещей одновременно, и главный вывод исследования такой: **фундамент (типизация + централизованная
нормализация целей + фиксы генератора) обязан идти первым, потому что все остальные пять направлений в него упираются**,
а голосовая почта — единственный кусок, который технически отделим целиком и который **не влезает** в разумный объём
одной фазы (см. `## Phase Sizing Assessment`).

Проверено чтением кода, а не предположением. Генератор `actionToDialplan` содержит **ровно 29 `case`-ветвей**, из них
**7 покрыты тестами и 22 не покрыты** — ROADMAP заявляет 21, цифра занижена на одну (`setclid_list` как отдельная ветвь
не покрыт; тесты `callerid` покрывают только `mode: 'setclid_list'` внутри ветви `callerid`). Все пять багов из D-42/D-43
подтверждены с точными строками. Конвенции тенант-скоупинга подтверждены с трёх независимых сторон (`queues.service.ts`,
`cdr-access-scope.ts`, `pjsipDialTarget`), и подтверждено, что генератор их нарушает в четырёх местах
(`toqueue`, `togroup`, `confbridge`, `voicemail`).

Три находки меняют план по сравнению с тем, что предполагает CONTEXT:

1. **`Record()` с опцией `k` сохраняет файл, но НЕ возвращает управление в цепочку при отбое абонента.** Официальная
   документация Asterisk 22: «If the user hangs up during a recording, all data will be lost and the application will
   terminate» — `k` отменяет потерю файла, но канал всё равно уходит в teardown, и следующий приоритет не выполняется.
   Значит уведомление и STT **нельзя** ставить следующим шагом цепочки: они должны висеть на **hangup handler**
   (`Set(CHANNEL(hangup_handler_push)=…)`) либо целиком уехать на бэкенд по одному синхронному `CURL` до `Record()`.
   Без этого D-55 «спасает файл» и одновременно теряет уведомление в самом частом сценарии — ровно в том, ради которого
   `k` и вводится. Это критический пункт, он раскрыт в `## Common Pitfalls` (Pitfall 1) и в `## Code Examples`.
2. **Механизма вызова LLM в проекте нет.** `ai-agents` — это CRUD-реестр провайдеров (`CcAiProvider`: `endpoint`,
   `auth_type`, `encrypted_api_key`, `capabilities`, `defaults`), без сервиса вызова. Реальные вызовы LLM в проекте
   идут во внешний сервис aiPBX (`ai-chat.service.ts` → `fetch(${aiPbxUrl}/chats/...)`). Значит D-57 требует **написать**
   тонкий OpenAI-совместимый клиент (по образцу `custom-http-stt.provider.ts`), а не «переиспользовать существующий».
3. **`npm run db:migrate` в репозитории сломан:** `packages/backend/migrations/run-migrations.js`, на который ссылается
   скрипт, **отсутствует**; в `migrations/` лежат только `README.md` и две ручные SQL-папки. Рабочий механизм — только
   standalone `npx ts-node src/modules/<mod>/migrate-<name>.ts`. Планировщик обязан использовать именно его; GSD
   schema-push gate Sequelize не распознаёт и не напомнит.

**Primary recommendation:** разбить фазу на 7 workstream-ов по швам ниже, начать с Wave 0 (тесты-заглушки на 22
непокрытые ветви генератора **до** любых правок), затем W1 «типы + нормализация целей + фиксы генератора» как единый
неделимый фундамент, и **вынести голосовую почту (D-54…D-59) в Phase 12b**.

---

<phase_requirements>
## Phase Requirements

REQ-ID в ROADMAP на эту фазу не назначены. Требования — локированные решения `12-CONTEXT.md`; каждое `D-NN`
трактуется как отслеживаемое требование.

| ID | Описание (кратко) | Research Support |
|----|-------------------|------------------|
| D-01 | Параметры шага в боковом `Sheet` | `shared/ui/Sheet/Sheet.tsx` существует, `side` не параметризован — правка подтверждена как необходимая |
| D-02 | Live-применение в черновик | Host держит черновик в `useState` (`RouteFormModal.tsx:41`) — совместимо без изменений |
| D-03 | Авто-открытие Sheet после выбора типа | `Pattern 2` (контроллер выбранного шага) |
| D-04 | Summary одним предложением из реестра | `Pattern 1` — расширение `IDialplanAppConfig` полем `summarize` |
| D-05 | Badge условий в строке | `Pattern 1`, `Pattern 5` |
| D-06 | App получает только `params` + `onChange(patch)` | Текущий контракт — `onUpdate(id, field, value)` (`SortableActionItem.tsx:18`), меняется во всех 14 app-компонентах |
| D-07 | Гибридная схема полей + escape hatch | `Pattern 1` |
| D-08 | Discriminated union в `packages/shared` | `DialplanAction` уже есть (`route.types.ts:150-176`), не используется никем — подтверждено |
| D-09 | DTO валидирует params per-type | `route-action.dto.ts:76-77` — сейчас `@IsObject() params: Record<string, any>`; **IVR-модуль DTO не имеет вовсе** |
| D-10 | Валидация блокирует сохранение | `Pattern 3` (кастомный `ValidationPipe` + маппинг на `action.id`) |
| D-11 | Ошибки на фронте и с бэкенда per-step | UI-SPEC backstop №2 — прецедента в проекте нет, нужен held-out тест |
| D-12 | Legacy-действия миграются | `## Runtime State Inventory` — 6 JSON-колонок в 5 таблицах |
| D-13 | Дублировать / вкл-выкл / копировать / вставить между / undo | `IRouteAction` требует нового поля `enabled` → миграция не нужна (JSON) |
| D-14 | Props `readOnly`/`labels`/`allowedTypes`/`density`/`maxSteps` | UI-SPEC Surface I, J |
| D-15 | `allowedTypes` per-host | UI-SPEC Surface J: таблица трёх host-ов |
| D-16 | `raw_dialplan` остаётся | `route.model.ts`, `routes.service.ts:214-216` — при непустом raw генерация действий полностью обходится |
| D-17 | Два флага видимости, default ON | `Pattern 4` + UI-SPEC Surface K (loading-состояние обязательно) |
| D-18 | Блок-схема — только флаг | scope-граница, кода нет |
| D-19 | Подсистема тенантных настроек | `system_settings` — глобальная key-value с `UNIQUE(key)` без тенанта (`system-setting.model.ts:10`); нужна новая таблица |
| D-20 | Единый «источник значения» | `Pattern 6`; сентинел `params.useExten` читается в `dialplan.util.ts:165` |
| D-21 | Централизованный тенант-скоупинг цели | `Pattern 6`, `## Common Pitfalls` Pitfall 2; конвенции подтверждены тройной перекрёстной проверкой |
| D-22 | Условия за пределами `DIALSTATUS` | `VALID_DIALSTATUSES` (`dialplan.util.ts:5-8`) и `ValidDialstatuses` (`route-action.dto.ts:26-29`) — два независимых списка, оба надо расширять; `RECORD_STATUS` имеет **7-е значение `OPERATOR`**, в D-56 не перечислено |
| D-23 | Пресеты + expert | UI-SPEC Surface E, все строки в Copywriting Contract |
| D-24 | Флаг `terminal` + предупреждение | UI-SPEC Surface H (плюрализация `_one`/`_other`) |
| D-25 | Защита от петель `toroute` | `dialplan.util.ts:232-237` — `Goto` без счётчика |
| D-26 | Манипуляция номером (strip/prepend) | отсутствует полностью; общий блок схемы полей |
| D-27 | Опции: чекбоксы + expert, round-trip | UI-SPEC backstop №4 — нужен round-trip тест |
| D-28 | `sendmail`/`sendmailpeer`/`telegram` → `notify` | `notify` уже CURL→Nest (`dialplan.util.ts:332-346`); `sendmailpeer`/`telegram` — `System(*.php)` (`:284`, `:287`) |
| D-29 | hard remove `tofax`/`asr`/`keywords` | `asr` (`:300`) и `keywords` (`:303`) эмитят **идентичный** `Record()` — подтверждено; `tofax` (`:323`) ставит `__faxmail`, никем не читаемую |
| D-30 | `text2speech` → внутренние TTS | `AGI(say.php,...)` (`:296`); есть `TtsProviderFactory.synthesizeBatch` (`provider-factory.ts:190`) и `TtsEngine` |
| D-31 | PHP через SHELL/System → CURL→Nest | 7 PHP-вызовов: `:255` ×2, `:284`, `:287`, `:296`, `:306`, `routes.service.ts:307`, `:312` |
| D-32 | `toqueue`: `QUEUE_PRIO` + `announceoverride` | `dialplan.util.ts:197` — 4-я позиция `Queue()` пуста |
| D-33 | `call_group.exten` + контекст `group_{exten}_{uid}` | `call-group-dialplan.util.ts:146` — сейчас `group_{uid}_{vpbx}`; переименование контекста ломает существующие `togroup` → нужна двухшаговая миграция |
| D-34 | Группы до уровня FreePBX Ring Groups | `DIAL_OPTS='tT'` захардкожен (`call-group-dialplan.util.ts:9`) |
| D-35 | Группы: откат `CALLERID(name)`, честный random | `maybeCidPrefix` (`:36-43`) не откатывает; `emitRandom` (`:104-138`) помечен «v1 simplification» и к тому же O(n²) |
| D-36 | Карусель транков: линейный цикл, per-trunk таймаут, режимы | `dialplan.util.ts:388-451` |
| D-37 | `callerid`: убрать двойной SHELL, имя из справочника, анти-повтор | `:255` и `:347+` |
| D-38 | Медиа-опции в UI, без `Answer()` | **VERIFIED** официальной документацией Asterisk 22 |
| D-39 | `toexten`: `webrtc`, Mark Answered Elsewhere, валидация | `:163` читает `params.webrtc`, ни один компонент его не пишет (`registry.ts:20` — `defaultParams` без `webrtc`); `:169-172` даёт `dp=''` |
| D-40 | ОТМЕНЕНО → D-54…D-59 | — |
| D-41 | `confbridge` только на схему параметров | `:310` `ConfBridge(${room})` без тенанта — риск зафиксирован, не чинится |
| D-42 | `Congestion()`, `action_logs` для `cmd`, двойной суффикс `toroute` | `:313-320` (нет лога), `:235` (нет guard `endsWith`, в отличие от `routes.service.ts:376-379`) |
| D-43 | Пять фиксов генератора | все пять подтверждены: `label` `:327`, multi-line condition `:152/:185/:280/:344`, time-group guard `routes.service.ts:361-367` + отсутствует в `ivrs.service.ts` и `phonebook-dialplan.util.ts`, `setclid_*` `:248-257`, `sendmailpeer` `:283-285` |
| D-44 | Логические примитивы (метка/переход/ветвление) | `label` сейчас — `NoOp())`, смысла не несёт |
| D-45 | Расписание как действие | `TimeGroupsService` + `ExecIfTime` уже есть (`routes.service.ts:186-201`) |
| D-46 | Шаблоны цепочек | новая таблица, тенант-скоуп |
| D-47 | HTTP-запрос → переменная | паттерн `CURL` + `Set` уже есть в `notify` |
| D-48 | Dry-run маршрута | генератор — чистая функция, dry-run = вызов без записи в конфиг |
| D-49 | Сбор ввода (`Read`/`WaitExten`) | новое, не складывается в D-51 (производит переменную) |
| D-50 | Callback как действие | новое; `Originate`/AMI |
| D-51 | Единое «Воспроизведение» из 3 приложений | `playprompt`→`Playback` (`:240`), `playback`→`Background` (`:245`) — инверсия имён подтверждена |
| D-52 | `Set(CHANNEL(language))` + `Progress()` | **VERIFIED** официальной документацией (пример с `Progress()` + `Playback(...,noanswer)`) |
| D-53 | «Выход по цифре» меняет поток управления | UI-SPEC Surface H — условный терминал |
| D-54 | Кастомная голосовая почта заменяет `VoiceMail()` | `:291` `VoiceMail(${vmExten}@default,u)`; `mailboxes`/`incoming_mwi_mailbox` — пассивные колонки |
| D-55 | Опция `k` обязательна | **VERIFIED** официальной документацией + **важная поправка**: `k` не возвращает управление, см. Pitfall 1 |
| D-56 | Опции `Record()` в UI, `RECORD_STATUS`, `RECORDED_FILE` | **VERIFIED**; `RECORD_STATUS` имеет 7 значений, `OPERATOR` в D-56 пропущено |
| D-57 | STT + LLM в Phase 12 | `SttProviderFactory.transcribe(engine, buffer, lang)` готов; **LLM-клиента нет, надо писать** |
| D-58 | Вкладка/фильтр в CDR | `cdr.service.ts` + `cdr-access-scope.ts` — механизм есть, но `safeRecordFilePath` жёстко добавляет `.mp3` (`:307`) и стрим отдаёт `audio/mpeg` (`:457`) |
| D-59 | Аутентифицированная ссылка с истекающим токеном | `cdr-public.controller.ts` существует и стримит без JWT — переиспользовать нельзя |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Редактор цепочки, черновик, DnD, undo, буфер копирования | Browser / Client | — | Черновик живёт в `useState` host-формы (ARCHITECTURE: Local Form State); RTK Query только для справочников |
| Декларативная схема полей и `summarize(action)` | Browser / Client | — | Реестр — чисто презентационная метадата; бэкенд её не читает |
| Клиентская валидация шага (D-10) | Browser / Client | API / Backend | Клиент даёт мгновенную обратную связь, но авторитет — DTO |
| Типы `params` (discriminated union) | `packages/shared` | Browser + Backend | Единственный способ, чтобы фронт и DTO не разъехались; **требует пересборки `@krasterisk/shared`** |
| Авторитетная валидация `params` per-type | API / Backend | — | Дальше DTO лежит генерация конфига Asterisk — фронту доверять нельзя |
| Нормализация цели (`q…`/`e…`/`ew…`/`group_…`) | API / Backend | — | Знание тенанта и конвенции имён живёт только на сервере; UI лишь **показывает** результат (UI-SPEC Surface C) |
| Генерация dialplan | API / Backend | — | `dialplan.util.ts` — единственная точка |
| Применение конфига на PBX | API / Backend | Asterisk host | `DialplanApplyService` / realtime PJSIP |
| Условия шага (`DIALSTATUS`/`QUEUESTATUS`/`RECORD_STATUS`) | Asterisk (runtime) | API / Backend | Вычисляются в dialplan; бэкенд их только эмитит |
| Тенантные настройки (флаги D-17) | API / Backend | Browser (optimistic toggle) | Новая таблица + RTK Query с `onQueryStarted`/`undo` |
| Запись голосового сообщения | Asterisk (runtime) | Database / Storage | `Record()` пишет файл в `/usr/records/...`; метаданные — в БД |
| Уведомление о сообщении | API / Backend | Asterisk (trigger) | `CURL` из hangup handler → Nest → `NotificationDispatcher` |
| STT-расшифровка и LLM-саммари | API / Backend | External service | Асинхронно, после того как файл закрыт; провайдеры тенант-скоупные |
| Плеер и детализация сообщения | Browser / Client | API / Backend | JWT-стрим; ссылка с токеном — только для исходящих уведомлений (D-59) |
| Токен-ссылка для уведомления | API / Backend | — | Подпись и TTL — серверная ответственность, в UI не рендерится (D-59) |

---

## Standard Stack

### Core

Фаза **не вводит новых npm-зависимостей** — ни на фронте (подтверждено `12-UI-SPEC.md` § Registry Safety),
ни на бэкенде (все нужные примитивы уже есть). Это осознанная рекомендация, а не констатация: каждый соблазн
добавить пакет ниже разобран в `### Alternatives Considered`.

| Library | Version (verified in repo) | Purpose | Why Standard |
|---------|---------------------------|---------|--------------|
| `class-validator` | `^0.14.1` | Валидация DTO, включая per-type `params` | Уже канон проекта (`route-action.dto.ts`); поддерживает `@ValidateNested` + кастомные `ValidatorConstraint` |
| `class-transformer` | `^0.5.1` | `@Type()` для вложенных DTO; **`discriminator` для полиморфных `params`** | Штатный механизм discriminated union в NestJS-стеке |
| `sequelize` / `sequelize-typescript` | `^6.37.6` / `^2.1.6` | Модели новых таблиц, миграции | Канон проекта |
| `ts-node` | `^10.9.2` (devDep) | Запуск `migrate-*.ts` | Единственный рабочий путь миграций (см. `## Environment Availability`) |
| `jest` + `ts-jest` | `^29.7.0` / `^29.2.5` | Тесты бэкенда, `testRegex: .*\.spec\.ts$`, `rootDir: src` | Канон |
| `vitest` | `^4.1.4` | Тесты фронтенда, `setupTests.ts` в `shared/config/tests/` | Канон |
| `@testing-library/react` + `user-event` | `^16.3.2` / `^14.6.1` | Held-out тесты UI-состояний | Канон |
| `@dnd-kit/core` + `@dnd-kit/sortable` | `^6.3.1` / `^10.0.0` | DnD цепочки, `DragOverlay`, `restrictToVerticalAxis`, `announcements` | Уже используется, `KeyboardSensor` подключён |
| `@radix-ui/react-dialog` | `^1.1.6` | Базис `Sheet` и `Dialog` в `shared/ui` | Порядок монтирования порталов — механизм наложения (UI-SPEC ⚠ unresolved) |
| `lucide-react` | `^0.475.0` | Иконки; эмодзи запрещены | ARCHITECTURE MUST |
| `react-i18next` | `^15.4.1` | i18n, включая `_one`/`_other` плюрализацию | ARCHITECTURE MUST; ru даёт `_one`/`_few`/`_many` |
| Node `fetch` (встроенный) | Node 18+ | HTTP-клиент к STT/LLM-провайдерам | Уже так сделано в `ai-chat.service.ts` и `custom-http-stt.provider.ts` — новый HTTP-клиент не нужен |

### Supporting

| Library / модуль проекта | Purpose | When to Use |
|-------------------------|---------|-------------|
| `SttProviderFactory.transcribe(engine, buffer, language)` | Батч-расшифровка PCM16 8kHz mono | D-57, единственная точка входа STT |
| `SttEnginesService` (`user_uid`-скоуп) | Выбор движка тенанта | D-57; `maskToken()` для отдачи наружу |
| `TtsProviderFactory.synthesizeBatch(engine, text)` | Синтез в PCM16 буфер | D-30 (`text2speech` → внутренний TTS) |
| `NotificationDispatcherService` + `notification_integrations` | Multi-channel уведомления (`telegram`/`email`/`whatsapp`/`webhook`/`max`/`vk`) | D-28, D-54 |
| `cdr-access-scope.ts` (`buildCdrLinkedidAccessClause`) | Access-scope для вкладки голосовых сообщений | D-58 |
| `TimeGroupsService` + `ExecIfTime` | Расписание как условие и как действие | D-43 (guard), D-45 |
| `AsteriskDialplanUtils.sanitize*` | Санитизация всех новых полей схемы | Все новые params |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `class-transformer` `discriminator` | `zod` + кастомный pipe | `zod` даёт лучшую типизацию и один источник схемы для фронта и бэка, но это новая зависимость и второй стиль валидации рядом с `class-validator` во всём проекте. **Не рекомендуется**: расхождение стилей дороже удобства |
| Ручной парсинг WAV-заголовка | `wav`, `node-wav`, `ffmpeg` | Asterisk пишет каноничный 44-байтный RIFF/PCM-заголовок; парсер чанков — ~30 строк с unit-тестом. Внешний `ffmpeg` добавляет системную зависимость, которой в `## Environment Availability` нет |
| Свой OpenAI-клиент на `fetch` | `openai` npm SDK | SDK привязывает к формату OpenAI, а `CcAiProvider.kind` включает `local`/`custom` (Ollama и т.п.). `fetch` + `endpoint`/`auth_type` из модели покрывает все три вида одним кодом |
| Токен-ссылка через собственный HMAC | `@nestjs/jwt` (уже в проекте) | Использовать **уже подключённый** `JwtService` с коротким `expiresIn` и отдельным `audience` — меньше кода и меньше шансов ошибиться в подписи. **Рекомендуется** |
| Новая таблица тенантных настроек | Расширить `system_settings` колонкой `vpbx_user_uid` | `system_settings.key` имеет `UNIQUE` без тенанта (`system-setting.model.ts:10`), а сам модуль ADMIN-guarded. Изменение уникального ключа глобальной таблицы — регресс-риск для всех существующих настроек. **Новая таблица по образцу `cc_settings`** |

**Installation:** новых пакетов нет.

```bash
# Обязательно перед сборкой backend/frontend после правки packages/shared:
npm run build -w @krasterisk/shared
```

## Package Legitimacy Audit

**Not applicable.** Фаза не устанавливает внешних пакетов: все используемые библиотеки уже присутствуют в
`packages/backend/package.json` и `packages/frontend/package.json` и версии считаны из репозитория
(`[VERIFIED: repo package.json]`). Слопсквоттинг-риска нет, `checkpoint:human-verify` перед install не требуется.

Единственная зависимость, которую планировщик **не должен** трогать: `@dnd-kit/sortable` `^10.0.0` — мажор новее,
чем `@dnd-kit/core` `^6.3.1`, это работающая комбинация в проекте; апгрейдить в рамках Phase 12 незачем.

---

## Architecture Patterns

### System Architecture Diagram

```
                          ┌──────────────────── FRONTEND (features/dialplan-apps) ─────────────────────┐
  host form draft         │                                                                            │
  (useState)              │   DialplanAppsEditor ── props: readOnly, labels, allowedTypes,             │
      │                   │        │                        density, maxSteps  (D-14)                  │
      │  actions[]        │        ├── StepRow[]  ── summarize(action) → одно предложение (D-04)       │
      ├──────────────────►│        │                 conditionBadges (D-05) · terminal badge (D-24)    │
      │                   │        │                 TableRowActions (D-13)                            │
      │                   │        └── StepSheet (ОДИН на редактор, параметризован selectedStepId)     │
      │                   │              ├── ActionTypeSelect                                          │
      │                   │              ├── SchemaFields  ◄── registry[type].schema      (D-07)      │
      │                   │              │     └── ValueSourceField (fixed/${EXTEN}/var/pb)  (D-20)   │
      │                   │              ├── OptionsEditor (checkboxes ⇄ raw string)        (D-27)    │
      │                   │              └── ConditionsEditor (presets | expert)            (D-22/23) │
      │                   │                                                                            │
      │◄── onChange(patch) ── App-компонент видит ТОЛЬКО свои params (D-06)                            │
      │                   └────────────────────────────────────────────────────────────────────────────┘
      │  PUT /routes/:uid  (или /ivrs/:uid, или bindings[])
      ▼
┌──────────────────────────── BACKEND (NestJS) ────────────────────────────────────────────────────────┐
│  DialplanActionValidationPipe ──► DialplanAction discriminated union (packages/shared)     (D-08/09) │
│        │ fail                                                                                        │
│        └──► 400 { errors: [{ actionId, path, message }] } ──► проецируется на шаг во фронте  (D-11)  │
│        │ ok                                                                                          │
│        ▼                                                                                             │
│  routes.service / ivrs.service / phonebook-dialplan.util / voice-robots.service                     │
│        │  (4 независимых call-site actionToDialplan — time-group guard есть только в первом)         │
│        ▼                                                                                             │
│  AsteriskDialplanUtils.actionToDialplan(action, vpbxUserUid, isAdmin, wh)                           │
│        ├── wrapCondition(dp, condition)  ◄── ЕДИНАЯ обёртка, применяется к КАЖДОЙ строке   (D-43)   │
│        ├── normalizeTarget(kind, source, value, uid) ── q…/e…+ew…/group_…/ctx-…            (D-21)   │
│        └── per-app emitters (playback | voicemail | queue | group | trunk_carousel | …)              │
│        ▼                                                                                             │
│  DialplanApplyService ──► extensions_*.conf на хосте Asterisk 22                                    │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌────────────────────── ASTERISK 22 runtime: кастомная голосовая почта (D-54…D-59) ────────────────────┐
│  [greeting?] Playback/Progress                                                                       │
│      ▼                                                                                               │
│  Set(CHANNEL(hangup_handler_push)=krsk-vm-done,s,1)   ◄── ОБЯЗАТЕЛЬНО ДО Record()                   │
│      ▼                                                                                               │
│  Record(<path>/${UNIQUEID}-%d.wav, silence, maxdur, k[qoxynsu])                                     │
│      ├── абонент нажал # / тишина / таймаут → RECORD_STATUS=DTMF|SILENCE|TIMEOUT → следующий шаг    │
│      └── абонент бросил трубку → RECORD_STATUS=HANGUP, файл СОХРАНЁН опцией k,                      │
│              но следующий приоритет НЕ выполняется → срабатывает hangup handler                     │
│      ▼ (оба пути ведут в одну точку)                                                                 │
│  [krsk-vm-done] CURL(<backend>/internal/dialplan/voicemail, uniqueid, file, status, …)               │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │  (синхронный HTTP из dialplan)
                                              ▼
┌──────────────── BACKEND: обработка сообщения (асинхронно, вне звонка) ───────────────────────────────┐
│  VoicemailController → VoicemailService.ingest()                                                     │
│      ├── запись строки в voicemail_messages (uniqueid, linkedid, file, duration, status)             │
│      ├── NotificationDispatcher: вложение (короткое) | JWT-ссылка с TTL (длинное)          (D-59)   │
│      └── очередь обработки:  wav → parseWavPcm16() → SttProviderFactory.transcribe()       (D-57)   │
│                                        ▼                                                             │
│                              LlmSummaryService (НОВЫЙ, fetch + CcAiProvider)                        │
│                                        ▼                                                             │
│                              UPDATE voicemail_messages SET transcript, summary, status               │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼  вкладка «Голосовые сообщения» = CDR + JOIN по uniqueid,
                                                 access-scope через buildCdrLinkedidAccessClause (D-58)
```

### Recommended Project Structure

```
packages/shared/src/types/
├── route.types.ts                    # ActionType (сокращённый), DialplanAction (расширенный union)
├── dialplan-params.types.ts          # НОВОЕ: per-type интерфейсы params + ValueSource
├── dialplan-condition.types.ts       # НОВОЕ: ConditionKind, ConditionExpr (D-22)
└── voicemail.types.ts                # НОВОЕ: IVoicemailMessage, VoicemailStatus (D-54…D-58)

packages/backend/src/shared/utils/
├── dialplan.util.ts                  # actionToDialplan — рефакторинг: wrapCondition + per-app emitters
├── dialplan-target.util.ts           # НОВОЕ: normalizeTarget (D-21) — ЕДИНСТВЕННОЕ место
├── dialplan-target.util.spec.ts      # НОВОЕ
├── dialplan-condition.util.ts        # НОВОЕ: condition → ExecIf/GotoIf (D-22)
└── dialplan-options.util.ts          # НОВОЕ: parse/serialize строки опций (D-27) — round-trip

packages/backend/src/modules/tenant-settings/     # НОВЫЙ модуль (D-19)
├── tenant-setting.model.ts           # tenant_settings: uid, vpbx_user_uid, key, value, category
├── tenant-settings.service.ts
├── tenant-settings.controller.ts
├── dto/tenant-setting.dto.ts
├── migrate-tenant-settings.ts        # НОВОЕ
└── tenant-settings.service.spec.ts

packages/backend/src/modules/voicemail/           # НОВЫЙ модуль (D-54…D-59)
├── voicemail-message.model.ts
├── voicemail.service.ts              # ingest + очередь обработки
├── voicemail-dialplan.controller.ts  # /internal/dialplan/voicemail (api_key-guard, как sendmail/notify)
├── voicemail.controller.ts           # список/детализация/стрим (JWT + access-scope)
├── voicemail-link.service.ts         # JWT-токен с TTL для уведомления (D-59)
├── wav-pcm.util.ts + .spec.ts        # WAV → PCM16 для STT
├── llm-summary.service.ts            # НОВОЕ: fetch + CcAiProvider
└── migrate-voicemail.ts

packages/backend/src/modules/routes/dto/
├── route-action.dto.ts               # per-type params (D-09)
└── dialplan-params/                  # НОВОЕ: по одному DTO-классу на ActionType
    └── *.params.dto.ts

packages/frontend/src/features/dialplan-apps/
├── model/
│   ├── registry.ts                   # + schema, summarize, terminal, allowedIn
│   ├── types.ts                      # IDialplanAppConfig расширяется (D-07)
│   ├── schema.types.ts               # НОВОЕ: FieldSchema
│   └── useChainEditor.ts             # НОВОЕ: add/remove/duplicate/move/undo/clipboard (D-13)
├── ui/
│   ├── DialplanAppsEditor/           # orchestrator + props D-14
│   ├── StepRow/                      # заменяет SortableActionItem (grid, summary, badges)
│   ├── StepSheet/                    # НОВОЕ (D-01…D-03)
│   ├── SchemaField/                  # НОВОЕ (D-07, таблица маппинга из UI-SPEC Surface C)
│   ├── ValueSourceField/             # НОВОЕ (D-20)
│   ├── OptionsEditor/                # НОВОЕ (D-27)
│   ├── ConditionsEditor/             # НОВОЕ (D-22, D-23)
│   ├── UnknownActionPanel/           # НОВОЕ (W5, D-12)
│   └── apps/*                        # 14 компонентов переводятся на { params, onChange }
└── lib/
    ├── summarize.ts + .test.ts       # НОВОЕ (D-04)
    ├── optionsString.ts + .test.ts   # НОВОЕ round-trip (D-27, backstop №4)
    └── validateAction.ts + .test.ts  # НОВОЕ (D-10)

packages/frontend/src/shared/ui/Sheet/Sheet.tsx   # ЕДИНСТВЕННАЯ правка shared/ui: prop side
```

### Pattern 1: Реестр как единственный источник метаданных приложения

**What:** `IDialplanAppConfig` расширяется до полного описания приложения: схема полей, summary-функция,
флаг терминальности, набор host-ов, объявленные флаги опций.
**When to use:** всегда; добавление приложения не должно требовать правки ни одного `switch` в UI.

```typescript
// packages/frontend/src/features/dialplan-apps/model/types.ts
export interface IDialplanAppConfig<P = Record<string, unknown>> {
  type: ActionType;
  labelKey: string;
  category: 'telephony' | 'media' | 'system' | 'notification';
  defaultParams: P;
  /** D-07: декларативная схема; render:'custom' — escape hatch на компонент */
  schema: FieldSchema<P>[];
  /** D-04: одно человекочитаемое предложение; деградирует на незаполненных полях */
  summarize: (params: P, t: TFunction, refs: SummaryRefs) => string;
  /** D-24/D-53: 'always' | 'conditional' | 'never' */
  terminal: 'always' | 'conditional' | 'never';
  /** D-15: в каких host-ах доступно */
  allowedIn: ReadonlyArray<'route' | 'phonebook' | 'ivr'>;
  /** D-27: объявленные флаги опций; отсутствие ⇒ группа «Опции» не рендерится */
  optionFlags?: ReadonlyArray<{ flag: string; descriptionKey: string }>;
  /** Опциональный кастомный компонент — получает тот же { params, onChange } */
  component?: React.ComponentType<IDialplanAppProps<P>>;
}
```

**Почему это закрывает W5:** `registry[action.type] || registry.hangup` (`DialplanAppsEditor.tsx:108`) сегодня
подменяет неизвестный тип на `hangup` — то есть неизвестное действие визуально становится «Сброс», и пользователь,
сохранив форму, **молча превращает шаг в Hangup**. Fallback удаляется, неизвестный тип получает собственное
состояние (UI-SPEC Surface G).

### Pattern 2: Один Sheet на редактор, параметризованный id шага

**What:** `StepSheet` монтируется один раз рядом со списком; выбранный шаг задаётся `selectedStepId`.
**When to use:** D-01…D-03.
**Anti-requirement:** рендерить `Sheet` внутри каждой строки запрещено (UI-SPEC Surface B) — иначе N порталов,
N подписок на справочники и неопределённый порядок наложения.

```tsx
const [selectedId, setSelectedId] = useState<string | null>(null);
const selected = useMemo(() => actions.find((a) => a.id === selectedId) ?? null, [actions, selectedId]);

// D-03: выбор типа в пустой строке немедленно открывает Sheet
const handleTypeChange = (id: string, type: ActionType) => {
  patchStep(id, { type, params: registry[type].defaultParams });
  setSelectedId(id);
};

return (
  <>
    <ol role="list">{actions.map(...)}</ol>
    <StepSheet
      open={selected !== null}
      step={selected}
      onPatch={(patch) => selected && patchStep(selected.id, patch)}
      onClose={() => setSelectedId(null)}
    />
  </>
);
```

### Pattern 3: Discriminated union один раз в shared, дважды переиспользован

**What:** `DialplanAction` в `packages/shared` — источник истины; бэкенд получает per-type DTO через
`class-transformer` `discriminator`, фронт получает типизацию `params` бесплатно.
**When to use:** D-08, D-09.

```typescript
// packages/backend/src/modules/routes/dto/route-action.dto.ts
export class RouteActionDto {
  @IsString() id: string;
  @IsIn(ACTION_TYPES) type: ActionType;

  @IsOptional() @IsBoolean() enabled?: boolean;   // D-13

  @ValidateNested()
  @Type(() => BaseParamsDto, {
    keepDiscriminatorProperty: false,
    discriminator: {
      property: '__t',                 // проставляется трансформером из type (см. ниже)
      subTypes: [
        { value: ToQueueParamsDto, name: 'toqueue' },
        { value: ToExtenParamsDto, name: 'toexten' },
        // … по одному на ActionType
      ],
    },
  })
  params: BaseParamsDto;

  @IsObject() @ValidateNested() @Type(() => RouteActionConditionDto)
  condition: RouteActionConditionDto;
}
```

**Известная граница механизма:** `class-transformer` `discriminator` читает дискриминатор **из самого вложенного
объекта**, а `type` лежит на уровне выше. Два рабочих выхода, оба проверяемы тестом:

- **(рекомендуется)** кастомный `DialplanActionValidationPipe`, который сам выбирает DTO-класс по `action.type`,
  вызывает `validate()` и собирает ошибки в форму `{ actionId, path, message }` — это ровно то, что нужно D-11
  для проекции на шаг, и заодно снимает зависимость от поведения `discriminator`;
- либо `@Transform`, копирующий `type` в `params.__t` до валидации.

**Второй, менее очевидный аргумент за кастомный pipe:** валидация нужна **в четырёх** местах, а не в одном —
`routes` (есть), `route_phonebook_bindings` (есть), **`ivrs` (DTO-папки нет вовсе — `menu_items` не валидируется
никак)** и `voice-robots` (`fallback_action`, `max_retries_action`, `vr_keywords.actions`). Pipe переиспользуется,
набор декораторов — нет.

### Pattern 4: Тенантные настройки рядом с глобальными, без пересечения ключей

**What:** новая таблица `tenant_settings` по образцу `cc_settings`; ключи **не пересекаются** с `system_settings`,
поэтому merge-логики и UI разрешения конфликтов нет (UI-SPEC Surface K фиксирует это явно).
**When to use:** D-17, D-19.

```typescript
@Table({ tableName: 'tenant_settings', timestamps: false, freezeTableName: true })
export class TenantSetting extends Model {
  @PrimaryKey @AutoIncrement @Column({ type: DataType.INTEGER }) declare uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'vpbx_user_uid' })
  declare user_uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false }) declare key: string;
  @Column({ type: DataType.TEXT, allowNull: true }) declare value: string | null;
  @Column({ type: DataType.STRING(64), allowNull: false, defaultValue: 'general' })
  declare category: string;
  @Column({ type: DataType.DATE, field: 'updated_at', defaultValue: DataType.NOW })
  declare updated_at: Date;
}
// UNIQUE KEY uniq_tenant_key (vpbx_user_uid, key)  ← в отличие от system_settings.UNIQUE(key)
```

**Whitelist ключей обязателен.** Иначе тенант сможет записать любой ключ, включая совпадающий с глобальным,
и «непересекаемость» из D-19 перестанет быть инвариантом. Whitelist — константа в `tenant-settings.service.ts`
плюс unit-тест «неизвестный ключ отвергается 400».

### Pattern 5: Единая обёртка условия, применяемая к каждой строке

**What:** вместо `wrapper`/`closing`, приклеиваемых к первой строке, — функция, которая берёт готовый
(возможно многострочный) dialplan и обёртывает **каждую** строку.
**When to use:** D-43 — это корень одного и того же дефекта в двух местах (`dialstatus` внутри
`actionToDialplan` и `time_group_uid` в `routes.service.ts:361-367`).

```typescript
/** D-43: dp может быть многострочным ('...\nsame => n,...'). Обёртка обязана накрыть все строки. */
export function wrapEachLine(dp: string, guard: string): string {
  if (!dp || !guard) return dp;
  return dp
    .split('\nsame => n,')
    .map((line) => `ExecIf($[${guard}]?${line})`)
    .join('\nsame => n,');
}
```

**Оговорка, которую обязан учесть план:** строка вида `Dial(...)` внутри `ExecIf(...)` работает, но
`ExecIf($[..]?Set(__X=${CURL(...)}))` с вложенными скобками и запятыми требует аккуратности; безопаснее для
многострочных действий эмитить **`GotoIf` + метку пропуска**, а не N вложенных `ExecIf`:

```
same => n,GotoIf($[<guard>]?ka_7)
same => n,Goto(ka_7_end)
same => n(ka_7),Set(__KMAIL_TO=x)
same => n,Set(__KMAIL_SUBJ=y)
same => n,Set(MAIL_RESULT=${CURL(...)})
same => n(ka_7_end),NoOp()
```

Это единственный способ применить условие к блоку, не вкладывая `ExecIf` в каждую строку с `CURL`.
Решение между двумя формами — за планировщиком, но **тест на многострочное действие с условием обязателен**
в обоих случаях.

### Pattern 6: `normalizeTarget` — единственная точка тенант-скоупинга

**What:** одна функция, принимающая тип цели и «источник значения» (D-20), возвращающая готовую строку цели.
**When to use:** D-21; заменяет 4 места, где `${EXTEN}` попадает в конфиг сырым.

Конвенции **проверены тремя независимыми источниками** и совпадают:

| Тип цели | Конвенция | Подтверждено |
|----------|-----------|--------------|
| Очередь | `q{exten}_{uid}` | `queues.service.ts` §`buildQueueName`; `cdr-access-scope.ts:77` (`%q{n}_{tenantId}%`) |
| Внутренний | `e{exten}_{uid}` | `pjsipDialTarget`; `cdr-access-scope.ts:59` (`%e{e}_{tenantId}%`) |
| WebRTC-companion | `ew{exten}_{uid}` | `pjsipDialTarget`; `cdr-access-scope.ts:60` (`%ew{e}_{tenantId}%`) |
| Группа (**после** D-33) | `group_{exten}_{uid}` | целевое состояние; **сегодня** `group_{group.uid}_{vpbx}` (`call-group-dialplan.util.ts:146`) |
| Локальный контекст списка | `ctx-{uid}` | `dialplan.util.ts:223` |
| Контекст маршрута | `{contextName}{uid}` с guard `endsWith` | `routes.service.ts:376-379` |

```typescript
export type TargetKind = 'queue' | 'exten' | 'group' | 'context';
export type ValueSource =
  | { source: 'fixed'; value: string }
  | { source: 'route_pattern' }                  // ${EXTEN}
  | { source: 'variable'; name: string }         // ${<name>}
  | { source: 'phonebook'; phonebookUid: number };

export function normalizeTarget(kind: TargetKind, src: ValueSource, uid: number, opts?: { webrtc?: boolean }): string {
  const raw =
    src.source === 'fixed'         ? AsteriskDialplanUtils.sanitizeDialplanInput(src.value)
  : src.source === 'route_pattern' ? '${EXTEN}'
  : src.source === 'variable'      ? `\${${AsteriskDialplanUtils.sanitizeDialplanInput(src.name)}}`
  : '${PB_RESULT}';

  switch (kind) {
    case 'queue': return `q${raw}_${uid}`;
    case 'group': return `group_${raw}_${uid}`;
    case 'exten': return AsteriskDialplanUtils.pjsipDialTarget(raw, uid, { webrtc: opts?.webrtc !== false });
    case 'context': {
      const suffix = String(uid);
      return raw.endsWith(suffix) ? raw : `${raw}${suffix}`;   // D-42: тот же guard, что buildContextName
    }
  }
}
```

**UI обязан показывать результат** (UI-SPEC Surface C): в режиме «По маске маршрута» вместо контрола значения —
read-only моно-чип `q{номер}_{тенант}`. Иначе D-21 остаётся невидимой магией, и пользователь не отличит рабочую
конфигурацию от сломанной.

### Pattern 7: Миграция как standalone ts-node скрипт (канон проекта)

**What:** каждая миграция — отдельный файл `migrate-<name>.ts` в папке модуля, идемпотентный, запускается вручную.
**When to use:** все схемные изменения фазы.

```typescript
/**
 * <Что и зачем>.
 *
 * Run (from packages/backend):
 *   npx ts-node src/modules/<module>/migrate-<name>.ts
 */
import { Sequelize } from 'sequelize-typescript';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

async function alterIdempotent(sequelize: Sequelize, label: string, sql: string): Promise<void> {
  try {
    await sequelize.query(sql);
    console.log(`[migration] ${label}: applied`);
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('Duplicate column name') || msg.includes('Duplicate key name')
        || msg.includes('check that column/key exists') || msg.includes('already exists')
        || msg.includes('Duplicate')) {
      console.log(`[migration] ${label}: already applied — ok`);
      return;
    }
    throw err;
  }
}

async function main() {
  const sequelize = new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'krasterisk',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'krasterisk',
    logging: console.log,
  });
  try {
    await alterIdempotent(sequelize, '<table>.<column>', `ALTER TABLE … ADD COLUMN …`);
    console.log('[migration] <name> complete.');
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
```

Прецедент unit-теста миграции в проекте есть: `cloud-admin/migrate-hub-modules-phase8.spec.ts`.
Для data-миграций (перезапись JSON-колонок) тест **обязателен** — см. `## Validation Architecture`.

### Anti-Patterns to Avoid

- **`onUpdate(id, field: string, value: any)`** — текущий контракт (`SortableActionItem.tsx:18`). Строковый путь
  поля (`'params.timeout'`, `'condition.dialstatus'`) убивает типизацию и заставляет каждый app-компонент знать
  собственный id. D-06 требует полного отказа.
- **`registry[type] || registry.hangup`** (`DialplanAppsEditor.tsx:108`) — молча превращает неизвестное действие
  в Hangup. Никогда.
- **Tailwind-классы в `features/`** — `SortableActionItem.tsx:83` (`bg-black/20`, `border-white/10`),
  `:91` (`text-white/40`). ARCHITECTURE запрещает; это и есть W7.
- **`overflow-x-auto` на обёртке редактора** (`DialplanAppsEditor.tsx:99`) — причина W3. Убирается,
  заменяется `min-width: 0` на детях grid/flex.
- **`Date.now() + Math.random()` как id шага** (`DialplanAppsEditor.tsx:55`) — коллизии при быстром добавлении
  и нестабильные ключи React. `crypto.randomUUID()`.
- **Хардкод `z-index`** для наложения Sheet поверх модалки — запрещён ARCHITECTURE. Санкционированный fallback —
  токен `--z-index-modal-nested: 55` в `globals.css` + класс `.layer-modal-nested`.
- **Прямая передача `${EXTEN}` в `Dial`/`Queue`/`Gosub`/`ConfBridge`** — 4 подтверждённых места.
- **`opacity < 1` для выключенного шага** — UI-SPEC запрещает: выключенный шаг всё ещё надо читать.
- **`invalidatesTags` + refetch вместо optimistic toggle** для флагов D-17 — ARCHITECTURE MUST требует
  `onQueryStarted` + `patchResult.undo()`.
- **Реюз `cdr-public.controller.ts` для голосовой почты** — стрим без JWT (D-59 запрещает явно).
- **Уведомление как следующий шаг после `Record()`** — не выполнится при отбое абонента. См. Pitfall 1.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Подпись и проверка ссылки с TTL (D-59) | Свой HMAC + собственный формат токена | `@nestjs/jwt` `JwtService.signAsync(payload, { expiresIn, audience })`, уже подключён для auth | Собственная подпись — классический источник уязвимостей (отсутствие `alg`-pinning, timing-атаки на сравнение); JWT в проекте уже сконфигурирован |
| Тенант-скоупинг цели | Свой хелпер на приложение | `normalizeTarget` (Pattern 6), одна функция | Ровно из «на приложение» и выросли 4 расхождения; конвенция должна быть в одном месте с одним тестом |
| Санитизация значений, попадающих в конфиг Asterisk | Свои `replace(/[;\n]/g,'')` | `AsteriskDialplanUtils.sanitizeDialplanInput` / `sanitizeShellInput` / `sanitizeFilePath` / `sanitizeTemplate` | Набор уже есть и уже покрывает инъекции через перевод строки и запрещённые функции (`SHELL`, `SYSTEM`, `AGI`) |
| Многоканальное уведомление (D-28, D-54) | Свой отправщик на канал | `NotificationDispatcherService` + `notification_integrations` (6 каналов) | Phase 6 это уже сделала; `sendmailpeer`/`telegram` — legacy-обходы того же |
| Расшифровка аудио | Свой HTTP-клиент к Yandex/Whisper | `SttProviderFactory.transcribe(engine, buffer, language)` | Тенант-скоуп, маскирование токенов, два провайдера и fallback со streaming на batch уже реализованы |
| Синтез речи (D-30) | Свой вызов TTS | `TtsProviderFactory.synthesizeBatch(engine, text)` | Возвращает готовый PCM16-буфер |
| Access-scope для вкладки сообщений (D-58) | Свой `WHERE` по тенанту | `buildCdrLinkedidAccessClause` + `ensureCallVisible` | Учитывает `linkedid`-сиблинги; свой фильтр потеряет trunk/queue-плечи и покажет чужие звонки |
| Плюрализация предупреждений (D-24, UI-SPEC Surface H) | Свой `count === 1 ? … : …` | `i18next` ключи `_one`/`_other`; ru раскрывается в `_one`/`_few`/`_many` | Ручное ветвление на русском даёт «1 шаги» и «22 шага» неверно |
| Range-запросы для плеера | Свой парсер `Range` | Скопировать/вынести уже написанный в `cdr.service.ts:461-501` | 416, suffix-range, clamp — всё уже правильно обработано |
| DnD-доступность | Свои `aria-live` объявления | `@dnd-kit` `announcements` + `aria-roledescription="sortable"` | Штатный API библиотеки |
| Ручной ре-парсинг WAV | «Отрезать 44 байта» инлайном в сервисе | Отдельный `wav-pcm.util.ts` с чтением чанков и unit-тестом | Заголовок Asterisk обычно 44 байта, но RIFF допускает `LIST`/`fact`-чанки; молчаливый сдвиг даёт шум вместо речи и невоспроизводимый баг |

**Key insight:** почти всё, что нужно этой фазе, в проекте **уже написано, но применено ровно один раз** —
`pjsipDialTarget` только в `toexten`, CURL→Nest только в `sendmail`/`notify`, access-scope только в CDR,
optimistic toggle только в паре мест. Фаза на 70% состоит из того, чтобы **поднять существующий локальный приём
до общего правила**, а не из написания нового кода. Планировщик, который начнёт с «написать новое приложение»,
а не с «вынести и обобщить существующее», сделает фазу вдвое больше, чем нужно.

---

## Runtime State Inventory

Фаза — refactor + migration, поэтому раздел обязателен. Ни одна категория не оставлена пустой.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | **6 JSON-колонок в 5 таблицах** содержат `IRouteAction[]` с legacy-типами: `routes.actions` (`route.model.ts:35`), `route_phonebook_bindings.actions` (`route-phonebook-binding.model.ts:41`), `ivrs.menu_items[].actions` (`ivr.model.ts:39`), `vr_keywords.actions` (`keyword.model.ts:28`), `voice_robots.fallback_action` и `voice_robots.max_retries_action` (`voice-robot.model.ts:43,49`). Плюс `routes.raw_dialplan` — свободный текст, может содержать `VoiceMail(`, `AGI(say.php`, `/usr/scripts/*.php` | **Data-миграция** (не только code edit): один скрипт, проходящий по всем 6 колонкам и переписывающий `type`+`params` по таблице соответствий D-12/D-28/D-29/D-51/D-54. `raw_dialplan` **не трогать** — только отчёт-предупреждение в лог, потому что это пользовательский текст |
| **Stored data** | Контекст группы вызова сегодня `group_{group.uid}_{vpbx}` (`call-group-dialplan.util.ts:146`), а `routes.actions[].params.group` хранит **`uid` группы**, не номер. D-33 меняет конвенцию на `group_{exten}_{uid}` | **Двухшаговая миграция:** (1) `ALTER TABLE call_groups ADD COLUMN exten`, заполнить (при отсутствии номера — сгенерировать/потребовать ввода), (2) переписать `params.group` из uid в exten во всех 6 колонках выше. Пока оба не сделаны, генерировать **оба** контекста или ломается каждый существующий `togroup`. Это самый рискованный пункт миграции в фазе |
| **Live service config** | Сгенерированные файлы dialplan на хосте Asterisk (контексты маршрутов, `group_*`, `ivr_*`). Переименование контекста группы (D-33) и удаление приложений делает старые файлы невалидными | **Полная регенерация + apply** после миграции: `DialplanApplyService` по всем тенантам, затем `dialplan reload`. Отдельная задача плана, не побочный эффект |
| **Live service config** | `voicemail.conf` на хосте Asterisk, на который рассчитывает `VoiceMail(${exten}@default,u)` (`dialplan.util.ts:291`). В проекте провизионинга ящиков нет | После D-54 файл становится мёртвым. **Никаких действий в коде**, но в план — пункт документации «voicemail.conf больше не используется», иначе через полгода никто не поймёт, можно ли его удалить |
| **Live service config** | PHP-скрипты на хосте: `/usr/scripts/sendmailpeer.php`, `telegram.php`, `say.php`, `webhook.php`, `exten_setclid.php`, `check_blacklist.php`, `check_listbook.php` | После D-28/D-30/D-31 остаются **орфанами** (вреда не несут). В плане — пункт «перечислить осиротевшие скрипты в SUMMARY», удаление с хоста — вне scope |
| **Live service config** | Файлы промптов `/usr/records/{uid}/sounds/*` — путь захардкожен в `dialplan.util.ts:240,245`, **в отличие** от CDR, который берёт базу из `system_settings.records_base_path` (`cdr.service.ts:294`) | Слияние по D-51 — хороший момент привести к одному источнику. **Но это меняет поведение на проде**: если `records_base_path` отличается от `/usr/records`, все существующие промпты «пропадут». Требуется явное решение планировщика + `checkpoint:human-verify` |
| **OS-registered state** | Ничего. Проверено: в репозитории нет Task Scheduler / systemd / pm2-регистраций, привязанных к именам типов действий или контекстов. Планировщик отчётов callcenter (`callcenter-report-schedules`) хранит расписания в БД, а не в ОС | **Нет действий** |
| **Secrets / env vars** | `DIALPLAN_API_KEY` (используется как `&api_key=` во всех CURL→Nest: `dialplan.util.ts:272,338`) — новые endpoint-ы голосовой почты обязаны валидировать его тем же способом. `CC_AI_KEY_SECRET` (AES-ключ для `CcAiProvider.encrypted_api_key`) — понадобится LLM-клиенту. `records_base_path` / `records_base_url` — лежат в `system_settings`, **не** в `.env`. JWT-секрет — для токен-ссылок D-59 | **Только чтение существующих**; новых секретов фаза не вводит. `dotenv` в `packages/backend/package.json` **не объявлен** явно (транзитивный через `@nestjs/config`) — migrate-скрипты его импортируют и работают, но это скрытая зависимость: если план добавляет миграции, стоит проверить `npx ts-node` на пустом `node_modules` |
| **Build artifacts / installed packages** | `packages/backend/tsconfig.tsbuildinfo` (в git, помечен модифицированным). **`packages/shared` собирается в `dist` и потребляется бэкендом и фронтендом через workspace** — правка `route.types.ts` без пересборки shared **не видна** ни бэкенду, ни фронту | **Обязательный шаг в каждой задаче, меняющей `packages/shared`:** `npm run build -w @krasterisk/shared` до запуска тестов. Это единственная причина, по которой корневой `npm run dev:backend` начинается именно с этой команды. Планировщик, который положит правку типов и тест в одну задачу без пересборки, получит «зелёные» тесты на старых типах |

---

## Generator Branch Coverage — verified, not assumed

`AsteriskDialplanUtils.actionToDialplan` содержит **ровно 29 `case`-ветвей**. Тесты
`dialplan.util.spec.ts` (27 `it`) касаются **7** типов действий.
**ROADMAP заявляет «21 из 29 не покрыты» — верное число 22.** Расхождение: `setclid_list` существует
**и как отдельный `ActionType`** (`dialplan.util.ts:253`), **и как `mode` внутри `callerid`**
(`:347+`). Тест `mode setclid_list preserves exten_setclid.php SHELL branch` (`spec.ts:176`) проверяет
**ветвь `callerid`**, а самостоятельная ветвь `setclid_list` остаётся непокрытой.

### Покрыто (7)

| ActionType | Строка генератора | Тесты |
|-----------|-------------------|-------|
| `busy` | `:329` | 5 тестов обёртки `DIALSTATUS` (`spec.ts:7-60`) — `busy` использован как носитель условия |
| `hangup` | `:452` | 3 теста `causecode` (`spec.ts:63-86`) |
| `togroup` | `:207` | 1 тест `Gosub(group_<uid>_<vpbx>)` (`spec.ts:89`) |
| `notify` | `:332` | 1 тест `Set(__KNOTIFY_*)` + CURL + URIENCODE (`spec.ts:112`) |
| `callerid` | `:347` | 4 теста: `static`, `phonebook`, `setclid_list`, `carousel` (`spec.ts:148-207`) |
| `trunk_carousel` | `:388` | 1 тест `random_then_failover` (`spec.ts:222`) |
| `toexten` | `:155` | 4 теста `pjsipDialTarget` / WebRTC-fork (`spec.ts:250-277`) |

### НЕ покрыто (22) — план меняет их слепо, если не сделать Wave 0

| # | ActionType | Строка | Что именно меняется в фазе | Риск |
|---|-----------|--------|---------------------------|------|
| 1 | `totrunk` | `:138` | multi-line condition (D-43), strip/prepend (D-26), источник значения (D-20) | HIGH — самое используемое исходящее действие |
| 2 | `toqueue` | `:188` | нормализация цели (D-21), `QUEUE_PRIO`, `announceoverride` (D-32), `QUEUESTATUS` (D-22) | **CRITICAL** — сегодня `Queue(${EXTEN})` при пустом `params.queue` |
| 3 | `toivr` | `:200` | флаг `terminal` (D-24), защита от петель (D-25) | MED |
| 4 | `voicerobot` | `:212` | схема параметров (D-07) | LOW |
| 5 | `tolist` | `:219` | схема, `ctx-{uid}` остаётся | LOW |
| 6 | `toroute` | `:232` | двойной суффикс (D-42), `terminal` (D-24), петли (D-25) | HIGH |
| 7 | `playprompt` | `:238` | сливается в «Воспроизведение» (D-51), миграция типа | HIGH |
| 8 | `playback` | `:243` | сливается в «Воспроизведение» (D-51), миграция типа | HIGH |
| 9 | `setclid_custom` | `:248` | потеря params (D-43), имя абонента (D-37) | MED |
| 10 | `setclid_list` | `:253` | двойной `SHELL()` (D-37), PHP→CURL (D-31) | HIGH |
| 11 | `sendmail` | `:258` | сливается в `notify` (D-28); multi-line condition (D-43) | HIGH |
| 12 | `sendmailpeer` | `:283` | **hard remove** → `notify` (D-28), недостижимые params (D-43) | HIGH |
| 13 | `telegram` | `:286` | **hard remove** → `notify` (D-28) | HIGH |
| 14 | `voicemail` | `:289` | **hard remove** → кастомная ВП (D-54) | **CRITICAL** |
| 15 | `text2speech` | `:294` | `AGI(say.php)` → внутренний TTS (D-30) | HIGH |
| 16 | `asr` | `:299` | **hard remove** (D-29) | MED |
| 17 | `keywords` | `:302` | **hard remove** (D-29) | MED |
| 18 | `webhook` | `:305` | `SHELL(webhook.php)` → CURL→Nest (D-31), результат в условия (D-47) | HIGH |
| 19 | `confbridge` | `:308` | только схема параметров (D-41); тенант **не** чинится | LOW (риск зафиксирован) |
| 20 | `cmd` | `:313` | запись в `action_logs` (D-42) | MED |
| 21 | `tofax` | `:321` | **hard remove** (D-29) | LOW |
| 22 | `label` | `:326` | битое `NoOp())` + **потеря условия** (D-43), логические примитивы (D-44) | HIGH |

### Wave 0 — обязательное условие

**До первой правки генератора** нужны характеризационные (golden) тесты на все 22 ветви, фиксирующие
**текущий** вывод. Иначе рефакторинг из D-43 (единая `wrapEachLine`) не отличит «исправил баг»
от «сломал работавшее». Это самая дешёвая страховка в фазе: 22 теста по 4-6 строк каждый,
все на чистой функции без моков, поднимают покрытие ветвей с 24% до 100% и превращают
последующие правки в проверяемые diff'ы.

---

## Common Pitfalls

### Pitfall 1: `Record()` с опцией `k` сохраняет файл, но не возвращает управление в цепочку

**What goes wrong:** шаг «Голосовая почта» построен как «`Record()` → `notify` → STT» в виде трёх последовательных
приоритетов. Абонент, дослушав приглашение, **бросает трубку** (это большинство — ровно тот аргумент, которым
обоснован D-55). Файл благодаря `k` сохранён, `RECORD_STATUS=HANGUP` выставлен, но следующий приоритет
**не выполняется**: канал уходит в teardown. Уведомление не отправлено, расшифровка не запущена. Снаружи это
выглядит как «сообщения иногда пропадают» — и диагностируется месяцами.

**Why it happens:** официальная документация Asterisk 22 для `Record()`: *«If the user hangs up during a recording,
all data will be lost and the application will terminate»*. Опция `k` — *«Keep recorded file upon hangup»* — отменяет
**потерю файла**, но не отменяет **завершение приложения и разрыв канала**. `k` спасает данные, а не поток управления.
CONTEXT (D-55) фиксирует первую половину и молчит про вторую.

**How to avoid:** до `Record()` повесить hangup handler — тогда точка сбора одна для обоих исходов:

```
same => n,Set(CHANNEL(hangup_handler_push)=krsk-vm-done,s,1)
same => n,Record(...,k...)
same => n,Goto(krsk-vm-done,s,1)          ; нормальные исходы (DTMF/SILENCE/TIMEOUT/OPERATOR)
```

Синтаксис подтверждён документацией: `Set(CHANNEL(hangup_handler_push)=[[context,]exten,]priority[(arg1[,…])])`,
и хендлеры «follow the channel», то есть выполняются независимо от того, где канал был в момент отбоя —
в отличие от классического `h`-extension, привязанного к контексту.

**Warning signs:** в `voicemail_messages` строки со `status='pending'`, которых больше, чем отправленных
уведомлений; в CDR звонки с `disposition` ≠ ANSWERED и существующим файлом записи без строки в таблице сообщений.
**Тест:** unit-тест генератора обязан утверждать, что `hangup_handler_push` эмитится **до** `Record(`
(порядок строк, не только присутствие).

### Pitfall 2: `${EXTEN}` в цели без нормализации — цель не существует

**What goes wrong:** пользователь ставит «Очередь по маске маршрута», генератор эмитит `Queue(${EXTEN},thH,,,)`
(`dialplan.util.ts:189,197`), Asterisk ищет очередь с именем `4500`, а в `queue_table` она называется `q4500_42`.
`QUEUESTATUS` не выставляется, `DIALSTATUS` тоже (`Queue()` его не ставит), цепочка идёт дальше вслепую.
То же у `togroup` (`:208-209`: `group_${EXTEN}_{uid}` против реального `group_{uid}_{vpbx}` — **двойное**
расхождение), `confbridge` (`:309-310`) и `voicemail` (`:290-291`).

**Why it happens:** каждое приложение решает вопрос цели само; корректная реализация есть, но применена
ровно один раз — `pjsipDialTarget` в `toexten`.

**How to avoid:** Pattern 6 — `normalizeTarget` как единственный путь; ни одно приложение не собирает имя цели
строкой. Проверяется тестом «для каждого `TargetKind` результат матчит регэксп конвенции», плюс негативный тест
«в выводе генератора нет подстроки `Queue(${EXTEN}` / `Gosub(group_${EXTEN}`».

**Warning signs:** в логах Asterisk `No such queue`, `Cannot find extension 'start' in context 'group_...'`.

### Pitfall 3: условие применяется только к первой строке многострочного действия

**What goes wrong:** `sendmail` эмитит 4 строки (`:274-280`), а `wrapper`/`closing` наклеены только на первую
(`:275`). При условии `DIALSTATUS=NOANSWER` получается: письмо-переменные ставятся условно, а сам `CURL`
выполняется **всегда** — письмо уходит на каждый звонок. Тот же дефект в `totrunk` (`:152`), `toexten` (`:185`),
`notify` (`:344`), `callerid`, `trunk_carousel`. И **ещё раз, независимо**, на уровне time-group в
`routes.service.ts:361-367`: `dp = \`ExecIf($["\${WT_${tgUid}}"="1"]?${dp})\`` при многострочном `dp` даёт
`ExecIf($[...]?Set(__KMAIL_TO=x)\nsame => n,Set(...))` — синтаксически битую конструкцию, где закрывающая скобка
оказывается в конце последней строки.

**Why it happens:** `dp` — плоская строка с `'\nsame => n,'` внутри, а обёртка написана в предположении «одна строка».

**How to avoid:** Pattern 5 (`wrapEachLine` либо `GotoIf` + метка). Обязательный тест: действие с ≥2 строками
**и** условием — каждая строка либо обёрнута, либо лежит внутри блока метки; ни одна не выполняется безусловно.

**Warning signs:** `dialplan show` с несбалансированными скобками; уведомления, приходящие вне условия.

### Pitfall 4: `label` теряет условие и эмитит невалидный dialplan

**What goes wrong:** `dp = \`NoOp()${closing}\`` (`:327`). Если у шага есть `condition.dialstatus`, `closing = ')'`,
и результат — `NoOp())`. Одновременно `wrapper` **не подставлен вовсе**, то есть условие молча выброшено.
Два дефекта в одной строке.

**How to avoid:** привести к общей форме `wrapCondition(...)`; при D-44 `label` перестаёт быть `NoOp` и становится
реальной приоритетной меткой `same => n(<label>),NoOp()`.

**Warning signs:** `dialplan reload` с parse error на конкретном контексте.

### Pitfall 5: два независимых списка допустимых значений условия

**What goes wrong:** D-22 расширяет условия, разработчик добавляет `QUEUESTATUS` в генератор
(`VALID_DIALSTATUSES`, `dialplan.util.ts:5-8`) и забывает про DTO (`ValidDialstatuses`,
`route-action.dto.ts:26-29`) — или наоборот. В первом случае бэкенд отвергает валидную конфигурацию с 400,
во втором конфигурация сохраняется и молча не эмитится.

**How to avoid:** список переезжает в `packages/shared` **один раз**, оба места импортируют его. Тест-инвариант:
«множество значений в DTO === множество значений в генераторе». Тот же приём для `ActionType`: `ActionTypesList`
(`route-action.dto.ts:15-24`) — строковый массив, компилятор его с `ActionType` не сверяет, тогда как
`dialplanAppsRegistry: Record<ActionType, …>` (`registry.ts:17`) **сверяет**. То есть удаление типа из
`ActionType` **сломает сборку фронта** (это хорошо) и **не тронет** DTO и генератор (это опасно).

**Warning signs:** конфигурация сохраняется, но не появляется в `extensions.conf`.

### Pitfall 6: удаление `telegram` как действия ломает `telegram` как канал уведомлений

**What goes wrong:** `grep -r "'telegram'"` даёт 15+ совпадений, из которых **только два** относятся к типу
действия (`route.types.ts:160`, `dialplan.util.ts:286` + `registry.ts:41` + `GenericApp.tsx:49` + `route-action.dto.ts:19`
+ i18n). Остальные — `NotificationChannel` (`shared/src/types/notification.types.ts:2`,
`notification-integration.model.ts:18,21`, `notification-provider.interface.ts:8`,
`notification-integration.dto.ts:6`, `migrate-notifications-phase6.ts:38`, весь frontend `features/notifications`).
Массовое удаление по строке снесёт рабочий канал уведомлений.

Такая же ловушка у **`keywords`**: `keyword.model.ts:19` — это колонка `keywords: string` модуля `voice-robots`
(ключевые слова голосового робота), а `voice-robots.service.ts:351` читает её. С типом действия `keywords` они
не связаны никак.

**How to avoid:** удалять **по символам**, а не по строкам: сначала убрать значение из `ActionType` в
`packages/shared`, пересобрать shared, и идти по ошибкам компилятора. Компилятор покажет `registry.ts`
(`Record<ActionType, …>` перестанет быть полным) и `DialplanAction`. Остальные четыре места
(`route-action.dto.ts` строковый массив, `dialplan.util.ts` `switch`, `GenericApp.tsx` `switch`, i18n `ru.ts`/`en.ts`)
компилятор **не** покажет — их закрывает чек-лист и тест-инвариант из Pitfall 5.

**Warning signs:** тесты `notifications` падают после «чистки legacy» — значит удалили не то.

### Pitfall 7: `.mp3`-предположение CDR не подходит для файлов `Record()`

**What goes wrong:** вкладка голосовых сообщений (D-58) переиспользует `resolveRecordingFile` /
`streamRecording`. Но `safeRecordFilePath` (`cdr.service.ts:303-310`) **жёстко добавляет `.mp3`**
(`path.resolve(baseResolved, \`${rel}.mp3\`)`), а `streamRecording` (`:457`) всегда отдаёт
`Content-Type: audio/mpeg` и `filename="<id>.mp3"` (`:454`). `Record()` пишет `wav`/`gsm`/`sln`.
Прямой реюз даст 404 «Recording file not found» на существующем файле.

**How to avoid:** параллельный резолвер для голосовой почты с явным расширением из БД
(`voicemail_messages.file` + `format`), с **тем же** path-traversal-guard (`rel.includes('..')` +
`fileResolved.startsWith(baseResolved)`) и правильным MIME. Переиспользуются `ensureCallVisible`,
access-scope и логика `Range` — а не `safeRecordFilePath`.

**Warning signs:** плеер показывает пустую длительность; 404 при существующем файле на диске.

### Pitfall 8: правка `packages/shared` без пересборки

**What goes wrong:** задача меняет `route.types.ts` и запускает `npm run test:backend`. Тесты зелёные —
но бэкенд компилируется против **старого** `packages/shared/dist`. Ошибка проявится только на `npm run build`
или в рантайме.

**How to avoid:** `npm run build -w @krasterisk/shared` — первый шаг любой задачи, которая трогает shared.
Корневой `dev:backend` именно с этого и начинается.

### Pitfall 9: переименование контекста группы обрывает существующие маршруты

**What goes wrong:** D-33 переводит контекст с `group_{uid}_{vpbx}` на `group_{exten}_{uid}`. Генератор групп
и генератор `togroup` правятся в разных задачах — между ними каждый существующий вызов группы указывает
на несуществующий контекст.

**How to avoid:** одна атомарная задача, включающая: миграцию `call_groups.exten`, переписывание `params.group`
во всех 6 JSON-колонках, правку **обоих** генераторов и полную регенерацию dialplan. Либо переходный период,
в котором генератор групп эмитит **оба** контекста (новый + `include => ` старого). Второе безопаснее для прода
и снимает требование «всё в одном коммите».

**Warning signs:** `Cannot find extension 'start' in context 'group_...'` в логах Asterisk после деплоя.

### Pitfall 10: `Sheet` внутри `Dialog` — наложение не гарантировано z-index'ом

**What goes wrong:** `SheetContent` и `DialogContent` используют **один и тот же** класс `layer-modal`
(`Sheet.tsx:35`, `Dialog.tsx:33`, `globals.css:73` → `--z-index-modal: 50`). Наложение вложенного `Sheet`
поверх host-модалки обеспечивается только порядком монтирования порталов Radix. В самом глубоком случае
(`RoutePhonebooksTab` внутри `RouteFormModal` — 3 уровня) это не проверено.

**How to avoid:** проверка в рантайме на самом глубоком случае — обязательный manual-only пункт валидации.
Санкционированный fallback (UI-SPEC ⚠ unresolved): токен `--z-index-modal-nested: 55` + класс
`.layer-modal-nested`. Инлайн `z-index` запрещён.

---

## Code Examples

### Голосовая почта: полный dialplan-шаблон (D-54…D-56)

```
; --- Шаг «Голосовая почта» ---
same => n,Set(__KVM_UNIQUEID=${UNIQUEID})
same => n,Set(__KVM_FILE=/usr/records/42/vm/${UNIQUEID}-%d)
; ОБЯЗАТЕЛЬНО до Record(): единственная точка сбора для обоих исходов (Pitfall 1)
same => n,Set(CHANNEL(hangup_handler_push)=krsk-vm-done-42,s,1)
; noanswer/n → сначала Progress(), иначе early media может не пойти (D-52)
same => n,ExecIf($["${KVM_NOANSWER}"="1"]?Progress())
same => n,Playback(/usr/records/42/sounds/vm-greeting,noanswer)
; k — обязательна (D-55). q подавляет beep, o — «0 для оператора», y — стоп по любой цифре.
same => n,Record(${KVM_FILE}.wav,3,120,ky)
same => n,Goto(krsk-vm-done-42,s,1)

[krsk-vm-done-42]
exten => s,1,NoOp(Voicemail done: ${RECORD_STATUS})
; RECORDED_FILE — итоговое имя без расширения (после раскрытия %d)
same => n,ExecIf($["${RECORDED_FILE}" != ""]?Set(VM_RESULT=${CURL(<backend>/internal/dialplan/voicemail,uniqueid=${URIENCODE(${KVM_UNIQUEID})}&file=${URIENCODE(${RECORDED_FILE})}&status=${RECORD_STATUS}&clid=${URIENCODE(${CALLERID(num)})}&exten=${URIENCODE(${ORIGEXTEN})}&user_uid=42&api_key=…)}))
same => n,Return()
```

Источники семантики: `Record()` — опции `k`/`q`/`o`/`x`/`y`/`n`/`s`/`u`/`a`/`t`, `%d`,
`RECORD_STATUS` ∈ {`DTMF`, `SILENCE`, `SKIP`, `TIMEOUT`, `HANGUP`, `ERROR`, **`OPERATOR`**},
`RECORDED_FILE` без расширения — [CITED: docs.asterisk.org · Asterisk 22 · Record].
Hangup handler — [CITED: docs.asterisk.org · Configuration/Dialplan/Subroutines/Hangup-Handlers].
`Progress()` перед `Playback(...,noanswer)` — [CITED: docs.asterisk.org · Early Media and the Progress Application].

**Важно для D-56:** `RECORD_STATUS` имеет **7** значений, а не 6 — опция `o` устанавливает `OPERATOR`
вместо `DTMF`. В D-56 `OPERATOR` не перечислено; пресеты условий (UI-SPEC optgroup «Запись сообщения»)
должны его включать, иначе «нажал 0 для оператора» неотличимо от «нажал #».

### Единое приложение «Воспроизведение»: выбор приложения Asterisk (D-51, D-52)

```typescript
type PlaybackMode = 'plain' | 'control' | 'menu';

function emitPlayback(p: PlaybackParams, uid: number): string {
  const file = AsteriskDialplanUtils.sanitizeFilePath(p.file);
  const path = `${BASE}/${uid}/sounds/${file}`;
  const lines: string[] = [];

  // D-52: у Playback/ControlPlayback нет langoverride → Set(CHANNEL(language))
  if (p.language && p.mode !== 'menu') {
    lines.push(`Set(CHANNEL(language)=${AsteriskDialplanUtils.sanitizeDialplanInput(p.language)})`);
  }
  // D-52: early media. Playback сам отвечает на канал, если опции не заданы,
  // поэтому при noanswer нужен явный Progress() — иначе звук может не пойти.
  if (p.noanswer) lines.push('Progress()');

  switch (p.mode) {
    case 'plain':
      lines.push(`Playback(${path}${p.noanswer ? ',noanswer' : p.skip ? ',skip' : ''})`);
      break;
    case 'control':
      // ControlPlayback(file,skipms,ff,rew,stop,pause,restart,options)
      lines.push(`ControlPlayback(${path},${p.skipms ?? 3000},${p.ff ?? '#'},${p.rew ?? '*'},${p.stop ?? ''},${p.pause ?? ''})`);
      break;
    case 'menu':
      // D-53: меняет поток управления — совпадение цифры уводит вызов из цепочки
      lines.push(`BackGround(${path},${p.bgOptions ?? ''},${p.langoverride ?? ''},${p.context ?? ''})`);
      break;
  }
  return lines.join('\nsame => n,');
}
```

Семантика подтверждена: *«The Playback application answers the channel if no options are specified»*;
`noanswer` — *«Playback without answering, otherwise the channel will be answered before the sound is played»*;
`skip` — *«Do not play if not answered»*; `say`/`mix` — say.conf
[CITED: docs.asterisk.org · Asterisk 22 · Playback]. Это подтверждает D-38: явный `Answer()` не нужен,
управлять надо противоположным.

### Проекция ошибок DTO на шаг (D-11, backstop №2)

```typescript
// backend
export interface ActionValidationError { actionId: string; path: string; message: string }

// 400 { statusCode: 400, message: 'Invalid actions', errors: ActionValidationError[] }

// frontend
const errorsByStep = useMemo(() => {
  const map = new Map<string, ActionValidationError[]>();
  const unmapped: ActionValidationError[] = [];
  for (const e of serverErrors) {
    if (e.actionId && actions.some((a) => a.id === e.actionId)) {
      map.set(e.actionId, [...(map.get(e.actionId) ?? []), e]);
    } else {
      unmapped.push(e);   // UI-SPEC Surface F: молча теряться они не должны
    }
  }
  return { map, unmapped };
}, [serverErrors, actions]);
```

### Round-trip строки опций (D-27, backstop №4)

```typescript
export interface ParsedOptions {
  known: string[];                                   // ['t','T']
  parameterized: string[];                           // ['U(krsk-on-answer)','L(60000:30000)']
  order: ReadonlyArray<{ kind: 'known' | 'param'; value: string }>;  // сохраняет позиции
}

export function parseOptions(raw: string, declared: ReadonlySet<string>): ParsedOptions;
export function serializeOptions(p: ParsedOptions): string;

// ИНВАРИАНТ, который обязан быть тестом:
//   serializeOptions(parseOptions(s, declared)) === s   для любого s
```

### WAV → PCM16 для STT (D-57)

```typescript
/**
 * Asterisk пишет 8kHz 16-bit mono PCM WAV. ISttProvider.transcribe ожидает
 * headerless PCM16 8kHz mono, поэтому заголовок надо снять — но не «первые 44 байта»:
 * RIFF допускает LIST/fact-чанки перед data.
 */
export function parseWavPcm16(buf: Buffer): { pcm: Buffer; sampleRate: number; channels: number } {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file');
  }
  let offset = 12, sampleRate = 0, channels = 0, bits = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === 'data') {
      if (bits !== 16) throw new Error(`Expected 16-bit PCM, got ${bits}`);
      return { pcm: buf.subarray(body, Math.min(body + size, buf.length)), sampleRate, channels };
    }
    offset = body + size + (size % 2);   // чанки выравниваются по чётной границе
  }
  throw new Error('No data chunk');
}
```

### LLM-саммари: тонкий клиент вместо «переиспользования» (D-57)

```typescript
/**
 * В проекте НЕТ сервиса вызова LLM: ai-agents — это CRUD-реестр CcAiProvider,
 * а ai-chat.service.ts зовёт внешний aiPBX. Пишем минимальный OpenAI-совместимый
 * клиент по образцу custom-http-stt.provider.ts, без новых зависимостей.
 */
@Injectable()
export class LlmSummaryService {
  async summarize(provider: CcAiProvider, transcript: string): Promise<string> {
    const key = decryptApiKey(provider.encrypted_api_key);   // CC_AI_KEY_SECRET
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (provider.auth_type === 'bearer') headers.Authorization = `Bearer ${key}`;
    else if (provider.auth_type === 'api_key_header') headers['X-API-Key'] = key;

    const res = await fetch(provider.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: provider.defaults?.model,
        temperature: provider.defaults?.temperature ?? 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_RU },
          { role: 'user', content: transcript.slice(0, MAX_TRANSCRIPT_CHARS) },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const json = await res.json();
    return json?.choices?.[0]?.message?.content?.trim() ?? '';
  }
}
```

**Отбор провайдера:** `CcAiProvider` где `user_uid IN (tenantUid, 0)` (0 = глобальный шаблон),
`enabled = true`, `capabilities` содержит `'llm'`. Если ни одного — статус сообщения `not-configured`,
а **не** `failed` (UI-SPEC Surface L требует различать: у них разные действия пользователя).

### Токен-ссылка с TTL (D-59)

```typescript
// НЕ рендерится в UI видимым текстом; чеканится только для исходящего уведомления.
const token = await this.jwt.signAsync(
  { sub: message.uid, t: 'vm', tenant: vpbxUserUid },
  { expiresIn: '72h', audience: 'voicemail-link' },
);
const link = `${publicBaseUrl}/api/voicemail/play?token=${encodeURIComponent(token)}`;
```

Валидация на приёме: отдельный guard, проверяющий `audience === 'voicemail-link'` и `t === 'vm'`.
Обычный `JwtAuthGuard` использовать нельзя — иначе токен-ссылка станет полноценной сессией
с доступом ко всему API.

---

## State of the Art

| Old Approach (в этом проекте) | Current Approach | When Changed | Impact |
|-------------------------------|------------------|--------------|--------|
| `onUpdate(id, field: string, value: any)` | Контракт `{ params, onChange(patch) }` | D-06 | Каскадные ре-рендеры (W1/W2) уходят; типизация params становится возможной |
| `registry[type] \|\| registry.hangup` | Явное состояние unknown с сохранением params | D-12, W5 | Данные не теряются; тип не подменяется молча |
| `params.useExten` + сентинел `__USE_EXTEN__` | Единый `ValueSource` (`fixed`/`route_pattern`/`variable`/`phonebook`) | D-20 | Один механизм на все адресные действия вместо частного флага у одного |
| `${EXTEN}` напрямую в `Dial`/`Queue`/`Gosub` | `normalizeTarget(kind, source, uid)` | D-21 | Конвенция тенант-скоупинга становится инвариантом, а не соглашением |
| `Playback` под именем `playprompt`, `BackGround` под именем `playback` | Одно приложение «Воспроизведение» с режимом | D-51 | Инверсия имён устраняется вместе с самим различием |
| `System(/usr/scripts/*.php …)`, `SHELL(...)`, `AGI(say.php)` | `CURL` → Nest endpoint (+ `Set(__K*)` + `URIENCODE`) | D-28, D-30, D-31 | Логи, ошибки, тенант-контекст и тесты появляются там, где раньше был чёрный ящик |
| `VoiceMail(${exten}@default,u)` + `voicemail.conf` на хосте | Кастомное приложение: `Record()` + hangup handler + `notify` + STT/LLM | D-54 | Тенантность по построению; наблюдаемость; MWI сознательно не реализуется |
| Глобальные `system_settings` с `UNIQUE(key)` | Отдельная `tenant_settings` с `UNIQUE(vpbx_user_uid, key)` | D-19 | Тенант настраивает своё, не задевая глобальное; merge-логика не нужна по построению |
| Условие только по `DIALSTATUS` | `DIALSTATUS` + `QUEUESTATUS` + `DEVICE_STATE` + `RECORD_STATUS` + переменная + CURL | D-22 | Сценарий «очередь переполнена → следующее действие» становится выразимым (`Queue()` не ставит `DIALSTATUS`) |
| `Sheet` только `side="right"` | Параметризованный `side` (`right` / `bottom`) | UI-SPEC Surface B | Мобильный вариант без второго компонента |

**Deprecated / outdated в рамках фазы:**

- `asr`, `keywords` — эмитят идентичный `Record()` и никакого распознавания не делают. Замена — `voicerobot`
  (Stasis) для распознавания и D-57 для расшифровки записей.
- `tofax` — `Set(__faxmail=…)`, переменную никто не читает.
- `sendmailpeer`, `telegram`, `sendmail` — поглощаются `notify` (multi-channel уже реализован в Phase 6).
- `playprompt`, `playback` — поглощаются «Воспроизведением».
- `voicemail` — поглощается кастомной голосовой почтой.
- `cdr-public.controller.ts` — остаётся для v3-iframe, но для новой функциональности закрыт (D-59).
- Скрипт `npm run db:migrate` — нерабочий (`run-migrations.js` отсутствует); канон — `npx ts-node migrate-*.ts`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Проект целится в **Asterisk 22**. Прямого пина версии в репозитории нет; вывод сделан по комментарию `// Asterisk 22.8 multi-tenant field` (`ps-endpoint.model.ts:431`), комментарию `// AgentConnect AMI event (Asterisk 22 docs)` (`ami.service.ts:272`), manual-verification-пункту из `09-03-SUMMARY.md` и по тому, что весь `12-CONTEXT.md` ссылается на документацию 22 | Общая | На Asterisk < 16 нет `hangup_handler_push` (появился в 11) и `ControlPlayback` без опций — риск низкий. **Существенно** только если целевая версия < 12: тогда `k` у `Record()` может отсутствовать. Рекомендуется зафиксировать версию явно (см. Open Questions Q1) |
| A2 | Число legacy-строк в БД (сколько реальных `voicemail`/`playprompt`/`telegram`-шагов у клиентов) неизвестно — доступа к прод-базе нет | Runtime State Inventory | Если legacy-шагов много и они критичны, data-миграция становится задачей с обязательным `checkpoint:human-verify` и dry-run-режимом, а не рутинным `UPDATE` |
| A3 | `Record()` пишет 8kHz 16-bit mono PCM WAV при формате `wav` — стандартное поведение, но зависит от кодека канала и от `format` в аргументе | Code Examples · WAV → PCM16 | Если частота отличается (16kHz на G.722), STT получит аудио с неверным sample rate и вернёт мусор. Митигируется: `parseWavPcm16` возвращает `sampleRate`, сервис обязан его проверить и отклонить неожидаемое значение с внятной ошибкой |
| A4 | `class-transformer` `discriminator` требует дискриминатор **внутри** вложенного объекта, а `type` лежит уровнем выше | Pattern 3 | Если это не так в `^0.5.1`, кастомный pipe всё равно остаётся рекомендацией (он нужен для D-11 и для четырёх host-ов), так что риск нулевой |
| A5 | `dotenv` доступен бэкенду транзитивно (через `@nestjs/config`), в `package.json` не объявлен, migrate-скрипты его импортируют | Runtime State Inventory | При чистой установке или смене версий `@nestjs/config` миграции упадут на `Cannot find module 'dotenv'`. Дешёвая страховка — добавить `dotenv` в `dependencies` явно |
| A6 | Порядок монтирования порталов Radix обеспечивает наложение вложенного `Sheet` поверх `Dialog` на 3 уровнях | Pitfall 10 / UI-SPEC ⚠ unresolved | Если нет — включается санкционированный fallback (`--z-index-modal-nested: 55`). Проверяется только в рантайме |
| A7 | Голосовые сообщения хранятся в том же дереве, что записи разговоров (`records_base_path`), в подкаталоге вида `{uid}/vm/` | Code Examples | Если на проде записи лежат на отдельном томе/квоте, голосовая почта его переполнит. Требует подтверждения владельцем инфраструктуры |
| A8 | Массовое переименование контекста группы (D-33) допустимо с переходным периодом через `include =>` старого контекста | Pitfall 9 | Если `include` в сгенерированный контекст конфликтует с чем-то в текущей структуре конфигов, придётся делать атомарную миграцию с окном обслуживания |

## Open Questions (RESOLVED)

1. **Целевая версия Asterisk не зафиксирована в репозитории.** — **RESOLVED → план 12-17**
   - Что известно: три независимых комментария указывают на 22 (в одном случае — 22.8); вся внешняя документация
     в `12-CONTEXT.md` — для 22.
   - Что неясно: нет ни `.env.example` с версией, ни docker-образа, ни README-требования. Прод может стоять
     на 18 или 20.
   - Решение фазы: manual-verify `core show version` + запись поддерживаемой версии в ARCHITECTURE/README —
     задача плана **12-17** (UAT / manual gates).

2. **Триггер запуска STT/LLM после сохранения сообщения.** — **DEFERRED → Phase 12b** (D-54…D-59 voicemail)
   - Что известно: очередей задач (BullMQ/Redis) в проекте нет; в `voice-robots` асинхронность решена внутри
     Stasis-сессии; `callcenter` использовал `@Cron`-подобные сервисы (janitor/reconciler).
   - Рекомендация (сканер по `status='pending'`) остаётся для 12b; в Phase 12 не планируется.

3. **Порог «вложение vs ссылка» (D-59) в числах.** — **DEFERRED → Phase 12b**
   - Решение «короткие — вложением, длинные — ссылкой» и числовой порог — scope голосовой почты (12b).

4. **Судьба `webrtc`-флага у `toexten` (D-39: «оживить или убрать»).** — **RESOLVED → план 12-03 (+ оживление в 12-13)**
   - Решение фазы: **оживить** как поле схемы/DTO (12-03 объявляет; 12-13 подключает к генератору и UI).

5. **Разрешение конфликта D-33 (`group_{exten}_{uid}`) с существующими данными** — **RESOLVED → план 12-14**
   - Планировщик: переходный период / миграция контекстов группы — задачи плана **12-14** (см. Pitfall 9 / A8).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js + npm workspaces | всё | ✓ | — | — |
| `ts-node` | миграции `migrate-*.ts` | ✓ | `^10.9.2` (devDep backend) | — |
| MySQL / MariaDB (`mysql2`) | схемные миграции, data-миграция | ✗ в среде агента | `mysql2 ^3.12.0` в зависимостях | Миграции пишутся и **unit-тестируются на моках Sequelize**; фактический запуск — `checkpoint:human-verify` |
| `npm run db:migrate` (раннер) | — | **✗ СЛОМАН** | `packages/backend/migrations/run-migrations.js` **отсутствует** | **Обязательный fallback:** `npx ts-node src/modules/<mod>/migrate-<name>.ts` из `packages/backend`. Планировщик **не должен** ссылаться на `db:migrate` |
| `packages/harness` (`npm run harness:asterisk` / `:api` / `:ui`) | автоматическая валидация против живого Asterisk | **✗ ОТСУТСТВУЕТ** | — | Пакет запланирован в **Phase 11**, ещё не выполнен (в `packages/` только `backend`, `frontend`, `shared`). Скрипты `harness:*` в корневом `package.json` есть, но падают. **Все проверки против живого Asterisk в Phase 12 — manual-only** |
| Живой Asterisk 22 | проверка `Record()`+`k`, hangup handler, `Progress()`, `QUEUESTATUS`, переименование контекста групп | ✗ | — | Manual-only чек-лист в VALIDATION; без него нельзя закрывать D-55, D-52, D-33 |
| Браузер / DOM | vitest + jsdom | ✓ | `jsdom ^29.0.2` | — |
| STT-провайдер (Yandex / custom HTTP) | D-57 | ✗ (нужен токен тенанта) | — | Мок `SttProviderFactory` в unit-тестах; реальный прогон — manual-only |
| LLM-провайдер | D-57 | ✗ | — | Мок `fetch`; реальный прогон — manual-only |
| SMTP / Telegram Bot | D-54 уведомления | ✗ | — | Мок `NotificationDispatcher` (в проекте уже есть `notification-dispatcher.service.spec.ts`) |
| `ffmpeg` | — | ✗ | — | **Не требуется** — конвертация WAV→PCM16 делается в коде (`parseWavPcm16`), внешний конвертер не нужен. Это осознанный выбор именно из-за отсутствия ffmpeg |

**Missing dependencies with no fallback:** нет — ни один пункт не блокирует написание и unit-тестирование кода.

**Missing dependencies with fallback:**
- миграционный раннер → standalone `ts-node` скрипты (канон проекта, 30 прецедентов);
- harness / живой Asterisk → manual-only пункты валидации с явным чек-листом;
- внешние сервисы (STT / LLM / SMTP / Telegram) → моки в тестах.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (backend) | Jest `^29.7.0` + ts-jest `^29.2.5` |
| Config file (backend) | `packages/backend/package.json` § `jest` (`rootDir: src`, `testRegex: .*\.spec\.ts$`, `testEnvironment: node`) |
| Framework (frontend) | Vitest `^4.1.4` + `@testing-library/react ^16.3.2` + `user-event ^14.6.1` + `jsdom ^29.0.2` |
| Config file (frontend) | `packages/frontend/vite.config.ts`; setup — `src/shared/config/tests/setupTests.ts` |
| Quick run (backend, узко) | `npm run test -w @krasterisk/backend -- --testPathPattern="shared/utils/dialplan" --no-coverage` |
| Quick run (frontend, узко) | `npm run test -w @krasterisk/frontend -- src/features/dialplan-apps` |
| Full suite | `npm run lint && npm run test:backend && npm run test:frontend` (AGENTS.md — verify перед «готово») |
| Обязательный префикс любой задачи, меняющей `packages/shared` | `npm run build -w @krasterisk/shared` |
| E2E / live-Asterisk | **недоступно** — `packages/harness` не существует (Phase 11 не выполнена) → manual-only |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| **Wave 0** | Текущий вывод генератора для 22 непокрытых ветвей зафиксирован (характеризационные тесты) | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="dialplan.util" --no-coverage` | ❌ Wave 0 — `dialplan.util.spec.ts` расширяется |
| D-43 | Условие применяется к **каждой** строке многострочного действия (`totrunk`, `toexten`, `sendmail`/`notify`, `callerid`, `trunk_carousel`) | unit | тот же | ❌ Wave 0 |
| D-43 | time-group guard корректен на многострочном действии; guard присутствует в IVR- и phonebook-биндингах | unit | `--testPathPattern="routes.service\|ivrs.service\|phonebook-dialplan"` | ❌ Wave 0 |
| D-43 | `label` не эмитит `NoOp())` и **не теряет** условие | unit | `--testPathPattern="dialplan.util"` | ❌ Wave 0 |
| D-43 | `setclid_custom` / `setclid_list` не теряют params из UI | unit | тот же | ❌ Wave 0 |
| D-21 | `normalizeTarget` даёт `q…`/`e…`+`ew…`/`group_…`/`ctx-…` для всех `ValueSource`; **негативный** тест: в выводе нет `Queue(${EXTEN}` и `Gosub(group_${EXTEN}` ни для одного действия | unit | `--testPathPattern="dialplan-target"` | ❌ Wave 0 — новый `dialplan-target.util.spec.ts` |
| D-42 | `toroute` не даёт двойной суффикс (`office42` + tenant 42 → `office42`, не `office4242`); совпадает с `buildContextName` | unit | `--testPathPattern="dialplan.util"` | ❌ Wave 0 |
| D-42 | `Congestion()` эмитится; применение `cmd` пишется в `action_logs` | unit | `--testPathPattern="dialplan.util\|routes.service"` | ❌ Wave 0 |
| D-25 | Счётчик переходов эмитится и ограничивает `toroute` A→B→A | unit | `--testPathPattern="dialplan.util"` | ❌ Wave 0 |
| D-22 | Множество допустимых значений условия в DTO === в генераторе (тест-инвариант); `QUEUESTATUS`/`DEVICE_STATE`/`RECORD_STATUS`/переменная эмитятся корректно | unit | `--testPathPattern="dialplan-condition\|route-action.dto"` | ❌ Wave 0 |
| D-08/D-09 | Каждый `ActionType` имеет DTO params; **инвариант**: `ActionType` (shared) === `ACTION_TYPES` (DTO) === ключи `switch` генератора === ключи `registry` | unit | `--testPathPattern="route-action.dto"` | ❌ Wave 0 |
| D-09 | IVR `menu_items[].actions` и `voice_robots.*_action` проходят ту же валидацию | integration (Nest `TestingModule`) | `--testPathPattern="ivrs.service\|voice-robots"` | ❌ Wave 0 — сегодня IVR не валидируется вовсе |
| D-10 | Пустой `type` и незаполненные обязательные params отвергаются 400 | integration | `--testPathPattern="routes.controller"` | ❌ Wave 0 |
| **D-11** | **held-out:** 400 с путём к шагу подсвечивает **именно тот** шаг; немаппящиеся ошибки уходят в host-сводку и **не теряются** | integration + component | `npm run test -w @krasterisk/frontend -- src/features/dialplan-apps` | ❌ Wave 0 — **UI-SPEC backstop №2** |
| D-12 | Data-миграция: каждая из 6 JSON-колонок переписывается; неизвестные типы **не** трогаются; повторный запуск идемпотентен | unit (моки Sequelize, прецедент `migrate-hub-modules-phase8.spec.ts`) | `--testPathPattern="migrate-"` | ❌ Wave 0 |
| D-04 | `summarize()` даёт одно предложение и **деградирует** на незаполненных обязательных params (плейсхолдер-фрагмент, а не выпадение) | unit | `-- src/features/dialplan-apps/lib/summarize` | ❌ Wave 0 |
| **D-27** | **held-out round-trip:** `serializeOptions(parseOptions(s)) === s` для набора строк, включающего `U(...)`, `M(...)`, `L(x:y:z)`, неизвестные флаги и их порядок | unit (property-style: фиксированный корпус ≥15 строк) | `-- src/features/dialplan-apps/lib/optionsString` | ❌ Wave 0 — **UI-SPEC backstop №4** |
| **UI loading** | **held-out:** справочный `Select` в состоянии «грузится» отличим от «пусто» — разные текст/иконка/подсказка; в «пусто» есть ссылка на раздел с `target="_blank"` | component | `-- src/features/dialplan-apps/ui/SchemaField` | ❌ Wave 0 — **UI-SPEC backstop №1** |
| **D-57 UI** | **held-out:** `not-configured` ведёт в настройки STT и **не** показывает «Повторить расшифровку»; `failed` показывает повтор | component | `-- src/features/callcenter` / CDR-фича | ❌ Wave 0 — **UI-SPEC backstop №3** |
| D-24/D-53 | Терминальность: `hangup`/`toroute`/`toivr` → «Завершает цепочку»; режим «выход по цифре» → «Может выйти»; предупреждение плюрализовано (`_one`/`_other`), при 0 недостижимых не рендерится | component | `-- src/features/dialplan-apps` | ❌ Wave 0 |
| D-06 | App-компонент получает только `params` + `onChange`; правка одного шага **не** ре-рендерит остальные (счётчик рендеров) | component | `-- src/features/dialplan-apps` | ❌ Wave 0 (закрывает W1/W2 измеримо) |
| D-13 | Дублировать / вкл-выкл / копировать / вставить между / undo — на редьюсере `useChainEditor`, без DOM | unit | `-- src/features/dialplan-apps/model` | ❌ Wave 0 |
| D-14/D-15 | `readOnly` (нет handle, нет кнопки добавления, поля `disabled` но видны), `maxSteps` (кнопка disabled + счётчик), `allowedTypes` (тип вне набора рендерится с бейджем, **не** удаляется) | component | `-- src/features/dialplan-apps` | ❌ Wave 0 |
| D-17/D-19 | `tenant_settings`: whitelist ключей, `UNIQUE(vpbx_user_uid,key)`, изоляция тенантов; **отсутствие пересечения** с `system_settings` | unit + integration | `--testPathPattern="tenant-settings"` | ❌ Wave 0 |
| D-17 UI | Optimistic toggle: мгновенный патч, `undo()` + видимая ошибка при 400; до резолва `Switch` `disabled` и **без** подставленного дефолта | component | `-- src/features/…/TenantSettings` | ❌ Wave 0 |
| D-51/D-52 | Режим → приложение: `plain`→`Playback`, `control`→`ControlPlayback`, `menu`→`BackGround`; `Set(CHANNEL(language))` для не-menu; `Progress()` **перед** воспроизведением при `noanswer` | unit | `--testPathPattern="dialplan.util"` | ❌ Wave 0 |
| **D-55** | **Порядок строк:** `Set(CHANNEL(hangup_handler_push)=…)` эмитится **до** `Record(`; в опциях `Record()` присутствует `k` **всегда**, независимо от настроек пользователя | unit | `--testPathPattern="dialplan.util\|voicemail"` | ❌ Wave 0 — самый важный единичный тест фазы |
| D-56 | Опции `Record()` мапятся из схемы; пресеты условий покрывают все **7** значений `RECORD_STATUS`, включая `OPERATOR` | unit | `--testPathPattern="dialplan-condition"` | ❌ Wave 0 |
| D-57 | `parseWavPcm16`: 44-байтный заголовок, заголовок с `LIST`-чанком, не-16-bit → ошибка, обрезанный `data` → не падает; `sampleRate` возвращается и проверяется вызывающим | unit | `--testPathPattern="wav-pcm"` | ❌ Wave 0 |
| D-57 | `LlmSummaryService`: `bearer`/`api_key_header`/`none`, таймаут, не-2xx → `failed`, отсутствие провайдера с `capabilities:['llm']` → `not-configured` (**не** `failed`) | unit (мок `fetch`) | `--testPathPattern="llm-summary"` | ❌ Wave 0 |
| D-58 | Вкладка/фильтр — одно состояние; access-scope: чужие сообщения не видны; корреляция по `uniqueid`; отдельный резолвер файла с path-traversal-guard и верным MIME | unit + integration | `--testPathPattern="voicemail\|cdr"` | ❌ Wave 0 |
| **D-59** | Токен: `audience='voicemail-link'`, истёкший отвергается, токен от `JwtAuthGuard` **не** принимается этим guard и наоборот; `cdr-public` **не** обслуживает голосовую почту | integration | `--testPathPattern="voicemail-link\|voicemail.controller"` | ❌ Wave 0 |
| D-33 | `call_groups.exten` + контекст `group_{exten}_{uid}`; переходный период не оставляет ни одного `togroup` без валидного контекста | unit | `--testPathPattern="call-group-dialplan\|migrate-call-groups"` | ❌ Wave 0 |
| D-34/D-35 | Подтверждение вызова, пропуск занятых, per-group `Dial`-опции; `CALLERID(name)` откатывается после `Return()`; `random` — честная перестановка | unit | `--testPathPattern="call-group-dialplan"` | ❌ Wave 0 |
| D-36 | Карусель: число эмитируемых блоков **линейно** по n (тест на n=5: было 25 `Dial`, стало ≤ n+const); per-trunk таймаут применяется; все режимы различимы | unit | `--testPathPattern="dialplan.util"` | ❌ Wave 0 |
| D-37 | `setclid_list` вызывает `SHELL`/CURL **один** раз за звонок; `phonebook` подставляет и номер, и имя; карусель CID не повторяет предыдущее значение | unit | `--testPathPattern="dialplan.util"` | ❌ Wave 0 |
| D-39 | `webrtc` читается из схемы; Mark Answered Elsewhere эмитится; пустой `exten` даёт **ошибку валидации**, а не `dp=''` | unit | `--testPathPattern="dialplan.util\|route-action.dto"` | ❌ Wave 0 |
| DnD/a11y | `DragOverlay` + `restrictToVerticalAxis`; `announcements` на ru и en; `aria-roledescription="sortable"`; id — `crypto.randomUUID()` | component | `-- src/features/dialplan-apps` | ❌ Wave 0 |
| Адаптивность | 375 / 768 / 1280 px: нет горизонтального скролла; ≥768 до 4 инлайн-действий, <768 — «Настроить» + `DropdownMenu` | component (matchMedia mock) | `-- src/features/dialplan-apps` | ❌ Wave 0 |

### Manual-Only / Live-Asterisk (не автоматизируется — harness отсутствует)

Каждый пункт обязан попасть в VALIDATION как `checkpoint:human-verify` с явным ожидаемым результатом.

| # | Что проверяется | Почему нельзя автоматизировать | Как проверить |
|---|-----------------|-------------------------------|---------------|
| M1 | Версия Asterisk на целевом PBX | нет доступа к хосту | `asterisk -rx 'core show version'` → записать в ARCHITECTURE |
| M2 | **`Record()` + `k`: абонент бросает трубку → файл существует И уведомление пришло** | требует реального SIP-звонка с отбоем в середине записи | звонок → отбой на 5-й секунде → проверить файл на диске, строку в `voicemail_messages`, доставку уведомления |
| M3 | Hangup handler выполняется при отбое из `Record()` | то же | `asterisk -rvvv` — увидеть вход в `krsk-vm-done-*` после `Hangup` |
| M4 | `Progress()` + `Playback(...,noanswer)` — звук реально идёт до ответа | зависит от SIP-провайдера и трансляции early media | входящий с трунка на маршрут с воспроизведением без ответа |
| M5 | `QUEUESTATUS` выставляется и условие «очередь переполнена» срабатывает | требует очередь с `maxlen` и реальных звонков | `maxlen=1`, два звонка, второй должен уйти на следующее действие |
| M6 | Переименование контекста групп (D-33) не оборвало ни один существующий `togroup` | зависит от данных прода | после миграции: `dialplan show group_*`, затем тестовый звонок в каждую группу тенанта |
| M7 | Подтверждение вызова и пропуск занятых в группах (D-34) | требует внешний номер с голосовой почтой оператора | звонок в группу с внешним участником; VM оператора не должна «отвечать» за группу |
| M8 | Вложенный `Sheet` поверх `RouteFormModal` на 3 уровнях (UI-SPEC ⚠ unresolved) | порядок порталов Radix проверяется только в рантайме | открыть `RouteFormModal` → `RoutePhonebooksTab` → шаг → Sheet; проверить перекрытие и работоспособность фокуса |
| M9 | `records_base_path` на проде совпадает с захардкоженным `/usr/records` (иначе промпты «пропадут» при унификации пути) | значение живёт в БД прода | прочитать `system_settings.records_base_path` перед унификацией |
| M10 | STT и LLM с реальными токенами тенанта дают осмысленный текст на русском 8kHz-аудио | нужны платные внешние сервисы | оставить сообщение → проверить расшифровку и саммари в модалке «Детали сообщения» |
| M11 | Ссылка из уведомления работает в чужой инфраструктуре и **перестаёт** работать после TTL | нужен реальный Telegram/email | получить уведомление, открыть ссылку, затем повторить после истечения TTL |
| M12 | Осиротевшие PHP-скрипты больше не вызываются | grep по логам PBX | `grep -c 'usr/scripts' /var/log/asterisk/full` после деплоя — должно перестать расти |

### Sampling Rate

- **Per task commit:** узкий прогон затронутой области — `npm run test -w @krasterisk/backend -- --testPathPattern="<area>" --no-coverage`
  либо `npm run test -w @krasterisk/frontend -- <path>`. Если задача трогала `packages/shared` —
  **сначала** `npm run build -w @krasterisk/shared`.
- **Per wave merge:** `npm run lint && npm run test:backend && npm run test:frontend`.
- **Phase gate:** полный набор зелёный + все `checkpoint:human-verify` из M1…M12 закрыты (или явно
  задокументированы как отложенные с оценкой риска) **до** `/gsd-verify-work`.
- **Дополнительный gate после Wave 0:** покрытие ветвей `dialplan.util.ts` = 100% (29/29). Проверяется
  `npm run test:cov -w @krasterisk/backend` с отчётом по файлу. Это единственная численная метрика фазы,
  и она измеряет ровно тот риск, который делает фазу опасной.

### Wave 0 Gaps

- [ ] `packages/backend/src/shared/utils/dialplan.util.spec.ts` — расширить характеризационными тестами
      на **22** непокрытые ветви (фиксируют текущий вывод **до** правок)
- [ ] `packages/backend/src/shared/utils/dialplan-target.util.spec.ts` — новый, D-21 + негативные тесты `${EXTEN}`
- [ ] `packages/backend/src/shared/utils/dialplan-condition.util.spec.ts` — новый, D-22 + инвариант «DTO === генератор»
- [ ] `packages/backend/src/shared/utils/dialplan-options.util.spec.ts` — новый, round-trip (D-27, backstop №4)
- [ ] `packages/backend/src/modules/routes/dto/route-action.dto.spec.ts` — новый, per-type params + инвариант
      четырёх списков `ActionType`
- [ ] `packages/backend/src/modules/routes/routes.service.spec.ts` — расширить: time-group guard на многострочном
      действии
- [ ] `packages/backend/src/modules/ivrs/ivrs.service.spec.ts` — расширить: time-group guard + валидация `menu_items`
- [ ] `packages/backend/src/modules/phonebooks/phonebook-dialplan.util.spec.ts` — новый, time-group guard
- [ ] `packages/backend/src/modules/call-groups/call-group-dialplan.util.spec.ts` — новый (D-33…D-36)
- [ ] `packages/backend/src/modules/tenant-settings/tenant-settings.service.spec.ts` — новый (D-19)
- [ ] `packages/backend/src/modules/voicemail/*.spec.ts` — новые: `voicemail.service`, `wav-pcm.util`,
      `llm-summary.service`, `voicemail-link.service`, `voicemail.controller`
- [ ] `packages/backend/src/modules/**/migrate-*.spec.ts` — тесты data-миграции (прецедент:
      `cloud-admin/migrate-hub-modules-phase8.spec.ts`)
- [ ] `packages/frontend/src/features/dialplan-apps/lib/summarize.test.ts` — новый (D-04)
- [ ] `packages/frontend/src/features/dialplan-apps/lib/optionsString.test.ts` — новый round-trip (backstop №4)
- [ ] `packages/frontend/src/features/dialplan-apps/lib/validateAction.test.ts` — новый (D-10)
- [ ] `packages/frontend/src/features/dialplan-apps/model/useChainEditor.test.ts` — новый (D-13)
- [ ] `packages/frontend/src/features/dialplan-apps/ui/StepSheet/StepSheet.test.tsx` — новый
      (D-01…D-03, фокус, backstop №1 loading-vs-empty)
- [ ] `packages/frontend/src/features/dialplan-apps/ui/StepRow/StepRow.test.tsx` — новый
      (summary, бейджи, overflow, unknown, terminal, плюрализация)
- [ ] `packages/frontend/src/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.test.tsx` — новый
      (`readOnly`/`allowedTypes`/`maxSteps`/`density`, backstop №2 маппинг ошибок бэкенда, счётчик ре-рендеров)
- [ ] Фича голосовых сообщений в CDR — component-тесты четырёх статусов обработки (backstop №3)
- [ ] Фреймворки устанавливать не нужно — Jest и Vitest настроены и работают

---

## Security Domain

`security_enforcement` в `.planning/config.json` не задан → считается включённым.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Многотенантность через `vpbx_user_uid` во всех новых таблицах (ARCHITECTURE MUST); `normalizeTarget` как единственная граница между пользовательским вводом и именами объектов Asterisk |
| V2 Authentication | yes | Существующий `JwtAuthGuard` для UI-эндпоинтов; **отдельный** guard для токен-ссылок (`audience: 'voicemail-link'`) — обычный auth-токен не должен открывать сообщение и наоборот |
| V3 Session Management | yes | Токен-ссылка D-59: короткий `expiresIn`, отдельный `audience`, **не рендерится** видимым текстом в UI (утечка через скриншот / шаринг экрана / историю буфера) |
| V4 Access Control | yes | `buildCdrLinkedidAccessClause` + `ensureCallVisible` для вкладки сообщений; `tenant_settings` с whitelist ключей; ADMIN-guard остаётся **только** на глобальных настройках; `cmd`-действие по-прежнему `isAdmin`-only (`dialplan.util.ts:314`) |
| V5 Input Validation | yes | `class-validator` per-type DTO (D-09) + `sanitizeDialplanInput` / `sanitizeShellInput` / `sanitizeFilePath` / `sanitizeTemplate` на **каждом** новом поле схемы. `sanitizeTemplate` уже блокирует `SHELL`/`SYSTEM`/`AGI` и переводы строки |
| V6 Cryptography | yes | Ключи провайдеров — существующий AES (`CcAiProvider.encrypted_api_key`, `CC_AI_KEY_SECRET`); подпись ссылок — `@nestjs/jwt`. **Ничего не писать руками** |
| V7 Logging | yes | Применение `cmd` пишется в `action_logs` (D-42) — сейчас произвольная строка попадает в конфиг Asterisk без следа. Токены и API-ключи в логи не попадают (`SttEnginesService.maskToken` как образец) |
| V8 Data Protection | yes | Голосовое сообщение — персональные данные абонента. Файл вне web-root, отдаётся только через контролируемый стрим; вложение в уведомлении уходит в чужую инфраструктуру — это осознанный, зафиксированный в D-59 компромисс |
| V12 File / Resource | yes | Path-traversal guard обязателен в новом резолвере файла голосовой почты (образец — `safeRecordFilePath`: `rel.includes('..')` + `fileResolved.startsWith(baseResolved)`) |
| V13 API | yes | `/internal/dialplan/voicemail` защищён тем же `api_key`, что `sendmail`/`notify` (`DIALPLAN_API_KEY`) |
| V14 Configuration | yes | Новые ключи `tenant_settings` — только из whitelist; глобальные ключи тенанту недоступны |

### Known Threat Patterns for этого стека

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **Dialplan injection** — пользовательская строка с `\n`, `,`, `)` ломает контекст или добавляет приоритет | Tampering / Elevation | `sanitizeDialplanInput` на всех полях; **тест на попытку инъекции для каждого нового поля схемы**; `cmd` остаётся ADMIN-only |
| **Command injection через `SHELL()`/`System()`** | Elevation | D-31 убирает семь PHP-вызовов; оставшиеся до конца фазы — через `sanitizeShellInput` |
| **Path traversal в имени файла промпта / записи** | Information Disclosure | `sanitizeFilePath` + guard резолвера; тест `../../etc/passwd` |
| **Публичный URL голосового сообщения** | Information Disclosure | D-59: JWT с TTL и отдельным `audience`; `cdr-public.controller.ts` для ВП **запрещён**; тест «истёкший токен → 401» |
| **Cross-tenant утечка** (чужая очередь / чужое сообщение / чужая настройка) | Information Disclosure | `vpbx_user_uid` во `WHERE` каждого запроса; `normalizeTarget` не даёт обратиться к объекту без суффикса тенанта; тест «тенант A не видит сообщение тенанта B» |
| **SSRF через `endpoint` LLM/STT-провайдера** | Elevation | `endpoint` задаётся администратором тенанта, но валидировать схему (`https?:`) и запрещать link-local / metadata-адреса стоит: провайдер настраивается через UI, а значит это пользовательский ввод |
| **Prompt injection в расшифровке** | Tampering | Расшифровка — недоверенный ввод: сообщение абонента идёт в LLM. Саммари **никогда** не интерпретируется как команда и рендерится как текст (не HTML); системный промпт отделён от пользовательского контента |
| **DoS через длинное сообщение / гигантский файл** | DoS | `maxduration` у `Record()` обязателен; лимит на размер файла перед STT; `MAX_TRANSCRIPT_CHARS` перед LLM; таймаут `AbortSignal.timeout` |
| **Петля между маршрутами** (`toroute` A→B→A) | DoS | D-25: счётчик переходов + guard; тест «на N+1 переходе цепочка обрывается» |
| **XSS в HTML-плеере** | Tampering | `renderRecordingPlayerHtml` уже экранирует атрибуты (`cdr.service.ts:363-368`) — переиспользовать, а не писать заново |

---

## Phase Sizing Assessment

**Вердикт: фазу следует разделить. Голосовая почта (D-54…D-59) должна уехать в отдельную фазу.**

Объективные измерения объёма (не оценки, а подсчёт по коду и артефактам):

| Метрика | Значение |
|---------|----------|
| Локированных решений | 59 |
| Поверхностей UI | 12 (A…L) |
| Ветвей генератора к изменению | 29 из 29 (22 без тестов) |
| Файлов `shared/ui` к изменению | 1 (`Sheet`) |
| App-компонентов к переводу на новый контракт | 14 |
| Новых модулей бэкенда | 2 (`tenant-settings`, `voicemail`) |
| Новых таблиц | ≥3 (`tenant_settings`, `voicemail_messages`, шаблоны цепочек по D-46) |
| Схемных миграций | ≥4 |
| Data-миграций | 1 крупная, затрагивающая **6 JSON-колонок в 5 таблицах** |
| Call-site генератора к синхронизации | 4 (`routes`, `ivrs`, `phonebooks`, `voice-robots`) |
| Тестовых файлов в Wave 0 | ~20 новых + 4 расширяемых |
| Manual-only проверок | 12 |

### Швы (в порядке зависимости; W1 блокирует всё)

| # | Workstream | Решения | Зависит от | Самостоятельная ценность | Оценка доли фазы |
|---|-----------|---------|-----------|-------------------------|------------------|
| **W0** | **Характеризационные тесты генератора** | — | — | Не даёт пользовательской ценности, но **обязателен**: без него W1 меняет 22 ветви слепо | ~8% |
| **W1** | **Фундамент: типы + DTO + нормализация целей + фиксы генератора** | D-08, D-09, D-10, D-20, D-21, D-42, D-43 | W0 | **Высокая, немедленная** — чинит 5 подтверждённых багов прода, включая `Queue(${EXTEN})`. Может выйти отдельным релизом | ~18% |
| **W2** | Surface редактора и UX цепочки | D-01…D-07, D-11…D-15, W1…W11 | W1 (контракт `params`) | Высокая — весь FE-рефакторинг, из-за которого фаза и появилась | ~20% |
| **W3** | Условия + сквозные механики | D-22…D-28 | W1 | Средняя — «очередь переполнена → следующее действие» становится выразимым | ~10% |
| **W4** | Legacy cleanup + слияние медиа | D-28…D-31, D-51…D-53 | W1, W2 (unknown-состояние), W3 (условия) | Средняя — снимает 7 PHP-вызовов и инверсию имён | ~12% |
| **W5** | Per-app расширения (инкрементально, по приложению) | D-32, D-34…D-39, D-41 | W1 | Высокая, но **делимая до одного приложения** — идеальный кандидат на «сколько успеем» | ~14% |
| **W5b** | Группы вызова: `exten` + контекст | D-33, D-35 | W1, миграция | Средняя; **самый рискованный кусок** (переименование контекста, Pitfall 9) — просится в отдельную задачу с окном обслуживания | ~5% |
| **W6** | Подсистема тенантных настроек + флаги | D-16…D-19 | — (независим от W1!) | Высокая и **полностью изолированная** — можно вести параллельно с W1/W2 | ~8% |
| **W7** | **Голосовая почта** | D-54…D-59 | W1, W3 (`RECORD_STATUS`), W4 (`notify`) | Высокая, но это **отдельный продукт**: приложение + таблица + уведомление + STT + LLM + вкладка CDR + токен-ссылки + безопасность ПДн | ~20% — **вынести** |
| **W8** | Новые возможности редактора | D-44…D-50 | W1, W2, W3 | Низкая относительно объёма; часть естественно уезжает в Phase 13 вместе с блок-схемой и MCP | ~15% — **вынести или урезать** |

Сумма долей > 100% — это и есть измерение проблемы: при равномерном темпе фаза не помещается.

### Конкретная рекомендация

**Phase 12 (ядро):** W0 → W1 → W2 → W3 → W4 → W5 → W5b, параллельно W6.
Это связный, проверяемый и полезный сам по себе результат: редактор переиспользуем, params типизированы
сквозь стек, генератор корректен, legacy убран, приложения на конкурентном уровне, тенантные настройки есть.

**Phase 12b «Кастомная голосовая почта»:** W7 целиком.
Аргументы за вынос, помимо объёма:
- она **зависит** от W1/W3/W4 и потому не может идти параллельно — её нельзя «просто добавить в конец»,
  она встаёт критическим путём;
- она вводит **новый класс данных** (голос абонента) с собственной моделью угроз (ПДн, токен-ссылки,
  prompt injection, SSRF) — это отдельный `/gsd-secure-phase`, а не подпункт;
- она требует **платных внешних сервисов** для валидации (STT + LLM) и живого Asterisk для М2/М3 —
  то есть её verification-цикл принципиально длиннее остального;
- находка про hangup handler (Pitfall 1) означает, что базовая схема из CONTEXT нуждается в доработке —
  это ещё один аргумент дать ей собственный discuss/plan-цикл, а не проектировать по ходу.

**Phase 13 (уже запланирована):** блок-схема + MCP/LLM-построение маршрутов + **D-46 (шаблоны цепочек)**,
**D-48 (dry-run)** и **D-50 (callback)** из W8 — они тематически ближе к «визуальному конструктору и автоматизации»,
чем к «редактору шага». В Phase 12 из W8 стоит оставить только то, что дёшево и востребовано сразу:
**D-44 (логические примитивы)** — он всё равно нужен, чтобы `label` перестал быть битым `NoOp())`,
**D-45 (расписание как действие)** — `TimeGroupsService` и `ExecIfTime` уже есть,
**D-47 (HTTP → переменная)** — паттерн `CURL`+`Set` уже реализован в `notify`,
**D-49 (сбор ввода)** — тесно связан с D-51 (то, что из «Воспроизведения» сознательно исключено).

Если пользователь настаивает на неделимости (позиция «делаем всё по максимуму» зафиксирована в CONTEXT),
минимально необходимая уступка — **W0 и W1 отдельным, полностью верифицированным блоком до всего остального**.
Пропуск W0 — единственное решение в этой фазе, которое гарантированно приведёт к регрессу на проде:
22 ветви генератора меняются, и ничто, кроме этих тестов, не заметит поломку.

---

## Project Constraints (from .cursor/rules/ и AGENTS.md)

| Directive | Источник | Как влияет на план |
|-----------|----------|--------------------|
| Читать `packages/frontend/.idea/ARCHITECTURE.md` и `packages/backend/.idea/ARCHITECTURE.md` перед работой | `AGENTS.md` (MUST READ) | Обязательное чтение для каждого исполнителя задач фазы |
| Verify перед «готово»: `npm run lint`, `npm run test:backend`, `npm run test:frontend` | `AGENTS.md` | Phase gate; ровно эти три команды |
| **Tailwind-классы запрещены выше `shared/ui`** | `frontend/.idea/ARCHITECTURE.md` | Прямо закрывает W7; внутри `shared/ui/Sheet` Tailwind разрешён (правка `side`) |
| SCSS-модули + `var(--color-*)` / `var(--radius-*)` / `var(--z-index-*)` | frontend ARCHITECTURE | Все новые компоненты фазы |
| Нативные `div` в `features/` запрещены (кроме обёртки `scrollBody`/`formBody`) | frontend ARCHITECTURE | `VStack`/`HStack`/`Flex` из `shared/ui/Stack` |
| `TableRowActions` + `TableRowAction` обязательны для колонок действий в списках | frontend ARCHITECTURE (MUST) | Действия строки шага |
| `InfoTooltip` обязателен; длинный текст-подсказка под полем запрещён | frontend ARCHITECTURE (MUST) | Schema-driven поля |
| Icon-only контролы: `title` **и** `aria-label` | frontend ARCHITECTURE (MUST) | Все новые icon-кнопки |
| Только `lucide-react`; эмодзи запрещены | frontend ARCHITECTURE | — |
| Optimistic toggles через `onQueryStarted` + `patchResult.undo()`; refetch запрещён | frontend ARCHITECTURE (MUST) | Флаги D-17 |
| Локальное состояние формы — `useState`, не RTK | frontend ARCHITECTURE | Черновик цепочки |
| Длинное тире `—` в UI-строках запрещено (в JSDoc допустимо) | frontend ARCHITECTURE | Copywriting Contract уже соблюдает |
| Словари **`ru` и `en`** обязательны для каждой новой строки | frontend ARCHITECTURE + UI-SPEC | `shared/config/locales/ru.ts`, `en.ts` |
| FSD-слои: `features/` не импортирует из `pages/`; публичный API через `index.ts` | frontend ARCHITECTURE | Структура из `### Recommended Project Structure` |
| Многотенантность: `vpbx_user_uid` во всех запросах и новых таблицах | backend ARCHITECTURE | `tenant_settings`, `voicemail_messages` |
| JWT + RBAC; DTO-валидация на каждом входе | backend ARCHITECTURE | D-09, D-10, D-59 |
| **Новые сущности требуют MCP-tool и AI-webhook-эндпоинта** | backend ARCHITECTURE | Применимо к `tenant_settings`, `voicemail_messages`, `call_groups.exten`. **Планировщик обязан завести эти задачи явно** — иначе фаза нарушит канон бэкенда. (MCP-**сервер** как таковой — Phase 13; регистрация tool'ов для новых сущностей — здесь) |
| Логирование через `Logger`; секреты в логи не попадают | backend ARCHITECTURE | `maskToken` как образец |
| Sketch-findings (`sketch-findings-krasterisk-v4`) применимы к Phase 2 (MohPage) и Phase 8 (Module Hub) | `.cursor/rules/sketch-findings-krasterisk-v4.mdc` (`alwaysApply: false`, globs включают `packages/frontend/**`) | Для Phase 12 даёт **только общий визуальный язык** (dark admin, indigo accent, плотность важнее декора). Конкретных winner-решений по редактору цепочек в skill нет — это зафиксировано и в шапке `12-UI-SPEC.md` |
| `shadcn` CLI не используется; `components.json` отсутствует | UI-SPEC § Design System (проверено) | Инициализировать shadcn запрещено |

---

## Sources

### Primary (HIGH confidence)

- **Код репозитория** — прочитан напрямую, все утверждения о текущем состоянии проверены:
  `packages/backend/src/shared/utils/dialplan.util.ts` (29 `case`-ветвей),
  `dialplan.util.spec.ts` (7 покрытых типов, 27 `it`),
  `packages/backend/src/modules/routes/routes.service.ts` (`:361-367` multi-line guard, `:376-379` `buildContextName`),
  `packages/backend/src/modules/routes/dto/route-action.dto.ts`,
  `packages/backend/src/modules/call-groups/call-group-dialplan.util.ts` (`:9`, `:36-43`, `:104-138`, `:146`),
  `packages/backend/src/modules/reports/cdr/cdr.service.ts` (`:291-360`, `:433-509`),
  `packages/backend/src/modules/reports/cdr/cdr-access-scope.ts` (`:46-137`),
  `packages/backend/src/modules/stt-engines/stt-engines.service.ts`,
  `packages/backend/src/modules/voice-robots/interfaces/stt-provider.interface.ts`,
  `packages/backend/src/modules/voice-robots/providers/provider-factory.ts`,
  `packages/backend/src/modules/ai-agents/models/ai-provider.model.ts`,
  `packages/backend/src/modules/ai-chat/ai-chat.service.ts`,
  `packages/backend/src/modules/system-settings/system-setting.model.ts`,
  `packages/backend/src/modules/callcenter/migrate-callcenter-transfer-destination.ts` (эталон миграции),
  `packages/shared/src/types/route.types.ts`,
  `packages/frontend/src/features/dialplan-apps/**`,
  `packages/frontend/src/shared/ui/Sheet/Sheet.tsx`, `Dialog/Dialog.tsx`, `app/styles/globals.css`,
  `packages/frontend/src/shared/config/locales/{ru,en}.ts`.
- **`docs.asterisk.org` · Asterisk 22 · `Record()`** — `[VERIFIED: официальная документация, прочитана целиком]`:
  «If the user hangs up during a recording, all data will be lost and the application will terminate»;
  опция `k` = «Keep recorded file upon hangup»; опция `o` устанавливает `RECORD_STATUS=OPERATOR`;
  `%d` автоинкремент; `RECORDED_FILE` без расширения; полный список опций `a,n,o,q,s,t,u,x,k,y`.
- **`docs.asterisk.org` · Asterisk 22 · `Playback()`** — `[VERIFIED]`: «The Playback application answers the
  channel if no options are specified»; `noanswer` = «Playback without answering»; `skip` = «Do not play if not
  answered»; `say` / `mix`; `PLAYBACKSTATUS`. Подтверждено и исходником `apps/app_playback.c`
  (примечание «Not all channel types support playing messages while still on hook»).
- **`docs.asterisk.org` · Configuration/Dialplan/Subroutines/Hangup-Handlers** — `[VERIFIED]`:
  `Set(CHANNEL(hangup_handler_push)=[[context,]exten,]priority[(arg1[,…])])`; хендлеры «follow the channel»
  и выполняются независимо от текущей позиции в dialplan, в отличие от `h`-extension.
- **`docs.asterisk.org` · Configuration/Applications/Early-Media-and-the-Progress-Application** — `[VERIFIED]`:
  канонический пример `Progress()` → `Wait(1)` → `Playback(...,noanswer)`; «Without that argument, Playback would
  automatically answer the call and then we would no longer be in early media mode».
- **`docs.asterisk.org` · Asterisk 22 · `Dial()`** — `[CITED]`: опции `U(x^arg)`, `g`, `F`, `S(x)`, `k`/`K`,
  `DIALSTATUS` — основание для D-27 (параметризованные флаги, которые обязаны сохраняться в round-trip).
- **Артефакты фазы** — `12-CONTEXT.md` (D-01…D-59, все LOCKED), `12-UI-SPEC.md` (approved, 12 поверхностей,
  4 backstop + 1 unresolved + 1 dismissed), `.planning/ROADMAP.md` § Phase 12, `.planning/STATE.md`.
- **Канон проекта** — `AGENTS.md`, `packages/frontend/.idea/ARCHITECTURE.md`,
  `packages/backend/.idea/ARCHITECTURE.md`, `.cursor/rules/sketch-findings-krasterisk-v4.mdc`,
  `.planning/config.json`, `package.json` (root / backend / frontend).

### Secondary (MEDIUM confidence)

- `docs.asterisk.org` · Configuration/Applications/Answer-Playback-and-Hangup-Applications — прозаическое
  подтверждение поведения `Playback` (получено через поиск, не прочитано целиком).
- `voip-info.org` · Asterisk cmd Playback — независимое подтверждение семантики `skip` / `noanswer`.
- FreePBX Ring Groups (Confirm Calls, Skip Busy Agent, CID Name Prefix, Announcement, Play Music On Hold) —
  рыночный ориентир для D-34, из `12-CONTEXT.md`.

### Tertiary (LOW confidence)

- Версия Asterisk на целевом PBX — выведена из комментариев в коде, не подтверждена ни манифестом,
  ни живым `core show version` (см. A1, Q1).
- Объём legacy-данных на проде — не наблюдался (A2).
- Формат WAV, который фактически пишет `Record()` на боевых каналах (A3).

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Текущее состояние кода | HIGH | Всё прочитано напрямую; каждое утверждение имеет файл и строку. Заявленное ROADMAP число непокрытых ветвей перепроверено и исправлено (22, не 21) |
| Конвенции тенант-скоупинга | HIGH | Тройная независимая перекрёстная проверка: `queues.service.ts`, `cdr-access-scope.ts`, `pjsipDialTarget` — совпадают |
| Семантика Asterisk (`Record`/`k`, `Playback`/`noanswer`, `Progress`, hangup handlers) | HIGH | Официальная документация Asterisk 22, прочитана; ключевая находка (`k` не возвращает управление) следует из текста документации прямо |
| Standard stack | HIGH | Новых пакетов нет; все версии считаны из `package.json` репозитория |
| Архитектурные паттерны | HIGH | Выведены из существующих паттернов проекта, не изобретены; для каждого указан прецедент |
| Пиктфоллы | HIGH | 9 из 10 подтверждены строками кода; Pitfall 10 подтверждён кодом + отмечен как runtime-непроверенный (UI-SPEC ⚠) |
| Миграционная поверхность | MEDIUM | Механизм и шаблон подтверждены (30 прецедентов + сломанный `db:migrate`); **объём данных** на проде неизвестен |
| Голосовая почта end-to-end | MEDIUM | Dialplan и точки реюза проверены; асинхронный триггер обработки — открытый вопрос Q2; внешние сервисы не проверялись живьём |
| Целевая версия Asterisk | LOW | Прямого пина в репозитории нет (A1 / Q1) |

**Research date:** 2026-08-18
**Valid until:** 2026-09-17 (30 дней). Утверждения о коде теряют силу при любом мерже в
`packages/backend/src/shared/utils/dialplan.util.ts` или `packages/frontend/src/features/dialplan-apps/**` —
перед планированием стоит убедиться, что эти файлы не менялись. Утверждения о семантике Asterisk 22 стабильны.

---

*Phase: 12-dialplan-apps-editor-refactor-reusable-route-chain-builder*
*Research produced by `gsd-phase-researcher`, 2026-08-18*
