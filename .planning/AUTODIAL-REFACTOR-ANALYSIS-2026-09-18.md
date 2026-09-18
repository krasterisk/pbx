# Автообзвон: анализ перед рефакторингом

Дата: 2026-09-18. Статус: анализ текущего рабочего дерева, не акт приёмки реализации.

## 1. Вывод и границы

Главная проблема не в размере AutodialBasesPage. Страница уже является относительно тонким компоновщиком. Основная сложность находится на границах: схема базы и значения контактов, контракт API и формы, черновик и серверный кэш, редактор сценария и исполнитель, состояние канала и результат попытки.

Нужен последовательный рефакторинг с исправлением подтверждённых дефектов, а не массовое перемещение компонентов. Сначала защитить данные и выполнение звонков, затем унифицировать формы и расширять транки/CallerID. Косметические изменения можно выпускать отдельно, но они не означают готовность звонкового контура.

В область анализа вошли базы, поля, контакты, импорт, настройки кампаний, DNC, расписания, ARI-originator, pacer, попытки и компиляция сценариев. Монитор/отчёты затронуты как потребители результатов; это не полный аудит всех их экранов. Изменений production-кода, БД, действующих кампаний и PBX не выполнялось. Существующие незакоммиченные изменения пользователя сохранены.

Обозначения доказательности:

- **S**: подтверждено чтением текущего кода. Последствие следует из кода, но не воспроизводилось на рабочей БД/PBX.
- **P**: дополнительно воспроизведено вызовом существующих чистых функций без сетевых обращений.
- **V**: нужна проверка в браузере, БД или на тестовой PBX; нельзя выдавать за наблюдавшийся production-инцидент.

## 2. Архитектурная база и существующие решения

Учтены [frontend-архитектура](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/.idea/ARCHITECTURE.md), [backend-архитектура](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/.idea/ARCHITECTURE.md), [канонический индекс](C:/Users/Professional/WebstormProjects/krasterisk_v4/.planning/CANONICAL_REFS.md), [GSD_GUIDE](C:/Users/Professional/WebstormProjects/krasterisk_v4/GSD_GUIDE.md), [контекст фазы 17](C:/Users/Professional/WebstormProjects/krasterisk_v4/.planning/phases/17-modul-avtoobzvon-kampanii-klientskie-bazy-dialer-monitor-otc/17-CONTEXT.md), [контекст фазы 6](C:/Users/Professional/WebstormProjects/krasterisk_v4/.planning/phases/06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove/06-CONTEXT.md), [.docs/TRUNKS_MODULE.md](C:/Users/Professional/WebstormProjects/krasterisk_v4/.docs/TRUNKS_MODULE.md).

Сохраняем принятые решения фазы 17:

- D-01/D-02: ARI create + dial, затем continueInDialplan; выбор исходящего транка/CID в TypeScript. Не заменять это на AMI Originate.
- D-03: сценарии IRouteAction[] и существующий DialplanAppsEditor.
- D-04/D-07/D-08: связь с очередями и состоянием операторов, несколько ограничителей набора.
- D-09/D-10: области DNC global/base/campaign и учёт местного времени абонента.
- D-11: исходный AMD через stock AMD(). Новый ML-движок не является необходимой частью рефакторинга.
- D-13/D-14: значения полей по field_uid, телефоны отдельно, CSV/XLSX и профили импорта.
- D-18/D-19/D-20: результаты попыток, повторный запуск по результатам, восстановление зависших задач.

Важно: [STATE.md:35](C:/Users/Professional/WebstormProjects/krasterisk_v4/.planning/STATE.md:35) явно отмечает, что код фаз 17/17.1-17.5 существует, но PLAN/SUMMARY и полнота приёмки не сверены. Наличие кода и зелёных unit-тестов не равно выполнению всех требований. Этот документ не переписывает ROADMAP и не объявляет фазы завершёнными.

Также сверены autodial-пункты свежих [AI capability audit](C:/Users/Professional/WebstormProjects/krasterisk_v4/.planning/AI-CAPABILITY-AUDIT-2026-09-17.md:155) и [production readiness](C:/Users/Professional/WebstormProjects/krasterisk_v4/.planning/PRODUCTION-READINESS-2026-09-17.md:69). AI-инструмент add_autodial_dnc уже обещает, что существующие задачи больше не набираются; A19 показывает, почему эту гарантию нужно обеспечить общим сервисом, а не только изменить UI. При будущем расширении API сохраняются diff/revalidate/apply и tenant isolation; новые AI-функции сами по себе в текущий рефакторинг не добавляются.

Каноны уже содержат оба правила пользователя:

