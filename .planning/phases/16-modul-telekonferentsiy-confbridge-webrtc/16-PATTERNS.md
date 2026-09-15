# Phase 16: Модуль телеконференций (ConfBridge + WebRTC) — Pattern Map

**Составлено:** 2026-09-15
**Файлов проанализировано:** 47 (26 backend, 21 frontend) — новые + правки
**Аналоги найдены:** 45 / 47 (2 — «нет аналога», см. раздел ниже)

Все пути аналогов ниже проверены на диске (не взяты со слов RESEARCH.md). Расхождения с RESEARCH.md отмечены явно.

---

## File Classification

### Backend — `packages/backend/src/modules/conferences/` (новый модуль)

| Новый/изменяемый файл | Role | Data Flow | Ближайший аналог | Match Quality |
|---|---|---|---|---|
| `conferences.module.ts` | module | — | `packages/backend/src/modules/call-groups/call-groups.module.ts` | exact |
| `conference-rooms.service.ts` | service | CRUD + apply-to-Asterisk | `packages/backend/src/modules/call-groups/call-groups.service.ts` | exact |
| `conference-rooms.controller.ts` | controller | request-response | `packages/backend/src/modules/call-groups/call-groups.controller.ts` | exact |
| `conference-dialplan.util.ts` | utility | transform (генерация dialplan-строк) | `packages/backend/src/modules/call-groups/call-group-dialplan.util.ts` | exact |
| `setup-conferences-schema.ts` | migration/config | batch (DDL) | `packages/backend/src/modules/directories/setup-directories-schema.ts` | exact |
| `models/conference-room.model.ts` | model | CRUD | `packages/backend/src/modules/call-groups/call-group.model.ts` | exact |
| `models/conference-room-moderator.model.ts` | model | CRUD (child, без тенантной колонки) | `packages/backend/src/modules/call-groups/call-group-member.model.ts` | exact |
| `models/conference-guest-token.model.ts` | model | CRUD (opaque token) | `packages/backend/src/modules/voicemail/voicemail-access-token.model.ts` | exact |
| `models/conference-meeting.model.ts` | model | CRUD (история) | `packages/backend/src/modules/callcenter/models/missed-call.model.ts` | role-match |
| `models/conference-meeting-participant.model.ts` | model | CRUD (child) | `packages/backend/src/modules/call-groups/call-group-member.model.ts` | role-match |
| `guards/conference-guest-token.guard.ts` | middleware/guard | request-response (auth) | `packages/backend/src/modules/voicemail/voicemail-link.guard.ts` | exact |
| `conference-guest.controller.ts` | controller | request-response | `packages/backend/src/modules/voicemail/voicemail-link.controller.ts` | exact |
| `conference-sse.controller.ts` | controller | streaming (SSE) | `packages/backend/src/modules/callcenter/callcenter-wallboard.controller.ts` | exact |
| `conference-state.service.ts` | service | event-driven (in-memory tally из AMI) | `packages/backend/src/modules/callcenter/callcenter-state.service.ts` | role-match |
| `conference-capacity.service.ts` | service | batch (периодический пересчёт) | `packages/backend/src/modules/callcenter/callcenter-rollup.service.ts` (`@Cron`) | role-match |
| `conference-stale-channel-sweeper.service.ts` | service | batch (`@Cron`) | `packages/backend/src/modules/callcenter/callcenter-shift-janitor.service.ts` | exact |
| `confbridge-static-profile.service.ts` | service | file-I/O через AMI (`OnApplicationBootstrap`) | `packages/backend/src/modules/ami/dialplan-apply.service.ts` (`applyCategories`, переиспользуется как есть) | role-match |
| `conference-recording.controller.ts` | controller | file-I/O (Range-стриминг) | `packages/backend/src/modules/reports/cdr/cdr.service.ts` (`getRecordingBaseUrl`/`safeRecordFilePath`) | role-match |
| `conferences-ai.adapter.ts` | AI adapter | request-response (tools) | `packages/backend/src/modules/time-groups/time-groups-ai.adapter.ts` + `packages/backend/src/modules/callcenter/callcenter-ai.adapter.ts` (live-ops) | exact |
| `packages/backend/src/skills/conferences/SKILL.md` | skill doc | — | `packages/backend/src/skills/time-groups/SKILL.md` | exact |
| **Правка** `packages/backend/src/shared/utils/dialplan.util.ts` (case `confbridge`, строки 483-492) | utility | transform | тот же файл, case `toqueue`/`toivr` рядом | exact |
| **Правка** `packages/backend/src/shared/utils/dialplan-target.util.ts` (`normalizeTarget`, добавить kind `'conference'`) | utility | transform | тот же файл, case `'queue'`/`'group'` рядом | exact |
| **Правка** `packages/backend/src/modules/ami/ami.service.ts` (слушатели `Confbridge*`) | event listener | event-driven | тот же файл, `queuememberstatus`/`queuecallerjoin` листенеры (строки 240-249, 326-360) | exact |
| **Правка** `packages/backend/src/modules/ai-platform/module-coverage.registry.ts` | registry entry | — | запись `'call-groups': { kind: 'covered', capability: 'configure' }` | exact |
| **Правка** `packages/backend/src/modules/cloud-admin/hub-modules.seed.ts` | seed entry | — | запись `{ hub_code: 'apps', page_code: 'call_groups', path: '/call-groups', sort_order: 60 }` | exact |
| **Правка** `packages/backend/src/modules/endpoints/endpoints.service.ts` (новый профиль для гостя/companion с видео) | config builder | transform | тот же файл, `NAT_PROFILES.webrtc` (строки 39-50) + `createCompanionTriple` (строки 159-213) | exact |
| **Правка** `packages/backend/src/modules/endpoints/ps-endpoint.model.ts` | model | — | поле `max_video_streams` **уже существует** (строка 336) — использование, не создание колонки | exact |

### Frontend — `packages/frontend/src/features/conferences/` (новая фича) + точки интеграции

| Новый/изменяемый файл | Role | Data Flow | Ближайший аналог | Match Quality |
|---|---|---|---|---|
| `shared/ui/VideoSurface/VideoSurface.tsx` | UI-примитив (wrapper над `<video>`) | media | `shared/ui/AudioPlayer` (wrapper над `<audio>`) | role-match |
| `shared/api/endpoints/conferenceApi.ts` | RTK Query slice | CRUD | `shared/api/endpoints/callGroupApi.ts` | exact |
| `entities/conference/model/types/*` | entity types | — | `packages/frontend/src/entities/moh/model/types/mohSchema.ts` | role-match |
| `entities/conference/` (roleLabel/roleColorFamily map) | entity lib | transform | `packages/frontend/src/features/callcenter/lib/displayLabels.ts` (`agentDisplayName`, статус-мэппинг) | role-match |
| `features/conferences/model/slice/conferencesPageSlice.ts` | Redux slice | — | `packages/frontend/src/features/call-groups/model/slice/callGroupsPageSlice.ts` | exact |
| `features/conferences/ui/ConferencesTable/ConferencesTable.tsx` + `useConferencesTableColumns.tsx` | component (список) | CRUD | `packages/frontend/src/features/call-groups/ui/CallGroupsTable/CallGroupsTable.tsx` + `useCallGroupsTableColumns.tsx` | exact |
| `features/conferences/ui/ConferencesPage` (внутри `pages/ConferencesPage/`) | page orchestrator | — | `packages/frontend/src/features/call-groups/ui/CallGroupsPage/CallGroupsPage.tsx` | exact |
| `features/conferences/ui/ConferenceRoomFormModal/` (табы) | component (форма) | CRUD | `packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFormModal.module.scss` (канон табов, вариант A) | role-match |
| `features/conferences/lib/useConferenceRoom.ts` | hook (WebRTC-сессия) | streaming (media) | `packages/frontend/src/features/callcenter/lib/useWebRTCPhone.ts` | role-match |
| `features/conferences/ui/LiveRoom/RoomControlBar.tsx` | component (панель кнопок) | request-response (действия) | `packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.tsx` (`controlsRow`) | role-match |
| `features/conferences/ui/LiveRoom/InviteSheet.tsx` | component | request-response | `SoftphoneWidget.tsx` `conferenceSheet` (`Sheet` + `TransferDirectory`) | role-match |
| `features/conferences/ui/ConferenceMiniPanel/` | component (chrome-триггер + панель + sticky bar) | UI state | `SoftphoneWidget.tsx` (`chromeTrigger`/`chromePanel`/`stickyBar`) целиком | exact |
| `features/conferences/ui/ConferencePreJoinCard/` | component (форма + устройства) | request-response | `SoftphoneWidget.tsx` `SoftphoneDevicePicker` (выбор устройств) | role-match |
| `widgets/ConferenceGuestShell/` | widget (минимальный шелл) | — | `packages/frontend/src/pages/CallCenterWallboardPage/CallCenterWallboardPage.tsx` (`.root` вне `AppLayout`, локальный тёмный контекст) | role-match (геометрия/роутинг, НЕ разметка) |
| `pages/ConferenceGuestPage/` | page orchestrator | — | `packages/frontend/src/pages/CallCenterWallboardPage/CallCenterWallboardPage.tsx` (маршрут вне `AppLayout`) | role-match |
| **Правка** `features/dialplan-apps/model/schemas/confBridge.tsx` | schema builder | transform | `features/dialplan-apps/model/registry.ts` (`toqueue.schema`, `optionsSource: 'queues'`) | exact |
| **Правка** `features/dialplan-apps/model/schema.types.ts` (`OptionsSource` union) | type | — | тот же файл, существующая строка `'queues'` | exact |
| **Правка** `features/dialplan-apps/model/useSchemaRefs.ts` | resolver | request-response | тот же файл, блок `queues:` (строки 82-91) | exact |
| **Правка** `features/dialplan-apps/ui/SchemaFields/SchemaFields.tsx` (`CATALOG_DEFAULTS`) | config map | — | тот же файл, запись `queues` в `CATALOG_DEFAULTS` | exact |
| **Правка** `features/modules/lib/moduleRegistry.ts` | registry entry | — | запись `{ id: 'call-groups', path: '/call-groups', labelKey: 'nav.callGroups', icon: Phone }` (строка 109) | exact |
| **Правка** `app/router/router.tsx` (`/conferences`, `/conferences/:uid/room`, `/conf/:token`) | route registration | — | запись `{ path: 'call-groups', element: <CallGroupsPage /> }` (внутри `AppLayout`) + `{ path: '/callcenter/wallboard', element: <CallCenterWallboardPage /> }` (вне `AppLayout`) | exact |
| **Правка** `shared/config/locales/ru.ts` / `en.ts` | locale dict | — | блок `callGroups.*` / `queues.*` в тех же файлах | exact |

---

## Pattern Assignments

### Backend

### `conferences.module.ts` (module)

**Аналог:** `packages/backend/src/modules/call-groups/call-groups.module.ts`

