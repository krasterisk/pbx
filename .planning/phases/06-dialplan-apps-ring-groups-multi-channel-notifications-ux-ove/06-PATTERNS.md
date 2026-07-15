# Phase 6: Dialplan Apps — ring groups, multi-channel notifications, UX overhaul - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 34 new/modified (backend 15, shared 3, frontend 16)
**Analogs found:** 33 / 34 (1 partial — generic webhook provider has no direct analog)

> Consumed by `gsd-planner`. Each new file below names its closest existing analog (full path + line refs) with a short real excerpt to mirror. Read-only analysis — no source edits.

---

## File Classification

### Backend — call-groups module (NEW, analog: `queues/`)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `modules/call-groups/call-group.model.ts` | model | CRUD | `modules/queues/queue.model.ts` | exact |
| `modules/call-groups/call-group-member.model.ts` | model | CRUD | `modules/queues/queue-member.model.ts` | exact |
| `modules/call-groups/call-groups.service.ts` | service | CRUD + apply | `modules/queues/queues.service.ts` | exact |
| `modules/call-groups/call-groups.controller.ts` | controller | request-response | `modules/queues/queues.controller.ts` | exact |
| `modules/call-groups/call-group-dialplan.util.ts` | dialplan-util | transform | `modules/phonebooks/phonebook-dialplan.util.ts` + `time-groups.service.ts:generateDialplan` | exact |
| `modules/call-groups/call-groups.module.ts` | config | — | `modules/phonebooks/phonebooks.module.ts` (uses AmiModule→DialplanApplyService) | exact |
| `modules/call-groups/migrate-call-groups-phase6.ts` | migration | batch | `modules/phonebooks/migrate-phonebooks-phase5.ts` | exact |
| `modules/call-groups/*.spec.ts` | test | — | `phonebook-dialplan` / `queues.service` specs | role-match |

### Backend — notifications module (NEW, analog: `mailer/` + `ai-agents/`)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `modules/notifications/notification-integration.model.ts` | model | CRUD | `modules/ai-agents/models/ai-provider.model.ts` (encrypted col) | exact |
| `modules/notifications/notifications.service.ts` | service | CRUD (encrypt) | `modules/queues/queues.service.ts` + `secret-cipher.util.ts` | role-match |
| `modules/notifications/notifications.controller.ts` | controller | request-response | `modules/queues/queues.controller.ts` (JWT+tenant) | exact |
| `modules/notifications/notification-dispatcher.service.ts` | service | event-driven | `mailer.service.ts:sendNotification` (per-channel fan-out) | role-match |
| `modules/notifications/providers/telegram.provider.ts` | service | request-response | `mailer.service.ts` + axios (see Standard Stack) | role-match |
| `modules/notifications/providers/email.provider.ts` | service | request-response | `mailer.service.ts:sendNotification` | exact |
| `modules/notifications/providers/{whatsapp,max,vk}.provider.ts` | service | request-response | axios HTTP (RESEARCH Pattern 3 table) | role-match |
| `modules/notifications/providers/webhook.provider.ts` | service | request-response | (no analog — generic HTTP POST) | **none** |
| `modules/notifications/dialplan-notify.controller.ts` | controller | request-response | `mailer/dialplan-notify.controller.ts` | exact |
| `modules/notifications/notifications.module.ts` | config | — | `mailer/mailer.module.ts` + `queues.module.ts` | exact |
| `modules/notifications/*.spec.ts` | test | — | `phonebooks.service.spec` pattern | role-match |

### Backend — modified (dialplan generation + DTO + bug fixes)

| Modified File | Role | Data Flow | Analog (in-file pattern) | Match |
|---|---|---|---|---|
| `shared/utils/dialplan.util.ts` | dialplan-util | transform | own `sendmail`/`setclid_custom`/`togroup`/`hangup` cases | exact |
| `modules/routes/routes.service.ts` | service | transform | own `generateRouteDialplan` (bindings loop 260-263) | exact |
| `modules/routes/dto/route-action.dto.ts` | validation | — | own `RouteActionConditionDto` (14-35) | exact |

### Shared types (NEW + MODIFY)

| File | Role | Analog | Match |
|---|---|---|---|
| `packages/shared/src/types/call-group.types.ts` (NEW) | shared-types | `route.types.ts` + `phonebook.types.ts` | exact |
| `packages/shared/src/types/notification.types.ts` (NEW) | shared-types | `route.types.ts` | exact |
| `packages/shared/src/types/route.types.ts` (MODIFY: ActionType + dialstatus) | shared-types | own `ActionType` union (3-10) | exact |

### Frontend — dialplan-apps (NEW dedicated apps + registry)

| File | Role | Analog | Match |
|---|---|---|---|
| `features/dialplan-apps/ui/apps/GroupApp/GroupApp.tsx` (NEW) | dialplan-app-component | `apps/QueueApp/QueueApp.tsx` (Select + RTK query) | exact |
| `features/dialplan-apps/ui/apps/NotifyApp/NotifyApp.tsx` (NEW) | dialplan-app-component | `apps/QueueApp` + `apps/HangupApp` (InfoTooltip) | role-match |
| `features/dialplan-apps/ui/apps/CallerIdApp/CallerIdApp.tsx` (NEW) | dialplan-app-component | `apps/HangupApp` (mode Select) + `RoutePhonebooksTab` (mode-switch params) | role-match |
| `features/dialplan-apps/ui/apps/TrunkCarouselApp/TrunkCarouselApp.tsx` (NEW) | dialplan-app-component | `apps/TrunkApp` + `RoutePhonebooksTab` up/down list | role-match |
| `features/dialplan-apps/model/registry.ts` (MODIFY) | registry | own registry (13-43) | exact |
| `features/dialplan-apps/model/types.ts` (reference only) | shared-types | own `IDialplanAppProps` | exact |

