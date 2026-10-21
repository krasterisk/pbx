---
phase: 16-modul-telekonferentsiy-confbridge-webrtc
verified: 2026-09-16T02:47:00Z
status: human_needed
score: 14/20 must-haves verified
behavior_unverified: 6
overrides_applied: 0
decision_coverage:
  honored: 23
  total: 41
  not_honored:
    - D-10
    - D-12
    - D-18
    - D-19
    - D-20
    - D-21
    - D-23
    - D-24
    - D-26
    - D-27
    - D-29
    - D-30
    - D-31
    - D-32
    - D-33
    - D-38
    - D-39
    - D-40
behavior_unverified_items:
  - truth: "D-06 precision: uid подставляется в имя как целое десятичное без научной нотации при любом vpbx_user_uid вплоть до INT max"
    test: "Сгенерировать имя комнаты с uid = 2147483647 и проверить строку conf{number}_{uid}"
    expected: "Имя содержит десятичную запись 2147483647, без e+ и без разделителей"
    why_human: "verification: backstop — тесты используют только маленькие uid (42, 77); наличие normalizeTarget не доказывает формат на границе INT"
  - truth: "D-25 ordering: порядок кодеков в allow стабилен (аудио перед видео) между запусками"
    test: "Прочитать строку allow у записанного профиля krsk_conf_sfu"
    expected: "Ровно opus,ulaw,vp8 в этом порядке"
    why_human: "verification: backstop — константа литеральная, но ни один spec не утверждает порядок allow="
  - truth: "D-34 concurrency: параллельные события по разным каналам одной комнаты не теряются — счётчик после N join равен N"
    test: "Одновременно послать N confbridgejoin по разным Channel в одну комнату"
    expected: "В снимке ровно N участников, без потери и без дублей"
    why_human: "verification: backstop — есть последовательные join в conference-state.spec, нет параллельного вызова handleJoin"
  - truth: "D-35: обрыв SSE-подписки освобождает RxJS-подписку и не оставляет висящий interval heartbeat"
    test: "Открыть GET /conferences/:room_uid/events, затем закрыть соединение"
    expected: "interval(15000) остановлен, Subject комнаты не копит подписчиков"
    why_human: "verification: backstop — контроллер merge(events$, heartbeat$) без takeUntil(req.close); cleanup зависит от Nest SSE unsubscribe, тестом не доказан"
  - truth: "D-17 ordering: несколько подряд входов админа в одну живую встречу пишут аудит на каждый вход в том же порядке"
    test: "Два раза подряд вызвать assertLiveRoomAccess чужой комнаты одним sub"
    expected: "Две записи logAction в порядке вызовов"
    why_human: "verification: backstop — spec проверяет один вход; повтор и порядок не упражняются"
  - truth: "D-08 concurrency: две последовательные мутации разных комнат одного тенанта оставляют в mask-index обе записи"
    test: "create комнаты A, затем create комнаты B; прочитать второй аргумент applyCategories"
    expected: "Последний mask-index содержит exten обеих комнат"
    why_human: "verification: backstop — applyRoom читает полный findAll, но сервисные тесты мокают одну комнату за вызов"
coincidental_reliance_items:
  - truth: "Синтетический confbridgejoin даёт участника в снимке"
    reason: undeclared-precondition
    harden: "registerRoom (или гидратация всех комнат тенанта) должна происходить на старте модуля и на SSE assertLiveRoomAccess, а не только в findAll/findOne/create/update"
  - truth: "Подметальщик зависших каналов срабатывает по cron каждую минуту"
    reason: undeclared-precondition
    harden: "Явно импортировать ScheduleModule в ConferencesModule или задокументировать зависимость от CloudAdmin BillingModule.forRoot()"