Стандартный NestJS `@Module` с импортом `SequelizeModule.forFeature([...])` для моделей, провайдерами сервисов/гардов/AI-адаптера, экспортом сервиса при необходимости межмодульного доступа (`RouteReferencesService` у call-groups использует такой экспорт). Копировать структуру 1:1, подставив модели и сервисы конференций.

---

### `conference-rooms.service.ts` (service, CRUD + apply-to-Asterisk)

**Аналог:** `packages/backend/src/modules/call-groups/call-groups.service.ts`

**Импорты и DI** (строки 1-18):
```typescript
import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op, UniqueConstraintError } from 'sequelize';
import { CallGroup } from './call-group.model';
import { CallGroupMember } from './call-group-member.model';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { generateGroupDialplan } from './call-group-dialplan.util';
import { normalizeTarget } from '../../shared/utils/dialplan-target.util';
```
Для конференций: `ConferenceRoom`, `ConferenceRoomModerator`, `generateConferenceDialplan` (см. ниже), `DialplanApplyService`, `EndpointsService` (для ephemeral-гостя), `RouteReferencesService` (для «удаление комнаты, если на неё ссылается маршрут» — тот же гейт, что у call-groups в `remove()`).

**Стабильные коды ошибок** (строки 20-40) — паттерн `callGroupHttpError` с `code`/`params` для фронтового `t('conferences.errors.<code>')`:
```typescript
export type CallGroupErrorCode =
  | 'CALL_GROUP_EXTEN_REQUIRED'
  | 'CALL_GROUP_EXTEN_USED_BY_GROUP'
  ...

export function callGroupHttpError(
  status: HttpStatus,
  code: CallGroupErrorCode,
  message: string,
  params: Record<string, string | number> = {},
): HttpException { ... }
```
Скопировать 1:1 под `ConferenceRoomErrorCode` (`CONFERENCE_NUMBER_USED_BY_*`, `CONFERENCE_ROOM_NOT_FOUND`).

**Файл диалплана на тенанта** (строка 55-57):
```typescript
private groupFile(vpbx: number): string {
  return `krasterisk/groups/group_${vpbx}.conf`;
}
```
→ `krasterisk/conferences/conf_${vpbx}.conf` (Pattern 1 из RESEARCH.md). Каталог `krasterisk/conferences/` должен существовать заранее — тот же операционный пункт, что у `groups`/`routes`/`ivrs` (Pitfall 4 из RESEARCH.md).

**Apply-метод, вызываемый на каждом CRUD** (строки 174-201):
```typescript
private async applyGroup(
  group: CallGroup,
  members: CallGroupMember[],
  vpbx: number,
): Promise<void> {
  const webrtcExtensions = await this.endpointsService.listWebrtcEnabledExtensions(vpbx);
  const mapped = this.toICallGroup(group);
  const category = generateGroupDialplan(mapped, this.toIMembers(members), vpbx, webrtcExtensions, { ... });
  await this.dialplanApplyService.applyCategories(
    this.groupFile(vpbx),
    [category, ...(category.extras ?? [])],
    { reload: true },
  );
}
```
Для конференций — `applyRoom()` собирает ОДНОВРЕМЕННО категорию самой комнаты (`krsk-conf-{room_uid}`) И пересобранный целиком mask-index тенанта (`krsk-conf-mask-{vpbx}`, все комнаты тенанта), потому что mask-index — общий файл на тенанта, а не на комнату (Pattern 1 RESEARCH.md). Оба массива передаются в один `applyCategories(this.roomFile(vpbx), [roomCategory, maskIndexCategory], { reload: true })`.

**Удаление контекста при `remove()`** (строки 203-213):
```typescript
private async removeGroupContext(group: CallGroup, vpbx: number): Promise<void> {
  const names = [
    normalizeTarget('group', { source: 'fixed', value: group.exten }, vpbx),
    `group_${group.uid}_${vpbx}`,
  ];
  await this.dialplanApplyService.deleteCategories(this.groupFile(vpbx), [...new Set(names)], { reload: true });
}
```
Для конференций — удаляется только категория комнаты (`krsk-conf-{room_uid}`); mask-index тенанта **пересобирается**, а не удаляется построчно (в нём остаются записи других комнат).

**CRUD-методы `findAll`/`findOne`/`create`/`update`/`remove`** (строки 215-460) — транзакция Sequelize, best-effort apply в `try/catch` с логированием (`this.logger.error(...); DB saved — retry/re-save may be needed`) — apply-ошибка **не** откатывает уже сохранённую в БД мутацию. Копировать этот контракт «DB — источник правды, dialplan — best-effort followup» буквально: тот же паттерн действует во всех модулях с генератором диалплана в этом репозитории (тот же try/catch у `queues.service.ts`).

**Отличие от call-groups, требующее нового кода:** `checkExtenConflict`/`suggestFreeExten` у call-groups ищут занятость номера среди групп/очередей/эндпоинтов через прямой SQL (`queue_table`). Для конференций аналог должен проверять занятость `number` среди `conference_rooms` того же тенанта — но **не** среди очередей/групп/эндпоинтов, потому что по D-07 комната **не занимает номер в плане нумерации** (в отличие от групп). Проверка сужается до `UNIQUE KEY (vpbx_user_uid, number)` — конфликт уникальности БД плюс дружелюбное HTTP-сообщение, без похода в `queue_table`.

---

### `conference-rooms.controller.ts` (controller, request-response)

**Аналог:** `packages/backend/src/modules/call-groups/call-groups.controller.ts` (полностью, 62 строки) — `@UseGuards(JwtAuthGuard)` на классе, пять методов CRUD, `req.user.vpbx_user_uid` в каждом. Копировать 1:1, заменив `CallGroupsService` на `ConferenceRoomsService` и DTO.

---

### `conference-dialplan.util.ts` (utility, transform)

**Аналог:** `packages/backend/src/modules/call-groups/call-group-dialplan.util.ts`

**Сигнатура генератора** (строки 293-303):
```typescript
export function generateGroupDialplan(
  group: ICallGroup,
  members: ICallGroupMember[],
  vpbx: number,
  webrtcExtensions?: Set<string>,
  options?: GenerateGroupDialplanOptions,
): GeneratedDialplanCategory {
```
и результат (строки 6-10):
```typescript
export interface GeneratedDialplanCategory {
  name: string;
  lines: string[];
  extras?: GeneratedDialplanCategory[];
}
```
`extras` — второй сгенерированный контекст, применяемый в том же вызове `applyCategories` (у call-groups это `buildConfirmMacro`; у конференций это mask-index-контекст).

**Имя контекста через `normalizeTarget`** (строка 312):
```typescript
const ctxName = normalizeTarget('group', { source: 'fixed', value: group.exten }, vpbx);
```
Для конференций — новая функция `generateConferenceDialplan(room, vpbx)` строит:
1. Основной контекст `krsk-conf-{room.uid}` (стабильный по `uid`, а не по номеру — переименование номера не рвёт AMI-адресацию `ConfbridgeKick`/`ConfbridgeMute`, см. RESEARCH.md Pattern 1);
2. Строки `Set(CONFBRIDGE(bridge,template)=krsk_conf_sfu)` + `Set(CONFBRIDGE(bridge,max_members)=...)` + `Set(CONFBRIDGE(user,wait_marked)=...)` и т.д. из настроек комнаты — **не** через `AsteriskDialplanUtils.pjsipDialTarget`/`Dial()`, это разовый `ConfBridge(...)` вызов, как в текущем `dialplan.util.ts` case `confbridge`;
3. `extras: [maskIndexCategory]` — второй контекст `krsk-conf-mask-{vpbx}`, пересобираемый из **всех** комнат тенанта (нужен полный список комнат тенанта на входе функции, не одна комната — сигнатура шире, чем у `generateGroupDialplan`).

**Санитизация ввода** — везде через `AsteriskDialplanUtils.sanitizeDialplanInput` / `sanitizeFilePath` (`packages/backend/src/shared/utils/dialplan.util.ts`, статические методы), как в `memberInterface()` (строка 46) и `cidPrefixOps()` (строка 125) у call-groups. Обязательно для PIN, названия и любого пользовательского текста, попадающего в строки диалплана (RESEARCH.md Security — path traversal / injection в `RecordFile`, том же принципе для PIN-строки).

---

### `setup-conferences-schema.ts` (migration/config)

**Аналог:** `packages/backend/src/modules/directories/setup-directories-schema.ts` (полностью, 113 строк) — копировать структуру буквально:

```typescript
export const DIRECTORY_SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS \`directories\` ( ... \`user_uid\` INT NOT NULL, ... )`,
  `CREATE TABLE IF NOT EXISTS \`directory_fields\` ( ... \`directory_uid\` INT NOT NULL, ... FOREIGN KEY (\`directory_uid\`) REFERENCES \`directories\` (\`uid\`) ON DELETE CASCADE ... )`,
  ...
];

export async function setupDirectoriesSchema(sequelize: { ... }): Promise<void> {
  const qi = sequelize.getQueryInterface?.();
  const exec = qi?.sequelize?.query ?? sequelize.query;
  for (const statement of DIRECTORY_SCHEMA_STATEMENTS) {
    await exec.call(qi?.sequelize ?? sequelize, statement);
  }
}

async function main(): Promise<void> { /* .env → Sequelize direct connect → setupXSchema → close */ }

