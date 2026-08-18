# Phase 12: Dialplan Apps Editor Refactor — Reusable Route Chain Builder — Pattern Map

**Mapped:** 2026-08-18
**Files analyzed:** 62 (46 новых / 16 изменяемых)
**Analogs found:** 55 / 62 (7 без аналога — см. `## No Analog Found`)

Источник списка файлов — `12-RESEARCH.md` → `### Recommended Project Structure` (строки 441–502) и
`### Швы` (строки 1561–1575). Решения — `12-CONTEXT.md` (D-01…D-59). UI-компоненты сопоставлены
поверхностям A…L из `12-UI-SPEC.md`.

---

## File Classification

### W0 + W1 — генератор, типы, нормализация целей

| Файл (N=новый, M=изменяемый) | Роль | Data flow | Ближайший аналог | Качество |
|---|---|---|---|---|
| `packages/backend/src/shared/utils/dialplan.util.spec.ts` (M, W0) | test | transform | сам себя, `dialplan.util.spec.ts:1-55` | exact |
| `packages/backend/src/shared/utils/dialplan.util.ts` (M) | utility | transform | сам себя, `actionToDialplan:110-137` | exact |
| `packages/backend/src/shared/utils/dialplan-target.util.ts` (N) | utility | transform | `dialplan.util.ts` → `pjsipDialTarget` (использование: `:166`, `:180`) | exact |
| `packages/backend/src/shared/utils/dialplan-target.util.spec.ts` (N) | test | transform | `dialplan.util.spec.ts:1-55` | exact |
| `packages/backend/src/shared/utils/dialplan-condition.util.ts` (N) | utility | transform | `dialplan.util.ts:121-135` (wrapper/closing) | exact |
| `packages/backend/src/shared/utils/dialplan-options.util.ts` (N) | utility | transform | `dialplan.util.ts` → `buildDialOptions` (вызовы `:144`, `:161`) | role-match |
| `packages/shared/src/types/dialplan-params.types.ts` (N) | model (types) | — | `packages/shared/src/types/route.types.ts:146-176` (`DialplanAction`) | exact |
| `packages/shared/src/types/dialplan-condition.types.ts` (N) | model (types) | — | `route.types.ts:26-31` (`IRouteActionCondition`) | exact |
| `packages/backend/src/modules/routes/dto/route-action.dto.ts` (M) | dto | request-response | сам себя, `:69-83` | exact |
| `packages/backend/src/modules/routes/dto/dialplan-params/*.params.dto.ts` (N, ~29) | dto | request-response | `route-action.dto.ts:87-109` (`ValidateNested`+`Type`), но **без** discriminator | partial |

### W6 — новый backend-модуль `tenant-settings` (D-16…D-19)

| Файл | Роль | Data flow | Ближайший аналог | Качество |
|---|---|---|---|---|
| `modules/tenant-settings/tenant-setting.model.ts` (N) | model | CRUD | `callcenter/models/cc-settings.model.ts:16-70` + `notifications/notification-integration.model.ts:9-33` | exact |
| `modules/tenant-settings/tenant-settings.service.ts` (N) | service | CRUD | `ai-agents/ai-providers.service.ts:16-106` | exact |
| `modules/tenant-settings/tenant-settings.controller.ts` (N) | controller | request-response | `callcenter/callcenter-settings.controller.ts:38-108` | exact |
| `modules/tenant-settings/dto/tenant-setting.dto.ts` (N) | dto | request-response | `call-groups/dto/call-group.dto.ts` + `route-action.dto.ts:55-83` | exact |
| `modules/tenant-settings/tenant-settings.module.ts` (N) | config | — | `notifications/notifications.module.ts:17-36` | exact |
| `modules/tenant-settings/migrate-tenant-settings.ts` (N) | migration | batch | `notifications/migrate-notifications-phase6.ts:20-56` (createTable) | exact |
| `modules/tenant-settings/tenant-settings.service.spec.ts` (N) | test | CRUD | `ai-agents/ai-providers.service.spec.ts:1-60` | exact |
| `packages/backend/src/app.module.ts` (M) | config | — | сам себя, `:93-94`, `:136-156`, `:205-211` | exact |

### W7 — новый backend-модуль `voicemail` (D-54…D-59; RESEARCH рекомендует вынести в Phase 12b)

| Файл | Роль | Data flow | Ближайший аналог | Качество |
|---|---|---|---|---|
| `modules/voicemail/voicemail-message.model.ts` (N) | model | CRUD | `notification-integration.model.ts:9-33`, `callcenter/models/display-token.model.ts:7-42` | exact |
| `modules/voicemail/voicemail-dialplan.controller.ts` (N) | controller | event-driven | `notifications/dialplan-notify.controller.ts:20-51` | exact |
| `modules/voicemail/voicemail.controller.ts` (N) | controller | request-response + streaming | `reports/cdr/cdr.controller.ts` + `cdr.service.ts:433-507` | exact |
| `modules/voicemail/voicemail.service.ts` (N) | service | file-I/O + CRUD | `reports/cdr/cdr.service.ts:291-351` (`safeRecordFilePath`, `resolveRecordingFile`) | exact |
| `modules/voicemail/voicemail-link.service.ts` (N, D-59) | service | request-response | `callcenter/models/display-token.model.ts` + `callcenter/guards/display-token.guard.ts:20-57` | role-match |
| `modules/voicemail/llm-summary.service.ts` (N, D-57) | service | request-response | `ai-agents/ai-providers.service.ts` + `ai-agents/util/secret-cipher.util.ts:24-43` | role-match |
| `modules/voicemail/wav-pcm.util.ts` + `.spec.ts` (N) | utility | transform | — | **none** |
| `modules/voicemail/migrate-voicemail.ts` (N) | migration | batch | `migrate-notifications-phase6.ts:20-56` | exact |
| `modules/voicemail/voicemail.module.ts` (N) | config | — | `notifications/notifications.module.ts:17-36` | exact |

### W2 + W8 — frontend `features/dialplan-apps` (UI-SPEC surfaces A…F)