human_verification:
  - test: "На живом Asterisk выполнить confbridge show profile krsk_conf_sfu после старта бэкенда (холодный и повторный)"
    expected: "Категория есть, video_mode=sfu, allow содержит opus,ulaw,vp8; повторный старт не дублирует категорию"
    why_human: "AMI GetConfig/UpdateConfig и module reload app_confbridge.so нельзя подтвердить без живого asterisk"
  - test: "Позвонить в существующую комнату тенанта (фиксированный шаг и маска _9XX) и открыть SSE комнаты"
    expected: "Звонок попадает в conf{number}_{uid}; первое SSE-сообщение fullSnapshot с участником; leave очищает снимок"
    why_human: "Реальный ConfBridge + AMI + браузерный поток — внешний сервис, юнит-тесты подменяют события"
  - test: "На живой сборке проверить DIALPLAN_EXISTS в mask-index (допущение A2 из 16-RESEARCH.md)"
    expected: "Переход в krsk-conf-{uid},s,1 срабатывает; несуществующий номер играет invalid и Hangup"
    why_human: "Функция диалплана зависит от сборки Asterisk; при отсутствии guard нужно заменить на TryExec"
  - test: "Владелец повышает гостя до модератора во встрече, затем гость нажимает DTMF-меню на аппарате"
    expected: "Портальные mute/kick работают сразу; административное DTMF-меню — только после повторного входа (ограничение движка из 16-05)"
    why_human: "Поведение user-профиля ConfBridge на живом канале"
  - test: "После рестарта бэкенда, не вызывая GET /conferences, войти в уже существующую комнату и открыть SSE"
    expected: "Join всё равно появляется в снимке (сейчас кэш пуст, пока кто-то не сходит в findAll/findOne/create/update)"
    why_human: "Гидратация кэша conferenceByName не делается на bootstrap и не в assertLiveRoomAccess"
  - test: "D-06 precision: сгенерировать имя с vpbx_user_uid=2147483647"
    expected: "conf{number}_2147483647 без научной нотации"
    why_human: "Backstop, тесты используют только маленькие uid"
  - test: "D-25 ordering: прочитать allow у записанного krsk_conf_sfu"
    expected: "opus,ulaw,vp8 в этом порядке"
    why_human: "Backstop, spec не утверждает порядок кодеков"
  - test: "D-34 concurrency: параллельно N join по разным каналам"
    expected: "Снимок содержит ровно N участников"
    why_human: "Backstop, есть только последовательные join"
  - test: "Закрыть вкладку с SSE и проверить, что heartbeat interval остановлен"
    expected: "Нет висящих interval после disconnect"
    why_human: "D-35 backstop — Nest unsubscribe не покрыт тестом"
  - test: "Два подряд входа админа в чужую живую комнату"
    expected: "Две audit-записи conference_live_room_enter в порядке входов"
    why_human: "D-17 ordering backstop"
  - test: "Создать две комнаты подряд у одного тенанта и снять mask-index"
    expected: "Последняя публикация содержит оба номера"
    why_human: "D-08 concurrency backstop"
---

# Phase 16: Модуль телеконференций — ядро — Verification Report

**Phase Goal:** Построить работающий хребет модуля телеконференций: тенантная сущность «комната» с настройками, генерация тенантного диалплан-контекста, резолюция номера комнаты по маске, роли через user-профили ConfBridge и живой поток состояния комнаты в браузер. Всё остальное (видео и ёмкость, запись, фронтенд и AI) наращивается поверх уже работающего хребта в Phase 16.1–16.3.

**Verified:** 2026-09-16T02:47:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

SUMMARY.md не принимался как доказательство. Проверены исходники `packages/backend/src/modules/conferences/**`, `ami.service.ts`, `dialplan.util.ts` / `dialplan-target.util.ts`, каталог шага на фронте и spec-файлы. Оркестратор уже прогнал целевые suite (`conference-|dialplan-target|dialplan.util.spec|legacy-confbridge`) — 17 suites / 410 tests green. Полные `npm run lint` / `test:backend` / `test:frontend` здесь не запускались.