const isDirectRun = typeof require !== 'undefined' && ... require.main === module;
if (isDirectRun) { main().catch(...); }
```
`CREATE TABLE IF NOT EXISTS` только, **никогда** `DROP` — конвенция подтверждена в самом файле-аналоге. Единственная тенантная колонка — на корневой таблице (`conference_rooms.vpbx_user_uid`), дочерние — `FOREIGN KEY ... ON DELETE CASCADE` без своей тенантной колонки (`directory_fields`/`directory_records`/`route_directory_bindings` в аналоге — без `user_uid`). Скрипт регистрируется в `packages/backend/package.json` как `db:setup:conferences`, рядом с `db:setup:directories`.

---

### `models/conference-room.model.ts` (model, корневая таблица)

**Аналог:** `packages/backend/src/modules/call-groups/call-group.model.ts` (полностью, 53 строки)

```typescript
@Table({ tableName: 'call_groups', timestamps: false })
export class CallGroup extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(8), allowNull: false })
  declare exten: string;
  ...
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
  ...
}
```
Ключевой ARCHITECTURE-канон: TS-свойство **всегда** `user_uid`, маппинг на реальную колонку БД `vpbx_user_uid` — через `field: 'vpbx_user_uid'`. `ENUM`-колонки (`strategy` у call-groups) — прямой прецедент для `kind` (`'permanent'|'ephemeral'`), `entry_strictness`, `record_mode` у `conference_rooms` (см. RESEARCH.md Pattern 4 — schema уже предложена, этот файл даёт точный `@Column`-синтаксис).

---

### `models/conference-room-moderator.model.ts` / `conference-meeting-participant.model.ts` (child models)

**Аналог:** `packages/backend/src/modules/call-groups/call-group-member.model.ts` — не читан построчно в этой сессии, но структура однотипна корневой модели минус тенантная колонка (см. Pattern 4 RESEARCH.md — `directory_fields`/`directory_records` не имеют `user_uid`, только FK на родителя). Использовать `call-group.model.ts` как источник `@Column`-синтаксиса, убрав `user_uid`, добавив `room_uid`/`meeting_uid` с `allowNull: false`.

---

### `models/conference-guest-token.model.ts` (model, opaque token)

**Аналог:** `packages/backend/src/modules/voicemail/voicemail-access-token.model.ts` (полностью, 32 строки) — **точная** структура нужна:

```typescript
@Table({ tableName: 'vm_access_tokens', timestamps: false, freezeTableName: true })
export class VoicemailAccessToken extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  /** Opaque hex string (NOT JWT) — 64 chars from randomBytes(32). */
  @Column({ type: DataType.STRING(64), allowNull: false })
  declare token: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare message_uid: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare vpbx_user_uid: number;

  @Column({ type: DataType.DATE, allowNull: false })
  declare expires_at: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare revoked_at: Date | null;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;
}
```
Для `conference_guest_tokens`: заменить `message_uid` на `room_uid`, добавить `kind` (`ENUM('shared_link','named_invite')`), `invite_name` (`STRING`, nullable), `last_used_at` (`DATE`, nullable, по образцу `cc_display_tokens.last_used_at`). PIN Asterisk сверяет сам — токен здесь не хэшируется (тот же прецедент, что у `vm_access_tokens.token` — «opaque, NOT JWT», сравнение по значению).

---

### `guards/conference-guest-token.guard.ts` (guard)

**Аналог:** `packages/backend/src/modules/voicemail/voicemail-link.guard.ts` (полностью, 51 строка) — структура guard'а копируется буквально:

```typescript
@Injectable()
export class VoicemailLinkGuard implements CanActivate {
  constructor(
    @InjectModel(VoicemailAccessToken)
    private readonly tokenModel: typeof VoicemailAccessToken,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: any }>();
    const token = req.query?.token;

    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Voicemail token required');
    }

    const row = await this.tokenModel.findOne({ where: { token } });
    if (!row) {
      throw new UnauthorizedException('Voicemail token invalid');
    }
    if (row.revoked_at != null) {
      throw new UnauthorizedException('Voicemail token revoked');
    }
    if (row.expires_at != null && row.expires_at < new Date()) {
      throw new UnauthorizedException('Voicemail token expired');
    }

    req.user = {
      vpbx_user_uid: row.vpbx_user_uid,
      isDisplayToken: true,
    };

    return true;
  }
}
```
**Критично (D-36 / Pitfall 5, оба аналога — `DisplayTokenGuard` и `VoicemailLinkGuard` — соблюдают это правило одинаково):** `req.user` **никогда** не получает `sub`/`level` — иначе гостевой токен рискует «сойти» за полноценную JWT-сессию где-то в цепочке гардов. Для конференций дополнительно нужны `roomUid`, `guestTokenUid`, `tokenKind`, `inviteName?` в `req.user` — по образцу комментария в `DisplayTokenGuard`, но с явным `isGuest: true` вместо переиспользуемого по смыслу поля `isDisplayToken` (RESEARCH.md прямо рекомендует новое имя поля, не копировать `isDisplayToken` как есть).

`DisplayTokenGuard` (`packages/backend/src/modules/callcenter/guards/display-token.guard.ts`, полностью прочитан) добавляет fire-and-forget обновление `last_used_at`:
```typescript
row.update({ last_used_at: new Date() }).catch(() => undefined);
```
Использовать этот же паттерн для `conference_guest_tokens.last_used_at` — не блокировать вход на запись в БД.

---

### `conference-guest.controller.ts` (controller)

**Аналог:** структурно ближе к `voicemail-link.controller.ts` (guard применяется на контроллере/методе, а не глобально) — не читан построчно в этой сессии, но контракт метода `canActivate` уже даёт полную форму `@UseGuards(ConferenceGuestTokenGuard)` на конкретных методах (`GET /conferences/guest/:token`, `POST /conferences/guest/:token/join`, `POST /conferences/guest/:token/leave`), как показано в RESEARCH.md Pattern 5. Смешанный класс с двумя гардами по методам — прямой прецедент: `CallCenterWallboardController` (см. ниже) держит `DisplayTokenGuard` на SSE-методе и `JwtAuthGuard` на административных методах **в одном классе**.

---

### `conference-sse.controller.ts` (controller, SSE)

**Аналог:** `packages/backend/src/modules/callcenter/callcenter-wallboard.controller.ts` (полностью, 116 строк) — эталон именно потому, что в нём **один класс** обслуживает и токен-гостя (SSE), и JWT-администрирование (CRUD токенов), ровно как нужно для conferences (свои через JWT + гости через opaque token в одном контроллере на разных методах):

```typescript
@Controller('callcenter/wallboard')
export class CallCenterWallboardController {
  constructor(
    private readonly stateService: CallCenterStateService,
    private readonly wallboardService: CallCenterWallboardService,
  ) {}

  @UseGuards(DisplayTokenGuard)
  @Sse('events')
  events(@Req() req: Request & { user: any }): Observable<MessageEvent> {
    const userUid = req.user.vpbx_user_uid;
    const snapshot = this.stateService.getSnapshot(userUid);

    const ccEvents$ = this.stateService.getEventStream(userUid).pipe(
      startWith({ type: 'fullSnapshot', userUid, data: snapshot }),
      map(event => ({
        data: JSON.stringify(event.data),
        type: event.type,
        id: String(event.data?._eventId || Date.now()),
      })),
    );

    const heartbeat$ = interval(SSE_HEARTBEAT_MS).pipe(
      map(() => ({ data: '', type: 'heartbeat', id: undefined as any })),
    );

    return merge(ccEvents$, heartbeat$);
  }

  @UseGuards(JwtAuthGuard)
  @Post('tokens')
  generate(@Body() dto: CreateDisplayTokenDto, @Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.wallboardService.generateToken(req.user.vpbx_user_uid, req.user.sub, dto);
  }
  ...
}
```
Для conferences: `GET /conferences/:room_uid/events` (`@UseGuards(JwtAuthGuard)`) и `GET /conferences/guest/:token/events` (`@UseGuards(ConferenceGuestTokenGuard)`) — **оба** подписываются на один и тот же `ConferenceStateService.getEventStream(roomUid)` (D-36 — гость получает ровно тот же поток, что свои), различие только в том, что гостевой DTO-маппинг перед отправкой исключает `vpbx_user_uid`/Asterisk-имена/channel id (RESEARCH.md Security — Information Disclosure).

Второй SSE-контроллер в этом же файле-семействе, `callcenter-sse.controller.ts` (частично прочитан, строки 39-64), даёт альтернативный паттерн — `defer(from(...)).pipe(switchMap(...))` для пред-снапшот side-эффекта (там это `reconcileActiveAgentCalls`). Для conferences не обязателен, но пригоден, если перед снапшотом участников нужно что-то синхронизировать с AMI (`ConfbridgeList`).

---

### `conference-state.service.ts` (service, event-driven tally)

**Аналог:** `packages/backend/src/modules/callcenter/callcenter-state.service.ts` — источник методов `getSnapshot(userUid)` / `getEventStream(userUid)`, используемых обоими SSE-контроллерами выше. Не читан построчно в этой сессии (файл большой), но его публичный контракт полностью виден через два вызывающих места (`callcenter-sse.controller.ts`, `callcenter-wallboard.controller.ts`) — копировать форму `Subject`/`Observable` на `userUid`-ключ, RxJS `filter` по тенанту.

**Приёмник AMI-событий** — образец листенеров в `ami.service.ts` (строки 240-249, 326-360):
```typescript
this.ami.on('queuememberstatus', (evt: any) => {
  this.getCcAmiService()?.handleAgentStatusEvent(evt);
});
```
Для `Confbridge*`: `this.ami.on('confbridgejoin', (evt) => this.getConferenceStateService()?.handleJoin(evt))` и т.д. — та же lazy `ModuleRef`-резолюция (`getCcAmiService()`/`getCcPresenceService()` — паттерн уже используется трижды в `ami.service.ts` для трёх разных модулей, повторить для conferences четвёртым).

---

### `conference-capacity.service.ts` (service, периодический пересчёт)

**Аналог для `@Cron`:** `packages/backend/src/modules/callcenter/callcenter-rollup.service.ts`:
```typescript
/** Nightly at 00:05 — recompute yesterday for all tenants (D-08, safety margin). */
@Cron('5 0 * * *')
async nightlyRollup(): Promise<void> {
  if (this.running) {
    this.logger.warn('[rollup] nightlyRollup skipped — already running');
    return;
  }
  ...
}
```
Для conferences — интервал секунд/минут, не суточный: `@Cron('*/30 * * * * *')` (каждые 30 сек, RESEARCH.md Pattern 9) с тем же `if (this.running) return;` guard против накладывающихся прогонов. Формула:
```typescript
function maxParticipantsForBudget(budgetStreams: number): number {
  return Math.floor((1 + Math.sqrt(1 + 4 * budgetStreams)) / 2);
}
```
— чистая функция, тестируется без моков AMI (см. Wave 0 Gaps в RESEARCH.md).

---

### `conference-stale-channel-sweeper.service.ts` (service, `@Cron` sweeper)

**Аналог:** `packages/backend/src/modules/callcenter/callcenter-shift-janitor.service.ts`:
```typescript
@Cron('*/5 * * * *')
async tick(): Promise<void> {
  if (this.running) return;
  this.running = true;
  try {
    await this.runOnce();
  } finally {
    this.running = false;
  }
}
```
Пятиминутный интервал у аналога слишком редкий для зависших WebRTC-каналов (RESEARCH.md рекомендует порог staleness 90-120 сек, значит цикл должен быть чаще — `@Cron('*/1 * * * *')`, как в `callcenter-ami.service.ts:2303` — `periodicMembershipSync` на минутный интервал с тем же `if (this.running) return` + `try/finally`). Копировать guard-паттерн, менять только частоту и тело.

---

### `confbridge-static-profile.service.ts` (service, bootstrap)

**Аналог:** переиспользование `DialplanApplyService.applyCategories` как есть (`packages/backend/src/modules/ami/dialplan-apply.service.ts`, полностью прочитан, 210 строк) — метод уже принимает `opts.reload` для отключения `dialplan reload`:
```typescript
async applyCategories(
  filename: string,
  categories: DialplanCategory[],
  opts: ApplyCategoriesOptions = {},
): Promise<ApplyCategoriesResult> {
  await this.ensureConfigFile(filename);
  ...
  if (opts.reload !== false) {
    await this.amiService.command('dialplan reload');
  }
  return { success: true, linesApplied: totalLines };
}
```
Для `confbridge.conf` нужна **другая** команда перезагрузки (`module reload app_confbridge.so`, не `dialplan reload`) — вызывать `applyCategories(filename, categories, { reload: false })`, затем отдельно `this.amiService.command('module reload app_confbridge.so')` в новом сервисе, реализующем `OnApplicationBootstrap`. Идемпотентность — проверка через `GetConfig` перед записью (см. RESEARCH.md «Пример 2»).

---

### `conference-recording.controller.ts` (controller, Range-стриминг)

**Аналог:** `packages/backend/src/modules/reports/cdr/cdr.service.ts` (строки 291-309):
```typescript
private async getRecordingBaseUrl(): Promise<{ url: string; path: string }> {
  const cfg = await this.systemSettings.getServerConfigRaw();
  const baseUrl = (cfg.records_base_url || '').replace(/\/$/, '');
  const basePath = cfg.records_base_path || '/usr/records';
  return { url: baseUrl, path: basePath };
}