- [ARCHITECTURE.md:296](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/.idea/ARCHITECTURE.md:296): U+2014 запрещён в UI, включая локализации, fallback, placeholder и option.
- [ARCHITECTURE.md:530](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/.idea/ARCHITECTURE.md:530): пояснения полей в InfoTooltip, не длинным текстом под контролом.

Добавлять дублирующие правила не требуется. Нужны проверки их выполнения. Ошибки валидации, текущий статус, последствия удаления и предупреждения о немедленном сохранении нельзя прятать в tooltip.

## 3. Карта текущих ответственностей

| Узел | Сейчас | Проблема границы |
|---|---|---|
| AutodialBasesPage | Выбор базы, сборка таблицы, форм, импорта, DNC | Не главный монолит; опасно менять только его |
| autodialPageSlice | Выбранные сущности и несколько независимых флагов модалок | Выбранная база одновременно является контекстом редактирования и импорта |
| BaseFormModal / ContactFormModal | Загрузка, гидратация, валидация, преобразование payload, сохранение | Смена данных кэша перезаписывает черновик; нет устойчивой идентичности сессии |
| ImportWizard | Файл, preview, профили, mapping, исполнение, результат | Этапы связаны множеством состояний; preview не гарантирует семантику import |
| CampaignFormModal + tabs | Один draft, настройки + немедленные DNC-мутации | Кнопка «Отмена» не описывает фактическую транзакционную границу |
| autodialApi | Все endpoint-ы, частичные response-типы как write DTO | Типизация не защищает реальный HTTP-контракт |
| BasesService / ImportService | Разные пути подготовки одинаковых контактов | Расходятся валидация, типизация, нормализация и идентичность |
| CampaignsService | Конфигурация, расписания, задачи, lifecycle, deploy | Неатомарное сохранение и смешение saved/applied/running |
| Originator / Attempt / Pacer | События ARI, ресурсные лимиты, результаты | Разные определения ответа/свободного ресурса/завершённости |
| autodial-dialplan.util | Собственный subset-компилятор | Не соответствует возможностям общего редактора |

## 4. Реестр проблем

P1: риск потери данных, неправильного звонка/маршрутизации или сломанного основного сценария. P2: существенные проблемы состояния, ошибок и UX. Приоритет отражает риск исправления, а не подтверждение инцидента у пользователя.

### Данные, API, импорт

**A01 [P1, S]. Несовместимый ответ списка контактов.** Backend возвращает `{items,total}`, frontend ожидает `{rows,total,page,page_size}`. Преобразования нет ни в endpoint, ни в базовом RTK query. Таблица получает пустой массив; форма редактирования обращается к `contactsPage?.rows.find`, что при ответе без rows также создаёт риск исключения. Источники: [bases.service:133](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-bases.service.ts:133), [autodialApi:19](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/shared/api/endpoints/autodialApi.ts:19), [ContactFormModal:55](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/autodial/ui/ContactFormModal/ContactFormModal.tsx:55). Нужен общий response DTO и HTTP contract test, а не приведение типов.

**A02 [P1, S]. Изменение схемы базы пересоздаёт UID всех полей.** `replaceFields` удаляет поля и создаёт новые без сохранения uid, хотя значения контактов хранятся по прежним uid. Frontend отправляет fields и при обычном сохранении базы. Результат: значения остаются в JSON, но перестают сопоставляться со схемой и экспортироваться в переменные звонка. Источник: [bases.service:275](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-bases.service.ts:275). Нужны diff по стабильному uid и явная политика удаления/смены типа. Автоматически восстанавливать уже нарушенные соответствия по догадкам нельзя.

**A03 [P1, S]. Даже редактирование комментария пересоздаёт все phone_uid.** `updateContact` удаляет телефоны и вставляет заново, задачи ссылаются на старые phone_uid. В schema setup у ac_tasks есть FK кампании, но нет FK телефона. Удаление контакта и replacement-import имеют аналогичное влияние на задачи. Источники: [bases.service:224](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-bases.service.ts:224), [schema:167](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/setup-autodial-schema.ts:167). Нужны стабильные UID, история попыток и согласованное завершение задач удаляемого номера.

**A04 [P1, S]. Required-телефон валидируется в неправильном месте.** UI исключает телефонные поля из values и отправляет phones отдельно. Backend требует значение required-поля, включая is_phone, в values. Стандартная схема формы создаёт required phone. Ручное создание контакта с заполненным номером может быть отвергнуто как отсутствие phone. Источник: [bases.service:300](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-bases.service.ts:300). Также API/import используют разные пути coercion, import не применяет ту же required/type-валидацию.