| Файл | Роль | Data flow | Ближайший аналог | Качество |
|---|---|---|---|---|
| `model/useChainEditor.ts` (N, D-13, Surface A) | hook | transform | `ui/DialplanAppsEditor/DialplanAppsEditor.tsx:53-96` (владелец списка сегодня) | partial |
| `model/registry.ts` (M, D-07) | config | — | сам себя, `:17-53` | exact |
| `model/types.ts` (M, D-07) | model (types) | — | сам себя, `:6-24` | exact |
| `model/schema.types.ts` (N, D-07) | model (types) | — | `model/types.ts:12-24` | role-match |
| `ui/DialplanAppsEditor/` (M, D-14, Surface A) | component | transform | сам себя, `:98-129` | exact |
| `ui/StepRow/` (N, заменяет `SortableActionItem`, Surface B) | component | transform | `ui/SortableActionItem/SortableActionItem.tsx:30-137` | exact |
| `ui/StepSheet/` (N, D-01…D-03, Surface C) | component | request-response | `callcenter/ui/ContactBookForm/ContactBookForm.tsx:148-210` | exact |
| `ui/SchemaField/` (N, D-07, Surface C) | component | transform | `call-groups/ui/CallGroupFormModal/CallGroupMembersEditor.tsx:38-88` (`MemberValueField`) | role-match |
| `ui/ValueSourceField/` (N, D-20) | component | transform | `dialplan-apps/ui/apps/CallerIdApp/CallerIdApp.tsx` (mode-switch внутри одного app) | role-match |
| `ui/OptionsEditor/` (N, D-27) | component | transform | `dialplan-apps/ui/apps/QueueApp/QueueApp.tsx:35-47` (строка опций как Input) | partial |
| `ui/ConditionsEditor/` (N, D-22, D-23) | component | transform | `dialplan-apps/ui/ActionConditionFilters/ActionConditionFilters.tsx` | exact |
| `ui/UnknownActionPanel/` (N, W5/D-12) | component | — | `SortableActionItem.tsx:109-112` (ветка `isEmptyType`) | partial |
| `ui/apps/*` (M, 14 компонентов → `{ params, onChange }`) | component | transform | `ui/apps/QueueApp/QueueApp.tsx`, `ui/apps/NotifyApp/NotifyApp.tsx` | exact |
| `lib/summarize.ts` + `.test.ts` (N, D-04) | utility | transform | `callcenter/lib/displayLabels.ts` + `displayLabels.test.ts:1-40` | exact |
| `lib/optionsString.ts` + `.test.ts` (N, D-27) | utility | transform | `displayLabels.test.ts:1-40` (форма теста) | exact |
| `lib/validateAction.ts` + `.test.ts` (N, D-10) | utility | transform | `displayLabels.test.ts:1-40` | exact |
| `shared/ui/Sheet/Sheet.tsx` (M, prop `side`) | component | — | сам себя, `:26-51` | exact |

### Хосты редактора и API-слой

| Файл | Роль | Data flow | Ближайший аналог | Качество |
|---|---|---|---|---|
| `features/routes/ui/RouteFormModal/RouteActionsTab.tsx` (M, D-14) | component | transform | сам себя, `:73-82` | exact |
| `features/ivrs/ui/IvrMenuItemsEditor/IvrMenuItemsEditor.tsx` (M, D-14) | component | transform | `RouteActionsTab.tsx:73-75` | exact |
| `shared/api/endpoints/tenantSettingsApi.ts` (N) | store (API slice) | CRUD | `shared/api/endpoints/callGroupApi.ts:33-75` | exact |
| `shared/api/endpoints/voicemailApi.ts` (N) | store (API slice) | CRUD + streaming | `callGroupApi.ts:33-75` | exact |
| `shared/api/rtkApi.ts` (M, `tagTypes`) | config | — | сам себя, `:98` | exact |
| Форма тенантных настроек (N, Surface J) | component | CRUD | `callcenter/ui/ShiftPolicyForm/ShiftPolicyForm.tsx:38-110` | exact |
| Optimistic-переключатели тенантных настроек (N, D-17) | store (API slice) | CRUD | `shared/api/endpoints/callCenterApi.ts:527-550` | exact |
| `shared/config/locales/ru.ts`, `en.ts` (M) | config | — | `ru.ts:331` (namespace `routes`), ключи `routes.apps.*` | exact |

---

## Pattern Assignments

### 1. Новый backend-модуль: scaffold + регистрация

**Аналог:** `packages/backend/src/modules/notifications/` (Phase 6) — самый свежий модуль, где есть
полный набор: model + service + controller + DTO + внутренний dialplan-контроллер + миграция + specs.
`stt-engines` тоже tenant-scoped, но типизирован слабее — брать `notifications`.

**Регистрация модуля** (`packages/backend/src/modules/notifications/notifications.module.ts:17-36`):

```typescript
@Module({
  imports: [
    SequelizeModule.forFeature([NotificationIntegration]),
    HttpModule.register({ timeout: 10_000 }),
    MailerModule,
  ],
  controllers: [NotificationsController, DialplanNotifyController],
  providers: [
    NotificationsService,
    NotificationDispatcherService,
    TelegramProvider,
    ...
  ],
  exports: [NotificationsService, NotificationDispatcherService, WebhookProvider],
})
export class NotificationsModule {}
```

**Wiring в `app.module.ts`** — три точки, все три обязательны (`packages/backend/src/app.module.ts`):

```typescript
// 1) импорты — :93-94
import { NotificationsModule } from './modules/notifications/notifications.module';
import { NotificationIntegration } from './modules/notifications/notification-integration.model';

// 2) models[] у SequelizeModule.forRoot — :136-156
      models: [
        User, Role, NumberList, ActionLog, UserSession, Context,
        ...
        NotificationIntegration,
        CallGroup, CallGroupMember,
      ],

// 3) imports[] приложения — :205-211
    CallGroupsModule,
    LoggerModule,
    MailerModule,
    NotificationsModule,
```

`synchronize: false` — таблицу создаёт только миграционный скрипт (см. паттерн 3).

---

### 2. Sequelize-модель с тенант-скоупингом, JSON-колонками и singleton-семантикой

Две канонические формы. Для `tenant_settings` (key/value по категориям) — форма A;
для «singleton настроек тенанта» — форма B.

**Форма A — обычная tenant-scoped таблица** (`modules/notifications/notification-integration.model.ts:9-33`):