recordingStreamPath(uniqueid: string): string {
  return `/reports/cdr/recording/${encodeURIComponent(uniqueid)}/play`;
}

private safeRecordFilePath(basePath: string, record: string): string | null {
  const rel = record.replace(/^\/+/, '').replace(/\\/g, '/');
  if (!rel || rel.includes('..')) return null;
  const baseResolved = path.resolve(basePath);
  const fileResolved = path.resolve(baseResolved, `${rel}.mp3`);
  if (!fileResolved.startsWith(baseResolved)) return null;
  return fs.existsSync(fileResolved) ? fileResolved : null;
}
```
Ключевой элемент безопасности для копирования — `safeRecordFilePath`: разрешение относительного пути **внутри** `basePath` с явной проверкой `..` и итоговым `startsWith(baseResolved)` (защита от path traversal, RESEARCH.md Security — «Подмена `RecordFile` пути»). Для конференций формат имени — `<vpbx_user_uid>/conferences/<room_uid>/<meeting_uid>.wav`, тот же принцип `safeRecordFilePath`, расширение `.wav`, не `.mp3`.

Range-заголовки (`Content-Range`/`Accept-Ranges`) в `cdr.service.ts` за пределами прочитанного диапазона строк — переиспользовать точную реализацию из voicemail-плейбека (`packages/backend/src/modules/voicemail/voicemail.controller.ts`, стриминг по play-токену) как второй источник — оба места решают одну и ту же задачу, взять любую как основу и не писать Range-логику с нуля (Don't Hand-Roll, RESEARCH.md).

---

### `conferences-ai.adapter.ts` (AI adapter)

**Аналог для read + `defineMutationTool`:** `packages/backend/src/modules/time-groups/time-groups-ai.adapter.ts` (полностью прочитан, 520 строк) — полный контракт:

```typescript
@Injectable()
export class TimeGroupsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(TimeGroupsAiAdapter.name);
  readonly domain = 'time-groups';

  constructor(
    private readonly timeGroupsService: TimeGroupsService,
    private readonly registry: AiAdapterRegistryService,
    @Optional() private readonly tenantSettings?: TenantSettingsService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('TimeGroupsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolListTimeGroups(), this.toolEvaluateTimeGroup(), this.toolCreateTimeGroup(), this.toolUpdateTimeGroup()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string { return `## ...`; }
  ...
}
```
`defineMutationTool` (пример `toolCreateTimeGroup`, строки 166-211): `propose` строит `AgentDiffProposal` (before/after/summary), `revalidate` перепроверяет инварианты непосредственно перед `apply`, `apply` вызывает сервис и пишет в Asterisk. **Обязательный readonly `domain`-регэксп** (`/readonly domain = '([^']+)'/` в completeness-тесте) — писать `readonly domain = 'conferences';` буквально этим синтаксисом.

**Аналог для деструктивных live-ops тулов:** `packages/backend/src/modules/callcenter/callcenter-ai.adapter.ts` (строки 171-205):
```typescript
private toolForcePauseAgent(): AiToolDefinition {
  return {
    name: 'cc_force_pause_agent',
    description: 'Принудительно поставить агента на паузу (supervisor force-pause). Деструктивная операция — требует confirm.',
    inputSchema: { agent_interface: { type: 'string', description: '...' }, reason: { type: 'string', description: 'Причина паузы' } },
    entityType: 'callcenter_agent',
    destructive: true,
    handler: async (args, vpbxUserUid) => {
      const iface = String(args.agent_interface || '');
      const reason = args.reason != null ? String(args.reason) : undefined;
      return this.ccService.supervisorForcePause(iface, reason, vpbxUserUid);
    },
  };
}
```
Для `cf_force_mute_participant`/`cf_force_kick_participant` — тот же синтаксис (обычный объект `AiToolDefinition`, не `defineMutationTool` — live-ops **не** проходят через diff-карточку, применяются немедленно с `destructive: true`, требующим confirm на уровне UI-агента, не через `propose/apply`).

**Регистрация в реестре и completeness-тест** — `packages/backend/src/modules/ai-platform/module-coverage.registry.ts` (полностью прочитан, 279 строк). Точная запись:
```typescript
'call-groups': { kind: 'covered', capability: 'configure' },
```
→ добавить `conferences: { kind: 'covered', capability: 'configure' },` в алфавитном месте между `config` и `contexts`. `capability: 'configure'` — правильный выбор (не `operation`), потому что D-41 требует дифф-карточку настроек как основную поверхность; `callcenter` тоже `capability: 'operation'`, но имеет read-тулы — прецедент, что `capability` не блокирует смешанный набор тулов (сам файл это подтверждает в комментарии к типу `capability`).

**Проверка completeness-теста** (`collectCoverageFailures`, строки 146-187) — три обязательных условия: директория `conferences` классифицирована, `covered`-запись имеет зарегистрированный адаптер (`registeredDomains.has('conferences')`), и `readonly domain = 'conferences'` совпадает с ключом в реестре (`adapterDomainOf`). Skill-контракт (`collectSkillFailures`, строки 244-276) — файл `src/skills/conferences/SKILL.md` должен существовать и парситься regex'ом `SKILL_FRONTMATTER` (`/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/`) с полями `name:`/`description:` внутри.

---

### `packages/backend/src/skills/conferences/SKILL.md` (skill doc)

**Аналог:** `packages/backend/src/skills/time-groups/SKILL.md` (полностью прочитан, 44 строки) — точный формат фронтматтера:
```markdown
---
name: time-groups
description: Календари маршрутов, интервалы и праздники, оценка в поясе тенанта, почему звонок ушёл на voicemail.
domains: ["time-groups"]
intents: ["configure_time_group"]
aliases: ["расписание", "календарь", "календар", "time group"]
related: ["routes"]
risk: medium
---

# Расписания
...
## Рецепт
1. **Что прочитать.** ...
2. **Создать, если нет.** ...
...
```
Для conferences — `name: conferences`, `domains: ["conferences"]`, `intents: ["configure_conference", "live_moderation"]`, `aliases: ["конференция", "видеоконференция", "confbridge"]`, `related: ["routes", "endpoints", "callcenter"]` (точный набор уже предложен в RESEARCH.md Pattern 12 — использовать как есть). Раздел «Рецепт» — нумерованные шаги «что прочитать → создать если нет → повесить на маршрут/начать встречу → править», по образцу time-groups.

---

### Правка: `dialplan.util.ts`, case `confbridge` (строки 483-492)

**Текущий код (полностью прочитан, не 482-486 как в RESEARCH.md, а 483-492):**
```typescript
case 'confbridge': {
  // Room stays without a tenant suffix (accepted risk T-12-03-05 / T-12-13-03).
  const roomSrc = resolveValueSource(params, 'room');
  const destLookup = compileDirectorySrc(roomSrc, lookupToken(action.id ?? action.uid, 'CB'), vpbxUserUid);
  const room = sourceExprFromValueSource(roomSrc, destLookup.valueVar) || '${EXTEN}';
  const roomOpts = this.sanitizeDialplanInput(params.options);
  const app = roomOpts ? `ConfBridge(${room},${roomOpts})` : `ConfBridge(${room})`;
  dp = [...destLookup.lines, gateSkip(destLookup.skip, destLookup.canExecuteExpr, app)].join('\nsame => n,');
  break;
}
```
Это **сложнее**, чем упрощённый пример из RESEARCH.md («Пример 1») — уже использует `resolveValueSource`/`compileDirectorySrc`/`sourceExprFromValueSource`/`gateSkip` (тот же инфраструктурный слой, что `toqueue`/`togroup`/`toivr` рядом в этом файле). Новый code для `confbridge` **обязан** оставаться в этой же инфраструктуре, а не писать собственный `Goto`-эмиттер с нуля:
- при `roomSrc.source === 'fixed'` (выбор конкретной комнаты, D-08) — эмитить `Goto(krsk-conf-{room_uid},s,1)` вместо текущего прямого `ConfBridge(...)`;
- при `roomSrc.source === 'route_pattern'` (маска, D-07) — эмитить `Goto(krsk-conf-mask-${vpbxUserUid},${EXTEN},1)`.
`params.options` (текущий второй аргумент `ConfBridge`) — **удаляется полностью**, это была ловушка №3 из ROADMAP (bridge-профиль, не строка флагов) — профили теперь живут в модуле, схема `confBridge.tsx` больше не передаёт `options`.

---

### Правка: `dialplan-target.util.ts`, `normalizeTarget` (добавить kind `'conference'`)

**Текущая структура** (полностью прочитана, 140 строк):
```typescript
export type TargetKind = 'queue' | 'exten' | 'group' | 'context';

export function normalizeTarget(
  kind: TargetKind,
  src: ValueSource,
  uid: number,
  opts?: { webrtc?: boolean; directoryValueVar?: string },
): string {
  const raw = /* resolve src → string, включая route_pattern → '${EXTEN}' */;
  switch (kind) {
    case 'queue': {
      if (new RegExp(`^q.+_${uid}$`).test(raw)) return raw;
      return `q${raw}_${uid}`;
    }
    case 'group':
      return `group_${raw}_${uid}`;
    case 'exten':
      return AsteriskDialplanUtils.pjsipDialTarget(raw, uid, { webrtc: opts?.webrtc !== false });
    case 'context': {
      const suffix = String(uid);
      return raw.endsWith(suffix) ? raw : `${raw}${suffix}`;
    }
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}
```
Добавить `'conference'` в `TargetKind` и ветку:
```typescript
case 'conference': {
  if (new RegExp(`^conf.+_${uid}$`).test(raw)) return raw;
  return `conf${raw}_${uid}`;
}
```
— буквальный повтор паттерна `'queue'` (passthrough-guard для уже отенантенных значений + иначе добавить префикс/суффикс). Использовать **только** для построения Asterisk-имени самой комнаты (`ConfBridge(conf6007_42,...)`, `ConfbridgeKick`/`ConfbridgeMute` адресация) — **не** для резолюции маски (это отдельный mask-index-механизм, Pattern 1 / Pattern 3 RESEARCH.md). `default: { const _never: never = kind; ... }` — TypeScript exhaustiveness-guard, при добавлении `'conference'` компилятор сам подскажет любое пропущенное место switch'а в файле — не убирать эту ветку.