### Frontend — call-groups + notifications features/pages (NEW, analog: `queues/`)

| File | Role | Analog | Match |
|---|---|---|---|
| `features/call-groups/ui/CallGroupsPage/…` (NEW) | page | `features/queues/ui/QueuesPage/QueuesPage.tsx` | exact |
| `features/call-groups/ui/CallGroupFormModal/…` (NEW) | form-modal | `features/queues/ui/QueueFormModal/QueueFormModal.tsx` | exact |
| `features/call-groups/ui/…MembersEditor` (NEW inline) | form-modal | `QueueFormModal` members block (566-649) + `RoutePhonebooksTab` up/down | exact |
| `features/notifications/ui/…Page + FormModal` (NEW) | page/form-modal | `features/queues/ui/*` | exact |
| `features/routes/ui/RouteFormModal/*` inline group editor (MODIFY) | form-modal | `RoutePhonebooksTab.tsx` (Select + create/edit sub-entity) | exact |
| `shared/api/endpoints/callGroupApi.ts` (NEW) | RTK-api | `shared/api/endpoints/queueApi.ts` | exact |
| `shared/api/endpoints/notificationApi.ts` (NEW) | RTK-api | `shared/api/endpoints/queueApi.ts` | exact |
| `shared/api/rtkApi.ts` (MODIFY: tagTypes) | RTK-api | own `tagTypes` (78) | exact |
| `shared/config/locales/{en,ru}.ts` (MODIFY) | config | existing `routes.action.*` / `routes.apps.*` keys | exact |

---

## Pattern Assignments

### `modules/call-groups/call-group.model.ts` (model, CRUD)

**Analog:** `packages/backend/src/modules/queues/queue.model.ts`

Tenant column pattern (note `field: 'vpbx_user_uid'` maps DB→`user_uid`). New table gets its own `uid` PK (autoincrement) unlike Queue which keys on `name`.

```120:121:packages/backend/src/modules/queues/queue.model.ts
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
```

For the `uid` autoincrement PK + ENUM strategy, mirror `ai-provider.model.ts`:

```12:19:packages/backend/src/modules/ai-agents/models/ai-provider.model.ts
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;
  @Column({ type: DataType.STRING(128), allowNull: false })
  declare name: string;
  @Column({ type: DataType.ENUM('online', 'local', 'custom'), allowNull: false })
  declare kind: 'online' | 'local' | 'custom';
```

Suggested columns: `uid`, `name`, `strategy ENUM('ringall','hunt','memoryhunt','random')`, `ring_time INT`, `external_context STRING`, optional `cid_prefix`, `user_uid` (tenant). `strategy`/`timeout` mirror `queue.model.ts:20-24`.

---

### `modules/call-groups/call-group-member.model.ts` (model, CRUD)

**Analog:** `packages/backend/src/modules/queues/queue-member.model.ts`

Members keyed by a group FK + ordering column. `queue-member` orders by `penalty` (see service reload `findOne`); call-group needs an explicit `position` + per-member `ring_time` (D-07).

```3:24:packages/backend/src/modules/queues/queue-member.model.ts
@Table({ tableName: 'queue_members_table', timestamps: false })
export class QueueMember extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER.UNSIGNED })
  declare uniqueid: number;
  @Column({ type: DataType.STRING(128), allowNull: false })
  declare queue_name: string;   // → call-group: call_group_uid INT (FK)
  @Column({ type: DataType.STRING(128), allowNull: false })
  declare interface: string;    // → call-group: member value (ext or external number)
  @Column({ type: DataType.INTEGER, allowNull: true, defaultValue: 0 })
  declare penalty: number;      // → call-group: position INT (order for hunt/memoryhunt)
```
Add: `member_type ENUM('internal','external')`, `ring_time INT`, `user_uid`.

---

### `modules/call-groups/call-groups.service.ts` (service, CRUD + apply)

**Analog:** `packages/backend/src/modules/queues/queues.service.ts` (transaction + destroy/bulkCreate + reload) **combined with** `DialplanApplyService` for apply.

**Transaction + members replace-all pattern** (mirror exactly for create/update/remove):

```128:163:packages/backend/src/modules/queues/queues.service.ts
    const transaction = await this.sequelize.transaction();
    try {
      const { members, advanced, exten, ...queueData } = dto;
      const fullData: any = { ...queueData, ...(advanced || {}), name: queueName, user_uid: vpbxUserUid };
      const queue = await this.queueModel.create(fullData, { transaction });
      if (members?.length) {
        await this.memberModel.bulkCreate(
          members.map(m => ({ ...m, queue_name: queueName, user_uid: vpbxUserUid })),
          { transaction },
        );
      }
      await transaction.commit();
      await this.reloadQueues();
      ...
    } catch (e) { await transaction.rollback(); throw e; }
```

**Update = destroy + bulkCreate members** (idempotent replace):

```202:216:packages/backend/src/modules/queues/queues.service.ts
      if (members !== undefined) {
        await this.memberModel.destroy({ where: { queue_name: name, user_uid: vpbxUserUid }, transaction });
        if (members.length) {
          await this.memberModel.bulkCreate(members.map(m => ({ ...m, queue_name: newQueueName, user_uid: vpbxUserUid })), { transaction });
        }
      }
```