**A05 [P1, S]. Редактирование контакта зависит от первой страницы.** Форма запрашивает `{baseUid}`, а не отдельный контакт: это другой cache key, backend по умолчанию выдаёт 50 записей. Контакт с другой страницы не находится и форма инициализируется пустыми значениями. Нет полноценного load/error/save gate. Это отдельный дефект, который останется после A01. Источник: [ContactFormModal:55](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/autodial/ui/ContactFormModal/ContactFormModal.tsx:55). Добавить tenant-scoped GET contact by id.

**A06 [P1, S]. Replacement-import может удалить базу контактов при нуле пригодных строк.** После накопления row errors код всё равно выполняет destroy и фиксирует транзакцию с пустым prepared. Кроме того, повтор телефона внутри файла делает continue внутреннего цикла, но контакт всё равно попадает в prepared. Дедупликация external_id проверяется внутри файла, но не относительно существующей базы. Счётчик skipped суммирует ошибки и удалённые записи, не обязательно строки. Источник: [import.service:218](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-import.service.ts:218). До удаления необходимы валидированный план изменений, подтверждение и проверка совместимости с задачами.

**A07 [P2, S]. Preview и import расходятся.** Controller не передаёт delimiter/has_header в preview; preview всегда считает первую строку заголовком. Применение профиля не перестраивает preview; frontend не отправляет profile_uid и не сохраняет весь смысл dedup-настроек выбранного профиля. `.xls` разрешён UI, но обработчик использует XLSX parser. Одноимённые колонки неоднозначны при mapping по строке заголовка. Источники: [bases.controller:177](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-bases.controller.ts:177), [ImportWizard:105](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/autodial/ui/ImportWizard/ImportWizard.tsx:105), [import.service:118](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-import.service.ts:118).

### Состояние, запросы, ошибки

**A08 [P2, S]. Контекст выбранной базы протекает в модалки.** Выбор базы, редактируемая база и открытый импорт используют activeBaseUid; смена базы не закрывает импорт. Локальные page/search таблицы не сбрасываются при смене базы. Нужны раздельные selection и dialog target, сессия импорта с неизменным baseUid. Источники: [slice](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/autodial/model/slice/autodialPageSlice.ts), [ContactsGrid:55](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/autodial/ui/ContactsGrid/ContactsGrid.tsx:55).

**A09 [P2, S]. Фоновая загрузка может стереть черновик.** Эффекты форм зависят от response-объектов; инвалидация баз при изменении контактов повторно гидратирует форму базы. CampaignFormModal зависит также от t. Нужны initial hydration по идентичности сессии и явный конфликт revision, не безусловный setDraft при refetch. Источники: [CampaignFormModal:90](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/autodial/ui/CampaignFormModal/CampaignFormModal.tsx:90), [BaseFormModal](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/autodial/ui/BaseFormModal/BaseFormModal.tsx), [ContactFormModal:68](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/autodial/ui/ContactFormModal/ContactFormModal.tsx:68).

**A10 [P2, S]. Ошибки часто выглядят как пустота или успех.** Списки не разделяют error/empty; удаления выполняются без unwrap и сообщения; удаление выбранной базы сбрасывает selection до успеха и может выбрать старый элемент из кэша. saveProfile очищает имя без unwrap. Формы теряют код/поле backend-ошибки в generic catch. Источники: [BasesList:106](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/autodial/ui/BasesList/BasesList.tsx:106), [ContactsGrid:187](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/autodial/ui/ContactsGrid/ContactsGrid.tsx:187), [ImportWizard:169](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/autodial/ui/ImportWizard/ImportWizard.tsx:169).

**A11 [P2, S]. Неоднозначны пустые значения и defaults.** Пустые comment/external_id сериализуются в undefined и не очищаются при update. В retry explicit 0 отбрасывается `value > 0`, хотя backend умеет интервал 0. FE/BE различаются по defaults каналов (2/5), success_min_sec (20/15), timeout (30/45), CID mode; timezone телефона UI 0, backend/import 180. Источники: [ContactFormModal:126](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/autodial/ui/ContactFormModal/ContactFormModal.tsx:126), [campaignDraft:150](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/autodial/model/campaignDraft.ts:150), [campaign.defaults](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-campaign.defaults.ts). Унификация defaults не должна молча менять сохранённые кампании.

**A12 [P2, S/V]. Поиск и масштабирование не имеют явного контракта.** Запрос идёт на каждый ввод; поиск backend только по external_id/comment, не по телефону/динамическому имени. include phones в findAndCountAll без distinct требует интеграционного теста total при нескольких телефонах. DNC загружается целиком, import дважды передаёт весь файл base64 и держит его в памяти, вставки последовательны. Сначала контракт поиска, debounce, SQL-проверки и замеры; фоновые jobs вводить по измеренной необходимости, не автоматически.