---

### Правка: `ami.service.ts` (добавить слушатели `Confbridge*`)

**Существующий образец — очередные листенеры** (строки 240-249):
```typescript
this.ami.on('queuememberstatus', (evt: any) => {
  this.gateway.emitAgentStatus({
    queue: evt.queue,
    member: evt.membername || evt.interface,
    status: evt.status,
    paused: evt.paused,
    callsTaken: evt.callstaken,
  });
});
```
и второй слой, форвардинг в модульный сервис через lazy `ModuleRef` (строки 326-360):
```typescript
// ─── Call Center module event forwarding ───────────────
// Forward AMI events to CallCenterAmiService for real-time state tracking.
// Uses lazy ModuleRef resolution (same pattern as webhooks) to avoid circular deps.

this.ami.on('queuememberstatus', (evt: any) => {
  this.getCcAmiService()?.handleAgentStatusEvent(evt);
});
this.ami.on('queuememberadded', (evt: any) => {
  this.getCcAmiService()?.handleMemberAdded(evt);
});
...
```
Добавить симметричный блок:
```typescript
// ─── Conference module event forwarding (Phase 16) ───────────────
this.ami.on('confbridgejoin', (evt: any) => {
  this.getConferenceStateService()?.handleJoin(evt);
});
this.ami.on('confbridgeleave', (evt: any) => {
  this.getConferenceStateService()?.handleLeave(evt);
});
this.ami.on('confbridgetalking', (evt: any) => {
  this.getConferenceStateService()?.handleTalking(evt);
});
this.ami.on('confbridgemute', (evt: any) => {
  this.getConferenceStateService()?.handleMute(evt);
});
this.ami.on('confbridgeunmute', (evt: any) => {
  this.getConferenceStateService()?.handleUnmute(evt);
});
```
Метод `getConferenceStateService()` пишется по образцу существующих `getCcAmiService()`/`getCcPresenceService()` (lazy `ModuleRef.get(...)`, ленивая резолюция во избежание циклической зависимости `AmiModule ↔ ConferencesModule`) — сигнатура этих геттеров не прочитана построчно в этой сессии, но их вызов виден трижды (для callcenter agent-состояния, presence, и в webhook-слое) — искать по имени `getCcAmiService` в `ami.service.ts` при реализации, это тонкий приватный метод в 10-15 строк.

**Важно (нейминг событий):** `asterisk-manager` в этом проекте передаёт имена событий **в нижнем регистре** (`queuememberstatus`, не `QueueMemberStatus`) — все существующие `.on(...)` в файле подтверждают это (`peerstatus`, `newchannel`, `hangup`, `dialbegin`). AMI event `ConfbridgeJoin` → слушать как `'confbridgejoin'`.

---

### Правка: `endpoints.service.ts` (новый профиль для гостя/companion с видео)

**Текущая структура `NAT_PROFILES`** (строки 24-51, полностью прочитано):
```typescript
const NAT_PROFILES: Record<string, Partial<PsEndpoint>> = {
  lan: { direct_media: 'yes', force_rport: 'no', rewrite_contact: 'no', rtp_symmetric: 'no', ice_support: 'no' },
  nat: { direct_media: 'no', force_rport: 'yes', rewrite_contact: 'yes', rtp_symmetric: 'yes', ice_support: 'yes' },
  webrtc: {
    direct_media: 'no',
    force_rport: 'yes',
    rewrite_contact: 'yes',
    rtp_symmetric: 'yes',
    ice_support: 'yes',
    webrtc: 'yes',
    dtls_auto_generate_cert: 'yes',
    media_encryption: 'dtls',
    rtcp_mux: 'yes',
    bundle: 'yes',
  },
};
```
`max_video_streams` и видео-`allow` (VP8) **отсутствуют** во всех трёх профилях сегодня — подтверждает RESEARCH.md Pitfall 2. Новый профиль (не модификация существующего `webrtc`, чтобы не трогать Phase 9/10 companion-эндпоинты без явного решения — см. Open Question 1 RESEARCH.md, требует явного решения на этапе планирования):
```typescript
confbridgeGuest: {
  ...NAT_PROFILES.webrtc,
  max_video_streams: 5, // или расчётный бюджет — контекст задаётся отдельно при создании
  allow: 'opus,ulaw,vp8',
},
```
**Создание ephemeral endpoint'а** — образец `createCompanionTriple` (строки 159-213, полностью прочитано):
```typescript
private async createCompanionTriple(
  vpbxUserUid: number,
  extension: string,
  primary: { context: string; callerid: string | null; department?: string | null; language?: string | null; allow?: string | null; },
  transaction: Transaction,
): Promise<string> {
  const webrtcId = buildWebrtcSipId(vpbxUserUid, extension);
  const existing = await this.endpointModel.findByPk(webrtcId, { transaction });
  if (existing) return webrtcId;

  const password = this.generatePassword();
  await this.authModel.create({ id: webrtcId, auth_type: 'userpass', username: webrtcId, password }, { transaction });
  await this.aorModel.create({ ...(NAT_PROFILES.webrtc as any) }, { transaction });
  return webrtcId;
}
```
Для гостя — новый метод `createEphemeralGuestEndpoint(roomUid, tokenUid)` по этой же тройной схеме `ps_auth`/`ps_aor`/`ps_endpoint`, но с `context = 'krsk-conf-{room_uid}'` (не `context` тенанта общего назначения — RESEARCH.md Pattern 6, критично для безопасности: скомпрометированный креденшл не может дозвониться никуда, кроме своей комнаты) и `destroyEndpointTriple(sipId, transaction)` (строки 215-220) на `BYE`/`ConfbridgeLeave`/cron-sweeper.

---

### Правка: `module-coverage.registry.ts` и `hub-modules.seed.ts`

См. разбор выше в разделе `conferences-ai.adapter.ts` (registry) — для seed:

**Текущая структура `HUB_MODULE_PAGES_SEED`** (строки 43-91, полностью прочитано):
```typescript
// Apps (base) — queues stay in Apps (D-15)
{ hub_code: 'apps', page_code: 'ivr', path: '/ivrs', sort_order: 10 },
{ hub_code: 'apps', page_code: 'queues', path: '/queues', sort_order: 20 },
{ hub_code: 'apps', page_code: 'prompts', path: '/prompts', sort_order: 30 },
{ hub_code: 'apps', page_code: 'moh', path: '/moh', sort_order: 40 },
{ hub_code: 'apps', page_code: 'voice_robot', path: '/voice-robots', sort_order: 50 },
{ hub_code: 'apps', page_code: 'call_groups', path: '/call-groups', sort_order: 60 },
{ hub_code: 'apps', page_code: 'integrations', path: '/integrations', sort_order: 70 },
```
Добавить строку по образцу (UI-SPEC уже фиксирует `sort_order: 65`, между `call_groups` (60) и `integrations` (70)):
```typescript
{ hub_code: 'apps', page_code: 'conferences', path: '/conferences', sort_order: 65 },
```
`HubModuleSeed` (не `HubModulePageSeed`) для самого хаба `apps` **не трогается** — `apps` уже существует (`kind: 'base'`) в `HUB_MODULES_SEED` (строка 35), новая запись — только страница внутри него.

---

### Frontend

### `shared/ui/VideoSurface/VideoSurface.tsx` (UI-примитив)

**Аналог:** `shared/ui/AudioPlayer` — обёртка над native media-тегом с `ref`, `autoPlay`, состоянием ошибки/загрузки. Файл не прочитан построчно в этой сессии, но UI-SPEC явно называет его образцом («Тонкая обёртка над `<video autoPlay playsInline>`, по образцу `shared/ui/AudioPlayer` (обёртка над `<audio>`)») — это единственный новый примитив фазы, скопировать форму `forwardRef`/`props spread` с `AudioPlayer.tsx` буквально, заменив тег и добавляя `mirrored`/`muted` пропы под превью в pre-join card.

---

### `shared/api/endpoints/conferenceApi.ts` (RTK Query slice)

**Аналог:** `shared/api/endpoints/callGroupApi.ts` (полностью прочитан, 91 строка):
```typescript
const callGroupApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    getCallGroups: build.query<ICallGroup[], void>({ query: () => '/call-groups', providesTags: ['CallGroups'] }),
    getCallGroup: build.query<ICallGroup, number>({
      query: (uid) => `/call-groups/${uid}`,
      providesTags: (_r, _e, uid) => [{ type: 'CallGroups', id: uid }],
    }),
    createCallGroup: build.mutation<ICallGroup, ICreateCallGroup>({
      query: (body) => ({ url: '/call-groups', method: 'POST', body }),
      invalidatesTags: ['CallGroups'],
    }),
    updateCallGroup: build.mutation<ICallGroup, { uid: number; data: IUpdateCallGroup }>({
      query: ({ uid, data }) => ({ url: `/call-groups/${uid}`, method: 'PUT', body: data }),
      invalidatesTags: ['CallGroups'],
    }),
    deleteCallGroup: build.mutation<void, number>({
      query: (uid) => ({ url: `/call-groups/${uid}`, method: 'DELETE' }),
      invalidatesTags: ['CallGroups'],
    }),
  }),
});

export const {
  useGetCallGroupsQuery, useGetCallGroupQuery, useCreateCallGroupMutation,
  useUpdateCallGroupMutation, useDeleteCallGroupMutation,
} = callGroupApi;
```
Копировать 1:1 под `/conferences`. Дополнительно нужны нестандартные (не-CRUD) эндпоинты, у call-groups отсутствующие: `GET /conferences/:uid/capacity`, `POST /conferences/:uid/recording/start|stop`, `GET /conferences/:uid/events` (не через RTK — через `EventSource`, см. ниже). Теги согласно UI-SPEC FSD-таблице: `Conferences`, `ConferenceParticipants`, `ConferenceLinks`, `ConferenceMeetings` — четыре отдельных тега, не один общий, потому что участники/ссылки/встречи инвалидируются независимо от самой карточки комнаты.

---

### `entities/conference/` (типы + role/label мэппинг)

**Аналог типов:** `packages/frontend/src/entities/moh/model/types/mohSchema.ts` — простая структура `entities/<name>/model/types/<name>Schema.ts` + `index.ts` (Public API). Использовать как форму файла, содержание — под `IConferenceRoom`/`IConferenceParticipant`/`ConferenceRole` (см. `@krasterisk/shared` — там заводятся общие типы, как `ICallGroup`).

**Аналог role/label маппинга:** `packages/frontend/src/features/callcenter/lib/displayLabels.ts` (частично прочитан):
```typescript
/** Operator label: human name, else extension (ew112_0 → 112). */
export function agentDisplayName(agent: Pick<IAgent, 'name' | 'interface'>): string {
  if (!isRawAgentName(agent.name, agent.interface)) return agent.name;
  return interfaceToExtension(agent.interface) || agent.name || agent.interface;
}
```
Для conferences — `participantRoleLabel(role: ConferenceRole, t: TFunction): string` (owner/moderator/participant → `live.roleOwner`/`live.roleModerator`/`live.roleMember`) и цветовая семья роли (info/success/muted по UI-SPEC Color-таблице) — чистые функции без хуков, тестируемые в изоляции, как `formatCallGroupStrategy` в `useCallGroupsTableColumns.tsx` (см. ниже).