ROADMAP.md не содержит массива `success_criteria`; контракт взят из Goal + Scope (in) и слит с уникальными `must_haves` семи планов. Edge-строки с `verification: backstop` без явного теста не входят в verified score.

LOCKED OVERRIDE из STATE.md: D-10, D-12, D-18–D-21, D-23, D-24, D-26, D-27, D-29–D-33, D-38–D-40 принадлежат Phase 16.1 / 16.2 / 16.3 и **не** скорятся как gaps ядра. Планы 16.1–16.3 ещё не закрыты — resurface не требуется.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | Тенантная комната с настройками публикуется категорией `krsk-conf-{room_uid}` через единственный `DialplanApplyService.applyCategories` | ✓ VERIFIED | `conference-rooms.service.ts` `applyRoom` передаёт `[generateConferenceDialplan(...), buildMaskIndex(...)]`. Spec: create/update — один вызов, две категории. |
| 2 | Категория вызывает `ConfBridge(conf{number}_{uid}, krsk_conf_sfu)`; `template` стоит до tenant `Set(CONFBRIDGE(...))`; пустые Set не эмитятся; `video_mode` не эмитится | ✓ VERIFIED | `conference-dialplan.util.ts` + `conference-spine.spec.ts` (template before override / ConfBridge, no empty sets, no video_mode). |
| 3 | Номер комнаты резолвится тенантным mask-index `krsk-conf-mask-{vpbx}`; fixed-шаг прыгает в `krsk-conf-{uid}`; динамика — в mask-index; CURL нет; несуществующий номер — Playback(invalid)+Hangup | ✓ VERIFIED | `generateConferenceMaskIndex`, `dialplan.util.ts` case `confbridge`, `dialplan.util.spec.ts` 16-03, `conference-dialplan.util.spec.ts` (007, 1/32, no CURL, not-found). |
| 4 | Поле `room` шага — каталог тенанта (`fixed` = uid строкой) + динамические источники; второго поля профиля нет; `options` сняты с контракта | ✓ VERIFIED | `conferenceRoomApi.ts` → `useSchemaRefs` → `CATALOG_DEFAULTS.conferenceRooms`; `confBridge.tsx` одно поле; `IConfBridgeParams` / `ConfBridgeParamsDto` только `room`; `ValueSourceField.test.tsx` empty → `/conferences`. |
| 5 | Ad hoc колл-центра поглощён: `addToConference` берёт эфемерную комнату и Redirect в `krsk-conf-{uid}` exten `s`; эфемерная угасает после последнего leave | ✓ VERIFIED | `callcenter.service.ts` → `ensureRoomForCall`; `conference-ephemeral.service.spec.ts`; `conference-state.service.ts` `scheduleCollectIfEmpty`. |
| 6 | Три роли через одну таблицу `admin`/`marked`; постоянные права — персональные `Set(CONFBRIDGE(user,...))`; разовая выдача только в живом снимке; роль из JWT/`resolveCallerRef`, не из тела | ✓ VERIFIED | `conference-roles.util.ts` + specs; `conference-moderation.spec.ts` (guest grant, no DB row, ignore self-declared role); генератор не биндит bridge к caller. |
| 7 | Админ тенанта видит все комнаты; вход в чужую живую (`created_by !== sub`) пишет `LoggerService.logAction`; `created_by` из JWT `sub`, не из DTO; `NULL` не аудитится | ✓ VERIFIED | Controller `create(..., req.user.sub)`; `assertLiveRoomAccess`; `conference-rooms.service.spec.ts` D-17; `conference-spine.spec.ts` created_by. |
| 8 | Три уровня строгости; PIN 4..32 ASCII; несоответствие → `CONFERENCE_PIN_REQUIRED`; wait/end_marked только у participant | ✓ VERIFIED | `conference-entry-policy.spec.ts` + dialplan/entry specs; `conference-rooms.service.spec.ts` 16-06. |
| 9 | AMI `confbridge*` → `ConferenceStateService` → SSE `fullSnapshot` через единый DTO (6 ключей, без channel/conference/vpbx) | ✓ VERIFIED | `ami.service.ts` 5 слушателей; `conference-sse.controller.ts` `toConferenceRoomStateDto`; `conference-participant-dto.spec.ts`; spine SSE. |
| 10 | Признак видео ставит только сам участник через `POST /:room_uid/me/video` и `resolveCallerRef` | ✓ VERIFIED | `conference-participant.controller.ts`; `conference-state.spec.ts` «changes video only for the caller». |
| 11 | Платформенный `krsk_conf_sfu` пишется при старте, не дублируется, пустой `confbridge.conf` создаёт файл, пустой список кодеков падает, reload строго после записи | ✓ VERIFIED | `confbridge-static-profile.service.ts` + spec (write-then-reload order, no-op, missing file, empty codecs throw). |
| 12 | Подметальщик ходит по живому состоянию; без активных комнат / без AMI — ноль вызовов; перекрытый тик выходит | ✓ VERIFIED | `conference-stale-channel-sweeper.service.spec.ts` (empty, disconnected, 119/120/121s, overlap). |
| 13 | `normalizeTarget('conference')` → `conf{raw}_{uid}`, passthrough `^conf.+_{uid}$` | ✓ VERIFIED | `dialplan-target.util.ts` + spine spec. |
| 14 | Миграции нет: отчёт по унаследованным `confbridge` по умолчанию только печатает; `--apply` снимает мёртвый `options` | ✓ VERIFIED | `legacy-confbridge-steps.spec.ts` + `report-legacy-confbridge-steps.ts`. |
| 15 | D-06 precision: uid как целое десятичное до INT max | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `normalizeTarget` конкатенирует `_${uid}`; теста на 2147483647 нет |
| 16 | D-25 ordering: opus,ulaw,vp8 стабилен | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Литерал `CONFERENCE_PLATFORM_CODECS`; spec не проверяет порядок `allow=` |
| 17 | D-34 concurrency: параллельные N join = N | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Последовательные join покрыты; параллельных нет |
| 18 | D-35: обрыв SSE снимает heartbeat interval | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `merge(interval)` без явного `takeUntil` |
| 19 | D-17 ordering: каждый повторный вход админа пишет аудит | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Spec — один вызов `logAction` |
| 20 | D-08 concurrency: две мутации комнат не теряют записи mask-index | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `buildMaskIndex` читает все комнаты; сервисный spec мокает одну |