**Tenant filter on every read** (RESEARCH Security V4):

```101:105:packages/backend/src/modules/queues/queues.service.ts
    const queue = await this.queueModel.findOne({ where: { name, user_uid: vpbxUserUid } });
    if (!queue) throw new NotFoundException(`Queue "${name}" not found`);
```

**Apply instead of `queue reload all`** — inject `DialplanApplyService` (exported by `AmiModule`), replace the `reloadQueues()` step with (RESEARCH Pattern 2):

```typescript
// call-groups.service.ts — after commit
private groupFile(vpbx: number) { return `krasterisk/groups/group_${vpbx}.conf`; }
async applyGroup(group, members, vpbx) {
  const category = generateGroupDialplan(group, members, vpbx); // {name:`group_${group.uid}_${vpbx}`, lines}
  await this.dialplanApplyService.applyCategories(this.groupFile(vpbx), [category], { reload: true });
}
// remove(): this.dialplanApplyService.deleteCategories(this.groupFile(vpbx), [`group_${uid}_${vpbx}`], { reload: true })
```

---

### `modules/call-groups/call-groups.controller.ts` (controller, request-response)

**Analog:** `packages/backend/src/modules/queues/queues.controller.ts` — copy verbatim (JWT guard + `req.user.vpbx_user_uid`), switch `:name` param to numeric `:uid`.

```16:34:packages/backend/src/modules/queues/queues.controller.ts
@UseGuards(JwtAuthGuard)
@Controller('queues')
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}
  @Get()
  findAll(@Req() req: Request & { user: any }) {
    return this.queuesService.findAll(req.user.vpbx_user_uid);
  }
  @Post()
  create(@Body() dto: CreateQueueDto, @Req() req: Request & { user: any }) {
    return this.queuesService.create(dto, req.user.vpbx_user_uid);
  }
```

---

### `modules/call-groups/call-group-dialplan.util.ts` (dialplan-util, transform)

**Analog:** `packages/backend/src/modules/phonebooks/phonebook-dialplan.util.ts` (returns `{name, lines[]}` category) + `time-groups.service.ts:generateDialplan` (context + `Return()` idiom).

**Category return shape + `Return()` termination** (mirror; NEVER emit `Hangup()` — Pitfall 1):

```43:89:packages/backend/src/modules/phonebooks/phonebook-dialplan.util.ts
export function generateBindingDialplan(...): GeneratedDialplanCategory {
  const lines: string[] = [];
  const ctxName = `pb_bind_${binding.uid}_${vpbxUserUid}`;
  lines.push(`[${ctxName}]`);
  lines.push(`exten => s,1,NoOp(PB binding ${binding.uid}: ...)`);
  ...
  lines.push('same => n,Return()');
  return { name: ctxName, lines };
}
```

**`start,1` + NoOp + `Return()` context idiom** (call groups use `start`, not `s`):

```62:77:packages/backend/src/modules/time-groups/time-groups.service.ts
    lines.push(`[tgroup_${timeGroup.uid}]`);
    lines.push(`exten => start,1,NoOp(TimeGroup: ${timeGroup.name})`);
    lines.push(`same => n,Set(__WORKTIME_${timeGroup.uid}=0)`);
    ...
    lines.push('same => n,Return()');
```

Category name MUST be `group_${group.uid}_${vpbx}` to match the `togroup` Gosub target (Pitfall 2). Member interfaces: internal → `PJSIP/e{ext}_{vpbx}`, external → `LOCAL/{num}@{group.external_context}`. Sanitize all values with `AsteriskDialplanUtils.sanitizeDialplanInput`. Strategy line templates: see RESEARCH Pattern 1 (ringall/hunt/memoryhunt/random) — each Dial step followed by `ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())`.

---

### `modules/call-groups/call-groups.module.ts` (config)

**Analog:** `packages/backend/src/modules/phonebooks/phonebooks.module.ts` — imports `AmiModule` (which `exports: [DialplanApplyService]`, verified `ami.module.ts:9`) so the service can apply group contexts.

```14:24:packages/backend/src/modules/phonebooks/phonebooks.module.ts
@Module({
  imports: [
    SequelizeModule.forFeature([RoutePhonebook, PhonebookEntry, RoutePhonebookBinding]),
    RoutesModule,
    AmiModule,
    ...
  ],
  controllers: [PhonebooksController, PhonebookLookupController],
  providers: [PhonebooksService, ...],
  exports: [PhonebooksService],
})
```

---

### `modules/call-groups/migrate-call-groups-phase6.ts` (migration, batch)

**Analog:** `packages/backend/src/modules/phonebooks/migrate-phonebooks-phase5.ts` — standalone script (no migration framework), `createTable(..., {ifNotExists})` + `addIndex` in try/catch + FK via raw `ALTER … ADD CONSTRAINT`.

```44:66:packages/backend/src/modules/phonebooks/migrate-phonebooks-phase5.ts
  await qi.createTable('route_phonebook_bindings', {
    uid:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    route_uid:     { type: DataTypes.INTEGER, allowNull: false },
    ...
    user_uid:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);
  try { await qi.addIndex('route_phonebook_bindings', ['user_uid'], { name: 'idx_pbb_user_uid' }); } catch (e) { ... }
  try {
    await sequelize.query('ALTER TABLE route_phonebook_bindings ADD CONSTRAINT fk_pbb_route FOREIGN KEY (route_uid) REFERENCES routes(uid) ON DELETE CASCADE');
  } catch (e) { ... }
```
Create: `call_groups`, `call_group_members` (FK `call_group_uid` → `call_groups.uid` ON DELETE CASCADE), `notification_integrations` (with `encrypted_credentials TEXT`). All get `user_uid INT NOT NULL DEFAULT 0` + index.