---

### `features/conferences/model/slice/conferencesPageSlice.ts` (Redux slice)

**Аналог:** `packages/frontend/src/features/call-groups/model/slice/callGroupsPageSlice.ts` (полностью прочитан, 36 строк):
```typescript
const initialState: CallGroupsPageSchema = {
  isModalOpen: false,
  modalMode: 'create',
  selectedCallGroupUid: null,
};

export const callGroupsPageSlice = createSlice({
  name: 'callGroupsPage',
  initialState,
  reducers: {
    openCreateModal(state) {
      state.isModalOpen = true;
      state.modalMode = 'create';
      state.selectedCallGroupUid = null;
    },
    openEditModal(state, action: PayloadAction<number>) {
      state.isModalOpen = true;
      state.modalMode = 'edit';
      state.selectedCallGroupUid = action.payload;
    },
    openCopyModal(state, action: PayloadAction<number>) {
      state.isModalOpen = true;
      state.modalMode = 'copy';
      state.selectedCallGroupUid = action.payload;
    },
    closeModal(state) {
      state.isModalOpen = false;
      state.selectedCallGroupUid = null;
    },
  },
});

export const { actions: callGroupsPageActions, reducer: callGroupsPageReducer } = callGroupsPageSlice;
```
Копировать 1:1 под `conferencesPageSlice` / `selectedRoomUid` — UI-SPEC FSD-таблица уже называет ровно этот набор полей (`isModalOpen`, `modalMode: create/edit/copy`, `selectedRoom`). `Copy` — присутствует (UI-SPEC Surface A явно перечисляет `Edit → Copy → Delete`), значит `openCopyModal` обязателен, в отличие от `ContextsTable` (эталон «без Copy» в ARCHITECTURE.md).

---

### `features/conferences/ui/ConferencesTable/ConferencesTable.tsx` + `useConferencesTableColumns.tsx`

**Аналог:** `packages/frontend/src/features/call-groups/ui/CallGroupsTable/` — оба файла полностью прочитаны и являются **точным** целевым сплитом, названным в `mapping_hints` («Use the newest of these as the canonical table analog»). Проверка mtime на диске подтвердила, что паттерн `[Name]Table.tsx` + `use[Name]TableColumns.tsx` + `.module.scss` + `.test.tsx` + `index.ts` актуален и на call-groups, и на ivrs/moh/notifications (все — недавно тронуты). `CallGroupsTable` использует его **полностью**, включая мобильный hybrid-режим — берём его как основной аналог, а не route-templates (тот держит колонки внутри `ui/RouteTemplatesPage/`, без отдельной `...Table` папки — иной, более старый сплит, не подходящий под явно описанный в UI-SPEC путь `features/conferences/ui/ConferencesTable/`).

**Колонки** (`useCallGroupsTableColumns.tsx`, полностью прочитан, 102 строки):
```typescript
export const useCallGroupsTableColumns = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [deleteCallGroup] = useDeleteCallGroupMutation();

  return useMemo(
    () => [
      columnHelper.accessor('name', { header: () => t('callGroups.name'), cell: (info) => <Text as="span" className={cls.name}>{info.getValue()}</Text> }),
      ...
      columnHelper.display({
        id: 'actions',
        header: () => t('common.actions'),
        cell: (info) => {
          const group = info.row.original;
          return (
            <TableRowActions>
              <TableRowAction title={t('common.edit')} aria-label={t('common.edit')} onClick={() => dispatch(callGroupsPageActions.openEditModal(group.uid))}>
                <Pencil />
              </TableRowAction>
              <TableRowAction title={t('common.copy')} aria-label={t('common.copy')} onClick={() => dispatch(callGroupsPageActions.openCopyModal(group.uid))}>
                <Copy />
              </TableRowAction>
              <TableRowAction danger title={t('common.delete')} aria-label={t('common.delete')} onClick={() => { if (window.confirm(t('callGroups.confirmDelete', { name: group.name }))) { deleteCallGroup(group.uid); } }}>
                <Trash2 />
              </TableRowAction>
            </TableRowActions>
          );
        },
      }),
    ],
    [t, dispatch, deleteCallGroup],
  );
};
```
**Важное отклонение для conferences:** UI-SPEC Copywriting Contract прямо предписывает `Dialog`-подтверждение для удаления комнаты (`confirmDelete`/`confirmDeleteKeep`/`confirmDeleteConfirm` — три ключа с конкретными лейблами), а не `window.confirm(...)`, как в этом аналоге у call-groups. Взять структуру колонок буквально, но заменить `window.confirm` на управление состоянием диалога (`useState` + `Dialog` из `shared/ui`, по образцу деструктивных диалогов в других уже отревьюженных UI-SPEC фазах — см. `15-UI-SPEC` `confirmDeleteKeep`/`confirmDeleteConfirm`).

**Колонка «сейчас в комнате» (живая, SSE)** — у аналога нет живых SSE-колонок (call-groups статичен), но паттерн патча RTK-кэша из SSE — ниже, в разделе Shared Patterns (`useCallCenterSSE.ts`).

**Таблица** (`CallGroupsTable.tsx`, полностью прочитан, 174 строки) — Card + toolbar + Desktop/Mobile ветвление по `useIsMobile(768)`, `DataTable` на десктопе, `VStack` карточек на мобильном — копировать 1:1 структуру, включая `data-testid="hybrid-table"` / `data-hybrid="mobile-card"` / `data-hybrid="overflow-x-auto"` (канон ARCHITECTURE.md «Hybrid (D-29)»).

---

### `pages/ConferencesPage/` (page orchestrator)

**Аналог:** `packages/frontend/src/features/call-groups/ui/CallGroupsPage/CallGroupsPage.tsx` (полностью прочитан, 50 строк) — тонкий оркестратор: `iconBadge` + градиентный `Text variant="h1"` + подзаголовок + CTA `Plus` + `Flex align="stretch"` обёртка таблицы + модалка внизу:
```tsx
export const CallGroupsPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  return (
    <VStack gap="24" max className={cls.page} data-testid="call-groups-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}><UsersRound size={24} /></Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>{t('callGroups.title', ...)}</Text>
            <Text variant="muted">{t('callGroups.subtitle', ...)}</Text>
          </VStack>
        </HStack>
        <Button className={cls.createBtn} onClick={() => dispatch(callGroupsPageActions.openCreateModal())}>
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('callGroups.create', ...)}</Text>
        </Button>
      </Flex>
      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <CallGroupsTable />
      </Flex>
      <CallGroupFormModal />
    </VStack>
  );
});
```
Копировать 1:1 (icon → `Video` по UI-SPEC Surface A, `iconBadge` тот же класс/токены).

---

### `features/conferences/ui/ConferenceRoomFormModal/` (табы)

**Аналог для табов (SCSS, вариант A):** `packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFormModal.module.scss` — прямо назван каноническим эталоном в ARCHITECTURE.md («Паттерн табов в модалках»):
```scss
.tabsWrap { margin-bottom: 1.5rem; border-bottom: 1px solid var(--color-border); flex-shrink: 0; }
.tabsRow { display: flex; gap: 0.5rem; margin-bottom: -1px; overflow-x: auto; scrollbar-width: none; &::-webkit-scrollbar { display: none; } }
.tab { position: relative; display: inline-flex; align-items: center; padding: 0.75rem 0.25rem; border: none; border-bottom: 2px solid transparent; background: transparent; ... }
.tabActive { color: var(--color-primary); border-bottom-color: var(--color-primary); }
```
Шесть вкладок из UI-SPEC (Основные / Доступ / Роли / Запись / Ссылки / История встреч) — ровно тот же `.tabsRow { overflow-x: auto; scrollbar-width: none }`, который UI-SPEC требует для переполнения на 360px («Табы формы комнаты | Переполнение / обрезка | ✅ explicit»).

**Аналог для формы-обёртки (`DialogContent size="large"` + `.scrollBody`):** ARCHITECTURE.md «Модальные окна форм (MUST) — эталон `UserFormModal`» даёт готовую разметку `flex flex-col` + `overflow: hidden` + `.formBody { overflow-y: auto }` + `.footer { border-top }` — использовать буквально, слой (`Dialog`/`DialogContent`/`DialogHeader`/`DialogFooter`) идентичен для крупных табовых модалок.

**Footer-кнопки** — UI-SPEC Copywriting Contract фиксирует нестандартные лейблы (`closeRoomForm`/`createRoom`/`saveRoom`), не `common.cancel`/`common.save` — копировать порядок outline→submit из ARCHITECTURE, но подставлять конкретные ключи, не общие.

---

### `features/conferences/lib/useConferenceRoom.ts` (WebRTC-хук)

**Аналог:** `packages/frontend/src/features/callcenter/lib/useWebRTCPhone.ts` — центральный WebRTC-хук проекта на `sip.js@0.21.2`:
```typescript
import { Invitation, Inviter, Registerer, RegistererState, Session, SessionState, UserAgent, Web } from 'sip.js';
...
const uaRef = useRef<UserAgent | null>(null);
const registererRef = useRef<Registerer | null>(null);
const sessionRef = useRef<Session | null>(null);
...
const ua = new UserAgent({
  uri,
  reconnectionAttempts: 10,
  reconnectionDelay: 4,
  transportOptions: { server: opts.server, ... },
  ...
});
uaRef.current = ua;
await ua.start();

const registerer = new Registerer(ua, { expires: 300 });
registererRef.current = registerer;
registerer.stateChange.addListener((state: RegistererState) => { ... });
```
и хук хода звонка / hold через модификаторы:
```typescript
await session.invite({ sessionDescriptionHandlerModifiers: [Web.holdModifier] });
```
Для `useConferenceRoom.ts` — та же пара `UserAgent`+`Registerer`, но: (1) `sessionDescriptionHandlerFactory` переопределяется под кастомный SDH (RESEARCH.md Pattern 8 — сток `sip.js` останавливает предыдущий видеотрек при каждом новом `ontrack`, нужен патч `setRemoteTrack`/подписка на `peerConnection.ontrack` до внутреннего обработчика); (2) вместо одного `sessionRef` — `Map<channelId, MediaStreamTrack>` для грид-рендеринга; (3) reconnection-параметры (`reconnectionAttempts`, `reconnectionDelay`) копируются буквально — тот же транспортный слой WSS. Кредлы комнаты получены не из `GET /callcenter/webrtc/config`, а из ответа `POST /conferences/:uid/join` (свои) / `POST /conferences/guest/:token/join` (гости) — иной источник credentials, тот же `UserAgent.makeURI(...)`.

---