```typescript
@Table({ tableName: 'notification_integrations', timestamps: false })
export class NotificationIntegration extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare name: string;

  @Column({
    type: DataType.ENUM('telegram', 'email', 'whatsapp', 'webhook', 'max', 'vk'),
    allowNull: false,
  })
  declare channel: 'telegram' | 'email' | 'whatsapp' | 'webhook' | 'max' | 'vk';

  /** Non-secret channel defaults (chat_id, webhook URL template, etc.). */
  @Column({ type: DataType.JSON, allowNull: true })
  declare config: Record<string, any> | null;

  /** Encrypted JSON credentials blob (AES-256-GCM, CC_AI_KEY_SECRET). */
  @Column({ type: DataType.TEXT, allowNull: true })
  declare encrypted_credentials: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare user_uid: number;
}
```

**Форма B — singleton на тенанта + JSON-настройки с дефолтами**
(`modules/callcenter/models/cc-settings.model.ts:12-38`):

```typescript
/**
 * Per-tenant call-center settings singleton (D-07 default SLA + D-27 alert thresholds).
 * Unique on vpbx_user_uid.
 */
@Table({ tableName: 'cc_settings', timestamps: false })
export class CcSettings extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;

  /** D-07: tenant default SLA threshold (sec) when queue has no servicelevel. */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 20 })
  declare default_sla_threshold: number;

  /**
   * D-27: flexible alert thresholds JSON.
   * Known keys: max_wait_sec, abandon_rate_pct, sla_critical_pct, agents_available_min.
   */
  @Column({ type: DataType.JSON, allowNull: true })
  declare alert_thresholds: Record<string, number> | null;
```

**Имя колонки тенанта.** В коде поле всегда называется `user_uid`; если физическая колонка в БД —
`vpbx_user_uid`, используется явный `field` (`models/display-token.model.ts:40-41`):

```typescript
  // Tenant isolation
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
```

**UNIQUE composite index в модели через декораторы в проекте не объявляется** — уникальность
навешивается миграцией (`qi.addIndex`, см. паттерн 3). Для `tenant_settings` это
`UNIQUE(vpbx_user_uid, key)`.

---

### 3. Standalone data-migration script

`npm run db:migrate` в репозитории нерабочий (RESEARCH), фреймворка миграций нет
(`synchronize: false`). Канон — standalone `ts-node`-скрипт внутри модуля. Две формы.

**Форма A — CREATE TABLE + индексы** (`modules/notifications/migrate-notifications-phase6.ts:1-56`):

```typescript
import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Standalone script (pattern: migrate-phonebooks-phase5.ts) — no migration
 * framework in this repo (app.module.ts: synchronize: false).
 *
 * Run (automated):
 *   npx ts-node src/modules/notifications/migrate-notifications-phase6.ts (from packages/backend)
 */
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

  const qi: QueryInterface = sequelize.getQueryInterface();

  console.log('[migration] Creating notification_integrations...');
  await qi.createTable('notification_integrations', {
    uid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    config: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    user_uid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('notification_integrations', ['user_uid'], { name: 'idx_notif_int_user_uid' });
  } catch (e) {
    console.log('[migration] idx_notif_int_user_uid:', (e as Error).message);
  }

  console.log('[migration] Phase 6 notification integrations migration complete.');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
```

**Форма B — идемпотентный ALTER** (`modules/callcenter/migrate-callcenter-transfer-destination.ts:16-65`):

```typescript
async function alterIdempotent(sequelize: Sequelize, label: string, sql: string): Promise<void> {
  try {
    await sequelize.query(sql);
    console.log(`[migration] ${label}: applied`);
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (
      msg.includes('Duplicate column name') ||
      msg.includes('Duplicate key name') ||
      msg.includes('check that column/key exists') ||
      msg.includes('already exists') ||
      msg.includes('Duplicate')
    ) {
      console.log(`[migration] ${label}: already applied — ok`);
      return;
    }
    throw err;
  }
}

async function main() {
  const sequelize = new Sequelize({ /* … как в форме A … */ });
  try {
    await alterIdempotent(
      sequelize,
      'cc_queue_calls.transfer_destination',
      `ALTER TABLE cc_queue_calls
       ADD COLUMN transfer_destination VARCHAR(64) NULL DEFAULT ''
       AFTER disposition`,
    );
    console.log('[migration] transfer_destination migration complete.');
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
```

**Тестирование миграции.** Прецедента «тест самой миграции» нет:
`cloud-admin/migrate-hub-modules-phase8.spec.ts` проверяет **seed-константы**, а не выполнение SQL.
Тестируемая часть выносится в чистую функцию и покрывается unit-тестом сервиса
(`ai-providers.service.spec.ts`), сам скрипт остаётся непокрытым — это принятая в репозитории норма.

---

### 4. Per-type DTO validation с discriminated union

**Прецедента discriminator в `class-validator` в этом backend НЕТ.** Поиск по
`packages/backend/src` даёт только `@ValidateNested` + `@Type(() => Class)` без
`discriminator`/`keepDiscriminatorProperty`. Планировщику нужно спроектировать механизм явно
(ручной `switch` по `type` + `plainToInstance` + `validateSync`, либо `@Type` с `discriminator`),
а не «скопировать существующий».

**Что есть сейчас — дыра, которую закрывает D-09**
(`modules/routes/dto/route-action.dto.ts:69-83`):

```typescript
export class RouteActionDto {
  @IsString()
  id: string;

  @IsIn(ActionTypesList)
  type: string;

  @IsObject()
  params: Record<string, any>;   // ← D-09: заменяется на per-type union

  @IsObject()
  @ValidateNested()
  @Type(() => RouteActionConditionDto)
  condition: RouteActionConditionDto;
}
```

**Максимально близкая существующая конструкция — вложенный массив DTO**
(`route-action.dto.ts:104-108`), её и надо тиражировать на per-type классы:

```typescript
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteActionDto)
  actions?: RouteActionDto[];
```

**Прецедент кастомного валидатора** (нужен для значений вида `string | string[]`) —
`route-action.dto.ts:39-53`:

```typescript
@ValidatorConstraint({ name: 'isDialstatusOrArray', async: false })
class IsDialstatusOrArrayConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') return ValidDialstatuses.includes(value);
    if (Array.isArray(value)) {
      return value.every((item) => typeof item === 'string' && ValidDialstatuses.includes(item));
    }
    return false;
  }

  defaultMessage(): string {
    return 'dialstatus must be a valid status or array of valid statuses';
  }
}
```

