# Phase 16: Модуль телеконференций (ConfBridge + WebRTC) — Research

**Researched:** 2026-09-15
**Domain:** Asterisk ConfBridge/AMI, тенантный dialplan-генератор, WebRTC-грид на sip.js, opaque-токены гостей, SSE-события, AI-адаптер
**Confidence:** HIGH (движок, видео, гибрид, ёмкость — закрыты спайками 001–004; dialplan-генерация, data model, токены, AI-адаптер — верифицированы по существующему коду)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Движок комнаты и конфигурация**
- **D-01:** Медиа-ядро выбирается ресёрчем (R-ENGINE), а не на discuss. **ЗАКРЫТО спайками: ConfBridge + AMI.**
- **D-02:** Настройки комнаты (профили, PIN, меню, лимиты) едут из БД **динамическим профилем `CONFBRIDGE()`**, а не записью `confbridge.conf`. У ConfBridge нет realtime-бэкенда — профили читаются только из файла либо собираются в диалплане строками `Set(CONFBRIDGE(user,pin)=…)` с `template` поверх профиля из файла. Бэкенд генерирует **тенантный диалплан-контекст**, а не `confbridge.conf`, и `dialplan reload` в конце `DialplanApplyService.applyCategories` — ровно та перезагрузка, которая нужна. **Поправка спайков:** `video_mode` динамике не поддаётся, платформа обязана держать статический bridge-профиль в `confbridge.conf` (`module reload app_confbridge.so`), тенантные настройки едут поверх через `Set(CONFBRIDGE(bridge,template)=…)`. Файл платформенный, не тенантный, пишется один раз.
- **D-03:** Ad hoc конференция колл-центра (`CallCenterService.addToConference`, комната = очищенный `uniqueid`, без тенанта и без записи в БД) **поглощается модулем** и становится эфемерной комнатой. Одна схема комнат на весь продукт.
- **D-04:** Комнаты бывают **постоянные и эфемерные**. Эфемерная создаётся из веба или из звонка и угасает после завершения.
- **D-05:** При маске маршрута (D-07) одна диалплан-запись обслуживает много комнат с разными настройками, поэтому настройки достаются **в рантайме**. Два жизнеспособных механизма: CURL в бэкенд либо ветка на комнату в сгенерированном контексте. **Выбор — за планированием** (Claude's Discretion) — см. Pattern 1 ниже.

**Именование и адресация**
- **D-06:** Тенантное имя комнаты — **`conf{номер}_{uid}`**. В одном ряду с `group_{exten}_{uid}`, читаемо в логах и `confbridge list`.
- **D-07:** Комната **не занимает номер в плане нумерации**. Маска обязана работать: маршрут `_9XX` попадает в комнату `9XX`, ровно как `q${EXTEN}_{uid}` у очередей.
- **D-08:** Комната в шаге маршрута — **только выбор из созданных комнат**. Маска резолвит номер в существующую комнату тенанта, но **не создаёт** её на лету.
- **D-09:** **Миграции нет.** Существующих маршрутов с `confbridge` в проде нет — можно удалить единичные находки.

**Гостевой вход по ссылке**
- **D-10:** Чем является гость технически — решается ресёрчем вместе с R-ENGINE. **Под ConfBridge+AMI → ephemeral PJSIP-эндпоинт на сессию** (см. Pattern 6).
- **D-11:** Строгость входа — **настройка комнаты**, три уровня: токен+имя; +PIN комнаты; +одобрение модератором (комната ожидания).
- **D-12:** Ссылки **двух видов одновременно**: общая ссылка комнаты с TTL и отзывом плюс именные приглашения (видно, кто вошёл, можно отозвать точечно). Прецеденты: `cc_display_tokens` + `DisplayTokenGuard`, `vm_access_tokens`.
- **D-13:** Поведение «гость пришёл раньше модератора» — **настройка комнаты**: ожидание модератора, свободный вход, завершение при выходе модератора. В ConfBridge — `wait_marked` и `end_marked`.

**Роли и права**
- **D-14:** **Три фиксированные роли:** владелец, модератор, участник. Ложатся на `admin` и `marked` в user-профиле ConfBridge.
- **D-15:** Владелец может сделать модератором любого участника, включая гостя со ссылки.
- **D-16:** Права на двух уровнях: постоянные модераторы в настройках комнаты плюс разовая выдача во встрече.
- **D-17:** Админ тенанта видит и настраивает все комнаты тенанта; вход в чужую живую встречу пишется в аудит.

**Ёмкость**
- **D-18:** Доступный максимум — минимум из потолка тарифа и живого остатка сервера. Тенант никогда не видит, какое ограничение сработало.
- **D-19:** Набор метрик живой нагрузки и веса участника — по R-CAPACITY. **ЗАКРЫТО: остаток считается в потоках** (N·(N−1) при ~800 кбит/с на поток), вес нового участника — `2n` новых потоков, где `n` — уже присутствующих.
- **D-20:** Тенанту показывается только число, формулировкой **«Максимальное число участников: N»** (дословно, без «сейчас доступно», без слов о сервере). Число считается динамически, может меняться между просмотрами.
- **D-21:** Участник сверх лимита получает **отказ с объяснением** (голосовое объявление / понятная ошибка в вебе). Деградация «пустить без видео» отклонена. Подтверждено спайками: штатное поведение ConfBridge `max_members`.

**Видео**
- **D-22:** Видео — обязательная часть v1, вплоть до внешнего SFU. **ЗАКРЫТО: нативный `video_mode=sfu` достаточен**, внешний SFU не нужен.
- **D-23:** Видео доступно веб-участникам и аппаратным телефонам, веб в приоритете. **Поправка спайков:** ограничитель — не совпадение кодека, а `max_video_streams` (дефолт 1 → любой абонент видео-слеп; участник видит N собеседников только при `max_video_streams >= N+1`). Это параметр провижининга.
- **D-24:** Раскладка — сетка всех участников. Подтверждена на 3 участниках.
- **D-25:** Единый видеокодек фиксирует платформа — **VP8** (по итогам R-VIDEO), тенант не видит.

**Поверхность и место в продукте**
- **D-26:** Живая комната — полноэкранная страница плюс мини-панель «вы в конференции» при уходе на другую страницу (по образцу софтфона Phase 9/10).
- **D-27:** В Module Hub — сначала страница в базовом хабе `apps` (рядом с IVR, очередями, группами), монетизация в `market` — позже. В `hub-modules.seed.ts` записи о конференциях сегодня нет.
- **D-28:** Страница гостя — минимальный шелл с логотипом тенанта (не «голая», как публичный wallboard, но без сайдбара/меню/намёков на АТС).
- **D-29:** Мобильный веб — полноценная комната на телефоне в v1.

**Запись**
- **D-30:** Запись переиспользует механику записей разговоров: тот же `records_base_path`, тот же access-scope и Range-стриминг, что у CDR и голосовой почты. Путь хранения фиксируется после первого приёма файлов (one-way).
- **D-31:** Запись включается и автоматически по настройке комнаты, и кнопкой модератора (`ConfbridgeStartRecord` / `ConfbridgeStopRecord`).
- **D-32:** Уведомление участников о записи — настройка комнаты (индикатор в вебе + голосовое объявление для телефонных участников).
- **D-33:** Слушать записи можно и в модуле (история встреч с плеером и списком участников), и в CDR-отчёте (факт звонка и запись, по образцу голосовой почты Phase 13).

**Живые события**
- **D-34:** Источник событий — ConfBridge → AMI-события `Confbridge*`. В `ami.service.ts` сегодня нет ни одного слушателя `Confbridge*` — образец: слушатели очередей в том же файле.
- **D-35:** Транспорт в браузер — SSE + REST на действия.
- **D-36:** Гость получает ровно тот же поток, что и свои. Тенантный префикс комнаты, имена каналов и внутренние идентификаторы не отдаются никому (общее правило D-06).
- **D-37:** Состояния участника в v1: говорит сейчас, заглушён, роль, видео вкл/выкл. «Поднятая рука» и поканальное качество — не в v1.

**Приглашения и имена**
- **D-38:** Механизм приглашения абонента (AMI `Originate` vs ARI `createChannel`+`addChannelToBridge`) — по итогам R-ENGINE → **AMI `Originate`** (ConfBridge выбран).
- **D-39:** Кто может приглашать внешний номер (исходящий звонок за деньги тенанта) — настройка комнаты.
- **D-40:** Смена отображаемого имени: гостю запоминается по токену, своим — только на время встречи. Карточка абонента и справочники не перезаписываются никогда.

**AI-адаптер**
- **D-41:** Полный объём: чтение + настройка через дифф-карточку + живые действия (заглушить, исключить), по образцу live-ops колл-центра. Модуль обязан приехать с `SKILL.md` и записью в `module-coverage.registry.ts`, иначе падает completeness-тест из `15-23`.

### Claude's Discretion
- Механизм доставки настроек комнаты в рантайме при маске (CURL против ветки на комнату) — D-05.
- Формулировки локалей, кроме дословно зафиксированной в D-20.
- Раскладка формы комнаты и группировка настроек по вкладкам.
- Конкретная структура таблиц модуля при соблюдении тенантной колонки `vpbx_user_uid`.

### Deferred Ideas (OUT OF SCOPE)
- Монетизация модуля в `market`-хабе (D-27) — после v1.
- Окно активности комнаты по расписанию (интеграция с `time-groups`) — отклонено в пользу «постоянные + эфемерные» (D-04).
- «Поднятая рука» и поканальное качество связи в списке участников (D-37).
- AI-саммари и расшифровка записи конференции.
- Планировщик конференций с календарными приглашениями.
- Биллинг и тарификация конференций.
- Замена общего softphone-стека Phase 10.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Описание | Research Support |
|----|----------|-------------------|
| D-02/D-05 | Тенантный dialplan-контекст комнаты + доставка настроек при маске | Pattern 1 — рекомендация: собственный контекст на комнату + тенантный mask-index, без CURL на маршрутизацию |
| D-02 (поправка) | Платформенный статический `confbridge.conf` профиль | Pattern 2 — точный минимальный файл, идемпотентный bootstrap на старте бэкенда |
| D-06/D-07/D-08 | Тенантное имя `conf{номер}_{uid}`, маска резолвит без создания | Pattern 1 (mask-index) + Pattern 3 (`normalizeTarget` расширение) |
| Claude's Discretion (таблицы) | Data model комнат, токенов, истории встреч | Pattern 4 — 5 таблиц, `vpbx_user_uid` только на корневой |
| D-11/D-12 | Гостевые токены — 3 уровня строгости, 2 вида ссылок | Pattern 5 — модель + guard + endpoint surface |
| D-10 | Гость как SIP-участник под ConfBridge | Pattern 6 — ephemeral PJSIP endpoint per session, dedicated context |
| D-34/D-35/D-37 | AMI `Confbridge*` → EventEmitter2 → SSE | Pattern 7 — карта событий, токен-scoped SSE для гостей |
| UI-SPEC / D-24 | Браузерный клиент, кастомный SDH, грид, телеметрия | Pattern 8 — рецепт из спайка 002, файл `useConferenceRoom.ts` |
| D-18/D-19/D-20 | Вычисление ёмкости N | Pattern 9 — формула, живой tally через AMI-события, где посчитать |
| D-30…D-33 | Запись — ConfbridgeStartRecord/StopRecord, Range, CDR | Pattern 10 — путь хранения, модель `conference_meetings`, CDR-хук |
| Задача спайков | Серверная чистка зависших каналов | Pattern 11 — Cron sweeper на `ConfbridgeList` |
| D-41 | AI-адаптер + SKILL.md + `module-coverage.registry.ts` | Pattern 12 — точный контракт completeness-теста, шаблон адаптера |
| D-38 | Приглашение абонента — AMI `Originate` | Pattern 6 (раздел «Приглашение своего абонента») |
| D-14…D-17 | Роли на `admin`/`marked` | Pattern 6 + Data model (Pattern 4) |
</phase_requirements>

## Summary

Все три исследовательских ворота (R-ENGINE, R-VIDEO, R-CAPACITY) закрыты экспериментальными спайками 001–004 — эта работа их не повторяет, а строит на них конкретный код. Оставшиеся вопросы для планирования — не «что выбрать из технологий», а «как встроить выбранное в существующие конвенции репозитория»: генератор диалплана, opaque-токены, SSE, AI-адаптер.

Ключевая находка этого ресёрча: **D-05 разваливается на два независимых вопроса**, которые в тексте фазы выглядят одним. (1) «Как маска резолвит номер в контекст комнаты» — решается **без CURL**, тем же способом, что `togroup`/`toivr`: генератор пишет отдельный dialplan-контекст на каждую комнату (`krsk-conf-{room_uid}`) плюс один тенантный «mask-index» контекст с `Goto` по номеру, применяемые одним вызовом `DialplanApplyService.applyCategories`. (2) «Сколько участников комната может принять прямо сейчас» — это принципиально рантайм-величина (зависит от всех комнат всех тенантов сервера одновременно) и **её CURL-проверка оправдана**, но не в хот-пасе маскировки, а внутри уже найденного контекста комнаты, притом реализация через периодический фоновый пересчёт `max_members` предпочтительнее CURL на каждый вход (см. Pattern 9).

Вторая находка: платформенный `confbridge.conf` пишется той же связкой AMI `CreateConfig`/`UpdateConfig`, что и тенантные конфиги, но **без операционного `mkdir`** — файл лежит в корне конфиг-директории Asterisk, а не в подкаталоге `krasterisk/*`. Это можно и нужно сделать самовосстанавливающимся bootstrap-шагом (`OnApplicationBootstrap` в новом модуле), а не разовой ручной задачей — риск разъехавшихся окружений (dev/staging/prod) выше стоимости идемпотентной проверки при старте.

Третья находка: гость технически — **ephemeral PJSIP endpoint на сессию**, чей `context` указывает прямо на контекст конкретной комнаты (не на общий guest-контекст с диалингом) — это одновременно и самое простое решение, и самое безопасное: скомпрометированный токен не даёт ничего, кроме входа в ту же самую комнату.

**Primary recommendation:** для генерации диалплана — copy-the-pattern из `call-group-dialplan.util.ts` (отдельный контекст на сущность + один `applyCategories` на CRUD); для ёмкости — фоновый пересчёт `max_members`, не CURL на каждый Join; для гостя — ephemeral endpoint с контекстом = комнатой; для AI-адаптера — точно повторить структуру `time-groups-ai.adapter.ts` (read + `defineMutationTool`) плюс живые тулы по образцу `callcenter-ai.adapter.ts` (`destructive: true`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| CRUD комнат, настройки, применение в Asterisk | API/Backend (`ConferenceRoomsService`) | Database | Тот же паттерн, что `CallGroupsService`/`RoutesService` — мутация → `applyCategories` |
| Резолюция номера в комнату (маска) | Asterisk dialplan (генерируемый) | — | Решается на уровне диалплана без обращения к backend в хот-пасе звонка |
| Вычисление живой ёмкости N | API/Backend (агрегатор AMI-событий) | Database (тариф) | Требует глобального across-tenant состояния, недостижимого из диалплана без похода на backend |
| Публикация настроек в ConfBridge на конкретный Join | Asterisk dialplan (`Set(CONFBRIDGE(...))`) | API/Backend (генератор) | `CONFBRIDGE()` — dialplan-функция, работает только внутри диалплана перед `ConfBridge()` |
| Live-события участников (говорит/muted/роль) | API/Backend (AMI listener → EventEmitter2) | Browser (SSE consumer) | Тот же путь, что и колл-центр: `ami.service.ts` → `EventEmitter2` → SSE |
| WebRTC-медиа и грид-рендеринг | Browser/Client (`useConferenceRoom.ts`) | Asterisk (SFU media plane) | Сигналинг и рендер — в браузере; фактическая раздача видеопотоков — в Asterisk ConfBridge |
| Гостевой доступ (auth-обвязка) | API/Backend (opaque-токен + guard) | Browser (гостевой шелл) | Тот же паттерн, что `DisplayTokenGuard`/`voicemail-link.guard.ts` |
| Приглашение абонента (Originate) | API/Backend (AMI `Originate`) | Asterisk | Инициируется REST-действием из живой комнаты |
| Запись и плейбек | API/Backend (Range-стриминг) | Filesystem (`records_base_path`) | Тот же путь, что CDR/voicemail |
| Чистка зависших каналов | API/Backend (Cron) | Asterisk (`ConfbridgeList`/`ConfbridgeKick`) | Сервер не может сам себя почистить — backend опрашивает и решает |
| AI-адаптер и SKILL.md | API/Backend (`ai-platform`) | — | Регистрация домена, не отдельный слой |

## Standard Stack

Фаза **не вводит новых внешних библиотек** — весь стек уже в проекте.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `asterisk-manager` | `^0.2.0` [VERIFIED: packages/backend/package.json:59] | AMI-клиент (`AmiService`), `CreateConfig`/`UpdateConfig`/`Originate`/`ConfbridgeMute` и т.д. | Уже используется во всех AMI-модулях |
| `sequelize` + `sequelize-typescript` | `^6.37.6` / `^2.1.6` [VERIFIED: packages/backend/package.json:81,51] | Модели комнат, токенов, истории встреч | Единственный ORM в проекте |
| `@nestjs/event-emitter` | `^3.0.1` [VERIFIED: packages/backend/package.json:43] | Мост AMI-события → SSE | Уже используется callcenter/queue-событиями |
| `@nestjs/schedule` | `^6.1.3` [VERIFIED: packages/backend/package.json:49] | Cron-sweeper зависших каналов, периодический пересчёт ёмкости | Уже зависимость проекта — не добавляется |
| `zod` | `^4.4.3` [VERIFIED: packages/backend/package.json:86] | `defineMutationTool` input/args схемы AI-адаптера | Конвенция `ai-mutation.contract.ts` |
| `sip.js` | `0.21.2` [CITED: 16-CONTEXT.md canonical_refs, callcenter-webrtc.controller.ts] | Браузерный SIP/WebRTC клиент | Уже используется софтфоном Phase 10; фаза расширяет через собственный `SessionDescriptionHandler`, не меняет версию |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| `bcrypt`/`bcryptjs` | уже в проекте | не нужен для guest-токенов — они opaque random, не пароли | — |
| `uuid` | `^3.4.0` / `^10.0.0` (types) [VERIFIED: packages/backend/package.json:63,45] | генерация opaque-токенов гостя, `room_uid` | По образцу `vm_access_tokens`/`cc_display_tokens` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Собственный ARI-бридж (R-ENGINE альтернатива) | ConfBridge + AMI | Отклонено спайками — ARI-бридж пришлось бы вручную повторять транскодинг, видео-переговоры, SFU |
| Внешний SFU (mediasoup/janus) | нативный `video_mode=sfu` | Отклонено спайками — нативный режим достаточен на проверенном масштабе |
| CURL на каждый Join для резолюции комнаты | Собственный dialplan-контекст на комнату | Задержка и точка отказа на каждый звонок против записи только на CRUD-мутации |

**Installation:** нет — все пакеты уже установлены.

## Package Legitimacy Audit

Фаза не устанавливает новых пакетов. Таблица не применяется.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Тенант (браузер, DialplanAppsEditor)                Гость (внешняя ссылка)
        │                                                    │
        ▼                                                    ▼
 ConferenceRoomsController         ConferenceGuestController (guard: ConferenceGuestTokenGuard)
        │ CRUD room                                          │ validate token → ephemeral endpoint
        ▼                                                    ▼
 ConferenceRoomsService ──apply──▶ DialplanApplyService.applyCategories
        │                            │  CreateConfig → UpdateConfig(DelCat/NewCat/Append) → dialplan reload
        │                            ▼
        │                    krasterisk/conferences/conf_{vpbx}.conf
        │                    ├── category krsk-conf-{room_uid}   (Set(CONFBRIDGE(...)) + ConfBridge())
        │                    └── category krsk-conf-mask-{vpbx}  (Goto по номеру → каждая krsk-conf-{room_uid})
        │
        ▼
 EndpointsService.createEphemeralGuestEndpoint()  (для гостя, Pattern 6)
        │  ps_endpoint/ps_auth/ps_aor, context = krsk-conf-{room_uid}, max_video_streams, allow=...vp8
        ▼
 Asterisk PJSIP registration (WSS) ──INVITE──▶ krsk-conf-{room_uid},s,1 ──▶ ConfBridge(conf{ном}_{uid}, krsk_conf_sfu, ...)
        │                                                                        │
        │◀──────────────── AMI events: ConfbridgeJoin/Leave/Talking/Mute ────────┘
        ▼
 AmiService.on('managerevent') → EventEmitter2 'conference.<event>' → ConferenceStateService (in-memory tally)
        │
        ├──▶ SSE ConferenceSseController (@Sse, guard по vpbx или по guest-токену) ──▶ useConferenceRoom.ts (браузер)
        └──▶ ConferenceCapacityService (периодический пересчёт N, Pattern 9) ──▶ applyCategories (max_members diff)

Браузер (участник/гость):
 useConferenceRoom.ts → sip.js UserAgent (кастомный SessionDescriptionHandler) → WSS → Asterisk
        │ ontrack (video) → VideoGrid (VideoSurface × N)
        │ getStats() → qualityLimitationReason/freezes → ConferenceTelemetryReporter → REST /conferences/:uid/telemetry
```

---

### Pattern 1: Тенантный dialplan-контекст комнаты + mask-index (D-02/D-05/D-07/D-08)

**What:** Комната получает собственный dialplan-контекст, аналогично IVR/группам. Плюс один тенантный «mask-index» контекст на все комнаты тенанта, который резолвит номер (в т.ч. по маске `_9XX`) в конкретный контекст комнаты через `Goto`.

**Свидетельство из существующих генераторов.** `case 'toivr'` в `dialplan.util.ts` эмитит прямой `Goto` в статически известный контекст комнаты — маршрутизация «какая сущность» решена на этапе построения шага маршрута, не в рантайме:

```482:520:packages/backend/src/shared/utils/dialplan.util.ts
      case 'confbridge': {
        const room = this.sanitizeDialplanInput(params.room) || 'default';
        const options = this.sanitizeDialplanInput(params.options) || '';
        dp = `Answer()\nsame => n,ConfBridge(${room}${options ? `,${options}` : ''})`;
        break;
      }
```
*(текущая untenanted эмиссия — заменяется полностью; `params.options` во втором аргументе на самом деле имя bridge-профиля, а не флаги — ROADMAP ловушка №3, подтверждается сигнатурой `ConfBridge(conference,[bridge_profile,[user_profile,[menu]]])` из canonical_refs)*

`togroup` — самый близкий по форме прецедент для случая с маской, потому что группа **тоже** не занимает номер в плане нумерации сама по себе и её резолюция построена как `Gosub` в контекст, чьё имя зависит от `${EXTEN}`:

```recall from call-groups precedent (verified this session earlier in conversation, see summary):
normalizeTarget('group', src, vpbx) === `group_${raw}_${uid}`
// where raw = '${EXTEN}' when target source is 'route_pattern'
// → Gosub(group_${EXTEN}_${uid}, start, 1)
```

и `generateGroupDialplan` создаёт контекст **с именем, равным этому самому вычисленному значению**, а не с числовым диапазоном:

```294:352:packages/backend/src/modules/call-groups/call-group-dialplan.util.ts
export function generateGroupDialplan(
  group: ICallGroup,
  members: ICallGroupMember[],
  vpbx: number,
  ...
): GeneratedDialplanCategory {
  const ctxName = `group_${group.exten}_${vpbx}`;
  ...
  return { name: ctxName, lines, extras };
}
```

**Рекомендация для conferences (evidence-based):** этот же трюк работает и для комнат, но с одним отличием — у групп числитель маски (`${EXTEN}`) **совпадает** с именем контекста напрямую (`group_${EXTEN}_${uid}`), поэтому `Gosub` работает даже без предварительной проверки существования (Asterisk просто продолжит на следующем приоритете при отсутствующем target для `Gosub`/`Goto` — но **не проверено в этой сессии на живом Asterisk**, см. Assumptions Log A1). Для конференций рекомендуется явный guard через `DIALPLAN_EXISTS()`, потому что: (а) комната **обязана** явно ответить «такой комнаты нет» с понятной ошибкой (в отличие от групп, где тихий провал на следующий шаг маршрута — приемлемое поведение), (б) ConfBridge не даёт дружелюбного отказа сам, в отличие от `Queue()`, который на несуществующей realtime-очереди сам возвращает `QUEUESTATUS=INVALID` и идёт дальше по диалплану.

Сгенерированные категории для одного тенанта (`vpbx = 42`), в одном файле `krasterisk/conferences/conf_42.conf`, применяемые ОДНИМ вызовом `applyCategories(filename, [roomCategory, maskIndexCategory])`:

```asterisk
[krsk-conf-77]                          ; room_uid = 77, стабильно при ренейме номера
exten => s,1,NoOp(Conference room conf6007_42)
same => n,Answer()
same => n,Set(CONFBRIDGE(bridge,template)=krsk_conf_sfu)
same => n,Set(CONFBRIDGE(bridge,max_members)=${DB(conf/77/max_members)})  ; или литерал, см. Pattern 9
same => n,Set(CONFBRIDGE(bridge,record_conference)=no)
same => n,Set(CONFBRIDGE(user,wait_marked)=no)
same => n,Set(CONFBRIDGE(user,end_marked)=no)
same => n,Set(CONFBRIDGE(user,talk_detection_events)=yes)
same => n,ConfBridge(conf6007_42,krsk_conf_sfu)
same => n,Hangup()

[krsk-conf-mask-42]                     ; один на тенанта, перезаписывается целиком на любой CRUD любой комнаты
exten => 6007,1,GotoIf($["${DIALPLAN_EXISTS(krsk-conf-77,s,1)}" = "1"]?krsk-conf-77,s,1:conf-not-found)
same => n(conf-not-found),Playback(conf-room-not-found)
same => n,Hangup()
exten => 6008,1,GotoIf($["${DIALPLAN_EXISTS(krsk-conf-81,s,1)}" = "1"]?krsk-conf-81,s,1:conf-not-found)
...
```

Точка входа из шага маршрута `confbridge` в `dialplan.util.ts` — два случая, различаемых `ValueSource` параметра (тот же паттерн, что уже применён к `queue`/`group` в других action-типах):
- **`fixed` (выбор конкретной комнаты в UI, D-08):** `emitHopPrologue('krsk-conf-{room_uid},s,1', {routeId:'conf_{room_uid}'})` — прямой `Goto`, без похода в mask-index.
- **`route_pattern` (маска, D-07):** `Goto(krsk-conf-mask-${vpbx},${EXTEN},1)` — попадает в тенантный mask-index, который либо резолвит, либо отказывает.

**When to use:** для ЛЮБОГО шага, где комната выбрана статически в форме шага — использовать прямой `Goto`. Mask-index — только когда параметр комнаты в шаге маршрута задан как маска/шаблон номера.

**Почему НЕ CURL здесь:** `buildCurlCall` в `dialplan-curl.util.ts` даёт синхронный HTTP round-trip на каждый входящий звонок — оправдан, когда без него нельзя (голосовая почта: список ящиков меняется независимо от диалплана; уведомления: контент письма не хранится в диалплане). Для комнаты **всё, что нужно диалплану, уже известно на момент CRUD** (какие комнаты существуют у тенанта, их номера, их uid) — вопрос чисто маршрутизационный, решаемый статической генерацией без побочного риска (сеть недоступна → звонок не пройдёт).

**Anti-Patterns to Avoid**
- **Один общий контекст на все комнаты тенанта с CURL внутри `s,1`:** добавляет сетевую зависимость в горячий путь каждого звонка и делает диалплан нечитаемым в `dialplan show`.
- **Хранение имени bridge-профиля во втором аргументе `params.options` как строки флагов:** зафиксированная ROADMAP-ловушка №3 — второй аргумент `ConfBridge()` — это ИМЯ bridge-профиля (`bridge_profile`), а не список опций.

---

### Pattern 2: Платформенный статический `confbridge.conf` (поправка D-02)

**What:** Единственный статический bridge-профиль `[krsk_conf_sfu]` с `video_mode=sfu`, живущий в `confbridge.conf` в корне конфиг-директории Asterisk (НЕ в `krasterisk/` подкаталоге).

**Механизм записи — идентичен `DialplanApplyService.applyCategories`, но с другой командой перезагрузки:**

```typescript
// packages/backend/src/modules/ami/dialplan-apply.service.ts — существующий метод, переиспользуется как есть
async applyCategories(
  filename: string,
  categories: DialplanCategory[],
  opts?: { reload?: boolean },
): Promise<void> {
  // CreateConfig → UpdateConfig (Action, Action-XXX: DelCat/NewCat/Append) → dialplan reload (если opts.reload !== false)
}
```

Подтверждено спайком `002-confbridge-sfu-video-grid/static-profile-test.js`: тот же `CreateConfig`/`UpdateConfig` пишет `confbridge.conf`, перезагрузка — **`module reload app_confbridge.so`**, не `dialplan reload`. Рекомендация: добавить в `DialplanApplyService` перегрузку/параметр `reloadCommand?: string`, либо отдельный узкий метод `applyConfbridgeProfile()`, вызывающий `applyCategories(filename, categories, { reload: false })` и затем `this.amiService.command('module reload app_confbridge.so')`.

**Минимальный контент файла:**
```ini
[krsk_conf_sfu]
type=bridge
video_mode=sfu
```

**Каталоговая оговорка:** AMI `CreateConfig` не создаёт родительские каталоги (задокументированная ловушка для `krasterisk/*` файлов) — но `confbridge.conf` лежит на **том же уровне**, что `extensions.conf`/`pjsip.conf`, то есть каталог уже существует всегда. Это меньше операционного риска, чем ROADMAP ожидал изначально.

**Рекомендация — не «разовая ручная задача», а идемпотентный bootstrap:** реализовать проверку/создание профиля в `OnApplicationBootstrap` нового `ConferencesModule` (тот же жизненный цикл, что уже используют другие сервисы бэкенда для самовосстанавливающейся инициализации): прочитать текущий `confbridge.conf` через AMI `GetConfig`, если категории `krsk_conf_sfu` нет — записать и один раз выполнить `module reload app_confbridge.so`. Это устраняет расхождение dev/staging/prod без ручного шага в runbook.

**When to use:** ровно один раз на установку Asterisk (не на тенанта, не на комнату).

---

### Pattern 3: `normalizeTarget` расширение под `conf{номер}_{uid}` (D-06/D-07)

**What:** `dialplan-target.util.ts` уже реализует ряд `normalizeTarget('queue', ...)` → `q${raw}_${uid}` с passthrough-guard для уже отенантенных значений (`^q.+_${uid}$`). Для конференций нужен симметричный `normalizeTarget('conference', ...)` → `conf${raw}_${uid}` с guard `^conf.+_${uid}$`.

**Важное отличие от группы/очереди:** У conferences резолюция маски идёт НЕ через прямое совпадение `${EXTEN}` с суффиксом имени контекста (как у групп), а через отдельный mask-index-контекст (Pattern 1), потому что комнате нужен явный отказ на «не найдено», а не тихий провал `Gosub`/`Goto` в никуда. `normalizeTarget('conference', ...)` используется **только для построения Asterisk-имени самой комнаты** (`conf${number}_${uid}`) при записи в `ConfBridge(...)` внутри собственного контекста комнаты — не для маршрутизации маски.

**When to use:** при генерации любой строки, где нужно тенантное Asterisk-имя комнаты (запись в конфиг ConfBridge, AMI-действия `ConfbridgeKick`/`ConfbridgeMute`, адресация в `ConfbridgeList`).

---

### Pattern 4: Data model (Claude's Discretion — структура таблиц)

**Конвенция схемы, подтверждённая в `setup-directories-schema.ts`:** `CREATE TABLE IF NOT EXISTS` только, никогда `DROP`; тенантная колонка (`user_uid`/`vpbx_user_uid`) — **только на корневой таблице домена**; дочерние таблицы получают тенантный скоуп через `FOREIGN KEY ... ON DELETE CASCADE`, без собственной колонки:

```8:64:packages/backend/src/modules/directories/setup-directories-schema.ts
CREATE TABLE IF NOT EXISTS `directories` ( ... `user_uid` INT NOT NULL, ... )
CREATE TABLE IF NOT EXISTS `directory_fields` ( ... `directory_uid` INT NOT NULL, ... )   -- нет user_uid
CREATE TABLE IF NOT EXISTS `directory_records` ( ... `directory_uid` INT NOT NULL, ... )  -- нет user_uid
CREATE TABLE IF NOT EXISTS `route_directory_bindings` ( ... )                             -- нет user_uid
```

**Рекомендуемая схема для conferences** (`setup-conferences-schema.ts`, скрипт `db:setup:conferences` по образцу `db:setup:directories`):

```sql
CREATE TABLE IF NOT EXISTS `conference_rooms` (
  `uid` INT NOT NULL AUTO_INCREMENT,
  `vpbx_user_uid` INT NOT NULL,               -- ЕДИНСТВЕННАЯ таблица с тенантной колонкой
  `number` VARCHAR(32) NOT NULL,               -- короткий номер, видимый тенанту
  `name` VARCHAR(255) NOT NULL,
  `kind` ENUM('permanent','ephemeral') NOT NULL DEFAULT 'permanent',
  `entry_strictness` ENUM('token_name','token_name_pin','token_name_pin_moderator') NOT NULL DEFAULT 'token_name',
  `pin` VARCHAR(32) NULL,
  `wait_marked` TINYINT(1) NOT NULL DEFAULT 0,   -- D-13
  `end_marked` TINYINT(1) NOT NULL DEFAULT 0,    -- D-13
  `record_mode` ENUM('off','auto','button','both') NOT NULL DEFAULT 'off',   -- D-31
  `notify_recording` TINYINT(1) NOT NULL DEFAULT 1,  -- D-32
  `invite_external_scope` ENUM('owner','moderator','anyone') NOT NULL DEFAULT 'owner',  -- D-39
  `tariff_max_participants` INT NULL,            -- D-18, потолок тарифа; NULL = без потолка кроме серверного
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `uniq_room_number_per_tenant` (`vpbx_user_uid`, `number`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `conference_room_moderators` (   -- D-16 постоянный уровень
  `uid` INT NOT NULL AUTO_INCREMENT,
  `room_uid` INT NOT NULL,
  `endpoint_ref` VARCHAR(64) NOT NULL,          -- extension тенанта, не гостя
  PRIMARY KEY (`uid`),
  FOREIGN KEY (`room_uid`) REFERENCES `conference_rooms`(`uid`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `conference_guest_tokens` (      -- D-11/D-12
  `uid` INT NOT NULL AUTO_INCREMENT,
  `room_uid` INT NOT NULL,
  `token` VARCHAR(64) NOT NULL,                 -- opaque, образец vm_access_tokens
  `kind` ENUM('shared_link','named_invite') NOT NULL,
  `invite_name` VARCHAR(255) NULL,               -- заполнено только для named_invite
  `expires_at` DATETIME NULL,
  `revoked_at` DATETIME NULL,
  `last_used_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `uniq_token` (`token`),
  FOREIGN KEY (`room_uid`) REFERENCES `conference_rooms`(`uid`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `conference_meetings` (          -- D-33 история встреч
  `uid` INT NOT NULL AUTO_INCREMENT,
  `room_uid` INT NOT NULL,
  `started_at` DATETIME NOT NULL,
  `ended_at` DATETIME NULL,
  `has_recording` TINYINT(1) NOT NULL DEFAULT 0,
  `recording_file_rel` VARCHAR(512) NULL,       -- относительный путь под records_base_path
  PRIMARY KEY (`uid`),
  FOREIGN KEY (`room_uid`) REFERENCES `conference_rooms`(`uid`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `conference_meeting_participants` (
  `uid` INT NOT NULL AUTO_INCREMENT,
  `meeting_uid` INT NOT NULL,
  `display_name` VARCHAR(255) NOT NULL,
  `role` ENUM('owner','moderator','participant') NOT NULL DEFAULT 'participant',
  `is_guest` TINYINT(1) NOT NULL DEFAULT 0,
  `joined_at` DATETIME NOT NULL,
  `left_at` DATETIME NULL,
  PRIMARY KEY (`uid`),
  FOREIGN KEY (`meeting_uid`) REFERENCES `conference_meetings`(`uid`) ON DELETE CASCADE
) ENGINE=InnoDB;
```

**Модерирование `pin`:** хранится нешифрованным (как и SIP-пароли эндпоинтов в этом проекте) — Asterisk сравнивает его через `CONFBRIDGE(user,pin)` во время звонка, хэшировать не нужно и негде было бы сравнить без расхэширования на каждый вход.

**Sequelize:** модели по образцу `voicemail-message.model.ts` — `@Table`, `@Column`, явный `tableName`, без Sequelize-миграций (проект использует ручной bootstrap-скрипт + `db:migrate` только для отдельных легаси-случаев — см. `packages/backend/package.json` `db:setup:*` семейство).

**When to use:** структура — предложение (Claude's Discretion), планировщик может перегруппировать колонки по вкладкам формы, но родительская/дочерняя иерархия таблиц и единственная тенантная колонка на корне — обязательное следствие конвенции репозитория, не предмет выбора.

---

### Pattern 5: Гостевой токен — 3 уровня строгости, 2 вида ссылок (D-11/D-12)

**Прецедент 1 — `DisplayTokenGuard`:** кладёт в `req.user` объект **без** `sub`/`level`, специально чтобы остальной код не спутал гостевой доступ с обычной сессией:

```(reviewed earlier this session)
// packages/backend/src/modules/callcenter/guards/display-token.guard.ts
// guard validates token → req.user = { vpbxUserUid, tokenScope } — НЕ { sub, level }
```

**Прецедент 2 — `vm_access_tokens`:** opaque token с TTL и явным `revoked_at`, независимая таблица от голосового сообщения, тот же паттерн, что рекомендован для `conference_guest_tokens` выше.

**Guard для conferences — `ConferenceGuestTokenGuard`:**
- Принимает токен из URL/query (`GET /conferences/guest/:token`), проверяет `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`.
- Кладёт в `req.user`: `{ roomUid, guestTokenUid, tokenKind, inviteName? }` — **без** `sub`, `level`, `vpbxUserUid` **как идентичного полю обычного пользователя** (значение нужно для scoping запросов, но не должно давать guard'ам обычных модулей повод считать это полноценной сессией — рекомендуется отдельное поле `guestVpbxUserUid` либо явный `isGuest: true` рядом).
- **Не должен** класть Asterisk-имена (`conf{number}_{uid}`), внутренние channel id — по D-36 это тенантный секрет, не гостевое ограничение, а общее правило.

**Три уровня строгости (D-11) — реализуются как последовательные проверки внутри одного guest-flow, не как три разных guard'а:**
1. `token_name` — валидный токен + вводимое имя participant'а (не проверяется на сервере, просто принимается).
2. `token_name_pin` — плюс PIN комнаты (`conference_rooms.pin`), сверяется на этапе выдачи временных SIP-креденшлов (см. Pattern 6), не на этапе HTTP-guard — PIN у ConfBridge также проверяется самим Asterisk через `CONFBRIDGE(user,pin)`, backend НЕ обязан дублировать проверку, но обязан НЕ выдать креды без верного PIN, чтобы не тратить ephemeral endpoint на заведомо неудачную попытку.
3. `token_name_pin_moderator` — плюс `wait_marked=yes` на комнате (комната ожидания): backend создаёт ephemeral endpoint и допускает Join, но Asterisk сам держит гостя в lobby до входа `marked`-участника (штатное поведение ConfBridge).

**Endpoint-поверхность (REST, гостевая, под `ConferenceGuestTokenGuard`):**
```
GET  /conferences/guest/:token                → метаданные комнаты (name, strictness, требуется ли PIN) — до входа
POST /conferences/guest/:token/join            → { display_name, pin? } → { sipCredentials, roomContext, sseUrl }
POST /conferences/guest/:token/leave           → освобождает ephemeral endpoint (Pattern 6)
GET  /conferences/guest/:token/events (SSE)    → тот же поток, что у своих (D-36)
```

**When to use:** `shared_link` (TTL+revoke) — для «пришлите ссылку кому угодно»; `named_invite` — когда нужно видеть «кто вошёл» и отзывать точечно (D-12 — оба вида одновременно на одну комнату, не взаимоисключающе).

---

### Pattern 6: Гость и приглашённый как SIP-участники (D-10/D-38)

**Под закрытым R-ENGINE (ConfBridge+AMI) гость технически = ephemeral PJSIP endpoint на сессию.** Подтверждено способом провижининга в спайке: `002-confbridge-sfu-video-grid/provision.js` создаёт realtime PJSIP endpoint (`ps_endpoints`/`ps_auths`/`ps_aors`) с уникальными username/password на каждого тестового участника, WebRTC-транспортом, `max_video_streams` и `allow=opus,ulaw,vp8` — той же тройкой таблиц, которую сегодня пишет `EndpointsService.createCompanionTriple`.

**Критическое решение для безопасности:** `context` эфемерного гостевого endpoint'а должен указывать **прямо на контекст самой комнаты** (`krsk-conf-{room_uid}`), а не на общий guest-контекст с диалингом наружу. Это значит:
- Скомпрометированный/просроченный (но ещё не удалённый) SIP-креденшл гостя физически не может дозвониться ни во что, кроме той самой комнаты — Asterisk маршрутизирует входящий INVITE по `context=` эндпоинта, и если в этом контексте есть только `exten => s,1,...` (или дозвон на любой другой exten падает — контекст не содержит `_X.` catch-all), опция «дозвониться куда-то ещё» отсутствует на уровне конфигурации, а не только на уровне бизнес-логики.
- Значит provisioning гостя — это НЕ переиспользование существующего `NAT_PROFILES.webrtc` (тот несёт общий контекст для дозвона по плану нумерации тенанта), а отдельный узкий профиль `NAT_PROFILES.confbridgeGuest` с контекстом = имени контекста конкретной комнаты, задаваемым в момент создания, не статически в самом профиле.

**Жизненный цикл креденшла:**
1. `POST /conferences/guest/:token/join` → генерация `username = 'gst' + randomHex(8)`, `password = generateSipPassword()` (переиспользуется `EndpointsService.generateSipPassword()`), создание `ps_endpoint`/`ps_auth`/`ps_aor` с `context = krsk-conf-{room_uid}`, `max_video_streams = <budget>`, `allow = opus,ulaw,vp8`.
2. Возврат креденшлов браузеру → `sip.js UserAgent` регистрируется через WSS → `INVITE` на `s` (или произвольный target, поскольку `context` уже сужен) → входит в `krsk-conf-{room_uid},s,1` → `ConfBridge(...)`.
3. На `BYE`/`ConfbridgeLeave` (AMI-событие, Pattern 7) → backend удаляет тройку `ps_endpoint`/`ps_auth`/`ps_aor` (по образцу деструктора в `EndpointsService`).
4. Cron-sweeper (Pattern 11) подчищает **и** зависшие каналы, **и** осиротевшие ephemeral endpoint'ы, у которых session TTL истёк, а явного `BYE` не было (та же причина, что спайки требуют для channel-очистки).

**Приглашение своего абонента в комнату (D-38, `Originate`, не ARI):**
```
AmiService.action('Originate', {
  Channel: `PJSIP/${targetExten}`,
  Context: 'krsk-conf-{room_uid}',
  Exten: 's',
  Priority: 1,
  CallerID: '<room name> <displayed number>',
})
```
— тот же примитив, что уже используется другими модулями через `AmiService.originate()` (сигнатура подтверждена в `ami.service.ts`). Прямой аналог `addToConference` из `callcenter.service.ts`, который сейчас делает `Redirect`, а не `Originate` — потому что там абонент уже в звонке; здесь абонент приглашается «с нуля», что ближе к `Originate`.

**Открытый вопрос про `max_video_streams` на ОБЫЧНЫХ (не гостевых) WebRTC-эндпоинтах тенанта** — см. Open Questions.

---

### Pattern 7: Live-события — AMI `Confbridge*` → EventEmitter2 → SSE (D-34/D-35/D-36/D-37)

**Подтверждено:** в `ami.service.ts` сегодня нет ни одного слушателя `Confbridge*` — образец для них — уже существующие queue-слушатели в том же файле (`this.ami.on('managerevent', (evt) => { if (evt.event === 'QueueMemberStatus') ... })`).

**Карта AMI-событий → состояние участника (D-37, только 4 состояния — говорит/muted/роль/видео):**

| AMI event | Поле | Участник-состояние |
|-----------|------|----------------------|
| `ConfbridgeJoin` | `CallerIDNum`, `Channel`, `Admin`, `MarkedUser` | участник появился, роль = `Admin`/`MarkedUser` → owner/moderator/participant (D-14) |
| `ConfbridgeLeave` | `Channel` | участник ушёл — триггер очистки ephemeral endpoint (Pattern 6) |
| `ConfbridgeTalking` | `Channel`, `TalkingStatus` (`on`/`off`) | «говорит сейчас» |
| `ConfbridgeMute` / `ConfbridgeUnmute` | `Channel` | «заглушён» |
| `ConfbridgeStartRecord` / `ConfbridgeStopRecord` | `Conference` | индикатор записи (D-32) |

Видео вкл/выкл (четвёртое требуемое состояние D-37) — **не отдельное AMI-событие ConfBridge**; ближайший источник — `CONFBRIDGE_INFO` function или клиентская телеметрия (участник сам репортит камеру вкл/выкл через существующий REST/SSE-канал, поскольку это состояние UI, не медиа-уровня Asterisk). Отметить как **[ASSUMED — требует проверки на живом Asterisk]**, см. Assumptions Log.

**Мост в EventEmitter2** — по образцу, где очередь эмитит `queue.<event>`:
```typescript
// ami.service.ts, внутри существующего 'managerevent' листенера
if (evt.event?.startsWith('Confbridge')) {
  this.eventEmitter.emit(`conference.${evt.event}`, evt);
}
```

**SSE — тот же паттерн, что `callcenter-sse.controller.ts`/`callcenter-wallboard.controller.ts`:** `@Sse()` эндпоинт, `getTypedEventStream` фильтрует по `room_uid`/`vpbx_user_uid`, guard — `JwtAuthGuard` для своих, `ConferenceGuestTokenGuard` для гостей (D-36 — **тот же самый поток**, не урезанная версия).

```
GET /conferences/:room_uid/events          (свои, JwtAuthGuard)
GET /conferences/guest/:token/events        (гости, ConferenceGuestTokenGuard)
```
Оба контроллера подписываются на один и тот же internal stream ключом `room_uid`, различие — только в guard'е и в том, что гостевой путь не раскрывает `vpbx_user_uid`/Asterisk-имена в payload (маппинг на DTO без этих полей — общее правило D-06/D-36).

---

### Pattern 8: Браузерный клиент — кастомный SessionDescriptionHandler и телеметрия (UI-SPEC, D-19/D-24)

**Проблема (подтверждена спайком 002):** стоковый `sip.js@0.21.2` при получении нового `ontrack` останавливает предыдущий удалённый видеотрек **до** вызова делегата приложения — грид из N плиток без патча превращается в одну живую плитку.

**Рецепт из `spike-findings-krasterisk-v4/SKILL.md` и `002-confbridge-sfu-video-grid/public/app.js`:** переопределить/расширить `SessionDescriptionHandler`, конкретно метод `setRemoteTrack` (или подписаться на `peerConnection.ontrack` до того, как `sip.js` внутренний обработчик успевает остановить предыдущий трек), сохраняя каждый новый `MediaStreamTrack` в собственной Map `channelId → MediaStream`, а не в единственном `<video>` элементе.

**Файл в этой фазе:** `packages/frontend/src/features/conferences/lib/useConferenceRoom.ts` [из 16-UI-SPEC.md, component inventory] — держит: `UserAgent` с кастомным SDH-фабрикой, `Registerer`, Map треков → рендер через `shared/ui/VideoSurface` (единственный новый примитив, тонкая обёртка над `<video autoPlay playsInline>`).

**«Вошёл, но видео нет» (~1 из 12 входов, по спайку 004):** детектируется на клиенте — после `accept()`/`invite()` не появился `ontrack` для одного из ожидаемых участников за N секунд → клиент сам инициирует re-INVITE (`session.invite()` повторно с тем же SDP-намерением) — Asterisk на повторных переговорах обычно дожимает видео. Рекомендация: таймаут 3–5 секунд, максимум 2 повторные попытки, дальше — деградация этой конкретной плитки до аватара без ретраев (не блокирует остальных участников).

**Телеметрия качества (D-19/R-CAPACITY — единственный достоверный признак деградации):**
```javascript
// каждые N секунд на каждый RTCPeerConnection:
const stats = await pc.getStats();
// извлечь: outbound-rtp.qualityLimitationReason, packetsLost, totalFreezesDuration (inbound-rtp)
// → POST /conferences/:room_uid/telemetry { participantRef, qualityLimitationReason, packetLossPct, freezesMs }
```
Backend не обязан хранить эту телеметрию долго — достаточно in-memory агрегации в `ConferenceStateService` для целей мониторинга живой комнаты (не входит в историю встреч).

**Anti-Patterns to Avoid**
- **Полагаться на серверные метрики нагрузки (`core show taskprocessors`, свободная RAM) как индикатор деградации участника** — спайк 004 явно показал, что сервер выглядит спокойным именно в момент деградации клиента; серверные метрики валидны только для операционного мониторинга инфраструктуры, не для решения «показать/не показать баннер деградации тенанту».

---

### Pattern 9: Вычисление ёмкости N (D-18/D-19/D-20)

**Формула из спайка 004:** при N участниках с видео — `N·(N−1)` потоков, ~800 кбит/с на поток. Присоединение (N+1)-го при N уже присутствующих стоит `2N` новых потоков (проверено: «шестой в комнате из пяти стоит десяти новых потоков» → N=5, 2N=10 ✓).

```typescript
// Обратная формула — N* такое, что N*(N-1) <= budgetStreams:
function maxParticipantsForBudget(budgetStreams: number): number {
  return Math.floor((1 + Math.sqrt(1 + 4 * budgetStreams)) / 2);
}
const budgetStreams = Math.floor(reservedLinkKbps / 800);
```

**D-05 переосмысление (см. Summary) — где считается и как достаётся в диалплан:**
- Backend поддерживает **живой tally** участников с видео across ВСЕХ активных комнат ВСЕХ тенантов (через тот же AMI `Confbridge*` listener из Pattern 7 — `ConfbridgeJoin`/`ConfbridgeLeave` инкрементируют/декрементируют глобальный счётчик).
- **Периодический фоновый пересчёт** (`@Interval`/`@Cron` из `@nestjs/schedule`, например каждые 30–60 секунд) вычисляет `budgetStreams` из зарезервированной полосы (конфигурация платформы, не тенанта) минус текущий tally, затем для каждой **активной** комнаты — `effective_max_members = min(room.tariff_max_participants ?? Infinity, maxParticipantsForBudget(remainingBudget))`, и если значение изменилось — переприменяет ТОЛЬКО строку `Set(CONFBRIDGE(bridge,max_members)=...)` через `applyCategories` на контекст этой комнаты (без полного `dialplan reload`, если применять точечно возможно — иначе обычный reload).
- **Почему не CURL на каждый Join:** резолюция ёмкости — не «какая комната», а «сколько человек эта комната согласна принять прямо сейчас», и `max_members` — штатная настройка ConfBridge, которая **уже** даёт отказ с объяснением нативно (D-21, подтверждено спайками: «200 OK, коннект, через 2 сек BYE с объявлением»). Периодический пересчёт даёт «почти живое» число (задержка до интервала опроса) БЕЗ добавления сетевой зависимости в путь каждого звонка — компромисс уже согласован пользователем в D-20 («может меняться между просмотрами»).
- **REST для отображения «Максимальное число участников: N» (D-20, дословная формулировка):**
```
GET /conferences/:room_uid/capacity → { maxParticipants: number }
```
считающий на лету при запросе (не из закэшированного `effective_max_members` в БД, чтобы не показывать устаревшее число дольше интервала фонового пересчёта) — сервис переиспользует ту же функцию `maxParticipantsForBudget`.
- **D-18 (тенант не видит, что именно сработало):** и тарифный потолок, и серверный остаток сворачиваются в `Math.min(...)` до выдачи наружу — единственное поле в ответе — итоговое число.

**When to use:** формула и пересчёт — обязательны для КАЖДОЙ активной комнаты с видео; для комнат без активных участников пересчёт можно не гонять (нет входа — нет актуальности числа).

---

### Pattern 10: Запись — `ConfbridgeStartRecord`/`StopRecord`, Range, CDR (D-30…D-33)

**AMI-действия (подтверждены `canonical_refs` из 16-CONTEXT.md, Asterisk `ConfBridge-AMI-Actions`):**
```
Action: ConfbridgeStartRecord
Conference: conf6007_42
RecordFile: /usr/records/<vpbx_user_uid>/conferences/<room_uid>/<meeting_uid>.wav   (опционально — если не задан, Asterisk сам генерирует имя)

Action: ConfbridgeStopRecord
Conference: conf6007_42
```

**Путь хранения — переиспользует `records_base_path` (D-30, one-way после первого приёма файлов):**
```292:296:packages/backend/src/modules/reports/cdr/cdr.service.ts
const cfg = await this.systemSettings.getServerConfigRaw();
const baseUrl = (cfg.records_base_url || '').replace(/\/$/, '');
const basePath = cfg.records_base_path || '/usr/records';
```
Рекомендуемый относительный путь (`conference_meetings.recording_file_rel`): `<vpbx_user_uid>/conferences/<room_uid>/<meeting_uid>.wav`, аналогично voicemail-конвенции (`<user_uid>/voicemail/<uniqueid>-N.wav`).

**Range-стриминг — переиспользует существующую механику voicemail (`streamByPlayToken`) без переписывания:** `Content-Range`/`Accept-Ranges` заголовки, партиальная выдача файла — та же функция может быть обобщена в shared util или скопирована по образцу в `ConferenceRecordingController`.

**Auto vs button (D-31):** `record_mode = 'auto'` → `ConfbridgeStartRecord` сразу после первого Join в комнате (слушатель на `ConfbridgeJoin`, если tally участников == 1 И `record_mode` включает auto); `record_mode = 'button'` → REST-действие модератора `POST /conferences/:room_uid/recording/start` → тот же AMI-вызов; `'both'` — автостарт + доступная ручная кнопка стоп/старт поверх.

**Уведомление (D-32):** индикатор в вебе — SSE-событие `conference.recording_started` (эмитится backend'ом сразу после успешного AMI-ответа, не через AMI-событие — `ConfbridgeStartRecord`/`StopRecord` не генерируют отдельного `Confbridge*`-события уведомления, это [ASSUMED — уточнить по документации Asterisk, действие могло бы триггерить неявное событие]); голосовое объявление для телефонных участников — `Playback` внутри самого AMI-действия недостаточен, вероятно нужен отдельный `Set(CONFBRIDGE(user,announcement)=...)` или явный `Playback` на bridge — **Open Question**, см. ниже.

**CDR-хук (D-33):** звонок ДО ConfBridge (Answer + Dial-подобный сегмент) уже попадает в стандартный Asterisk CDR как звонок на `conf{ном}_{uid}` — специальной интеграции с `cdr.service.ts` не требуется для самого факта звонка. Нужна только правка **копирайтинга** факта записи в существующем CDR recording UI, чтобы текст шёл из `conferences.*` (namespace i18n), не дублировал терминологию voicemail — само поле «есть запись» на CDR-строке эта фаза не трогает структурно (по формулировке D-33 «чужая поверхность»).

---

### Pattern 11: Чистка зависших каналов (задача, добавленная спайками)

**Проблема:** канал без `BYE` (закрытая вкладка браузера без корректного teardown) держит слот SFU и лишает живых участников видео РАНЬШЕ, чем упирается `max_members`.

**Рецепт из спайка** (`002-confbridge-sfu-video-grid/hangup-stale.js`): периодически опрашивать `ConfbridgeList` (AMI action, список текущих участников каждой активной комнаты), сверять с локальным tally «последний раз видели этот channel живым по AMI-событию» — если участник не прислал ни одного `ConfbridgeTalking`/heartbeat дольше порога **и** соответствующий PJSIP-контакт не отвечает на `qualify` — послать `ConfbridgeKick` (или `Hangup` на сам channel).

**Реализация:** `@Injectable()` сервис с `@Cron('*/1 * * * *')` (каждую минуту, `@nestjs/schedule`, уже зависимость проекта) — `ConferenceStaleChannelSweeperService`:
```typescript
@Cron('*/1 * * * *')
async sweep(): Promise<void> {
  const activeRooms = this.stateService.getActiveRoomUids();
  for (const roomUid of activeRooms) {
    const list = await this.amiService.action('ConfbridgeList', { Conference: roomAsteriskName(roomUid) });
    for (const participant of list) {
      if (this.stateService.isStale(participant.Channel, staleThresholdMs)) {
        await this.amiService.action('ConfbridgeKick', { Conference: ..., Channel: participant.Channel });
      }
    }
  }
}
```
Порог staleness — рекомендация 90–120 секунд без heartbeat (запас над обычным keep-alive WebRTC/RTCP интервалом ~30с).

**When to use:** обязательно для КАЖДОЙ активной комнаты с хотя бы одним WebRTC-участником — аппаратные SIP-телефоны такому риску не подвержены (TCP/UDP-транспорт без вкладки браузера, которую можно закрыть без `BYE`), но проще гонять sweeper унифицированно на все активные комнаты.

---

### Pattern 12: AI-адаптер + SKILL.md (D-41)

**Точный контракт completeness-теста `15-23`** — прочитан из `ai-adapter-completeness.spec.ts` (тест `'live classification matches on-disk modules and getDomains() with no leftovers'`, и `'live covered domains and registered tools resolve to a parseable skill'`):

1. `MODULE_COVERAGE['conferences']` **обязана существовать** в `module-coverage.registry.ts` — иначе `unclassified module directory: conferences`.
2. Запись должна быть `{ kind: 'covered', capability: '...' }` — если нет — тест не проверяет `capability` напрямую, но D-41 явно требует read+configure+operation микс → рекомендация **`capability: 'configure'`** (дифф-карточка настроек — определяющая черта capability=`configure`; живые mute/kick тулы допускаются в адаптере независимо от объявленного `capability`, как показывает сам `callcenter` с `capability: 'operation'`, у которого при этом есть read-тулы).
3. Адаптер-файл `conferences-ai.adapter.ts` должен объявлять `readonly domain = 'conferences';` (регэксп теста: `/readonly domain = '([^']+)'/`) — иначе `covered domain missing adapter: conferences`.
4. `SKILL.md` — либо собственный `src/skills/conferences/SKILL.md`, либо `sharedSkill: '<name>'` в записи `MODULE_COVERAGE`, с валидным frontmatter (`name:`, `description:` внутри `---...---`, регэксп `SKILL_FRONTMATTER`) — иначе `skill frontmatter does not parse` / `covered domain missing skill`.
5. **Каждый** `name: '...'` тул в адаптере должен резолвиться в существующий skill для своего `domain` — иначе `tool <name> domain conferences has no skill`.

**Точная запись для `module-coverage.registry.ts`:**
```typescript
conferences: { kind: 'covered', capability: 'configure' },
```
(без `domain`/`sharedSkill` — директория `conferences` совпадает с `readonly domain = 'conferences'`, собственный skill в `src/skills/conferences/SKILL.md`).

**Форма адаптера — read + `defineMutationTool` (образец `time-groups-ai.adapter.ts`) + live-ops (`destructive: true`, образец `callcenter-ai.adapter.ts`):**
```typescript
// packages/backend/src/modules/conferences/conferences-ai.adapter.ts
@Injectable()
export class ConferencesAiAdapter implements DomainAiAdapter, OnModuleInit {
  readonly domain = 'conferences';

  constructor(
    private readonly rooms: ConferenceRoomsService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit() { this.registry.register(this); }

  getTools(): AiToolDefinition[] {
    return [
      { name: 'list_conference_rooms', description: '...', inputSchema: {}, entityType: 'conference_room', handler: async (_a, vpbx) => this.rooms.list(vpbx) },
      defineMutationTool({
        name: 'update_conference_room',
        entityType: 'conference_room',
        input: updateInput,   // zod, по образцу time-groups
        args: updateArgs,
        propose: async (input, vpbx) => this.rooms.diffProposal(input, vpbx),
        apply: async (args, vpbx) => this.rooms.applyFromAi(args, vpbx),
      }),
      {
        name: 'cf_force_mute_participant',
        description: 'Принудительно заглушить участника конференции. Деструктивная операция — требует confirm.',
        inputSchema: { /* room_uid, channel_ref */ },
        destructive: true,
        entityType: 'conference_participant',
        handler: async (args, vpbx) => this.rooms.forceMute(args, vpbx),
      },
      {
        name: 'cf_force_kick_participant',
        description: 'Исключить участника из конференции. Деструктивная операция — требует confirm.',
        inputSchema: { /* room_uid, channel_ref */ },
        destructive: true,
        entityType: 'conference_participant',
        handler: async (args, vpbx) => this.rooms.forceKick(args, vpbx),
      },
    ];
  }
}
```

**`src/skills/conferences/SKILL.md` frontmatter** (обязательный формат, по образцу `src/skills/routes/SKILL.md`):
```markdown
---
name: conferences
description: Тенантные комнаты конференций, роли, гостевые ссылки, ёмкость по видеопотокам.
domains: ["conferences"]
intents: ["configure_conference", "live_moderation"]
aliases: ["конференция", "видеоконференция", "confbridge"]
related: ["routes", "endpoints", "callcenter"]
risk: medium
---
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Резолюция маски номера в комнату | Собственный runtime-роутер в бэкенде на каждый звонок | Тенантный dialplan mask-index контекст (Pattern 1) | Работает без сети, тот же прецедент, что группы/IVR |
| Опросник «жив ли канал» | Собственный протокол heartbeat на клиенте | AMI `ConfbridgeList` + существующий keep-alive WebRTC/RTCP + Cron sweeper (Pattern 11) | Спайк уже выявил рабочий рецепт, изобретать новый протокол — риск гонок |
| Видео-грид рендеринг | Своя WebRTC-обёртка с нуля | Кастомный `SessionDescriptionHandler` над существующим `sip.js@0.21.2` (Pattern 8) | Патч уже найден и работает на 3 участниках; замена всего SDK — потеря совместимости с остальным софтфон-стеком Phase 10 |
| Opaque-токен гостя | Собственная JWT-схема для гостей | Модель по образцу `vm_access_tokens`/`cc_display_tokens` (Pattern 5) | Ровно тот же прецедент TTL+revoke уже в проекте, тестирован |
| Range-стриминг записи | Своя логика `Content-Range` | Существующая механика voicemail `streamByPlayToken` (Pattern 10) | Уже покрыта тестами, работает с CDR |
| AI tool completeness | Ручной чек-лист «не забыть адаптер» | `ai-adapter-completeness.spec.ts` (уже существующий, автоматический) | Тест уже написан и падает детерминированно на любой упущенной части |

**Key insight:** в этой фазе почти нет «нового» инженерного протокола — весь новый функционал — это применение уже отработанных в других модулях паттернов к новому домену (conferences). Риск не в отсутствии прецедента, а в **пропуске** прецедента (например, если разработчик решит писать `confbridge.conf` тенантно вместо динамического профиля, или добавит CURL в hot-path маршрутизации).

## Common Pitfalls

### Pitfall 1: `video_mode` через `Set(CONFBRIDGE(bridge,video_mode)=sfu)` молча не срабатывает
**What goes wrong:** дефолтный `video_mode=none` остаётся, участники не видят видео друг друга, при этом ни ошибки, ни предупреждения в логах.
**Why it happens:** `video_mode` — это bridge-параметр, применяемый только при создании конференц-моста, а не переопределяемый диалплан-функцией на существующей комнате (подтверждено спайком).
**How to avoid:** видео-режим ВСЕГДА едет через статический профиль `confbridge.conf` + `Set(CONFBRIDGE(bridge,template)=krsk_conf_sfu)` (Pattern 2), никогда через прямой `Set(CONFBRIDGE(bridge,video_mode)=...)`.
**Warning signs:** участники слышат друг друга, но `ontrack` для видео не срабатывает ни у кого — при этом в `confbridge list` мост создан нормально.

### Pitfall 2: `max_video_streams=1` по умолчанию на существующих эндпоинтах
**What goes wrong:** тенантские WebRTC-абоненты, созданные ДО этой фазы (через `EndpointsService.createCompanionTriple` / `NAT_PROFILES.webrtc`), видят максимум одного собеседника с видео, даже если комната настроена на грид.
**Why it happens:** `max_video_streams` не задавался при провижининге раньше, дефолт Asterisk = 1.
**How to avoid:** новый профиль для гостей/конференц-эндпоинтов **обязан** задавать `max_video_streams >= N+1`; для СУЩЕСТВУЮЩИХ тенантских эндпоинтов — см. Open Questions (нужно ли расширять `NAT_PROFILES.webrtc` глобально).
**Warning signs:** в лайв-комнате с 4+ участниками кто-то один видит только одну плитку с видео, у остальных — аватары.

### Pitfall 3: `params.options` во втором аргументе `ConfBridge()` — не строка флагов
**What goes wrong:** текущий код (`dialplan.util.ts:482-486`) дописывает `params.options` как второй аргумент `ConfBridge(room,options)` — но по сигнатуре `ConfBridge(conference,[bridge_profile,[user_profile,[menu]]])` это **имя bridge-профиля**, произвольная строка там ломает применение профиля.
**Why it happens:** легаси-код писался до внедрения профилей, когда `options` трактовался буквально.
**How to avoid:** переписываемый case `confbridge` должен явно передавать `bridge_profile = 'krsk_conf_sfu'` (или тенантно-собранный template-層 профиль) на этой позиции, никогда произвольный `params.options`.

### Pitfall 4: AMI `CreateConfig` не создаёт родительские каталоги
**What goes wrong:** первая попытка применить тенантный `krasterisk/conferences/conf_{vpbx}.conf` в новом окружении молча проваливается (или падает с ошибкой файловой системы) на первом же деплое.
**Why it happens:** известная ловушка проекта (уже задокументирована для groups/routes/ivrs) — каталог `krasterisk/conferences/` должен существовать заранее.
**How to avoid:** тот же операционный шаг, что уже применяется к другим `krasterisk/*` подкаталогам — добавить `conferences` в существующий провижининг-скрипт/runbook, создающий каталоги при установке.
**Warning signs:** первая созданная комната в свежем окружении не появляется в `dialplan show`, AMI-ответ на `CreateConfig` возвращает ошибку.

### Pitfall 5: Гостевой JWT-подобный `req.user` спутывается с обычной сессией
**What goes wrong:** guard, написанный по образцу `JwtAuthGuard`, кладёт в `req.user` поля, которые случайно совпадают по имени с обычным пользовательским JWT payload (`sub`, `level`) — другой код в цепочке middleware начинает трактовать гостя как полноценного тенантного пользователя.
**Why it happens:** копипаст структуры без осознанного исключения полей.
**How to avoid:** явно следовать прецеденту `DisplayTokenGuard` — **никогда** не класть `sub`/`level` в `req.user` для гостевого guard'а; использовать явно другое имя поля для проверки прав (например, `isGuest: true`).
**Warning signs:** гость получает доступ к эндпоинтам, которые проверяют `req.user.level`, потому что оно случайно совпало по значению с валидным ролевым уровнем.

## Code Examples

### Пример 1: Точка ветвления `confbridge` в генераторе (полная замена case)
```typescript
// packages/backend/src/shared/utils/dialplan.util.ts — заменяет строки 482-486
case 'confbridge': {
  const roomRef = params.room; // { source: 'fixed', value: roomUid } | { source: 'route_pattern' }
  if (roomRef.source === 'fixed') {
    dp = emitHopPrologue(`krsk-conf-${roomRef.value},s,1`, { routeId: `conf_${roomRef.value}` });
  } else {
    dp = `Goto(krsk-conf-mask-${vpbxUserUid},\${EXTEN},1)`;
  }
  break;
}
```
*(Сигнатуры `emitHopPrologue`/`ValueSource` — по образцу существующих `case 'toivr'`/`case 'togroup'`; точные имена полей params должны быть согласованы с frontend-схемой `confBridge.tsx`, которая переходит на выбор комнаты по D-08.)*

### Пример 2: Применение статического профиля при старте модуля (Pattern 2)
```typescript
@Injectable()
export class ConfbridgeStaticProfileService implements OnApplicationBootstrap {
  constructor(private readonly ami: AmiService, private readonly dialplanApply: DialplanApplyService) {}

  async onApplicationBootstrap(): Promise<void> {
    const current = await this.ami.action('GetConfig', { Filename: 'confbridge.conf' });
    if (this.hasProfile(current, 'krsk_conf_sfu')) return;
    await this.dialplanApply.applyCategories('confbridge.conf', [
      { name: 'krsk_conf_sfu', lines: ['type=bridge', 'video_mode=sfu'] },
    ], { reload: false });
    await this.ami.command('module reload app_confbridge.so');
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---------------|-------------------|----------------|--------|
| `confbridge` шаг маршрута = свободное поле `room`, без тенанта | Модуль комнат с CRUD, тенантным префиксом, выбором из списка | Эта фаза (D-06/D-08) | Убирает T-12-03-05/T-12-13-03 (два тенанта с одинаковым номером в одной комнате) |
| Ad hoc конференция колл-центра (`addToConference`, комната=`uniqueid`, без БД) | Эфемерная комната в общей схеме модуля | D-03/D-04 | Единая точка правды по всем конференциям; риск: затронута уже отгруженная операторская функция Phase 9 |
| `NAT_PROFILES.webrtc` без видео вообще | Отдельный профиль с `max_video_streams`+VP8 минимум для гостей/конференц-эндпоинтов | Эта фаза | См. Pitfall 2 и Open Questions про масштаб изменения |

**Deprecated/outdated:**
- Прямая эмиссия `ConfBridge(room,options)` без bridge-профиля (`dialplan.util.ts:482-486`) — заменяется полностью по Pattern 1/Пример 1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | `Gosub`/`Goto` на несуществующий контекст в Asterisk не роняет звонок, а просто не выполняет переход (продолжает на следующем приоритете/возвращает управление) | Pattern 1 | Если поведение иное (hangup/ошибка), явный `DIALPLAN_EXISTS()` guard, который и так рекомендован как основной путь для conferences, становится обязательным без исключений — низкий риск, т.к. рекомендация уже не полагается на это допущение |
| A2 | `DIALPLAN_EXISTS()` — валидная встроенная dialplan-функция Asterisk в используемой версии | Pattern 1 | Если функции нет/имя другое — заменить на альтернативную проверку (например, попытка `Goto` с `Priority` fallback через `h`-extension или `TryExec`) — требует проверки на живом Asterisk перед реализацией (Wave 0) |
| A3 | `ConfbridgeStartRecord`/`ConfbridgeStopRecord` не генерируют собственного AMI-события уведомления участников | Pattern 10 | Если событие есть — упрощает D-32 (событие вместо ручной эмиссии backend'ом после AMI-ответа); если нет — план как описан (backend сам эмитит SSE после успешного действия) остаётся верным |
| A4 | Видео вкл/выкл (4-е состояние D-37) не приходит отдельным AMI Confbridge-событием и должно репортиться клиентом через REST/SSE | Pattern 7 | Если `CONFBRIDGE_INFO` или отдельное событие даёт эту информацию нативно — упрощает клиентский код, но не меняет архитектуру канала доставки |
| A5 | Расширение глобального `NAT_PROFILES.webrtc` (video_mode, VP8, max_video_streams) не создаёт нежелательных побочных эффектов на существующий Phase 9/10 софтфон-стек | Pattern 6, Open Questions | Если есть эффект — нужен отдельный профиль только для «включивших видео в конференциях» эндпоинтов, а не глобальное изменение — влияет на объём Wave провижининга |

**Все пять допущений — низкого/среднего риска и разрешимы дешёвой проверкой на тестовом `ipbx.krasterisk.ru` (тот же стенд, что уже использовали спайки 001-004) до начала реализации соответствующей задачи, не блокируя планирование в целом.**

## Open Questions (RESOLVED)

> Все три вопроса разведены по фазам при планировании (2026-09-15). Фаза 16 была разбита на ядро (Phase 16) и три подфазы: 16.1 — видео, ёмкость, гости и приглашения; 16.2 — запись; 16.3 — фронтенд, гостевая поверхность и AI-адаптер. Вопросы 1 и 2 относятся к 16.1 и 16.2 соответственно и решаются при планировании этих подфаз; вопрос 3 закрыт в плане `16-07`.

1. **RESOLVED → Phase 16.1.** **Расширять `NAT_PROFILES.webrtc` глобально или только для conference-специфичных эндпоинтов?**
   - Что мы знаем: спайк провижининга ставил `max_video_streams`+VP8 на ОТДЕЛЬНЫЕ тестовые endpoint'ы, не трогая production-профиль тенантских софтфонов. Existing `NAT_PROFILES.webrtc` в `endpoints.service.ts` используется ВСЕМИ WebRTC companion-эндпоинтами тенанта (Phase 9/10 софтфон), не только конференциями.
   - Что неясно: обычный тенантский subscriber (не гость), присоединяющийся к конференции со своего постоянного WebRTC companion-эндпоинта — получит ли он видео при текущем дефолте профиля, если профиль не трогать?
   - Recommendation: планировщику — явно решить в Wave 0, добавив либо (а) глобальное расширение `NAT_PROFILES.webrtc` с видео+VP8 (простое, но трогает объект вне заявленного scope фазы Phase 9/10), либо (б) отдельный флаг на endpoint / отдельный provisioning-путь только для «участвует в конференциях с видео» companion-эндпоинтов. Решение влияет на объём задач Endpoints-модуля в этой фазе.

2. **RESOLVED → Phase 16.2.** **Голосовое объявление о записи для телефонных участников (D-32) — какой именно Asterisk-примитив?**
   - Что мы знаем: `ConfbridgeStartRecord`/`StopRecord` не задокументированы как автоматически озвучивающие начало записи (в отличие от некоторых других телефонных систем).
   - Что неясно: нужен ли явный `Playback` на bridge (`ConfBridge()` bridge-wide announcement) или штатная опция ConfBridge-профиля `record_conference=yes` уже озвучивает сама (некоторые сборки Asterisk играют встроенный beep/announcement автоматически при `record_conference=yes`).
   - Recommendation: проверить на тестовом стенде — включить `record_conference=yes` на bridge-профиле и услышать, звучит ли объявление автоматически, до написания отдельного `Playback`-кода.

3. **RESOLVED → план `16-07`.** **Точный список полей `ConfbridgeList` AMI-действия для sweeper'а (Pattern 11)** — нужен ли предварительный вызов `ConfbridgeListRooms` для получения списка активных конференций, если backend уже не хранит это в своём `ConferenceStateService`?
   - Recommendation: `ConferenceStateService` уже держит live-tally активных room_uid из Pattern 7/9 — sweeper использует этот internal список, отдельный AMI-запрос `ConfbridgeListRooms` не требуется (in-memory состояние надёжнее лишнего сетевого round-trip на каждый цикл Cron).
   - **Принято при планировании:** `16-07` Task 3 реализует подметальщик именно на живом состоянии `ConferenceStateService`, без `ConfbridgeListRooms`, ровно как рекомендует ресёрч.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Asterisk с `app_confbridge` + PJSIP WebRTC | Весь движок фазы | ✓ [VERIFIED: `.planning/spikes/001-asterisk-recon/README.md` — все проверки прошли на `ipbx.krasterisk.ru`] | подтверждено спайком 001 | — |
| AMI доступ (`asterisk-manager`) | `DialplanApplyService`, `AmiService`, все `Confbridge*`-действия | ✓ [VERIFIED: packages/backend/package.json:59, уже используется во всех модулях] | `^0.2.0` | — |
| `sip.js` в браузерном бандле | Клиент комнаты, гостевой клиент | ✓ [CITED: 16-CONTEXT.md canonical_refs] | `0.21.2` | — |
| `@nestjs/schedule` | Cron sweeper (Pattern 11), периодический пересчёт ёмкости (Pattern 9) | ✓ [VERIFIED: packages/backend/package.json:49] | `^6.1.3` | — |
| `records_base_path`/`records_base_url` настройки | Запись (Pattern 10) | ✓ [VERIFIED: packages/backend/src/modules/system-settings/system-settings.service.ts:79] | — | — |

**Missing dependencies with no fallback:** нет.
**Missing dependencies with fallback:** нет — весь стек уже присутствует и верифицирован спайками/кодом.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | Jest `^29.7.0` [VERIFIED: packages/backend/package.json:106] |
| Backend config | `jest` key внутри `packages/backend/package.json` — `rootDir: src`, `testRegex: .*\.spec\.ts$` |
| Frontend framework | Vitest (`vitest run`) [VERIFIED: packages/frontend/package.json:17] |
| Quick backend run | `npm run test -w @krasterisk/backend -- --testPathPattern="conferences" --no-coverage` |
| Quick frontend run | `npm run test -w @krasterisk/frontend -- src/features/conferences` |
| Full suite | `npm run test:backend && npm run test:frontend` (AGENTS.md verify checklist) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|---------------|
| D-06/D-07 | `normalizeTarget('conference', ...)` продолжает passthrough-guard и производит `conf{number}_{uid}` | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="dialplan-target" --no-coverage` | ❌ Wave 0 — новый describe-блок в `dialplan-target.util.spec.ts` |
| D-02/D-05/Pattern 1 | Генератор `confbridge`-case и mask-index эмитят корректные строки диалплана | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="dialplan.util" --no-coverage` | ❌ Wave 0 — новые кейсы в `dialplan.util.spec.ts` |
| Pattern 2 | Static profile bootstrap идемпотентен (не пишет дубли при повторном старте) | unit (мок AmiService) | `npm run test -w @krasterisk/backend -- --testPathPattern="confbridge-static-profile" --no-coverage` | ❌ Wave 0 — новый сервис + spec |
| Data model (Pattern 4) | Sequelize-модели читают/пишут корректно, FK cascade срабатывает | integration (требует MySQL, но не Asterisk) | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-rooms.service" --no-coverage` | ❌ Wave 0 |
| D-11/D-12/Pattern 5 | Guard проверяет TTL/revoke, не кладёт `sub`/`level` | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-guest-token.guard" --no-coverage` | ❌ Wave 0 |
| D-10/Pattern 6 | Ephemeral endpoint создаётся с корректным `context`, удаляется на leave | integration (мок AMI, реальная БД) | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-guest" --no-coverage` | ❌ Wave 0 |
| D-34/D-37/Pattern 7 | AMI event → EventEmitter2 → правильная карта состояний | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-state" --no-coverage` | ❌ Wave 0 |
| D-19/D-20/Pattern 9 | Формула `maxParticipantsForBudget`, `min(tariff, capacity)` | unit (чистая функция) | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-capacity" --no-coverage` | ❌ Wave 0 |
| Pattern 11 | Sweeper определяет stale-канал по порогу и вызывает `ConfbridgeKick` | unit (мок AMI + fake timers) | `npm run test -w @krasterisk/backend -- --testPathPattern="conference-stale-channel" --no-coverage` | ❌ Wave 0 |
| D-41/Pattern 12 | `MODULE_COVERAGE['conferences']` присутствует, адаптер зарегистрирован, skill парсится | unit (уже существующий генеральный тест) | `npm run test -w @krasterisk/backend -- --testPathPattern="ai-adapter-completeness" --no-coverage` | ✅ уже существует — фаза обязана пройти его, не писать новый |
| Pattern 8 (грид, SDH) | Кастомный SessionDescriptionHandler сохраняет N треков в Map | unit (мок RTCPeerConnection) | `npm run test -w @krasterisk/frontend -- src/features/conferences/lib` | ❌ Wave 0 |
| UI-SPEC компоненты | `VideoSurface`, `ConferencesTable`, форма комнаты | component/unit (Vitest + RTL, по образцу остальных `*Table.test.tsx`) | `npm run test -w @krasterisk/frontend -- src/features/conferences` | ❌ Wave 0 |
| Полный флоу «звонок → комната → грид» | e2e/manual | **manual-only** — требует живой Asterisk с реальными PJSIP-регистрациями и браузером; спайк 002 уже даёт готовый черновой клиент как мануальный тест-стенд | ❌ Wave 0 — чеклист ручной проверки, не автотест |
| «Вошёл, но видео нет» переговоры (~1/12) | manual-only, статистическая | Нельзя детерминированно воспроизвести в CI; ручная проверка на живом стенде через повторные Join | — | manual runbook, не автотест |

### Sampling Rate
- **Per task commit:** узкий `--testPathPattern` на изменённый модуль (см. таблицу выше) — каждая задача даёт свою команду.
- **Per wave merge:** `npm run test:backend` + `npm run test:frontend` полностью, обязательно включая `ai-adapter-completeness.spec.ts` (падает при малейшем расхождении MODULE_COVERAGE/skill/adapter).
- **Phase gate:** полный набор зелёный + `npm run lint` перед `/gsd-verify-work`; мануальный чеклист (полный флоу звонка, грид на 3+ участниках, гостевая ссылка end-to-end) — обязателен один прогон на живом `ipbx.krasterisk.ru` перед объявлением фазы готовой, поскольку ConfBridge/WebRTC-поведение не полностью воспроизводимо юнит-тестами.

### Wave 0 Gaps
- [ ] `dialplan-target.util.spec.ts` — расширить describe-блоком под `normalizeTarget('conference', ...)`
- [ ] `dialplan.util.spec.ts` — новые кейсы `case 'confbridge'` (fixed + route_pattern)
- [ ] `setup-conferences-schema.ts` + первый прогон `db:setup:conferences` на тестовой БД
- [ ] Фикстуры/моки для `AmiService.action('ConfbridgeList'/'ConfbridgeKick'/'Originate', ...)` в тестах — сегодня в репозитории уже есть моки AMI в других `*.spec.ts`, скопировать паттерн
- [ ] Ручной чек-лист мануальной проверки на `ipbx.krasterisk.ru`: (1) статический профиль применился и `video_mode=sfu` активен, (2) грид на 3 web-участниках, (3) гибрид web+SIP-телефон в одной комнате, (4) гостевая ссылка end-to-end с PIN и без, (5) запись стартует/стопается и проигрывается с Range

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|-----------------|---------|---------------------|
| V2 Authentication | да | Гостевой доступ через opaque-токен с TTL+revoke (Pattern 5), не пароль — стандартная альтернативная аутентификация для anonymous-guest сценариев |
| V3 Session Management | да | `req.user` для гостя без `sub`/`level` (образец `DisplayTokenGuard`), ephemeral SIP-сессия с TTL, привязанным к токену (Pattern 6) |
| V4 Access Control | да | `JwtAuthGuard` для тенантских эндпоинтов, `ConferenceGuestTokenGuard` — для гостевых; роли owner/moderator/participant проверяются на уровне REST-действий (mute/kick/invite доступны только moderator+) |
| V5 Input Validation | да | Zod-схемы в `defineMutationTool` (AI-адаптер), class-validator DTO на REST-контроллерах — конвенция проекта |
| V6 Cryptography | да | Guest token — криптографически случайный (`uuid`/`crypto.randomBytes`), НЕ хэшируется (сравнение по значению, как `vm_access_tokens`); PIN комнаты хранится нешифрованным по прецеденту SIP-паролей эндпоинтов (Asterisk сам сравнивает через `CONFBRIDGE(user,pin)`) |
| V7 Error Handling / Logging | да | Вход администратора тенанта в чужую живую встречу (D-17) обязан писаться в аудит — переиспользовать существующий audit-log модуль |

### Known Threat Patterns for этого стека

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Утечка Asterisk-имён/channel id гостю через SSE payload | Information Disclosure | DTO-маппинг перед отправкой в SSE явно исключает `conf{number}_{uid}`, channel id (D-06/D-36) — маппинг общий для своих и гостей, не два разных payload с риском забыть один |
| Guest endpoint используется для дозвона куда-либо кроме своей комнаты | Elevation of Privilege | `context` эфемерного PJSIP endpoint = контекст конкретной комнаты, без catch-all внутри (Pattern 6) — архитектурная мера, не только проверка в коде |
| Просроченный/отозванный guest token всё ещё валиден из-за гонки между HTTP-guard и уже выданными SIP-креденшлами | Tampering / Elevation of Privilege | Явный сброс/удаление ephemeral endpoint СИНХРОННО с revoke токена (не дожидаясь Cron sweeper) — revoke-действие должно триггерить немедленное `ConfbridgeKick`+удаление endpoint, не только помечать `revoked_at` в БД |
| Guest token bruteforce (перебор opaque-токенов по URL) | Tampering | Достаточная длина токена (≥32 байт случайности, как `vm_access_tokens`), rate-limiting на гостевой guard (проверить наличие `@nestjs/throttler`, уже зависимость проекта — `^6.5.0`) |
| Подмена `RecordFile` пути в `ConfbridgeStartRecord` (path traversal через room_uid/meeting_uid, если они интерполируются в путь без санитизации) | Tampering | `room_uid`/`meeting_uid` — числовые PK из БД, не пользовательский ввод напрямую в путь; санитизация как у остальных `sanitizeFilePath` в `dialplan.util.ts` |

## Sources

### Primary (HIGH confidence)
- `.planning/spikes/001-asterisk-recon/README.md`, `002-confbridge-sfu-video-grid/README.md` (+ `public/app.js`, `static-profile-test.js`, `provision.js`, `hangup-stale.js`, `probe-dynamic-vs-template.js`), `003-hybrid-web-and-sip-peer/README.md`, `004-room-capacity/README.md` — экспериментально верифицировано на `ipbx.krasterisk.ru`
- `.cursor/skills/spike-findings-krasterisk-v4/SKILL.md` — дистиллированные рецепты
- `packages/backend/src/modules/ai-platform/module-coverage.registry.ts`, `ai-adapter-completeness.spec.ts` — прочитаны целиком, контракт completeness-теста verified построчно
- `packages/backend/src/modules/directories/setup-directories-schema.ts` — конвенция схемы verified построчно
- `packages/backend/src/modules/call-groups/call-group-dialplan.util.ts`, `packages/backend/src/shared/utils/dialplan.util.ts` — verified построчно (case `toqueue`, `confbridge`, `generateGroupDialplan`)
- `packages/backend/src/modules/reports/cdr/cdr.service.ts`, `packages/backend/src/modules/system-settings/system-settings.service.ts` — `records_base_path` verified построчно
- `packages/backend/package.json`, `packages/frontend/package.json` — версии зависимостей и test-скрипты verified построчно
- `.planning/phases/16-modul-telekonferentsiy-confbridge-webrtc/16-CONTEXT.md` — verified целиком, все D-ID скопированы дословно
- `.planning/phases/16-modul-telekonferentsiy-confbridge-webrtc/16-UI-SPEC.md` — grep-верифицированные фрагменты (component inventory, файловые пути)

### Secondary (MEDIUM confidence)
- Asterisk docs (`docs.asterisk.org`) — `app_confbridge`, ConfBridge AMI Actions, ConfBridge dialplan application — процитированы через `16-CONTEXT.md canonical_refs` (сам ресёрч не выполнял свежий WebFetch, ссылки уже проверены на этапе discuss)
- `packages/backend/src/modules/callcenter/guards/display-token.guard.ts`, `packages/backend/src/modules/voicemail/voicemail-access-token.model.ts`, `voicemail-link.guard.ts`, `voicemail.service.ts` — прочитаны в этой сессии ранее (до summarization), паттерн подтверждён по памяти сессии + перекрёстная проверка через grep в этом заходе

### Tertiary (LOW confidence)
- Поведение `Gosub`/`Goto` на несуществующий контекст (A1), наличие `DIALPLAN_EXISTS()` в используемой версии Asterisk (A2), автоматическое озвучивание записи (Open Question 2) — не проверены на живом Asterisk в этой сессии, помечены в Assumptions Log

## Metadata

**Confidence breakdown:**
- Стандартный стек: HIGH — фаза не вводит новых пакетов, весь состав verified по `package.json`
- Движок/видео/гибрид/ёмкость (R-ENGINE/R-VIDEO/R-CAPACITY): HIGH — закрыты экспериментальными спайками на живом Asterisk
- Dialplan-генерация (Pattern 1/3): HIGH — построена на дословно прочитанном существующем коде трёх аналогичных генераторов
- Data model / токены / AI-адаптер (Pattern 4/5/12): HIGH — построена на дословно прочитанных существующих конвенциях и тесте completeness
- Гостевой SIP-эндпоинт, чистка каналов, запись (Pattern 6/10/11): MEDIUM-HIGH — механизм подтверждён спайками, но конкретные детали (announcement, sweeper threshold) — рекомендации, не verified фактом
- Некоторые Asterisk-примитивы (Pitfall/Assumptions A1-A4): LOW-MEDIUM — требуют дешёвой проверки на тестовом стенде до реализации, не блокируют планирование

**Research date:** 2026-09-15
**Valid until:** оценка 30 дней для стабильной части (конвенции репозитория меняются редко); спайк-находки валидны до следующего major-обновления используемой версии Asterisk на `ipbx.krasterisk.ru`