### `features/conferences/ui/LiveRoom/RoomControlBar.tsx` + `InviteSheet.tsx`

**Аналог для панели кнопок:** `SoftphoneWidget.tsx` `controlsRow` (строки 540-614, полностью прочитан) — `Tooltip` + `Button variant="outline" size="sm"` на каждую иконку, `disabled={!isInCall}` по состоянию:
```tsx
<Tooltip content={...}>
  <Button variant="outline" size="sm" onClick={handleMuteToggle} disabled={!isInCall} aria-label={...}>
    {phone.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
  </Button>
</Tooltip>
```
UI-SPEC для `RoomControlBar` требует `size="icon"` 44px и `title` + `aria-label` из фиксированных ключей (не Tailwind `className="w-4 h-4"` — это нарушило бы ARCHITECTURE «No Tailwind в features»), поэтому копировать **логику** disabled/tooltip/aria, но рендерить кнопки через `Button size="icon"` + Lucide `size` проп + SCSS, не через Tailwind-классы иконок, как в этом (частично legacy) аналоге.

**Аналог для приглашения:** `SoftphoneWidget.tsx` `conferenceSheet` (строки 765-778):
```tsx
const conferenceSheet = (
  <Sheet open={conferenceOpen} onOpenChange={setConferenceOpen}>
    <SheetContent className={styles.conferenceSheet}>
      <SheetHeader><SheetTitle>{t('callcenter.controlBar.conference', ...)}</SheetTitle></SheetHeader>
      <TransferDirectory mode="conference-add" activeCallUniqueid={activeCallUniqueid} onDone={() => setConferenceOpen(false)} />
    </SheetContent>
  </Sheet>
);
```
`InviteSheet.tsx` — та же форма `Sheet`+`SheetHeader`+`SheetTitle`, внутри — список абонентов тенанта (аналог `TransferDirectory`, не прочитан построчно, но вызывается с готовым `mode`-пропом — тот же паттерн переключаемого режима компонента применим к `InviteSheet` с `mode="member"`/`mode="external"`, различающими `live.inviteMember`/`live.inviteExternal`).

---

### `features/conferences/ui/ConferenceMiniPanel/`

**Аналог:** `SoftphoneWidget.tsx` **целиком** — UI-SPEC Surface E прямо предписывает копировать геометрию 1:1 с `.chromeTrigger`/`.chromePanel`/`.stickyBar`. Три ветки уже даны образцом:

1. **Desktop chrome-триггер** (строки 843-889):
```tsx
<div className={styles.chromeWrap} data-testid="softphone-widget-chrome">
  {open ? (
    <div className={styles.chromePanel} data-testid="softphone-widget-panel">
      {panelBody}
      <Button variant="ghost" size="sm" className={styles.collapseBtn} onClick={() => setOpen(false)}>{t('...collapse', ...)}</Button>
    </div>
  ) : null}
  <button
    type="button"
    className={`${styles.chromeTrigger}${showLabel ? ` ${styles.chromeTriggerLabeled}` : ''}${pulseActive ? ` ${styles.chromeTriggerRinging}` : ''}${open ? ` ${styles.chromeTriggerOpen}` : ''}`}
    aria-label={...}
    aria-expanded={open}
    onClick={() => setOpen((v) => !v)}
  >
    {pulseActive ? <PhoneIncoming .../> : <Phone .../>}
    {!pulseActive ? <span className={`${styles.regBadge} ${regBadgeClass}`} .../> : null}
  </button>
</div>
```
2. **Mobile sticky bar** (строки 790-841) — `<div className={styles.stickyBar} data-testid="softphone-widget-sticky">` с точкой состояния + инфо-блоком + контролами.

Копировать структуру `open`-состояния, триггера, точки состояния (`success` вместо `regBadge`), но заменить содержимое панели на название комнаты + Display 28px таймер + счётчик участников + микрофон/камера/выйти + CTA «Открыть комнату» (UI-SPEC Surface E). Collision-контракт (UI-SPEC «Collision contracts») требует **второй** отдельный chrome-триггер рядом с софтфонным, не переиспользование того же `.chromeTrigger` слота — оба виджета монтируются параллельно в `AppLayout`/`ModuleShell` chrome.

---

### `features/conferences/ui/ConferencePreJoinCard/`

**Аналог для выбора устройств:** `SoftphoneWidget.tsx` `SoftphoneDevicePicker` (строки 107-192, полностью прочитан):
```tsx
function SoftphoneDevicePicker({ phone, deviceError, onDeviceError, onMicDeviceChange, onSpeakerDeviceChange }) {
  const { t } = useTranslation();
  const audioDevices = useAudioDevices();
  const handleMicChange = async (deviceId: string) => { ... };
  return (
    <VStack gap="8" className={styles.devicePicker} data-testid="softphone-device-picker">
      <label className={styles.deviceRow}>
        <Text className={styles.deviceLabel}>{t('...microphone', ...)}</Text>
        <Select value={audioDevices.selectedMic} onChange={(e) => void handleMicChange(e.target.value)} ...>
          <option value="default">Default</option>
          {audioDevices.microphones.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{audioDeviceLabel(d, i, 'mic')}</option>)}
        </Select>
      </label>
      ...
    </VStack>
  );
}
```
Хук `useAudioDevices` (`packages/frontend/src/features/callcenter/lib/useAudioDevices.ts`, не прочитан построчно, но использован как есть выше) — переиспользовать напрямую в `ConferencePreJoinCard`, не писать новый device-enumerator: UI-SPEC требует ровно два `Select` устройств (микрофон, камера) — расширить существующий хук камерой (`videoinput`), если он сегодня перечисляет только `audioinput`/`audiooutput`.

---

### `widgets/ConferenceGuestShell/`

**Аналог (геометрия и роутинг, НЕ разметка):** `packages/frontend/src/pages/CallCenterWallboardPage/CallCenterWallboardPage.tsx` + `.module.scss` — единственная в проекте страница вне `AppLayout` с локальным тёмным контекстом на корне:
```tsx
if (!token) {
  return (
    <div className={styles.root} data-wallboard="true">
      <div className={styles.empty}>...</div>
    </div>
  );
}
return (
  <div className={styles.root} data-wallboard="true">
    ...
  </div>
);
```
**Внимание:** этот файл написан на raw `<div>`/Tailwind-подобной разметке и **не** соответствует текущему канону Stack-компонентов (ARCHITECTURE.md запрещает `div`/`span` в `features`/`pages` выше `shared`). Он прочитан целиком и взят **только** как прецедент SCSS-трюка `.root { color-scheme: dark; --color-*: переопределены локально }` + маршрут вне `AppLayout` в `router.tsx` (`{ path: '/callcenter/wallboard', element: <CallCenterWallboardPage /> }`, строки 74-77 роутера) — саму разметку `ConferenceGuestShell`/`ConferenceGuestPage` писать через `VStack`/`Flex`/`Text` по актуальному канону, не копируя `<div>` из этого файла построчно.

---

### Правка: `features/dialplan-apps/model/schemas/confBridge.tsx`

**Текущий файл** (полностью прочитан, 30 строк):
```tsx
export function buildConfBridgeSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'room',
      kind: 'value-source',
      required: true,
      labelKey: 'routes.chain.confbridge.room',
      label: t('routes.chain.confbridge.room', 'Комната'),
      hintKey: 'routes.chain.confbridge.roomHint',
      hint: t('routes.chain.confbridge.roomHint', 'Номер комнаты. Два тенанта с одинаковым номером попадут в одну конференцию.'),
    },
  ];
}
```
**Аналог целевой формы поля** — `registry.ts`, схема `toqueue` (строки 138-146, полностью прочитан):
```typescript
{
  key: 'target',
  kind: 'value-source',
  required: true,
  group: 'primary',
  labelKey: 'routes.chain.fields.queue',
  label: 'Очередь',
  optionsSource: 'queues',
},
```
Новая `buildConfBridgeSchema`:
```tsx
export function buildConfBridgeSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'room',
      kind: 'value-source',
      required: true,
      group: 'primary',
      labelKey: 'routes.chain.confbridge.room',
      label: t('routes.chain.confbridge.room', 'Комната'),
      optionsSource: 'conferenceRooms',
      valueSourceMode: 'queue',
      hintKey: 'routes.chain.confbridge.roomHint',
      hint: t('routes.chain.confbridge.roomHint', '...'),
    },
  ];
}
```
`options` (второе поле схемы у аналога `toqueue` нет, а у старого `confBridge.tsx` тоже нет отдельного `options`-поля — второй аргумент `ConfBridge` собирался из `params.options` вручную в `dialplan.util.ts`, не через схему) — UI-SPEC Surface C прямо говорит: «Второе поле `options` на схеме **не появляется**: профили живут в модуле» — подтверждено, ничего добавлять не нужно.

---

### Правка: `schema.types.ts` (`OptionsSource`), `useSchemaRefs.ts`, `SchemaFields.tsx` (`CATALOG_DEFAULTS`)

**Три обязательные точки регистрации** (по явному предупреждению в ARCHITECTURE.md: «без записи `RefSelect` покажет «Ничего не создано» вместо данных»):

1. `schema.types.ts` (строки 18-32, полностью прочитан) — добавить `'conferenceRooms'` в union:
```typescript
export type OptionsSource =
  | 'queues'
  | 'trunks'
  ...
  | 'notifications'
  | 'conferenceRooms';
```

2. `useSchemaRefs.ts` (полностью прочитан, 202 строки) — добавить хук + запись в объект результата + зависимость в `useMemo`, по образцу блока `queues` (строки 82-91):
```typescript
const conferenceRooms = useGetConferencesQuery(undefined, { skip: !needs('conferenceRooms') });
...
conferenceRooms: {
  items: (conferenceRooms.data ?? []).map((room) => ({
    value: String(room.uid),
    label: room.name ? `${room.number} - ${room.name}` : room.number,
  })),
  isLoading: conferenceRooms.isLoading,
  sectionHref: '/conferences',
  sectionKey: 'routes.chain.catalog.conferencesSection',
  sectionFallback: 'Конференции',
},
```
(`sectionKey`/`sectionFallback` уже зафиксированы буквально в UI-SPEC Copywriting Contract — `routes.chain.catalog.conferencesSection` = «Конференции».)

3. `SchemaFields.tsx`, `CATALOG_DEFAULTS` (строки 121-124 контекста, не читан полностью, но структура видна из грепа — `Record<OptionsSource, { href, sectionKey, sectionFallback }>`) — добавить запись `conferenceRooms: { href: '/conferences', sectionKey: 'routes.chain.catalog.conferencesSection', sectionFallback: 'Конференции' }`, синхронную с `useSchemaRefs`.

Прямые `useGetXQuery` в `StepSheet`/полях **запрещены** (ARCHITECTURE.md) — единственное разрешённое исключение уже занято `ValueSourceField`, который сам грузит очереди/справочники по своему `mode` (см. ниже).

---