**Источник union на стороне типов** уже существует и переиспользуется
(`packages/shared/src/types/route.types.ts:146-176`) — DTO должны повторять именно его состав:

```typescript
export type DialplanAction = BaseRouteAction & (
  | { type: 'totrunk'; params: ITrunkActionParams }
  | { type: 'toexten'; params: IExtenActionParams }
  | { type: 'toqueue'; params: IQueueActionParams }
  | { type: 'togroup'; params: IGroupActionParams }
  ...
  | { type: 'hangup'; params: Partial<Record<string, never>> }
);
```

---

### 5. Reducer-style состояние редактора (`useChainEditor`)

**Прецедента `useReducer` в `packages/frontend/src` нет; прецедента undo/history-стека — тоже нет.**
Все редакторы списков — `useState` у родителя + пересборка массива. `patchResult.undo()` из RTK
(паттерн 7) — это откат серверной мутации, а не отмена локального действия; переиспользовать
механику нельзя, но её формулировку «оптимистично применили → откатили» стоит сохранить.

**Ближайший владелец списка — текущий редактор** (`features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor.tsx:53-96`).
Именно эти четыре операции переезжают в хук; сигнатура `updateAction(id, field, value)` по D-06 заменяется:

```typescript
  const addAction = useCallback(() => {
    const newAction: IRouteAction = {
      id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: '' as ActionType,
      params: {},
      condition: { dialstatus: '' },
    };
    onChange([...actions, newAction]);
  }, [actions, onChange]);

  const removeAction = useCallback((id: string) => {
    onChange(actions.filter((a) => a.id !== id));
  }, [actions, onChange]);

  const updateAction = useCallback((id: string, field: string, value: any) => {
    onChange(actions.map((a) => {
      if (a.id !== id) return a;
      if (field === 'type') {
        const config = dialplanAppsRegistry[value as ActionType];
        return { ...a, type: value as ActionType, params: config?.defaultParams || {} };
      }
      if (field === 'params' && typeof value === 'object') {
        return { ...a, params: { ...a.params, ...value } };
      }
      ...
    }));
  }, [actions, onChange]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id && over) {
      const oldIndex = actions.findIndex((a) => a.id === active.id);
      const newIndex = actions.findIndex((a) => a.id === over.id);
      onChange(arrayMove(actions, oldIndex, newIndex));
    }
  };
```

DnD-обвязка, которую хук должен сохранить (`DialplanAppsEditor.tsx:46-51`, `:100-105`):

```typescript
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  // …
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={actions.map(a => a.id)} strategy={verticalListSortingStrategy}>
```

**Контракт «список принадлежит родителю»** сохраняется у всех хостов
(`features/routes/ui/RouteFormModal/RouteActionsTab.tsx:73-75`) — D-14 расширяет props, но не
переносит владение состоянием в редактор:

```typescript
      {editorMode === 'table' && (
        <DialplanAppsEditor actions={actions} onChange={setActions} />
      )}
```

---

### 6. `shared/ui Sheet` и вложенные overlay

**Аналог для `StepSheet` — `features/callcenter/ui/ContactBookForm/ContactBookForm.tsx:148-245`:**
Sheet-форма и подтверждающий Dialog объявлены **соседями** в одном фрагменте, а не вложенно:

```tsx
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="max-w-md">
          <SheetHeader>
            <SheetTitle>…</SheetTitle>
          </SheetHeader>
          …
          <SheetFooter className={styles.footer}>…</SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog … >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('common.delete', 'Delete')}</DialogTitle>
          </DialogHeader>
          …
        </DialogContent>
      </Dialog>
```

**Правка `Sheet.tsx` под `side` (D-02, мобильный `side="bottom"`)** — менять надо ровно две строки
класса (`shared/ui/Sheet/Sheet.tsx:32-41`); всё остальное (Portal, Overlay, Close) не трогать:

```tsx
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-y-0 right-0 layer-modal h-full w-[480px] max-sm:w-full border-l border-border bg-background p-6 shadow-lg duration-200',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
        'flex flex-col gap-4 overflow-hidden',
        className,
      )}
```

**Про 3-уровневую вложенность (открытый вопрос UI-SPEC).** Прецедента «overlay внутри Dialog внутри
Dialog» в кодовой базе нет. Максимум, что есть — 2 уровня: `SoftphoneWidget.tsx` рендерит
`SoftphoneContacts` (`:758`) и собственные `SheetContent` (`:766`, `:826`), а `SoftphoneContacts`
уже поднимает `ContactBookForm` со своим Sheet + Dialog. При этом **все overlay сидят на одном
z-слое** (`shared/ui/Sheet/Sheet.tsx:18` — `layer-modal`; `app/styles/globals.css:57,73`):

```css
  --z-index-modal: 50;
  …
.layer-modal    { z-index: var(--z-index-modal); }
```

То есть порядок наложения определяется исключительно порядком порталов в DOM, а не z-index —
это и есть подтверждение Pitfall 10 из RESEARCH. Эскалации z-index для вложенных overlay в проекте
не существует, её пришлось бы вводить впервые.

---

### 7. Optimistic toggle через RTK `onQueryStarted` + undo (обязателен для D-17)

**Канонический экземпляр** — `shared/api/endpoints/callCenterApi.ts:527-550`
(второй такой же — `:558-576`, матрица уведомлений):

```typescript
    /** D-05/D-06/09-14: persist own ui_visibility/softphone_placement (server rejects locked keys). */
    updateMyUiCustomization: build.mutation<IUiCustomization, Partial<{ ui_visibility: IUiVisibility; softphone_placement: SoftphonePlacement }>>({
      query: (body) => ({ url: '/callcenter/settings/operator/ui', method: 'PUT', body }),
      /** Optimistic: Switch/Select flip immediately; undo on failure (ARCHITECTURE: optimistic toggles). */
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          callCenterApi.util.updateQueryData('getMyUiCustomization', undefined, (draft) => {
            if (arg.ui_visibility) {
              draft.ui_visibility = { ...draft.ui_visibility, ...arg.ui_visibility };
            }
            if (arg.softphone_placement !== undefined) {
              draft.softphone_placement = arg.softphone_placement;
            }
          }),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(
            callCenterApi.util.updateQueryData('getMyUiCustomization', undefined, () => data),
          );
        } catch {
          patchResult.undo();
        }
      },
    }),
```