---

### `modules/notifications/notification-integration.model.ts` (model, CRUD)

**Analog:** `packages/backend/src/modules/ai-agents/models/ai-provider.model.ts` — encrypted-secret column + JSON config + tenant col.

```27:55:packages/backend/src/modules/ai-agents/models/ai-provider.model.ts
  @Column({ type: DataType.ENUM('bearer', 'api_key_header', 'none', 'custom'), allowNull: true, defaultValue: 'bearer' })
  declare auth_type: ...;
  /** Encrypted API key (AES-256, key from .env CC_AI_KEY_SECRET). */
  @Column({ type: DataType.TEXT, allowNull: true })
  declare encrypted_api_key: string;
  @Column({ type: DataType.JSON, allowNull: true })
  declare defaults: Record<string, any>;
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
```
Map: `channel ENUM('telegram','email','whatsapp','webhook','max','vk')`, `config JSON` (non-secret: default chat_id/phone_id/webhook url/payload template), `encrypted_credentials TEXT`, `user_uid`. RESEARCH Code Example (§Encrypted credentials model) gives the exact shape.

---

### `modules/notifications/notifications.service.ts` (service, CRUD + encrypt)

**Analog:** `queues.service.ts` (CRUD + tenant filter) + `secret-cipher.util.ts` (encrypt on save, decrypt only at send).

```24:42:packages/backend/src/modules/ai-agents/util/secret-cipher.util.ts
export function encryptSecret(plain: string): string {
  if (!plain) return '';
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, getKey(), iv);
  ...
  return Buffer.concat([iv, tag, enc]).toString('base64');
}
export function decryptSecret(blob: string): string { ... }
```
Rules (RESEARCH Pitfall 5): `encryptSecret(JSON.stringify(secrets))` on create/update; NEVER return decrypted secrets in CRUD responses (mask/strip); a separate `findByUidInternal(uid)` decrypts for the dispatcher only. Tenant filter `where:{user_uid}` + `delete dto.user_uid` (see `time-groups.service.ts:31`).

---

### `modules/notifications/dialplan-notify.controller.ts` (controller, request-response)

**Analog:** `packages/backend/src/modules/mailer/dialplan-notify.controller.ts` — internal endpoint, API-key from header or body, `@HttpCode(200)`.

```28:50:packages/backend/src/modules/mailer/dialplan-notify.controller.ts
  @Post('sendmail')
  @HttpCode(200)
  async sendMail(@Headers('x-api-key') headerKey: string, @Body() body: SendNotificationDto & { api_key?: string }) {
    const providedKey = headerKey || body.api_key;
    if (this.apiKey && providedKey !== this.apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }
    ...
    return this.mailerService.sendNotification(mailDto);
  }
```
New endpoint `@Post('notify')` — MUST return 200 immediately and dispatch async (Pitfall 4): `this.dispatcher.dispatch(body).catch(e => this.logger.error(...)); return { accepted: true };` (RESEARCH Pattern 3 endpoint snippet). `apiKey` from `configService.get('DIALPLAN_API_KEY')` (line 25).

---

### `modules/notifications/notification-dispatcher.service.ts` + `providers/*.provider.ts`

**Analog:** `mailer.service.ts:sendNotification` (per-channel send with try/catch, no throw) + axios (`@nestjs/axios` `HttpModule.register({timeout})`, RESEARCH Standard Stack).

```52:68:packages/backend/src/modules/mailer/mailer.service.ts
  async sendNotification(dto: SendNotificationDto): Promise<{ success: boolean }> {
    const { to, subject, text } = dto;
    try {
      await this.transporter.sendMail({ from: ..., to, subject: subject || '...', text: text || '' });
      this.logger.log(`Notification sent to ${to}`);
      return { success: true };
    } catch (e) {
      this.logger.error(`Failed to send notification to ${to}`, e);
      return { success: false };
    }
  }
```
- **email.provider.ts** — thin wrapper over `MailerService.sendNotification` (exact reuse).
- **telegram/whatsapp/max/vk.provider.ts** — axios POST per RESEARCH Pattern 3 request-shape table; decrypt creds via `notificationsService.findByUidInternal`; trim message to 4096; never log decrypted tokens.
- **webhook.provider.ts** — NO analog (generic POST to user URL + templated payload). Validate URL scheme http/https (RESEARCH Security SSRF row).
- **dispatcher** — `switch (integ.channel)` fan-out (RESEARCH Pattern 3 dispatcher snippet).

---

### `shared/utils/dialplan.util.ts` (MODIFY — new cases + bug fixes)

**Analog:** own existing cases.

**notify case** — model on `sendmail` (Set(__K*) + CURL(...URIENCODE...), `sanitizeTemplate` for user text):