**Score:** 14/20 truths verified (6 present, behavior-unverified)

`created_by` не делает создателя владельцем моста — это STATE.md (D-17/D-14), не gap: строка `owner` появляется только после `PUT /conferences/:uid/moderators`.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `setup-conferences-schema.ts` | 5 CREATE TABLE IF NOT EXISTS, tenant только на rooms | ✓ VERIFIED | Нет DROP; children FK CASCADE; колонка `role` у moderators |
| `models/conference-room.model.ts` | Sequelize-модель + `created_by` | ✓ VERIFIED | Wired в module + service |
| `conference-dialplan.util.ts` | Генератор комнаты + mask-index | ✓ VERIFIED | Не stub; вызывается из `applyRoom` |
| `conference-rooms.service.ts` / `.controller.ts` | CRUD + apply/delete + audit + moderators | ✓ VERIFIED | JWT tenant; best-effort apply |
| `conferences.module.ts` | Регистрация контроллеров/провайдеров + string tokens | ✓ VERIFIED | Импорт в `app.module.ts` |
| `confbridge-static-profile.service.ts` | Bootstrap профиля | ✓ VERIFIED | `OnApplicationBootstrap` |
| `conference-state.service.ts` | In-memory снимок + grants + collect | ✓ VERIFIED | AMI + SSE + ephemeral |
| `conference-sse.controller.ts` | SSE + mapper + heartbeat | ✓ VERIFIED | `GET :room_uid/events` |
| `conference-ephemeral.service.ts` | ensure/collect | ✓ VERIFIED | Wired из CC + state leave |
| `legacy-confbridge-steps.util.ts` / `report-legacy-confbridge-steps.ts` | Отчёт D-09 | ✓ VERIFIED | npm script рядом с directories |
| `conference-roles.util.ts` | Единственная таблица ролей | ✓ VERIFIED | Импорт генератора и state |
| `conference-moderation.service.ts` / `.controller.ts` | Живые действия | ✓ VERIFIED | mute/unmute/kick/grant/revoke |
| `dto/conference-moderator.dto.ts` | Постоянные права | ✓ VERIFIED | `PUT :uid/moderators` |
| `conference-entry-policy.util.ts` | Политика входа | ✓ VERIFIED | Генератор + assert на записи |
| `dto/conference-participant.dto.ts` | Единый исходящий маппер | ✓ VERIFIED | SSE и только он |
| `conference-participant.controller.ts` | Self-video | ✓ VERIFIED | JWT + resolveCallerRef |
| `conference-stale-channel-sweeper.service.ts` | Cron kick | ✓ VERIFIED | `@Cron`; см. coincidental-reliance |
| `conferenceRoomApi.ts` | RTK GET /conferences | ✓ VERIFIED | tag `ConferenceRooms` |
| `ValueSourceField.test.tsx` | UI-state каталога | ✓ VERIFIED | empty/error/link |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `ConferenceRoomsService.applyRoom` | `DialplanApplyService.applyCategories` | `[roomCategory, maskIndex]` | WIRED | Единственная публикация настроек и номера |
| `ConferenceRoomsService.remove` | `deleteCategories` + `applyCategories(mask)` | после commit | WIRED | Категория комнаты удаляется, индекс пересобирается |
| `ami.service.ts` | `ConferenceStateService` | `ModuleRef.get('ConferenceStateService')` | WIRED | 5 lowercase `confbridge*` |
| `ConferenceStateService.getEventStream` | `conference-sse.controller.ts` | startWith fullSnapshot + mapper | WIRED | Heartbeat 15s |
| `normalizeTarget('conference')` | генератор + AMI kick/mute | единственное имя | WIRED | |
| `CallCenterService.addToConference` | `ConferenceEphemeralService.ensureRoomForCall` | Redirect context+exten s | WIRED | `userId` → `created_by` |
| `handleLeave` empty | `collectIfEmpty` | string token | WIRED | |
| `useSchemaRefs` | `SchemaFields` → `ValueSourceField` | `optionsSource: conferenceRooms` | WIRED | Прямых `useGetConferenceRoomsQuery` в полях нет |
| `conferenceRoomApi` | `GET /conferences` | RTK | WIRED | |
| `conference-roles.util.ts` | генератор + state + moderation | flags/resolve | WIRED | |
| `resolveCallerRef` | moderation + me/video | JWT → exten | WIRED | |
| `assertCanModerate` | все живые действия | owner/moderator | WIRED | |
| `grantRole` | live snapshot only | no moderatorModel.create | WIRED | spec «does not create a row» |
| `conferenceEntryPolicy` | `generateConferenceDialplan` | user,pin / wait / end | WIRED | |
| `assertEntryPolicyConsistent` | create/update | `CONFERENCE_PIN_REQUIRED` | WIRED | |
| `toConferenceRoomStateDto` | SSE payload | единственный маппер | WIRED | |
| `setVideoState` | event stream | self endpoint | WIRED | |
| `Sweeper` | `getActiveRoomUids` | no AMI if empty | WIRED | |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Rooms CRUD | `conference_rooms` | `roomModel.findAll/create/update/destroy` | Sequelize, tenant `user_uid` | ✓ FLOWING |
| Dialplan apply | category lines | `generateConferenceDialplan` + DB rights | Не статический `[]` | ✓ FLOWING |
| Mask-index | extens | `findAll({ attributes: uid, number })` | Полный список тенанта | ✓ FLOWING |
| Live snapshot | participants | AMI events → Map | Пусто до join — норма | ✓ FLOWING |
| SSE first message | `toConferenceRoomStateDto(snapshot)` | state service | Реальный снимок, не mock в prod | ✓ FLOWING |
| Catalog picker | `conferenceRooms.items` | `GET /conferences` | DB via service | ✓ FLOWING |
| Static profile | `krsk_conf_sfu` | AMI GetConfig + applyCategories | Живой asterisk (human) | ✓ FLOWING (code) / human on box |
| CC conference | contextName | `ensureRoomForCall` → create/find | Не `uniqueid` как имя | ✓ FLOWING |