Три обязательных элемента: патч кэша до запроса → замена кэша ответом сервера при успехе →
`patchResult.undo()` в `catch`. Вариант с тостом об ошибке — `callCenterApi.ts:667-671`.

**Форма-хост для тенантных настроек (Surface J)** —
`features/callcenter/ui/ShiftPolicyForm/ShiftPolicyForm.tsx:14-67`: дефолты + нормализация ответа +
RBAC-гейт + skeleton/error-состояния:

```typescript
const DEFAULT_POLICY: IShiftPolicy = { max_duration_min: 0, close_at_eod: false, … };

function normalizePolicy(raw: IShiftPolicy | null | undefined): IShiftPolicy {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_POLICY };
  return {
    max_duration_min: Number(raw.max_duration_min) >= 0 ? Number(raw.max_duration_min) : 0,
    …
  };
}

export function ShiftPolicyForm() {
  const level = useAppSelector(selectUserLevel);
  const canEdit = level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN;
  const { data, isLoading, isError, refetch } = useGetTenantSettingsQuery();
  const [update, { isLoading: isSaving }] = useUpdateTenantSettingsMutation();
  const [policy, setPolicy] = useState<IShiftPolicy>({ ...DEFAULT_POLICY });

  useEffect(() => {
    if (!data) return;
    setPolicy(normalizePolicy(data.shift_policy));
  }, [data]);
```

---

### 8. RTK Query API slice + `tagTypes` invalidation

**Аналог** — `shared/api/endpoints/callGroupApi.ts:33-75` (полный CRUD, теги, именованные хуки):

```typescript
const callGroupApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    getCallGroups: build.query<ICallGroup[], void>({
      query: () => '/call-groups',
      providesTags: ['CallGroups'],
    }),
    getCallGroup: build.query<ICallGroup, number>({
      query: (uid) => `/call-groups/${uid}`,
      providesTags: (_r, _e, uid) => [{ type: 'CallGroups', id: uid }],
    }),
    createCallGroup: build.mutation<ICallGroup, ICreateCallGroup>({
      query: (body) => ({ url: '/call-groups', method: 'POST', body }),
      invalidatesTags: ['CallGroups'],
    }),
    …
  }),
});

export const {
  useGetCallGroupsQuery,
  useCreateCallGroupMutation,
  …
} = callGroupApi;
```

**Регистрация новых тегов** — единственный массив, правится в одну строку
(`shared/api/rtkApi.ts:98`): к нему добавляются `'TenantSettings'` и (для W7) `'Voicemail'`.

---

### 9. Tenant-scoped внешний провайдер с шифрованным ключом (D-57, `llm-summary.service.ts`)

**Шифрование ключа** — `modules/ai-agents/util/secret-cipher.util.ts:1-43` (AES-256-GCM,
`scrypt(CC_AI_KEY_SECRET)`, base64 `iv||tag||ct`). Новый клиент **обязан** читать ключ через
`decryptSecret`, а не хранить его в открытом виде:

```typescript
const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const SCRYPT_SALT = Buffer.from('krsk-ai-providers-v1');

function getKey(): Buffer {
  const secret = process.env.CC_AI_KEY_SECRET || '__krsk_dev_unsafe_key__';
  return scryptSync(secret, SCRYPT_SALT, 32);
}

export function encryptSecret(plain: string): string {
  if (!plain) return '';
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}
```

**Сервис-владелец записи провайдера** — `modules/ai-agents/ai-providers.service.ts:24-78`:
глобальные шаблоны (`user_uid = 0`) видны всем, но правит тенант только свои строки;
ключ шифруется на write, пустая строка = «ключ снят»:

```typescript
  /** List providers visible to the tenant: own rows + global templates. */
  async findAll(userUid: number) {
    return this.model.findAll({
      where: { user_uid: { [Op.in]: [0, userUid] } },
      order: [['user_uid', 'ASC'], ['name', 'ASC']],
    });
  }

  async update(id: number, dto: UpdateAiProviderDto, userUid: number) {
    // Globals are read-only for tenants
    const row = await this.model.findOne({ where: { uid: id, user_uid: userUid } });
    if (!row) throw new NotFoundException('Provider not found (or read-only global template)');

    const patch: any = { ...dto };
    delete patch.apiKey;
    if (typeof dto.apiKey === 'string' && dto.apiKey.length > 0) {
      patch.encrypted_api_key = encryptSecret(dto.apiKey);
    } else if (dto.apiKey === '') {
      patch.encrypted_api_key = '';
    }
    await row.update(patch);
    return row;
  }
```

**Тест такого сервиса** — `ai-providers.service.spec.ts:10-60` (модель мокается `jest.fn`,
проверяется *сохранённая форма*, а не поведение Sequelize):

```typescript
describe('AiProvidersService', () => {
  let model: any;
  let service: AiProvidersService;

  beforeEach(() => {
    model = { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() };
    service = new AiProvidersService(model);
  });

    it('encrypts the apiKey, defaults auth_type to bearer, marks enabled', async () => {
      …
      expect(persisted.user_uid).toBe(7);
      expect(persisted.encrypted_api_key).not.toBe('sk-secret');
      expect(decryptSecret(persisted.encrypted_api_key)).toBe('sk-secret');
    });
```

**HTTP-клиент наружу** делается через `HttpModule.register({ timeout: 10_000 })`
(`notifications.module.ts:20`) — отдельного LLM-клиента в репозитории нет.

---

### 10. Токен для не-сессионных ссылок (D-59)

**Прецедента JWT с кастомным `audience` НЕТ.** Единственный `audience` в проекте задан глобально
(`modules/auth/auth.module.ts:37-39`) и применяется ко всем токенам сессии:

```typescript
          expiresIn: config.get('JWT_EXPIRES_IN', '2h') as any,
          issuer: 'krasterisk-v4',
          audience: 'krasterisk-v4-client',
```