### Правка: `ValueSourceField.tsx` (`valueSourceMode: 'queue'` для `conferenceRooms`)

**Текущий код** (строки 133-139, частично прочитан):
```tsx
const mode: ValueSourceMode =
  modeProp ?? (optionsSource === 'queues' ? 'queue' : 'scalar');
const coerced = coerceValueSource(value);
const src = asValueSource(coerced);
const queuesQuery = useGetQueuesQuery(undefined, { skip: mode !== 'queue' });
```
UI-SPEC Surface C явно указывает `valueSourceMode: 'queue'` для комнаты (не производный от `optionsSource === 'queues'`, а передаваемый явно в схеме `buildConfBridgeSchema` — см. правку схемы выше, поле `valueSourceMode: 'queue'` уже присутствует). Значит здесь нужна **не** правка условия `optionsSource === 'queues'`, а обеспечение, что `mode === 'queue'` корректно резолвит `optionsSource: 'conferenceRooms'` через уже существующий каталог-путь (`RefSelect`/`optgroup` «Динамичная»/«Статичная», описанный в UI-SPEC), а не через отдельный `queuesQuery`, специфичный для queue-каталога буквально. Внутренняя реализация `ValueSourceField` при `mode === 'queue'` не прочитана целиком в этой сессии (строки после 139 не читаны) — рекомендация планировщику: прочитать оставшуюся часть файла (полный компонент) перед реализацией, чтобы понять, жёстко ли `queuesQuery` используется внутри рендера, или каталог достаётся из пропа `catalog`/`SchemaRefs` независимо от `optionsSource`.

---

### Правка: `features/modules/lib/moduleRegistry.ts`

**Текущий блок** (строки 104-115, полностью прочитан):
```typescript
{ id: 'ivrs', path: '/ivrs', labelKey: 'nav.ivrs', icon: AppWindow },
{ id: 'queues', path: '/queues', labelKey: 'nav.queues', icon: ListOrdered },
{ id: 'prompts', path: '/prompts', labelKey: 'promptsPage.title', icon: Mic },
{ id: 'moh', path: '/moh', labelKey: 'moh.title', icon: Music },
{ id: 'voice-robots', path: '/voice-robots', labelKey: 'nav.voiceRobots', icon: Bot },
{ id: 'call-groups', path: '/call-groups', labelKey: 'nav.callGroups', icon: Phone },
{
  id: 'integrations',
  path: '/integrations',
  labelKey: 'nav.integrations',
  icon: Package,
```
Добавить после `call-groups` (UI-SPEC Surface A явно требует «после `call-groups`»):
```typescript
{ id: 'conferences', path: '/conferences', labelKey: 'nav.conferences', icon: Video },
```
`Video` — импорт из `lucide-react`, уже используемого набора иконок хаба.

---

### Правка: `app/router/router.tsx`

**Внутри `AppLayout`-дерева** (строки 121-123, полностью прочитан):
```tsx
{ path: 'queues', element: <QueuesPage /> },
{ path: 'integrations', element: <NotificationIntegrationsPage /> },
{ path: 'call-groups', element: <CallGroupsPage /> },
```
Добавить `{ path: 'conferences', element: <ConferencesPage /> }` и `{ path: 'conferences/:uid/room', element: <ConferenceRoomPage /> }` в этом же блоке.

**Вне `AppLayout`** (строки 73-77, полностью прочитан):
```tsx
// Public TV wallboard - display-token auth only (no AppLayout / JWT) (D-18 / NAV-15)
{
  path: '/callcenter/wallboard',
  element: <CallCenterWallboardPage />,
},
```
Добавить рядом (тот же уровень дерева маршрутов, вне `AppLayout`):
```tsx
// Public conference guest entry - opaque token auth only (no AppLayout / JWT) (D-28)
{
  path: '/conf/:token',
  element: <ConferenceGuestPage />,
},
```

---

## Shared Patterns

### Тенантная изоляция (`vpbx_user_uid` / `user_uid`)
**Источник:** `packages/backend/.idea/ARCHITECTURE.md`, раздел «Мультитенантность» — контроллер всегда берёт `req.user.vpbx_user_uid`, сервис всегда принимает `userUid` вторым параметром, `delete dto.user_uid` перед `update`. Применить к каждому методу `ConferenceRoomsController`/`ConferenceRoomsService`.

### Best-effort dialplan apply после DB-транзакции
**Источник:** `call-groups.service.ts`, методы `create`/`update`/`remove` — паттерн `try { await this.applyGroup(...) } catch (e) { this.logger.error(...) }` **после** успешного `transaction.commit()`. БД — источник правды, ошибка применения в Asterisk не откатывает уже сохранённую запись, только логируется с явной пометкой «DB saved — retry/re-save may be needed». Применить к `ConferenceRoomsService.applyRoom()`.

### Opaque-токен с TTL и `revoked_at`, `req.user` без `sub`/`level`
**Источник:** `DisplayTokenGuard` + `VoicemailLinkGuard` (оба прочитаны целиком, идентичная структура) — три проверки (`missing → invalid → revoked → expired`), `req.user` только с тенантным полем и явным маркером не-JWT-сессии, fire-and-forget обновление `last_used_at`. Применить к `ConferenceGuestTokenGuard`.

### AI-адаптер: read + `defineMutationTool` + live-ops с `destructive: true`
**Источник:** `time-groups-ai.adapter.ts` (read/propose/apply) + `callcenter-ai.adapter.ts` (immediate destructive tools). Регистрация через `onModuleInit() { this.registry.register(this); }`, `readonly domain = '<name>';` буквально этим синтаксисом (регэксп completeness-теста), `getKnowledgeBlock()` — короткий markdown-блок с доменными правилами для LLM.

### `@Cron` с guard против накладывающихся прогонов
**Источник:** `callcenter-shift-janitor.service.ts` (`if (this.running) return; this.running = true; try { ... } finally { this.running = false; }`), `callcenter-ami.service.ts:2303` (`periodicMembershipSync`, тот же guard плюс проверка `this.amiService.isConnected()`). Применить к `conference-capacity.service.ts` и `conference-stale-channel-sweeper.service.ts`.

### AMI event listener → lazy `ModuleRef` → доменный сервис
**Источник:** `ami.service.ts`, три существующих форварда (`getCcAmiService()`, `getCcPresenceService()`, webhook lazy-resolver) — избегает циклической зависимости `AmiModule ↔ ConferencesModule`. Событийные имена в нижнем регистре (`confbridgejoin`, не `ConfbridgeJoin`).

### RTK Query CRUD slice (5 эндпоинтов, тег на сущность)
**Источник:** `callGroupApi.ts` — `getX[]` / `getX(uid)` / `createX` / `updateX({uid, data})` / `deleteX(uid)`, `providesTags`/`invalidatesTags` на один общий тег плюс точечный `{ type, id }` для `getOne`.

### Триадный `modalMode` slice (`create`/`edit`/`copy`)
**Источник:** `callGroupsPageSlice.ts` — три `openXModal` reducer'а + `closeModal`, `selectedXUid: number | null`. Applies to `conferencesPageSlice`.

### `[Name]Table` + `use[Name]TableColumns` + hybrid desktop/mobile
**Источник:** `CallGroupsTable.tsx`/`useCallGroupsTableColumns.tsx` — `useIsMobile(768)` ветвление, `TableRowActions`/`TableRowAction` (Edit→Copy→Delete, без Tailwind на иконках), `data-hybrid="mobile-card"`/`"overflow-x-auto"`.

### SSE → RTK cache patch (`api.util.updateQueryData`)
**Источник:** `useCallCenterSSE.ts` (строки 271-276, 331-334) — `EventSource` с `?token=` query param (нативный `EventSource` не поддерживает custom headers), `dispatch(callCenterApi.util.updateQueryData('getX', arg, (draft) => { ... }))` на каждый именованный SSE-эвент (`addEventListener('presenceUpdate', ...)`). Применить к живой колонке «сейчас в комнате» в `ConferencesTable` и к состояниям участников в `LiveRoom`.

### sip.js `UserAgent` + `Registerer` + модификаторы SDP
**Источник:** `useWebRTCPhone.ts` — `new UserAgent({ uri, reconnectionAttempts, transportOptions })`, `new Registerer(ua, { expires: 300 })`, `registerer.stateChange.addListener(...)`, `session.invite({ sessionDescriptionHandlerModifiers: [Web.holdModifier] })`. Тот же импорт `from 'sip.js'`, та же версия `0.21.2`.

### Chrome-триггер / выпадающая панель / mobile sticky bar
**Источник:** `SoftphoneWidget.tsx` целиком — единственный в проекте прецедент «мини-панели, живущей поверх текущей страницы», геометрия которого UI-SPEC требует скопировать буквально для `ConferenceMiniPanel`.

---

## No Analog Found

| Файл | Role | Data Flow | Причина |
|---|---|---|---|
| `features/conferences/ui/LiveRoom/VideoGrid.tsx` + `ParticipantTile.tsx` | component | media (CSS-grid раскладка N видео-плиток) | В проекте нет ни одного существующего CSS-grid рендера произвольного числа live-видео-потоков — `CallCenterWallboardPage` рисует KPI/чарты, не видео. Единственный проверенный референс — рабочий черновой клиент спайка `.planning/spikes/002-confbridge-sfu-video-grid/public/` (не аналог кодовой базы, а спайк-прототип; используется как «проверенный рецепт раскладки», не как код для копирования 1:1 — сам spike использует ванильный JS/DOM, не React/FSD). Планировщику — писать с нуля по контракту UI-SPEC Surface D (`grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))`), ориентируясь на рецепт спайка только для `ontrack`-обхода (Pattern 8 RESEARCH.md), не для структуры компонента. |
| `features/conferences/lib/useConferenceRoom.ts` — кастомный `SessionDescriptionHandler` (переопределение `setRemoteTrack`) | utility (media patch) | streaming | Проект нигде не переопределяет внутренний SDH `sip.js` — `useWebRTCPhone.ts` использует сток-обработку треков (одна аудио-сессия, один remote track достаточно для звонка без грида). Патч, останавливающий штатное поведение библиотеки при множественных видео-треках, — новый для кодовой базы код; единственный источник — экспериментальный `.planning/spikes/002-confbridge-sfu-video-grid/public/app.js` (спайк, не продуктовый код). Планировщику — читать спайк для точного метода патча перед реализацией, тестировать через мок `RTCPeerConnection` (см. RESEARCH.md Validation Architecture, Pattern 8 test row). |

---

## Metadata

**Область поиска аналогов:** `packages/backend/src/modules/{call-groups,queues,voicemail,callcenter,ami,endpoints,ai-platform,cloud-admin,directories,reports/cdr}`, `packages/backend/src/shared/utils/`, `packages/backend/src/skills/time-groups/`, `packages/frontend/src/{features,entities,shared/ui,shared/api,pages,app}`.
**Файлов прочитано целиком или частично с построчной цитатой:** 32.
**Дата составления паттерн-карты:** 2026-09-15.