`assertLiveRoomAccess` **не** вызывает `registerRoom` — после рестарта AMI-join не резолвится, пока не будет findAll/findOne/create/update. Это hollow cache, не hollow API. См. human_verification и coincidental-reliance.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Conference + dialplan + legacy suites | Оркестратор: 17 suites / 410 tests matching `conference-|dialplan-target|dialplan.util.spec|legacy-confbridge` | green | ✓ PASS (executor evidence, not re-run here) |
| Named: spine join→snapshot→SSE | `conference-spine.spec.ts` «opens SSE with fullSnapshot…» | exists, asserts type + 1 participant | ✓ PASS (existence + read) |
| Named: stale tick empty AMI | `conference-stale-channel-sweeper.service.spec.ts` «makes no AMI calls when there are no active rooms» | exists | ✓ PASS (existence + read) |
| Live ConfBridge / real call | — | нужен asterisk | ? SKIP → human |

Полный workspace suite здесь не гонялся (один раз на верификацию не требовался: оркестратор уже дал целевой прогон).

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| `scripts/**/tests/probe-*.sh` | — | нет conventional probes | SKIP |
| `16-VERIFY-PATHS.probe.json` | jest patterns из планов | `status: not_applicable` (это inventory, не runner) | N/A |

### Requirements Coverage

