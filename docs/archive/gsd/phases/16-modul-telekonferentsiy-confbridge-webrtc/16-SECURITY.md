---
phase: "16"
slug: "modul-telekonferentsiy-confbridge-webrtc"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-09-16"
---

# Phase 16 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> State B (no prior SECURITY.md). Register authored at plan time across 16-01…16-07. ASVS L1.
> Short-circuit: `threats_open: 0` + authored register + `asvs_level: 1` — L1 grep-depth, auditor not spawned.

**Verdict:** SECURED — 38/38 closed, `threats_open: 0`

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| JWT-клиент → CRUD / SSE / moderation / `me/video` | Тенант и `sub` только из токена | номер, имя, PIN, `room_uid`, ref участника |
| `ConferenceRoomsService` → AMI `applyCategories` | Строки БД становятся категориями Asterisk | `krasterisk/conferences/conf_{vpbx}.conf` |
| Входящий звонок → `krsk-conf-mask-{vpbx}` / `krsk-conf-{uid}` | `${EXTEN}` резолвится в контекст комнаты | номер комнаты |
| Asterisk AMI → `ConferenceStateService` | Неаутентифицированные медиа-события | Channel, CallerID, Conference |
| `ConferenceStateService` → SSE | Внутренний снимок → DTO участника | ref, displayName, role, flags |
| JWT-оператор → `addToConference` | Создание эфемерной комнаты и редирект каналов | uniqueid звонка, `userId` |
| Каталог `GET /conferences` → шаг маршрута | `uid` комнаты в `actions` | номер и название в label |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-16-01-01 | Tampering | `conference-dialplan.util.ts` | high | mitigate | `sanitizeDialplanInput` на полях категории; `number` — `@Matches(/^\d{1,32}$/)` | closed |
| T-16-01-02 | Elevation of Privilege | `conference-rooms.service.ts` | high | mitigate | `findAll`/`findOne`/`update`/`remove` по `req.user.vpbx_user_uid`; чужой uid → `NotFoundException` | closed |
| T-16-01-03 | Information Disclosure | `conference-sse.controller.ts` | high | mitigate | Закрыто 16-07: SSE отдаёт `toConferenceRoomStateDto`, не внутренний снимок | closed |
| T-16-01-04 | Tampering | `confbridge-static-profile.service.ts` | medium | mitigate | Bootstrap читает `GetConfig` + CLI; имя категории — литерал `krsk_conf_sfu` | closed |
| T-16-01-05 | Denial of Service | AMI `confbridge*` listeners | medium | accept | In-memory Map O(1); отдельного дросселя нет (спайк 004) | closed |
| T-16-01-06 | Spoofing | `ConferenceStateService.handleJoin` | low | accept | Доверие к AMI — системный контракт, как у очередей | closed |
| T-16-01-SC | Tampering | npm/pip/cargo installs | high | mitigate | Новых пакетов фаза не ставит (`16-RESEARCH.md` Package Legitimacy) | closed |
| T-16-02-01 | Repudiation | `assertLiveRoomAccess` | high | mitigate | `logAction('conference_live_room_enter')` при `created_by !== sub`; UAT 10 — две записи по порядку | closed |
| T-16-02-02 | Elevation of Privilege | `update`/`remove` | high | mitigate | Поиск с фильтром тенанта; чужой uid — 404 и ноль AMI | closed |
| T-16-02-03 | Tampering | `ensureRoomForCall` | medium | mitigate | `uniqueid` → только цифры, slice 32, пустой → `CONFERENCE_NUMBER_INVALID` | closed |
| T-16-02-04 | Denial of Service | ephemeral rooms | medium | mitigate | `collectIfEmpty` на последнем leave + `ConferenceStaleChannelSweeperService` | closed |
| T-16-02-05 | Elevation of Privilege | `addToConference` | medium | mitigate | Существующие guard-ы владения звонком сохранены; `userId` из JWT `sub` | closed |
| T-16-02-06 | Information Disclosure | ephemeral `number` | low | accept | Номер от uniqueid виден только владельцу тенанта | closed |
| T-16-03-01 | Elevation of Privilege | `dialplan.util.ts` confbridge | high | mitigate | Нет голого `ConfBridge(номер)`: hop в `krsk-conf-{uid}` или `krsk-conf-mask-{vpbx}` | closed |
| T-16-03-02 | Tampering | `generateConferenceMaskIndex` | high | mitigate | `sanitizeDialplanInput` + `/^\d{1,32}$/`; прочее не эмитится | closed |
| T-16-03-03 | Denial of Service | hop loop | medium | mitigate | Оба перехода через `emitHopPrologue` (лимит прыжков) | closed |
| T-16-03-04 | Tampering | `report-legacy-confbridge-steps.ts` | medium | mitigate | По умолчанию dry-run; запись только с `--apply`, один ключ | closed |
| T-16-03-05 | Information Disclosure | `conf_{vpbx}.conf` | low | accept | Файл тенанта; доступ только у администратора платформы | closed |
| T-16-04-01 | Elevation of Privilege | `GET /conferences` | high | mitigate | Каталог фильтрует `vpbx_user_uid`; фронт тенант не передаёт | closed |
| T-16-04-02 | Tampering | шаг `room` | high | mitigate | Бэкенд оставляет только цифры и подставляет в контекст своего тенанта | closed |
| T-16-04-03 | Information Disclosure | catalog label | medium | mitigate | Label = `{number} - {name}`; `conf{number}_{uid}` в каталог не попадает | closed |
| T-16-04-04 | Denial of Service | catalog size | low | accept | Один запрос без пагинации, как у очередей | closed |
| T-16-05-01 | Elevation of Privilege | `assertCanModerate` | high | mitigate | Caller ref из `resolveCallerRef(JWT sub)`; роль/номер из тела не читаются | closed |
| T-16-05-02 | Elevation of Privilege | dialplan admin flag | high | mitigate | `Set(CONFBRIDGE(user,admin))` только при `CONF_ROLE != participant` | closed |
| T-16-05-03 | Tampering | `endpointRef` | high | mitigate | DTO `/^\d{1,32}$/` + `sanitizeDialplanInput` | closed |
| T-16-05-04 | Repudiation | kick / grantRole | medium | mitigate | `logAction` до ответа; live-вход по-прежнему через `assertLiveRoomAccess` | closed |
| T-16-05-05 | Elevation of Privilege | AMI channel | medium | mitigate | Канал берётся из живого снимка по ref, не из тела | closed |
| T-16-05-06 | Information Disclosure | moderation response | low | accept | Ответ подтверждает факт; DTO участника — только через 16-07 mapper | closed |
| T-16-06-01 | Elevation of Privilege | entry policy | high | mitigate | `assertEntryPolicyConsistent` → `CONFERENCE_PIN_REQUIRED`; пустой PIN не эмитится | closed |
| T-16-06-02 | Tampering | PIN in dialplan | high | mitigate | DTO `/^\d{4,32}$/` + `sanitizeDialplanInput` | closed |
| T-16-06-03 | Denial of Service | wait_marked | high | mitigate | `wait_marked` только при `CONF_ROLE = participant` | closed |
| T-16-06-04 | Information Disclosure | `conference_rooms.pin` | medium | accept | PIN plaintext по прецеденту SIP-паролей; сравнивает движок | closed |
| T-16-06-05 | Information Disclosure | waitingForModerator | low | accept | Флаг «встреча не началась», без внутренних имён | closed |
| T-16-07-01 | Information Disclosure | `toConferenceParticipantDto` | high | mitigate | Один mapper, 6 ключей; нет `channel` / `conf{number}_{uid}` | closed |
| T-16-07-02 | Spoofing | `POST .../me/video` | high | mitigate | `resolveCallerRef`; поле ref из тела не читается | closed |
| T-16-07-03 | Denial of Service | stale sweeper | high | mitigate | Порог 120s константой; обход живого состояния; флаг тика; нет AMI без соединения | closed |
| T-16-07-04 | Elevation of Privilege | SSE room | medium | mitigate | `assertLiveRoomAccess` до `startWith`; чужая комната — 404 + аудит | closed |
| T-16-07-05 | Information Disclosure | video / speaking | low | accept | Признаки участника той же встречи; поканальное качество вне v1 (D-37) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `block_on: high` count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-16-01-05 | T-16-01-05 | Пик AMI на массовом входе; состояние O(1) Map. Дроссель отложен. | phase-16 plans (16-01) | 2026-09-16 |
| AR-16-01-06 | T-16-01-06 | AMI-события не аутентифицируются приложением — тот же контракт, что у очередей. | phase-16 plans (16-01) | 2026-09-16 |
| AR-16-02-06 | T-16-02-06 | Номер эфемерной комнаты производен от uniqueid и не уходит за тенант. | phase-16 plans (16-02) | 2026-09-16 |
| AR-16-03-05 | T-16-03-05 | `conf_{vpbx}.conf` читает только администратор платформы. | phase-16 plans (16-03) | 2026-09-16 |
| AR-16-04-04 | T-16-04-04 | Каталог без пагинации, как очереди и группы. | phase-16 plans (16-04) | 2026-09-16 |
| AR-16-05-06 | T-16-05-06 | Ответ moderation не несёт внутренних имён; полный DTO — mapper 16-07. | phase-16 plans (16-05) | 2026-09-16 |
| AR-16-06-04 | T-16-06-04 | PIN хранится как SIP-пароль: сравнивает Asterisk, хэш неприменим. | phase-16 plans (16-06) | 2026-09-16 |
| AR-16-06-05 | T-16-06-05 | `waitingForModerator` не раскрывает, кого ждут. | phase-16 plans (16-06) | 2026-09-16 |
| AR-16-07-05 | T-16-07-05 | video/speaking видны всем в комнате по природе конференции (D-37). | phase-16 plans (16-07) | 2026-09-16 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

None. SUMMARY files have no `## Threat Flags` section.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open (blocking) | Open (below high) | Run By |
|------------|---------------|--------|-----------------|-------------------|--------|
| 2026-09-16 | 38 | 38 | 0 | 0 | gsd-secure-phase orchestrator (ASVS L1 short-circuit) |

## Security Audit 2026-09-16

| Metric | Count |
|--------|-------|
| Threats found | 38 |
| Closed | 38 |
| Open (blocking ≥ high) | 0 |
| Open (non-blocking) | 0 |
| Unregistered flags | 0 |
| ASVS level | 1 |
| block_on | high |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-16