```241:253:packages/backend/src/shared/utils/dialplan.util.ts
        const email = this.sanitizeTemplate(params.email);
        const subject = this.sanitizeTemplate(params.subject);
        const text = this.sanitizeTemplate(params.text);
        const url = `${this.backendBaseUrl}/internal/dialplan/sendmail`;
        const keyParam = this.dialplanApiKey ? `&api_key=${encodeURIComponent(this.dialplanApiKey)}` : '';
        const lines = [
          `${wrapper}Set(__KMAIL_TO=${email})${closing}`,
          ...
          `Set(MAIL_RESULT=\${CURL(${url},to=\${URIENCODE(\${KMAIL_TO})}&...${keyParam})})`,
        ];
        dp = lines.join('\nsame => n,');
```

**callerid case (static mode)** — model on `setclid_custom`:

```221:224:packages/backend/src/shared/utils/dialplan.util.ts
      case 'setclid_custom': {
        const callerid = this.sanitizeDialplanInput(params.callerid);
        dp = `${wrapper}Set(CALLERID(num)=${callerid})${closing}`;
```

**callerid case (setclid_list mode)** — preserve `exten_setclid.php` (D-14):

```226:229:packages/backend/src/shared/utils/dialplan.util.ts
      case 'setclid_list': {
        const listUid = this.sanitizeShellInput(String(params.list_uid || ''));
        dp = `${wrapper}ExecIf($["\${SHELL(/usr/scripts/exten_setclid.php "${listUid}" "\${CLIDNUM}")}" != ""]?Set(CALLERID(num)=\${SHELL(...)}))${closing}`;
```

**Bug fix — DIALSTATUS OR-join (Pitfall 6):** replace the single-string wrapper (lines 104-112) with array support:

```104:112:packages/backend/src/shared/utils/dialplan.util.ts
    if (condition.dialstatus) {
      if (!VALID_DIALSTATUSES.includes(condition.dialstatus)) {
        return `NoOp(Invalid dialstatus: ${this.sanitizeDialplanInput(condition.dialstatus)})`;
      }
      wrapper = `ExecIf($["\${DIALSTATUS}" = "${condition.dialstatus}"]?`;
      closing = ')';
    }
```
→ accept `string | string[]`, filter by `VALID_DIALSTATUSES`, join with ` | ` (RESEARCH Code Example "DIALSTATUS OR-join wrapper").

**Bug fix — hangup causecode (Pitfall 8):** `Hangup(${sanitizeDialplanInput(causecode)})` when non-empty:

```305:307:packages/backend/src/shared/utils/dialplan.util.ts
      case 'hangup':
        dp = `${wrapper}Hangup()${closing}`;
        break;
```

**togroup case** — already emits the correct Gosub; just ensure `params.group` is the group `uid`:

```180:184:packages/backend/src/shared/utils/dialplan.util.ts
      case 'togroup': {
        const group = this.sanitizeDialplanInput(params.group) || '${EXTEN}';
        dp = `${wrapper}Gosub(group_${group}_${vpbxUserUid},start,1)${closing}`;
      }
```

---

### `modules/routes/routes.service.ts` (MODIFY — time_group_uid emission, Pitfall 7)

**Analog:** own `generateRouteDialplan` — the phonebook-binding loop shows where to inject per-action guards; time-group guard uses `ExecIfTime` inline (RESEARCH Pitfall 7).

```299:304:packages/backend/src/modules/routes/routes.service.ts
      // --- Actions ---
      for (const action of actions) {
        const dp = AsteriskDialplanUtils.actionToDialplan(action, vpbxUserUid, isAdmin, wh);
        if (dp) lines.push(`same => n,${dp}`);
      }
```
Before the actions loop, collect distinct `action.condition.time_group_uid`, emit `Set(__WT_{uid}=0)` + `ExecIfTime(<interval>?Set(__WT_{uid}=1))` once per uid (interval format from `time-groups.service.ts:70-72`), then wrap each guarded action in `ExecIf($["${WT_{uid}}"="1"]?<app>)`. Requires passing TimeGroup intervals map into generation.

---

### `modules/routes/dto/route-action.dto.ts` (MODIFY — new types + array dialstatus, Pitfall 9/6)

**Analog:** own DTO.

```4:12:packages/backend/src/modules/routes/dto/route-action.dto.ts
const ActionTypesList = [
  'totrunk', 'toexten', 'toqueue', 'togroup', 'tolist',
  ...
  'setclid_custom', 'setclid_list',
  'sendmail', 'sendmailpeer', 'telegram',
  ...
];
```
Add `'notify'`, `'callerid'`, `'trunk_carousel'` here. And relax the condition:

```27:35:packages/backend/src/modules/routes/dto/route-action.dto.ts
export class RouteActionConditionDto {
  @IsOptional()
  @IsIn(ValidDialstatuses)
  dialstatus?: string;
  @IsOptional()
  @IsString()
  calendar?: string;
}
```
→ accept `string | string[]` (validate each against `ValidDialstatuses`) and add `@IsOptional() @IsNumber() time_group_uid?: number`.

---

### `packages/shared/src/types/route.types.ts` (MODIFY)

**Analog:** own union — add `'notify' | 'callerid' | 'trunk_carousel'` (RESEARCH Code Example "Add new action types").

```3:10:packages/shared/src/types/route.types.ts
export type ActionType =
  | 'totrunk' | 'toexten' | 'toqueue' | 'togroup' | 'tolist'
  | 'toivr' | 'toroute' | 'playprompt' | 'playback'
  | 'setclid_custom' | 'setclid_list'
  | 'sendmail' | 'sendmailpeer' | 'telegram'
  | ...
```
`dialstatus` is already `DialStatus | DialStatus[] | ''` (line 22) and `time_group_uid?` already present (line 23) — types are ready; keep in sync with DTO/registry. New param interfaces (`INotifyActionParams`, `ICallerIdActionParams`, `ITrunkCarouselActionParams`) follow the existing `I*ActionParams` shape (34-138).

---

### `packages/shared/src/types/call-group.types.ts` + `notification.types.ts` (NEW)

**Analog:** `route.types.ts` (interface + union style) and `phonebook.types.ts` (entity+binding pair). Define `ICallGroup`, `ICallGroupMember`, `RingStrategy = 'ringall'|'hunt'|'memoryhunt'|'random'`; `INotificationIntegration`, `NotificationChannel`. Export from `packages/shared/src/index` barrel like other type modules.

---

### `features/dialplan-apps/ui/apps/GroupApp/GroupApp.tsx` (NEW)

**Analog:** `packages/frontend/src/features/dialplan-apps/ui/apps/QueueApp/QueueApp.tsx` — Select fed by an RTK query, `onUpdate(action.id, 'params.X', value)`.

```10:29:packages/frontend/src/features/dialplan-apps/ui/apps/QueueApp/QueueApp.tsx
export const QueueApp: React.FC<IDialplanAppProps> = ({ action, onUpdate }) => {
  const { t } = useTranslation();
  const { data: queues = [] } = useGetQueuesQuery();
  return (
    <VStack gap="2" className="w-full">
      ...
      <Select value={action.params?.queue || ''} onChange={(e) => onUpdate(action.id, 'params.queue', e.target.value)}>
        <option value="">{t('routes.apps.queue.selectQueue', 'Выберите очередь')}</option>
        {queues.map((q) => (<option key={q.name} value={q.name}>{q.exten || q.name}...</option>))}
```
GroupApp: `useGetCallGroupsQuery()` + a "create/edit" button opening `CallGroupFormModal` inline (D-02); store `params.group = String(group.uid)` (Pitfall 2).

---

### `features/dialplan-apps/ui/apps/NotifyApp/NotifyApp.tsx` (NEW)

**Analog:** `QueueApp` (Select from `useGetNotificationsQuery()`) + `HangupApp` for the `InfoTooltip` + memo + option-mapping idiom (per-field hints, D-13).

```34:63:packages/frontend/src/features/dialplan-apps/ui/apps/HangupApp/HangupApp.tsx
export const HangupApp = memo(({ action, onUpdate }: IDialplanAppProps) => {
  const { t } = useTranslation();
  const causeCode = action.params?.causecode || '';
  ...
  return (
    <HStack gap="8" align="center" className="w-full">
      <Select value={causeCode} onChange={(e) => onUpdate(action.id, 'params.causecode', e.target.value)}>...</Select>
      <InfoTooltip text={t('routes.apps.hangup.tooltip', '...')} />
    </HStack>
  );
});
```
NotifyApp: integration Select + message template textarea + presets dropdown + optional `target` override.

---

### `features/dialplan-apps/ui/apps/CallerIdApp/CallerIdApp.tsx` (NEW, consolidates setclid_custom+setclid_list)

**Analog:** `HangupApp` (mode Select + memo) for chrome; `RoutePhonebooksTab.tsx` `BindingParamsFields` (293-452) for the "mode drives which params render" pattern.

```300:347:packages/frontend/src/features/routes/ui/RouteFormModal/RoutePhonebooksTab.tsx
  switch (normalizePhonebookBehaviorType(binding.behavior_type)) {
    case 'set_name': {
      ...
      const mode = params.fixed !== undefined ? 'fixed' : 'var';
      return (
        <VStack ...>
          <Select value={mode} onChange={(e) => setParams(...)}>
            <option value="var">...</option>
            <option value="fixed">...</option>
          </Select>
          {mode === 'var' ? <VarKeyField .../> : <Input .../>}
        </VStack>
      );
    }
```
CallerIdApp modes: static / phonebook (reuse phonebook Select) / setclid_list / carousel (pool list). Store `params.mode` + mode-specific params. Backend `callerid` case reads `params.mode`.

---

### `features/dialplan-apps/ui/apps/TrunkCarouselApp/TrunkCarouselApp.tsx` (NEW)

**Analog:** `apps/TrunkApp/TrunkApp.tsx` (trunk Select) + `RoutePhonebooksTab` up/down reorder pattern (108-120) for an ordered trunk list with per-trunk CID source (static | phonebook). List reorder handlers:

```108:120:packages/frontend/src/features/routes/ui/RouteFormModal/RoutePhonebooksTab.tsx
  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    const copy = [...bindings];
    [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
    setBindings(withPositions(copy));
  }, [bindings, setBindings]);
```

---

### `features/dialplan-apps/model/registry.ts` (MODIFY)

**Analog:** own registry — repoint `togroup`→`GroupApp`, add `notify`/`callerid`/`trunk_carousel`, keep GenericApp fallback for the rest (D-18).

```15:19:packages/frontend/src/features/dialplan-apps/model/registry.ts
  totrunk: { type: 'totrunk', labelKey: 'routes.action.totrunk', component: TrunkApp, category: 'telephony', defaultParams: { trunk: '', dest: '${EXTEN}', timeout: 60, options: 'tT' } },
  toqueue: { type: 'toqueue', labelKey: 'routes.action.toqueue', component: QueueApp, category: 'telephony', defaultParams: { queue: '', timeout: '', options: 'thH' } },
  togroup: { type: 'togroup', labelKey: 'routes.action.togroup', component: GenericApp, category: 'telephony' },
```
→ `togroup: { …, component: GroupApp, defaultParams: { group: '' } }`; add `notify`, `callerid`, `trunk_carousel` entries. `setclid_custom`/`setclid_list` can point to `CallerIdApp` (mode inferred) while keeping ids working.

---

### `features/call-groups/ui/CallGroupsPage` + `CallGroupFormModal` (NEW page + form-modal)

**Analog:** `features/queues/ui/QueuesPage/QueuesPage.tsx` (toolbar + Card + Table + Modal, redux slice `openCreateModal`) and `QueueFormModal/QueueFormModal.tsx` (tabbed modal, `modalMode: create|edit|copy`, members add/list/remove).

```11:46:packages/frontend/src/features/queues/ui/QueuesPage/QueuesPage.tsx
export const QueuesPage = () => {
  const dispatch = useAppDispatch();
  return (
    <motion.div ...>
      <VStack gap="16" max>
        <HStack justify="between" align="center" max>
          ...<Button onClick={() => dispatch(queuesPageActions.openCreateModal())}>...</Button>
        </HStack>
        <Card><CardContent className="p-0"><QueuesTable /></CardContent></Card>
        <QueueFormModal />
```

**Members editor** (add endpoint / custom + list + remove) — mirror QueueFormModal 566-649; strategy Select 456-471; reset-on-mode `useEffect` (134-222). Note: QueueFormModal uses interim Tailwind classes; per RESEARCH Project Constraints new features MUST use SCSS-modules + `@/shared/ui` (no raw `select/input/button`, no Tailwind). Use `Select`/`Input`/`Button` from `@/shared/ui` (as `RoutePhonebooksTab` does) rather than the raw `<select className="flex h-9…">` seen in QueueFormModal.

---

### `features/routes/ui/RouteFormModal/*` inline group editor (MODIFY)

**Analog:** `RoutePhonebooksTab.tsx` — canonical "Select existing sub-entity + add/edit inline within the route modal" (D-02). Add-row + list pattern:

```252:272:packages/frontend/src/features/routes/ui/RouteFormModal/RoutePhonebooksTab.tsx
        <Flex align="center" gap="8" wrap="wrap" className={cls.addRow}>
          <Select value={selectedPhonebook} onChange={(e) => setSelectedPhonebook(e.target.value)}>
            <option value="">{t('routes.phonebooks.selectPhonebook', ...)}</option>
            {phonebooks.map((pb) => (<option key={pb.uid} value={pb.uid}>{pb.name}</option>))}
          </Select>
          <Button type="button" onClick={handleAdd} disabled={!selectedPhonebook}>...</Button>
        </Flex>
```
For groups this appears inside `GroupApp` (Select group + "create/edit" button → `CallGroupFormModal`).

---

### `shared/api/endpoints/callGroupApi.ts` + `notificationApi.ts` (NEW RTK-api)

**Analog:** `packages/frontend/src/shared/api/endpoints/queueApi.ts` — `rtkApi.injectEndpoints`, `providesTags`/`invalidatesTags` per new tag.

```4:38:packages/frontend/src/shared/api/endpoints/queueApi.ts
const queueApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    getQueues: build.query<IQueue[], void>({ query: () => '/queues', providesTags: ['Queues'] }),
    getQueue: build.query<IQueueFull, string>({ query: (name) => `/queues/${encodeURIComponent(name)}`, providesTags: (_r,_e,name) => [{ type: 'Queues', id: name }] }),
    createQueue: build.mutation<IQueueFull, any>({ query: (body) => ({ url: '/queues', method: 'POST', body }), invalidatesTags: ['Queues'] }),
    updateQueue: build.mutation<...>({ ... invalidatesTags: ['Queues'] }),
    deleteQueue: build.mutation<...>({ ... invalidatesTags: ['Queues'] }),
  }),
});
```
Endpoints `/call-groups` and `/notifications`; use numeric `:uid` param.

---

### `shared/api/rtkApi.ts` (MODIFY — tagTypes)

**Analog:** own `tagTypes` array (78) — add `'CallGroups'`, `'Notifications'`.

```78:78:packages/frontend/src/shared/api/rtkApi.ts
  tagTypes: ['Endpoints', 'Contexts', 'Peers', 'Trunks', 'Queues', 'Routes', ..., 'AiChatSettings'],
```

---

## Shared Patterns

### Authentication (JWT CRUD + internal API key)
**Source:** `queues.controller.ts:16` (`@UseGuards(JwtAuthGuard)` + `req.user.vpbx_user_uid`) and `mailer/dialplan-notify.controller.ts:35-38` (`x-api-key` / `body.api_key` vs `DIALPLAN_API_KEY`).
**Apply to:** all new CRUD controllers (JWT) and `dialplan-notify.controller.ts` (API key).

### Tenant isolation
**Source:** `queues.service.ts:101-104` (`where:{ user_uid: vpbxUserUid }`) + `time-groups.service.ts:31` (`delete data.user_uid`).
**Apply to:** every read/write in `call-groups.service.ts`, `notifications.service.ts`. Model tenant column = `field: 'vpbx_user_uid'` (`queue.model.ts:120`) for Asterisk-realtime-adjacent tables, or plain `user_uid` for app tables (`ai-provider.model.ts:54` uses `field: 'vpbx_user_uid'`; phase5 migration uses plain `user_uid`).

### Dialplan apply (AMI UpdateConfig)
**Source:** `ami/dialplan-apply.service.ts` `applyCategories()` / `deleteCategories()` (exported by `AmiModule`, `ami.module.ts:9`).
**Apply to:** `call-groups.service.ts` group context CRUD (file `krasterisk/groups/group_{vpbx}.conf`). DO NOT re-implement the DelCat/NewCat/Append batch loop.

### Secret encryption
**Source:** `ai-agents/util/secret-cipher.util.ts` `encryptSecret`/`decryptSecret` (AES-256-GCM, `CC_AI_KEY_SECRET`).
**Apply to:** `notifications.service.ts` — encrypt on save, decrypt only in dispatcher; never in CRUD responses/logs.

### Dialplan value sanitization
**Source:** `dialplan.util.ts` `sanitizeDialplanInput` (41), `sanitizeTemplate` (70), `sanitizeShellInput` (31), `sanitizeFilePath` (51).
**Apply to:** every user value emitted into dialplan — group members/CID (`sanitizeDialplanInput`), notify message templates (`sanitizeTemplate`).

### Dialplan category shape + Return semantics
**Source:** `phonebook-dialplan.util.ts:43-89` (`{name, lines[]}`) + `time-groups.service.ts:62-77` (`[ctx]` + `NoOp` + `Return()`).
**Apply to:** `call-group-dialplan.util.ts` — always terminate `Return()`, never `Hangup()`.

### CURL → internal endpoint (fire from dialplan)
**Source:** `dialplan.util.ts` `sendmail` case (231-254): `Set(__K*)` + `CURL(url,params...URIENCODE...&api_key=...)`.
**Apply to:** `notify` case (async), phonebook-lookup reuse for callerid phonebook mode (`phonebook-dialplan.util.ts:60-61`).

### RTK Query endpoint + tags
**Source:** `queueApi.ts` (injectEndpoints, providesTags/invalidatesTags) + `rtkApi.ts:78` tagTypes.
**Apply to:** `callGroupApi.ts`, `notificationApi.ts` (+ register new tags).

### Ordered sub-list UI (up/down)
**Source:** `RoutePhonebooksTab.tsx:108-120` (handleMoveUp/Down + `withPositions`).
**Apply to:** call-group members editor, trunk-carousel trunk list, CID-carousel pool.

### FSD/UI constraints (RESEARCH Project Constraints)
SCSS-modules + `var(--color-*)`, `@/shared/ui` components (`Select`/`Input`/`Button`/`VStack`/`HStack`), no raw `div/select/input/button`, no Tailwind in features/pages, no em dash/emoji, i18n `ru`+`en`, integration tests for new feature components. `RoutePhonebooksTab.tsx` is the compliant reference (QueueFormModal uses interim Tailwind — do NOT copy its raw `<select>`/className styling).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `modules/notifications/providers/webhook.provider.ts` | service | request-response | No generic outbound-webhook client exists (inbound webhook controllers only). Build minimal axios POST + templated JSON payload; validate URL scheme (SSRF, RESEARCH Security). |

Partial analogs (mirror request-shape from RESEARCH Pattern 3 table, no in-repo precedent for the external API): `whatsapp.provider.ts`, `max.provider.ts`, `vk.provider.ts` — structure/error-handling copy `mailer.service.ts:sendNotification`; endpoint/auth/body from RESEARCH.

---

## Metadata

**Analog search scope:** `packages/backend/src/modules/{queues,phonebooks,mailer,ami,time-groups,ai-agents,routes}`, `packages/backend/src/shared/utils`, `packages/frontend/src/features/{queues,dialplan-apps,routes}`, `packages/frontend/src/shared/api`, `packages/shared/src/types`.
**Files scanned (read in full or targeted):** 24.
**Pattern extraction date:** 2026-07-15

## PATTERN MAPPING COMPLETE

**Phase:** 6 - Dialplan Apps — ring groups, multi-channel notifications, UX overhaul
**Files classified:** 34
**Analogs found:** 33 / 34

### Coverage
- Files with exact analog: 21
- Files with role-match analog: 12
- Files with no analog: 1 (generic webhook provider; 3 external-API providers are partial)

### Key Patterns Identified
- Entity+members CRUD is a 1:1 copy of `queues` (transaction + destroy/bulkCreate + tenant filter); group apply swaps `queue reload` for `DialplanApplyService.applyCategories` on `krasterisk/groups/group_{vpbx}.conf`.
- All dialplan sub-contexts return `{name, lines[]}` and MUST terminate `Return()` (phonebook-binding + time-group idiom); `togroup` Gosub already targets `group_{uid}_{vpbx}` — the only gap is generating that context.
- Multi-channel notify generalizes the `sendmail` case (Set(__K*) + CURL…URIENCODE) → generic `/internal/dialplan/notify` (async 200) → per-channel providers; credentials encrypted via `secret-cipher.util` (ai-provider model shape).
- Bug fixes are localized single-file switch edits: DIALSTATUS OR-join + array DTO, `time_group_uid` inline ExecIfTime guard, `Hangup(${causecode})`.
- Frontend: dedicated apps copy `QueueApp`/`HangupApp` chrome; pages/forms copy `queues` feature; inline sub-entity editing copies `RoutePhonebooksTab`; new features MUST use SCSS-modules + `@/shared/ui` (not QueueFormModal's interim Tailwind).

### File Created
`.planning/phases/06-dialplan-apps-ring-groups-multi-channel-notifications-ux-ove/06-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can reference each analog (path + line refs + excerpt) directly in PLAN.md action steps.