REQUIREMENTS.md **не содержит** D-*/R-* Phase 16 — формулировки живут в `16-CONTEXT.md`. Все ID ядра заявлены frontmatter планов 16-01…16-07. Orphaned относительно REQUIREMENTS.md: весь набор (ожидаемо). Orphaned относительно CONTEXT: нет.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| D-01 | 16-01 | ConfBridge + AMI как ядро | ✓ SATISFIED | proceed-locked STATE; ConfBridge() + AMI listeners |
| D-02 | 16-01 | Настройки через `Set(CONFBRIDGE)` + static template | ✓ SATISFIED | generator + static profile |
| D-03 | 16-02 | Ad hoc CC поглощён | ✓ SATISFIED | `ensureRoomForCall` |
| D-04 | 16-02 | permanent / ephemeral | ✓ SATISFIED | kind + collectIfEmpty |
| D-05 | 16-03 | Ветка на комнату, не CURL | ✓ SATISFIED | mask-index + no /CURL(/i |
| D-06 | 16-01 | `conf{number}_{uid}` | ✓ SATISFIED | normalizeTarget; precision → human |
| D-07 | 16-03 | Маска резолвит номер, номер — строка | ✓ SATISFIED | `exten => 007` |
| D-08 | 16-03+16-04 | Только существующая комната | ✓ SATISFIED | catalog + not-found; concurrency → human |
| D-09 | 16-03 | Миграции нет | ✓ SATISFIED | report script |
| D-11 | 16-06 | Три уровня строгости | ✓ SATISFIED | entry policy |
| D-13 | 16-06 | wait_marked / end_marked | ✓ SATISFIED | только participant branch |
| D-14 | 16-05 | Три роли на admin/marked | ✓ SATISFIED | roles util + dialplan |
| D-15 | 16-05 | Владелец повышает гостя | ✓ SATISFIED | grant without endpoint_ref |
| D-16 | 16-05 | Постоянные + разовые права | ✓ SATISFIED | moderators table vs liveGrants |
| D-17 | 16-02 | Все комнаты тенанта + аудит | ✓ SATISFIED | findAll tenant; audit; ordering → human |
| D-22 | 16-01 | video_mode только в static profile | ✓ SATISFIED | не эмитится в диалплане; сетка/ёмкость — 16.1 |
| D-25 | 16-01 | Кодек платформы один | ✓ SATISFIED | `CONFERENCE_PLATFORM_CODECS`; order → human |
| D-34 | 16-01 | Confbridge* → state | ✓ SATISFIED | listeners + spine; concurrency → human |
| D-35 | 16-01 | SSE + REST actions | ✓ SATISFIED | SSE + moderation; unsubscribe → human |
| D-36 | 16-07 | Один поток/маппер | ✓ SATISFIED | DTO spec |
| D-37 | 16-07 | 4 состояния / 6 ключей | ✓ SATISFIED | Object.keys ровно 6 |
| R-PROFILE | 16-01 | Bootstrap krsk_conf_sfu | ✓ SATISFIED | static profile spec |
| R-STALE | 16-07 | Чистка зависших каналов | ✓ SATISFIED | sweeper spec |
| D-10, D-12, D-18–D-21, D-23, D-24, D-26, D-27, D-29–D-33, D-38–D-40 | — | 16.1 / 16.2 / 16.3 | deferred (override) | STATE.md 2026-09-15 |
| D-41 | — | AI-адаптер + SKILL | deferred 16.3 | `module-coverage.registry.ts` `kind: excluded` с причиной 16.3 |

### Prohibitions

| Statement | Tier | Status | Evidence |
| --------- | ---- | ------ | -------- |
| Вход админа в чужую встречу не бесследный | judgment | verified by test | D-17 spec пишет logAction |
| Mask не создаёт комнату, которой нет | judgment | verified by test | not-found + Playback(invalid) |
| Шаг не даёт вписать несуществующую комнату | judgment | verified by test | catalog select, не free text |
| Разовая роль не оседает в settings | judgment | verified by test | grantRole не пишет moderators |
| Роль не принимается из тела запроса | judgment | verified by test | ignore self-declared role |
| Строгость с модератором не открывает комнату без одобрения | judgment | verified by code+test | wait_marked у participant |
| Нет quality / raised hand в DTO | judgment | verified by test | ровно 6 ключей |
| Видео нельзя поставить за другого | judgment | verified by test | me/video + resolveCallerRef |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `conference-rooms.service.ts` `assertLiveRoomAccess` | 284–312 | Нет `registerRoom` | ⚠️ Warning | После рестарта AMI-join теряется, пока не будет CRUD/list |
| `conference-sse.controller.ts` | 53–60 | heartbeat `interval` без `takeUntil` | ⚠️ Warning | D-35 unproven cleanup |
| `conference-stale-channel-sweeper.service.ts` | 19 | `@Cron` без своего `ScheduleModule` | ℹ️ Info | Живёт на `BillingModule` `ScheduleModule.forRoot()` |
| conferences module | — | TBD/FIXME/XXX | none | Не найдено |
| conferences tests | — | it.skip / test.todo | none | Не найдено |

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| conference-spine.spec.ts | D-01 D-02 D-06 D-22 D-34 D-35 | yes | 0 | no | behavioral | OK |
| confbridge-static-profile.service.spec.ts | R-PROFILE D-25 | yes | 0 | no | value + order | OK |
| conference-rooms.service.spec.ts | D-03 D-04 D-17 D-14 D-11 | yes | 0 | no | behavioral | OK |
| conference-ephemeral.service.spec.ts | D-03 D-04 | yes | 0 | no | behavioral | OK |
| conference-dialplan.util.spec.ts | D-05 D-07 D-08 D-13 D-14 | yes | 0 | no | value | OK |
| dialplan.util.spec.ts | D-05 D-08 | yes | 0 | no | value | OK |
| legacy-confbridge-steps.spec.ts | D-09 | yes | 0 | no | value | OK |
| conference-roles.spec.ts / conference-state.spec.ts / conference-moderation.spec.ts | D-14 D-15 D-16 | yes | 0 | no | behavioral | OK |
| conference-entry-policy.spec.ts | D-11 D-13 | yes | 0 | no | value | OK |
| conference-participant-dto.spec.ts | D-36 D-37 | yes | 0 | no | value | OK |
| conference-stale-channel-sweeper.service.spec.ts | R-STALE | yes | 0 | no | behavioral | OK |
| useSchemaRefs.test.tsx / ValueSourceField.test.tsx | D-08 | yes | 0 | no | UI-state | OK |

**Disabled tests on requirements:** 0
**Circular patterns detected:** 0
**Insufficient assertions:** 0 blockers (backstop gaps already listed)

### Decision Coverage

Gate non-blocking. CONTEXT `<decisions>` D-01…D-41 = 41. Ядро исполняет и честно закрывает **23** (D-01…D-09, D-11, D-13…D-17, D-22, D-25, D-34…D-37 + исполненные следствия R-PROFILE/R-STALE). **18** `not_honored` — точная партиция STATE.md на 16.1/16.2/16.3, не потеря исполнения. D-41 намеренно `excluded` в реестре покрытия до 16.3.

### Human Verification Required

#### 1. Живой статический профиль

**Test:** `confbridge show profile krsk_conf_sfu` после холодного и повторного старта бэкенда.
**Expected:** Профиль с `video_mode=sfu`; повторный старт ничего не переписывает.
**Why human:** AMI/модуль Asterisk.

#### 2. Живой звонок в комнату

**Test:** Позвонить по фиксированному шагу и по маске; смотреть SSE.
**Expected:** Участник в `fullSnapshot`, leave очищает, чужой тенант не попадает в ту же конференцию.
**Why human:** Реальный ConfBridge.

#### 3. DIALPLAN_EXISTS (A2)

**Test:** Несуществующий номер и существующий на живой сборке.
**Expected:** invalid+Hangup vs переход в `krsk-conf-{uid}`.
**Why human:** Зависит от сборки.

#### 4. Разовая роль vs DTMF

**Test:** Повысить гостя, проверить портал и аппарат.
**Expected:** REST сразу; DTMF admin — после rejoin.
**Why human:** Ограничение движка.

#### 5. Кэш после рестарта

**Test:** Рестарт → сразу звонок + SSE без GET /conferences.
**Expected:** Join в снимке. Сейчас, скорее всего, нет — пока не гидратировать кэш.
**Why human:** Нужен живой процесс.

Плюс шесть backstop-пунктов из frontmatter `behavior_unverified_items`.

Human-check из 16-01 (lock D-01/D-02/D-06) **уже закрыт**: пользователь ответил `approved`, STATE.md proceed-locked.

### Gaps Summary

Блокирующих gaps нет: хребет (комната → тенантный диалплан → mask-index → роли user-профиля → AMI → SSE/DTO) существует, содержателен, связан и покрыт целевыми тестами. Фаза не `passed`, потому что (а) живой Asterisk и реальный звонок нельзя закрыть grep/jest, (б) шесть backstop-инвариантов не имеют поведенческого теста. Предупреждение: кэш комнат не гидратируется на старте и на открытии SSE — это не ломает заявленный unit-контракт, но ломает «живой поток» сразу после рестарта, пока не дернут list/CRUD.

---

_Verified: 2026-09-16T02:47:00Z_
_Verifier: Claude (gsd-verifier)_