### Сценарии и звонковый контур

**A13 [P1, S/P]. Редактор и compiler не согласованы.** Metadata разрешает больше типов для autodial, чем поддерживает локальный switch; остальные превращаются в NoOp. Современный toqueue хранит `params.target`, compiler читает legacy queue/queue_name и fallback queue_names[0]. Проба с target=wanted генерирует Queue(fallback,t). TTS генерирует Playback переменной KRSK_TTS_*, а другого места её подготовки в packages не найдено. Условия и современные параметры шагов не проходят через общий renderActionChain. Источники: [autodial-dialplan:91](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-dialplan.util.ts:91), [registry:123](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/dialplan-apps/model/registry.ts:123), [renderActionChain:945](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/shared/utils/dialplan.util.ts:945). У общего renderer host пока не содержит autodial; подключение требует адаптера/валидации, а не одной замены вызова.

**A14 [P1, S/V]. StasisStart ошибочно приравнен к ответу.** Originator использует create + dial, но на любом StasisStart ставит answered и выполняет continueInDialplan без state=Up. Корреляция регистрируется после await create. В ARI create помещает канал в Stasis до отдельного dial; это не семантика originate endpoint, который передаёт ответивший канал. Возможны преждевременная передача/потеря раннего события. Также callerId передаётся query-параметром create, где он не входит в документированный контракт; требуются CALLERID channel variables/поддержанный адаптер и проверка фактического SIP. Источники: [originator](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-originator.service.ts), [ARI client](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/ari/ari-http-client.service.ts), [официальный ARI API](https://docs.asterisk.org/Asterisk_22_Documentation/API_Documentation/Asterisk_REST_Interface/Channels_REST_API/). Порядок конкретных событий на установленной PBX ещё не проверен.

**A15 [P1, S/P]. Свободные ресурсы и полные лимиты смешаны.** tenant_cap уже вычитает tenantActive, trunk provider получает свободные каналы; в конце из обоих снова вычитается activeChannels. Проба: tenant limit=10, active=4 возвращает 2 новых слота вместо 6; trunk free=6, campaign active=4 также возвращает 2. Очереди суммируются, что требует дедупликации одного оператора в нескольких очередях. Источники: [capacity util](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-capacity.util.ts), [pacer:247](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-pacer.service.ts:247). Нужен единый контракт provider: допустимое число НОВЫХ вызовов, с однократным учётом резервов.

**A16 [P1, S]. Выбор транка не гарантирует его доступность.** Pacer суммирует остатки ограниченных транков, selector выбирает по весу без этой информации. Можно выбрать насыщенный транк при свободном соседнем. Смесь unlimited+limited неправильно представлена суммой только limited. AMI-картинка при ошибке остаётся старой без TTL, новые вызовы не отражаются немедленно в ней. Резервы локальны процессу/кампании. Источники: [pacer:267](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-pacer.service.ts:267), [trunk util](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-trunk.util.ts). Нужны доступность конкретного ресурса, его reservation и явный degraded policy.

**A17 [P1, S]. Живой звонок может снова стать pending.** Sweeper сбрасывает leased и dialing через 120 секунд от leased_at без проверки живого канала; отдельный reconciler имеет другой порог 6 часов и это не предотвращает reset pacer. Stop тоже сбрасывает dialing без завершения/дренирования живых каналов; следующий start может повторно выбрать задачу. Смена базы разрешена paused-кампании при старых задачах. Источники: [pacer:215](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-pacer.service.ts:215), [campaigns:217](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-campaigns.service.ts:217), [reconciler](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-reconciler.service.ts). Нужны lease heartbeat/fencing и lifecycle с live-attempt invariant.

**A18 [P1, S]. Финализация зависит от порядка событий.** read-check-update не атомарен; два finalize могут одновременно пройти проверку. Originator не передаёт AMD в классификатор результата. finalize затирает enrich-поля null, а поздний applyScenarioResult не пересчитывает disposition/retry. Длительность после answer используется как talk_sec, включая AMD/сообщение/ожидание очереди. Это влияет на «короткий разговор», retries, predictive и отчёты. Источник: [attempt.service:73](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-attempt.service.ts:73). Нужны монотонное объединение evidence, атомарная фиксация terminal outcome и явное различие answered_sec/agent_talk_sec.

**A19 [P1, S]. DNC не проверяется непосредственно перед набором.** Фильтр присутствует при генерации новых задач; isBlocked не вызывается звонковым путём. Добавленный после start номер и повторно активированная задача могут быть набраны. DNC нормализуется как digits, а контакт обычно ru_8_to_7: представления одного номера могут расходиться. Источники: [campaigns:238](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-campaigns.service.ts:238), [dnc.service:55](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-dnc.service.ts:55), originator. Уточнить границу: блокируются новые попытки; уже начатый звонок автоматически не обрывается.

**A20 [P1/P2, S/P]. Расписание выглядит безопаснее, чем исполняется.** Неверная IANA zone молча заменяется UTC. Нет включённых строк, в том числе когда все отключены, означает круглосуточный набор. subscriberHoursAllow существует только как util и в тестах, но runtime его не вызывает. Обещание локальных часов абонента в tooltip не обеспечено. Источник: [schedule util](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-schedule.util.ts). Проба подтвердила all-disabled => open. Изменять эту семантику нужно явно, с миграцией/предупреждением.

**A21 [P1, S]. Сохранение не равно применению.** Campaign update сохраняет row до validation/замены schedules; одной транзакции нет. applyCampaign логирует ошибку и не сообщает её вызывающему коду, start может выставить running без подтверждённого dialplan. Источники: [campaigns:110](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-campaigns.service.ts:110), [dialplan.service:25](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-dialplan.service.ts:25). Нужны config revision, applied revision/status, проверка перед запуском и повтор deploy без повторного создания кампании.

**A22 [P1, S/V]. Вложенные ссылки требуют tenant validation.** База проверяется по владельцу, но trunk_pool и цели сценария не проходят эквивалентную проверку принадлежности в CampaignsService; DNC проверяет форму scope_uid, но не владельца сущности. DTO не заменяет проверку ссылок. Источники: campaigns service, [DNC:87](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/autodial-dnc.service.ts:87), [campaign DTO](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/modules/autodial/dto/autodial-campaign.dto.ts). Это установленный пробел проверок, не демонстрация проведённой межтенантной атаки. Нужны negative integration tests до расширения динамических источников.

### UX и границы сохранения

**A23 [P2, S/V]. Вёрстка не следует собственной системе ограничений.** Невыровненные row layouts, пять/шесть колонок в модалке, общий max-width 10rem для длинных select, inline hints и viewport-breakpoints вместо учёта ширины контейнера. overflow-x:hidden скрывает последствия, но не лечит внутреннюю геометрию. DncPanel импортирует CSS приватной вкладки кампании. Источник: [CampaignTabs.module.scss](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/autodial/ui/CampaignFormModal/CampaignTabs.module.scss). Точные переполнения нужно измерить в браузере, здесь визуального прогона не было.

**A24 [P2, S]. DNC внутри формы кампании сохраняется немедленно.** «Отмена» кампании не отменяет добавленный/удалённый DNC; default scope global расширяет влияние действия. Кампания показывает global+campaign, но не наследуемый base DNC. В create/copy можно менять global до сохранения самой кампании. Источник: [DncPanel](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/autodial/ui/DncPanel/DncPanel.tsx). Предпочтительно отдельное управление стоп-листом и read-only сводка применимых правил в форме; альтернативно сохранить вкладку с явной независимой границей сохранения.

## 5. Ответы на восемь замечаний и целевой UX

### 5.1. Вёрстка, tooltip, тире

Правила уже есть, но реализации им не соответствуют. В autodial-блоке ru/en остались U+2014, включая подсказки очередей, лимитов, расписания и DNC. Существующий [responsive.test](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/autodial/ui/CampaignFormModal/CampaignFormModal.responsive.test.tsx) читает исходники и проверяет CSS regex, не рендерит интерфейс и не измеряет размеры. Это конкретный пробел контроля. Точно установить причины всех прошлых прогонов по текущему дереву нельзя.

Предложение: единый field-layout (label + InfoTooltip, control, отдельный error slot), ограниченные сетки и карточки повторяемых строк, общий modal shell с одним scroll body. Подсказки доступны по фокусу/касанию, не только hover; Esc закрывает, наведение на сам tooltip не должно его скрывать. См. [W3C WCAG: content on hover or focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html). Не скрывать критическую информацию ради ровной высоты.

### 5.2. «Очереди для соединения»

Сейчас параметр выполняет две разные роли:

1. Pacer использует эти очереди вместе с queue_agents.provider.queue_names для оценки доступных операторов.
2. Локальный compiler берёт первую очередь как fallback для toqueue без распознанного legacy-параметра.

Сам по себе список НЕ создаёт действие соединения. Пустой сценарий допускается backend, но compiler тогда выдаёт NoOp и Hangup. С современным params.target fallback может подменять фактически выбранную очередь (A13).

Предложение: назначение вызова принадлежит «Сценарию», пул операторов принадлежит «Темпу обзвона». Для статических достижимых toqueue можно предложить автоматически вычисленный пул с понятным отображением. Для условных/динамических целей нужен явный пул или ограниченный набор возможных очередей. Нельзя просто удалить queue_names: это изменит и маршрутизацию, и расчёт нагрузки. Legacy fallback мигрировать в явный target, показать diff и сохранить выбранный пользователем маршрут.

### 5.3. «Пейсинг»

Название вкладки: **«Темп обзвона»**. Секции: «Режим набора», «Ограничения одновременных вызовов», «Доступность операторов», «Расширенные настройки». AMD вынести в самостоятельную секцию/вкладку «Определение автоответчика». Технические progressive/power/predictive пояснять человеческими названиями и tooltip, не удаляя ключи API.

Показывать объяснение текущего ограничения: «Можно начать 3 вызова. Ограничение: свободные операторы». Не подменять все правила одним полем «скорость»: каналы, отношение вызовов к оператору и частота старта являются разными величинами.

### 5.4. AMD и «Оставить сообщение»

Сейчас используется **Asterisk AMD()**, без аргументов, с настройками установленного amd.conf. Это эвристический анализ пауз/речи, не современная нейросетевая классификация. Документация прямо описывает outbound-вызовы после ответа: сам факт, что система звонит первой, соответствует назначению AMD. Важен правильный момент запуска, который сейчас ставит под вопрос A14. См. [официальная документация AMD](https://docs.asterisk.org/Asterisk_22_Documentation/API_Documentation/Dialplan_Applications/AMD/).

«Сбросить» и «Оставить сообщение» генерируют одинаковый machine-tail с Hangup. Настройки аудио/текста для этой ветки нет. «Продолжить» идёт в обычный сценарий; NOTSURE тоже не выделен в отдельную ветку. AMDCAUSE не сохраняется. Обнаружить машину не равно дождаться сигнала записи и гарантированно оставить сообщение.

Рекомендуемый путь: сначала честно обозначить неподдержанную возможность и согласовать обработку существующих voicemail-конфигураций. Затем реализовать machine-ветку с выбором существующей записи либо текста через действующий TTS, preview, timeout/fallback и отдельным результатом. Проверить на записи автоответчика, человеке, тишине, шуме и раннем media. ML/ASR AMD рассматривать отдельным экспериментом только после замеров false-positive, задержки и стоимости.

### 5.5. Повторы и «Короткий разговор»

Лейблы с единицами: «Ожидание ответа, с», «Минимальная длительность, с», «Интервал после “Занято”, с», «Максимум попыток на номер». Tooltip должен объяснять, считается ли первая попытка, с какого момента отсчитывается интервал, как влияет расписание, чем пустое значение отличается от 0 и когда номер становится завершённым.

Но сначала согласовать метрику: сейчас «короткий разговор» определяется по времени после ответа, не обязательно по разговору с оператором (A18). Нельзя одним переименованием обещать измерение реального разговора. До изменения модели честно называть существующий порог «Минимальное время после ответа, с»; переход на agent talk вынести в явное изменение поведения для операторских кампаний.

### 5.6. Транки и CallerID

Новая подпись: «Лимит одновременных вызовов». Tooltip: «0: использовать лимит из настроек транка. Если там лимит не задан, этот транк не ограничивает число вызовов; остальные ограничения кампании продолжают действовать». Рядом показывать эффективное значение и источник, например «Унаследовано: 8». device_state_busy_at является техническим ключом, а не названием карточки; его место в диагностике, не в основном объяснении.

| Возможность | Автообзвон сейчас | Приложение «Транки» сейчас | Цель |
|---|---|---|---|
| Выбор | Вес + cursor от task.uid/attempt_count | Sequential / random_then_failover | Сохранить legacy weighted, добавить явные стратегии |
| CID конкретного транка | Одна строка, применяется только при global mode=per_trunk | Static / directory / pool | Те же смысловые источники на каждом транке |
| Список CID | Общий rotate | Отдельный random/round_robin pool на транк | Независимая политика и cursor пула |
| Справочник | Нет | По ORIGINAL_CALLER | Для outbound явный ключ: номер назначения/поле контакта |
| Failover | Нет цепочки в одной попытке | Переход после любого не-ANSWER | Явный список допустимых технических отказов |
| Ограничение ресурса | Aggregate, выбор не учитывает occupancy | Сам dialplan-carousel не решает резервирование pacer | Доступность + reservation до выбора |

Источники: [TrunkCallerIdSource](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/shared/src/types/directory.types.ts:47), [TrunkCarouselTrunksField](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/frontend/src/features/dialplan-apps/ui/TrunkCarouselTrunksField/TrunkCarouselTrunksField.tsx), [carousel runtime](C:/Users/Professional/WebstormProjects/krasterisk_v4/packages/backend/src/shared/utils/dialplan-trunk-carousel.util.ts:241).

Переиспользовать типы/нормализацию и независимые редакторы источника CID через нижележащий слой; не импортировать внутренние компоненты одной feature в другую. Dialplan-исполнитель и ARI-исполнитель остаются разными адаптерами. В автодозвоне нет исходного входящего звонящего, поэтому перенос ORIGINAL_CALLER без выбора семантики ошибочен. Busy/no_answer не должны автоматически превращаться в немедленный обход всех операторов связи. Отдельно учитывать contact attempt, технические legs и пользовательский retry.

Сохранить старые static/rotate/per_trunk до явного upgrade версии конфигурации. Legacy round-robin не является настоящим независимым курсором: один cursor выбирает транк и общий CID, возможна корреляция. В новой модели хранить независимые, конкурентно безопасные курсоры; не обещать отсутствие повторов или обход блокировок провайдера. Передавать только разрешённые провайдером номера.

### 5.7. Расписание и часовой пояс

Вместо шести полей в одной строке: карточка правила с типом, днём/датами, интервалом, зоной и действиями; 2 колонки на широком контейнере, 1 на узком. Сохранить фиксированный footer модалки.

«Часовой пояс»: searchable combobox по IANA с русскими названиями основных городов, идентификатором и текущим UTC offset. Хранить IANA id, не текущий offset. Источник списка: поддерживаемые зоны Intl + проверенный fallback; сохранённые алиасы не терять. [Intl.supportedValuesOf](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf) подходит для списка, но не отменяет серверную валидацию.

Пояснение: «Интервал действует по времени выбранного часового пояса». Дополнительно показывать ближайшее окно. Часовой пояс правила и смещение телефона контакта сейчас разные модели; не связывать их молча. Для окон через полночь в первой версии предлагать два правила, не менять интерпретацию существующих строк. Пустое расписание / все строки выключены / неверная зона должны иметь явные, отдельно проверяемые значения (A20).

### 5.8. «Арендатор» в стоп-листе

В коде это tenant, то есть учётная область виртуальной АТС/организации, определяемая JWT vpbx_user_uid. Это не человек-оператор и не арендатор номера. UI: «Общий стоп-лист действует во всех кампаниях вашей организации» либо «вашей виртуальной АТС», согласно общему словарю продукта. Никогда не подразумевать глобальность на все организации сервера.

Показывать источник каждой записи: «Организация», «База», «Кампания», срок и причину. Кампания должна видеть объединение применимых областей. Обещание «не набирается» станет достоверным только после проверки DNC перед каждой новой попыткой и общей нормализации номера (A19).

## 6. Предлагаемая целевая структура

Это направления ответственности, не требование создать каждый файл заранее.

```text
packages/shared/src/
  types/autodial*.ts        read/write DTO, результат страницы, ошибки, версия конфигурации
  lib/autodial/             чистые defaults, validation, normalizers без Nest/React
  types/...                 общие стратегии trunk/CID с контекстными capability

packages/frontend/src/
  pages/AutodialBasesPage/   остаётся тонкой композицией
  features/autodial/
    model/bases/            selection/dialog state, base/contact draft, validators
    model/import/           reducer этапов + immutable session identity
    model/campaign/         draft, adapters, field-error mapping, session lifecycle
    ui/...                  существующие публичные формы/таблицы, небольшие секции
    lib/...                 domain-specific labels/errors
  entities/trunk/           общий CID editor при реальном втором потребителе
  shared/ui/                существующие Stack/Text/InfoTooltip + нейтральный field-layout
  shared/api/endpoints/     autodialBasesApi, autodialCampaignsApi, autodialDncApi, ...
                            один rtkApi, временный re-export старых hooks

packages/backend/src/modules/autodial/
  bases/                    схема и идентичность полей
  contacts/                 общий writer/validator, stable phones, contact queries
  import/                   parse -> normalize -> validate -> preview plan -> commit
  campaigns/                config transaction, lifecycle, deploy revision
  policies/                 eligibility(DNC/time), capacity, retry, trunk/CID resolver
  runtime/                  task leases, resource reservations, ARI state machine,
                            attempt evidence/finalization, reconciliation
  dialplan/                 autodial adapter к общему action renderer
```

Почему не разбить сразу autodial на множество FSD features: это создаст горизонтальные зависимости и много public API до стабилизации контрактов. Сначала внутренние model/ui-границы и сохранение существующих exports; отдельная feature нужна при самостоятельном пользовательском действии и независимом жизненном цикле. Общий компонент выделяется после доказанного переиспользования, не ради «универсальности».

Правила состояния:

- Серверные сущности принадлежат RTK Query, не дублируются в Redux.
- Redux хранит selection и discriminated dialog descriptor с mode=create/edit/copy и целевыми uid, но не черновики.
- Черновик локален; sessionId + entityId + initialRevision определяют гидратацию. Refetch не перезаписывает dirty draft.
- Contacts query keyed по baseUid/page/filter; при смене базы reset page/selection, никаких строк прошлой базы под новым заголовком.
- Импорт связан с конкретной базой и параметрами parser; устаревший preview не может стать основанием нового import.
- Немедленные серверные Switch следуют канону RTK onQueryStarted + undo. Switch внутри draft с общей кнопкой Save не должен внезапно получать отдельный PUT.

Правила API/ошибок:

- Отдельные Create/Update DTO вместо Partial<read entity> и Record<string,unknown>; tenant id только из JWT.
- Устойчивые коды ошибок, field path и безопасное сообщение; 409 revision conflict не теряет draft.
- Статусы loading/error/empty/refreshing отдельны; retry запроса виден; мутации не изображают успех до ответа.
- Инвалидация scoped по base/contact/campaign, count-теги отделены от схемы. Никакого auto-refetch всех данных ради одного поля.
- Сохранение DB и применение PBX не могут быть одной ACID-транзакцией: config transaction + observable deploy state, idempotent apply и gate запуска.

## 7. Сценарии, которые нужно сохранить

1. Создание/изменение базы, обязательные и произвольные поля, enum, поля телефона и переменные сценария.
2. Ручное добавление/редактирование/удаление контактов с несколькими телефонами, основным номером, external_id/comment и смещением времени.
3. CSV/XLSX preview, mapping, transforms, профили, dedup, add/replace, отчёт об ошибках. Исправление некорректно обещанного XLS требует явного сообщения, не скрытой потери формата.
4. Выбор базы, поиск/пагинация, редактирование записи с любой страницы; пустые/ошибочные ответы.
5. Создание/edit/copy кампании, сохранение всех режимов, текущих legacy настроек транков/CID, расписаний и сценариев.
6. Start/pause/resume/stop/restart по результатам без двойного вызова живой задачи.
7. Agentless и операторские режимы, очередь по сценарию, fallback существующих кампаний после явной миграции.
8. DNC всех трёх областей и tenant isolation.
9. Исходы/повторы, monitor/report counters и predictive как потребители единого результата попытки.

«Сохранить сценарий» не означает сохранить потерю UID, игнорирование target, ложную voicemail-функцию или обход DNC. Эти исправления меняют наблюдаемое поведение и должны быть отмечены в release notes.

## 8. Выполненная проверка и ограничения

Успешно выполнены:

```text
npm run test -w @krasterisk/backend -- --runInBand --testPathPattern=autodial --no-coverage
7 suites, 100 tests passed

npm run test -w @krasterisk/frontend -- src/features/autodial --maxWorkers=2
7 files, 61 tests passed
```

Frontend запуск потребовал повторного запуска с разрешением для esbuild после sandbox EACCES. Ошибка первого запуска не является дефектом модуля.

Дополнительные read-only пробы: существующие TS util-функции транспилированы в памяти и вызваны без БД/PBX. Проверены computeAutodialCapacity, generateAutodialCampaignDialplan + withMachineTail, campaignWindowOpen. Получены: tenant10/active4 => slots2; trunkFree6/active4 => slots2; target wanted => Queue(fallback,t); hangup и voicemail => идентичные линии; all schedules disabled => true. Неиспользуемый в проверяемом пути buildCurlCall изолирован stub, сетевые вызовы исключены.

Текущие autodial-тесты преимущественно проверяют util/draft, а responsive-тест исходники. Нет доказательства покрытия HTTP-контрактов, транзакций сохранения полей/телефонов, реальной геометрии, порядка событий ARI и провайдерского CallerID. Полные lint/backend/frontend, browser UAT и PBX harness в этой аналитической стадии не запускались. Готовность реализации не заявляется.

План работ и критерии приёмки: [AUTODIAL-REFACTOR-PLAN-2026-09-18.md](C:/Users/Professional/WebstormProjects/krasterisk_v4/.planning/AUTODIAL-REFACTOR-PLAN-2026-09-18.md).