Ближайшее к «второму типу JWT» — короткоживущий impersonation-токен
(`modules/cloud-admin/tenants.service.ts:291`, `expiresIn: '30m'` + доп. claim), но он остаётся в
той же аудитории.

**Реально работающий прецедент «ссылка без сессии» — opaque-токен + отдельный guard.**
Это лучший аналог для voicemail-ссылок, чем JWT-audience.

Модель (`modules/callcenter/models/display-token.model.ts:3-42`):

```typescript
/**
 * Long-lived opaque display token for TV wallboard access (D-26).
 * Validated by DisplayTokenGuard — NOT JWT. Revocable via revoked_at.
 */
@Table({ tableName: 'cc_display_tokens', timestamps: false })
export class CcDisplayToken extends Model {
  /** Opaque hex string (NOT JWT) — 64 chars from randomBytes(32). */
  @Column({ type: DataType.STRING(64), allowNull: false })
  declare token: string;

  /** Optional expiry; NULL = no expiry. */
  @Column({ type: DataType.DATE, allowNull: true })
  declare expires_at: Date | null;

  /** Revocation stamp; NULL = active. */
  @Column({ type: DataType.DATE, allowNull: true })
  declare revoked_at: Date | null;
```

Guard (`modules/callcenter/guards/display-token.guard.ts:11-56`) — обратить внимание на
намеренный отказ от `sub`/`level` в `req.user`, чтобы утёкший токен не эскалировал права:

```typescript
/**
 * Separate auth branch from JwtAuthGuard: reads ?token= query param, looks up
 * cc_display_tokens, rejects revoked/expired rows.
 *
 * Pitfall 5: req.user is set WITHOUT level/sub so a leaked display token cannot
 * silently escalate if it ever hits a JWT-guarded endpoint.
 */
@Injectable()
export class DisplayTokenGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: any }>();
    const token = req.query?.token;
    if (!token || typeof token !== 'string') throw new UnauthorizedException('Display token required');

    const row = await this.displayTokenModel.findOne({ where: { token } });
    if (!row) throw new UnauthorizedException('Display token invalid');
    if (row.revoked_at != null) throw new UnauthorizedException('Display token revoked');
    if (row.expires_at != null && row.expires_at < new Date()) {
      throw new UnauthorizedException('Display token expired');
    }

    // Intentionally omit level/sub — display tokens must never impersonate a user
    req.user = { vpbx_user_uid: row.user_uid, isDisplayToken: true };

    row.update({ last_used_at: new Date() }).catch(() => undefined);
    return true;
  }
}
```

---

### 11. i18n: размещение ключей

Ресурсы — два TS-объекта, без JSON и без namespaces-плагина
(`shared/config/i18n.ts:4-14`):

```typescript
import { ru } from './locales/ru';
import { en } from './locales/en';

i18n.use(LanguageDetector).use(initReactI18next).init({
    resources: {
      ru: { translation: ru },
      en: { translation: en },
    },
    fallbackLng: 'ru',
```

Всё, что относится к редактору цепочки, живёт в существующем namespace `routes`
(`shared/config/locales/ru.ts:331`), подключи приложений — `routes.apps.<app>.<key>`
(например `features/dialplan-apps/ui/apps/NotifyApp/NotifyApp.tsx:104`,
`ui/apps/QueueApp/QueueApp.tsx:23`). Новый namespace заводить не нужно; для W7 добавляется
`voicemail`, для W6 — ключи внутри существующего `systemSettings` (`ru.ts:1829`).

Вызов всегда с fallback-строкой вторым аргументом:

```typescript
{t('routes.addAction', 'Добавить действие')}
```

---

## Shared Patterns

### Тенант-скоуп в контроллере

**Источник:** `modules/callcenter/callcenter-settings.controller.ts:38-66`
**Применять к:** всем новым контроллерам (`tenant-settings`, `voicemail`).

```typescript
@UseGuards(JwtAuthGuard)
@Controller('callcenter/settings')
export class CallCenterSettingsController {
  constructor(private readonly settingsService: CallCenterSettingsService) {}

  @Get('operator')
  getMyOperatorSettings(@Req() req: Request & { user: any }) {
    return this.settingsService.getOperatorSettings(
      req.user.vpbx_user_uid,
      req.user.sub,
    );
  }
```

Правила из шапки того же файла (`:1-21`), которые переносятся один в один: идентификатор субъекта
берётся из JWT, а не из тела запроса (IDOR); запись в тенантный singleton гейтится
`assertSupervisor` (`callcenter-rbac.util.ts`); exact-path маршруты регистрируются **до**
wildcard `:id`.

### Внутренний endpoint для Asterisk (api_key вместо JWT)

**Источник:** `modules/notifications/dialplan-notify.controller.ts:20-51`
**Применять к:** `voicemail-dialplan.controller.ts` и любому новому `CURL()`-приёмнику.

```typescript
@Controller('internal/dialplan')
export class DialplanNotifyController {
  private readonly apiKey: string;

  constructor(
    private readonly dispatcher: NotificationDispatcherService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('DIALPLAN_API_KEY') || '';
  }

  @Post('notify')
  @HttpCode(200)
  async notify(
    @Headers('x-api-key') headerKey: string,
    @Body() body: NotifyDialplanDto & { api_key?: string },
  ) {
    const providedKey = headerKey || body.api_key;
    if (this.apiKey && providedKey !== this.apiKey) {
      this.logger.warn('Unauthorized dialplan notify attempt');
      throw new UnauthorizedException('Invalid API key');
    }

    this.dispatcher.dispatch(body).catch((e) => this.logger.error(`notify dispatch failed: ${e?.message ?? e}`));
    return { accepted: true };
  }
}
```

Парная сторона в генераторе (`shared/utils/dialplan.util.ts:332-345`) — как формируется вызов:

```typescript
      case 'notify': {
        // D-12: Set(__KNOTIFY_*) + CURL → /internal/dialplan/notify (sendmail pattern)
        const message = this.sanitizeTemplate(params.message);
        const url = `${this.backendBaseUrl}/internal/dialplan/notify`;
        const keyParam = this.dialplanApiKey ? `&api_key=${encodeURIComponent(this.dialplanApiKey)}` : '';
        const lines = [
          `${wrapper}Set(__KNOTIFY_MSG=${message})${closing}`,
          `Set(__KNOTIFY_TARGET=${target})`,
          `Set(NOTIFY_RESULT=\${CURL(${url},integration_uid=${integrationUid}&message=\${URIENCODE(\${KNOTIFY_MSG})}&…${keyParam})})`,
        ];
        dp = lines.join('\nsame => n,');
        break;
      }
```

Обратить внимание: многострочные действия склеиваются через `'\nsame => n,'`, и `wrapper/closing`
навешиваются **только на первую строку** — это Pitfall 3 из RESEARCH, который W1 должен устранить.

### Обёртка условия и санитайзеры генератора

**Источник:** `shared/utils/dialplan.util.ts:110-135`
**Применять к:** `dialplan-condition.util.ts` и всем per-app эмиттерам.

```typescript
  static actionToDialplan(
    action: any,
    vpbxUserUid: number,
    isAdmin: boolean = false,
    wh: Record<string, any> = {},
  ): string {
    const { type, params = {}, condition = {} } = action;
    let dp = '';
    let wrapper = '';
    let closing = '';

    // Condition wrapper (DIALSTATUS) — whitelist + OR-join for arrays (D-19)
    const statuses: string[] = Array.isArray(condition.dialstatus)
      ? condition.dialstatus
      : condition.dialstatus ? [condition.dialstatus] : [];
    if (!Array.isArray(condition.dialstatus) && condition.dialstatus
        && !VALID_DIALSTATUSES.includes(condition.dialstatus)) {
      return `NoOp(Invalid dialstatus: ${this.sanitizeDialplanInput(condition.dialstatus)})`;
    }
    const valid = statuses.filter((s) => VALID_DIALSTATUSES.includes(s));
    if (valid.length) {
      const expr = valid.map((s) => `"\${DIALSTATUS}" = "${s}"`).join(' | ');
      wrapper = `ExecIf($[${expr}]?`;
      closing = ')';
    }
```

Санитайзеры выбираются по типу приёмника: `sanitizeDialplanInput` — для аргументов приложений,
`sanitizeShellInput` — для `System()`/`SHELL()` (`dialplan.util.ts:287`, `:306`),
`sanitizeTemplate` — для пользовательских шаблонов с `${...}` (`:334-335`).

### Тенант-скоуп цели набора (D-21)

**Источник:** `shared/utils/dialplan.util.ts:155-186`
**Применять к:** `dialplan-target.util.ts` — это единственное место, откуда `normalizeTarget`
должен звать `pjsipDialTarget`.

```typescript
      case 'toexten': {
        // PJSIP: primary e{ext}_{uid} + optional WebRTC companion ew{ext}_{uid} (fork)
        const webrtc = params.webrtc !== false && params.webrtc !== 'false';
        let dialTarget: string;
        if (params.useExten) {
          dialTarget = this.pjsipDialTarget('${EXTEN}', vpbxUserUid, { webrtc });
        } else {
          const rawExten = this.sanitizeDialplanInput(params.exten) || '';
          if (!rawExten) { dp = ''; break; }
          dialTarget = rawExten.includes('/')
            ? rawExten
            : this.pjsipDialTarget(rawExten, vpbxUserUid, { webrtc });
        }
```

Контрпример, который W1 обязан починить (`dialplan.util.ts:188-197`) — `toqueue` подставляет
`${EXTEN}` без нормализации:

```typescript
      case 'toqueue': {
        const queue = this.sanitizeDialplanInput(params.queue) || '${EXTEN}';
        …
        dp = `${wrapper}Queue(${queue},${options},,,${timeout})${closing}`;
```

### Характеризационные тесты генератора (W0)

**Источник:** `shared/utils/dialplan.util.spec.ts:3-51`
**Применять к:** всем 22 непокрытым ветвям перед их изменением.

```typescript
describe('AsteriskDialplanUtils.actionToDialplan', () => {
  const vpbx = 42;

  describe('DIALSTATUS condition wrapper', () => {
    it('wraps a single valid dialstatus in ExecIf', () => {
      const dp = AsteriskDialplanUtils.actionToDialplan(
        { type: 'busy', params: {}, condition: { dialstatus: 'ANSWER' } },
        vpbx,
      );
      expect(dp).toBe('ExecIf($["${DIALSTATUS}" = "ANSWER"]?Busy(10))');
    });
```

Форма — точное строковое сравнение `toBe` на полный вывод. Это и есть требуемый Wave 0:
зафиксировать текущий вывод посимвольно, потом рефакторить.

### Стриминг медиафайла с Range + защита пути (W7)

**Источник:** `modules/reports/cdr/cdr.service.ts:303-310` и `:433-507`
**Применять к:** `voicemail.service.ts` / `voicemail.controller.ts`.

```typescript
  private safeRecordFilePath(basePath: string, record: string): string | null {
    const rel = record.replace(/^\/+/, '').replace(/\\/g, '/');
    if (!rel || rel.includes('..')) return null;
    const baseResolved = path.resolve(basePath);
    const fileResolved = path.resolve(baseResolved, `${rel}.mp3`);
    if (!fileResolved.startsWith(baseResolved)) return null;
    return fs.existsSync(fileResolved) ? fileResolved : null;
  }
```

```typescript
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Accept-Ranges', 'bytes');

    const rangeHeader = req?.headers?.range;
    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
      if (!match) { res.status(416).setHeader('Content-Range', `bytes */${fileSize}`); res.end(); return; }
      …
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunkSize);
      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', () => { if (!res.headersSent) res.status(404).end(); });
      stream.pipe(res);
      return;
    }
```

Расширение `.mp3` здесь захардкожено (`:307`) — это Pitfall 7 из RESEARCH: файлы `Record()` имеют
другое расширение, копировать метод дословно нельзя, расширение должно стать параметром.

### Видимость записи по access-list (W7, вкладка CDR)

**Источник:** `modules/reports/cdr/cdr-access-scope.ts:39-100`
**Применять к:** `voicemail.controller.ts` — список голосовых сообщений обязан фильтроваться тем же
скоупом, что и CDR.

```typescript
export function isCdrUnrestricted(scope: …): boolean {
  return scope.operators.length === 0
    && scope.queues.length === 0
    && (scope.operatorUserIds?.length ?? 0) === 0;
}

export function buildCdrAccessClause(
  alias: string,
  tenantId: number,
  scope: CdrAccessScope,
): { sql: string; replacements: Record<string, string> } | null {
  if (isCdrUnrestricted(scope)) return null;

  const parts: string[] = [];
  const replacements: Record<string, string> = {};
  const extens = new Set(scope.operators);
  if (scope.ownExten) extens.add(normalizeAccessToken(scope.ownExten));
  …
}
```

### Frontend: unit-тест чистой функции

**Источник:** `features/callcenter/lib/displayLabels.test.ts:1-33`
**Применять к:** `lib/summarize.test.ts`, `lib/optionsString.test.ts`, `lib/validateAction.test.ts`.

```typescript
import { describe, it, expect } from 'vitest';
import { agentDisplayName, isRawAgentName, … } from './displayLabels';

const identityT = (key: string, fallback?: string) => fallback ?? key;

describe('displayLabels', () => {
  it('detects raw PJSIP names', () => {
    expect(isRawAgentName('PJSIP/ew112_0', 'PJSIP/ew112_0')).toBe(true);
  });
```

Frontend — `vitest` с явным импортом `describe/it/expect`; backend — `jest` с глобалами.
`summarize` принимает `t` параметром (как `identityT` выше), чтобы тест не поднимал i18n.

### Реестр как источник метаданных

**Источник:** `features/dialplan-apps/model/registry.ts:17-53` и `model/types.ts:6-24`
**Применять к:** расширению `IDialplanAppConfig` полями `schema`, `summarize`, `terminal`,
`allowedIn`, `optionFlags` (D-07).

```typescript
export const dialplanAppsRegistry: Record<ActionType, IDialplanAppConfig> = {
  // --- TELEPHONY & MEDIA ---
  totrunk: { type: 'totrunk', labelKey: 'routes.action.totrunk', component: TrunkApp, category: 'telephony', defaultParams: { trunk: '', dest: '${EXTEN}', timeout: 60, options: 'tT' } },
  toexten: { type: 'toexten', labelKey: 'routes.action.toexten', component: ExtenApp, category: 'telephony', defaultParams: { exten: '', timeout: 60, options: 'tThH' } },
  …
};

/** Ensure the runtime keys ordered logically for Select menus */
export const ACTION_TYPES_LIST = Object.values(dialplanAppsRegistry);
```

```typescript
export interface IDialplanAppProps {
  action: IRouteAction;
  /** Callback to update a specific parameter inside `action.params` or `action.type` etc. */
  onUpdate: (id: string, field: string, value: any) => void;   // ← D-06: → { params, onChange }
}
```

### Строка шага: что переносится в `StepRow`

**Источник:** `features/dialplan-apps/ui/SortableActionItem/SortableActionItem.tsx:35-49`, `:76-97`
**Применять к:** `ui/StepRow/`. Логику `useSortable` сохранить дословно; Tailwind-классы
(`bg-black/20`, `border-white/10`, `text-white/40`) заменить на SCSS-модуль с `var(--color-*)`
согласно UI-SPEC и frontend ARCHITECTURE.

```tsx
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: action.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };
```

```tsx
      <VStack gap="2" align="center" className="w-[30px] opacity-70 shrink-0">
        <Tooltip content={t('routes.tooltips.dragHandle', 'Перетащите для изменения порядка выполнения')}>
          <Flex {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing …">
            <GripVertical className="w-5 h-5" />
          </Flex>
        </Tooltip>
        <Text variant="muted">{idx + 1}</Text>
      </VStack>
```

---

## No Analog Found

Планировщику придётся проектировать эти вещи с нуля (или по `12-RESEARCH.md` → `## Code Examples`),
а не «по образцу из репозитория»:

| Файл / механизм | Роль | Data flow | Почему нет аналога |
|---|---|---|---|
| Discriminated-union DTO (`dto/dialplan-params/*`) | dto | request-response | В `packages/backend/src` нет ни одного `discriminator` / `keepDiscriminatorProperty`; есть только `@ValidateNested` + `@Type` для однородных массивов |
| Undo / history-стек в `useChainEditor` | hook | transform | В `packages/frontend/src` нет ни `useReducer`, ни истории изменений; `patchResult.undo()` из RTK — откат серверной мутации, другая механика |
| Буфер обмена шага (copy/paste, D-13) | hook | transform | Есть дублирование сущности целиком (`routes.duplicate` / `routes.copyRoute`, `ru.ts:335-336`), дублирования элемента внутри списка нет |
| 3-уровневая вложенность overlay (UI-SPEC, открытый вопрос) | component | — | Максимум в проекте — 2 уровня, и все overlay на одном слое `layer-modal` (z-index 50); эскалации z-index не существует |
| JWT со вторым `audience` (D-59) | service | request-response | Единственный `audience` задан глобально (`auth.module.ts:39`); заменяющий прецедент — opaque-токен + `DisplayTokenGuard` |
| `wav-pcm.util.ts` (WAV → PCM16, D-57) | utility | transform | Обработки аудиоформатов в backend нет вообще |
| HTTP-клиент LLM (`llm-summary.service.ts`, D-57) | service | request-response | Есть только реестр провайдеров (`CcAiProvider`) и `HttpModule` в `notifications`; клиента к LLM нет |

---

## Metadata

**Analog search scope:**
`packages/backend/src/modules/{notifications,ai-agents,callcenter,call-groups,routes,reports/cdr,stt-engines,auth,cloud-admin,system-settings}`,
`packages/backend/src/shared/utils`, `packages/backend/src/app.module.ts`,
`packages/frontend/src/{features,shared,widgets,app}`, `packages/shared/src/types`.

**Ключевые аналоги (5):** `modules/notifications/*` (scaffold нового модуля),
`modules/ai-agents/*` (tenant-scoped внешний провайдер + шифрование + spec),
`modules/callcenter/{models,guards,callcenter-settings.controller.ts}` (тенантные настройки, токен-guard),
`modules/reports/cdr/*` (стриминг файла + access-scope),
`features/dialplan-apps/*` + `shared/api/endpoints/callCenterApi.ts` (frontend-редактор и optimistic toggles).

**Files scanned:** ~55 прочитано целиком или таргетированными диапазонами; ~20 обследовано через Grep.

**Pattern extraction date:** 2026-08-18
