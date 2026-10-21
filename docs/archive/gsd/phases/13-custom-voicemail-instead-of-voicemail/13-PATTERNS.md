# Phase 13: Custom voicemail instead of VoiceMail — Pattern Map

**Mapped:** 2026-09-02
**Files analyzed:** 52 (25 новых / 27 изменяемых)
**Analogs found:** 49 / 52 (3 без аналога — см. `## No Analog Found`)

Источник списка — `13-RESEARCH.md` → `### Recommended Project Structure` и `### Phase Requirements`;
решения — `13-CONTEXT.md` (D-54…D-74). UI — Surface L из `12-UI-SPEC.md`.
Предыдущая карта фазы 12 (`12-PATTERNS.md`) остаётся каноном для scaffold модуля и opaque-токена;
ниже — **актуальные** номера строк после Phase 12 (генератор, schema-driven editor, AI adapter).

---

## File Classification

### Backend-модуль `voicemail` (новый)

| Файл (N=новый, M=изменяемый) | Роль | Data flow | Ближайший аналог | Качество |
|---|---|---|---|---|
| `modules/voicemail/voicemail.module.ts` (N) | config | — | `directories/directories.module.ts:14-29` (+ `AiPlatformModule`) | exact |
| `modules/voicemail/voicemail-message.model.ts` (N) | model | CRUD | `notifications/notification-integration.model.ts:9-33` + `callcenter/models/display-token.model.ts:7-42` (`field: 'vpbx_user_uid'`) | exact |
| `modules/voicemail/voicemail-access-token.model.ts` (N) | model | CRUD | `callcenter/models/display-token.model.ts:3-42` | exact |
| `modules/voicemail/voicemail.service.ts` (N) | service | CRUD + file-I/O | `reports/cdr/cdr.service.ts:291-351,433-509` (resolver + Range; **не** копировать `.mp3`) | exact |
| `modules/voicemail/voicemail-scanner.service.ts` (N) | service | batch | `@Interval` — `callcenter-zombie.service.ts:40-50`; mutex — `callcenter-shift-janitor.service.ts:23-44` | exact |
| `modules/voicemail/voicemail-dialplan.controller.ts` (N) | controller | event-driven | shape `{accepted:true}` — `dialplan-notify.controller.ts:20-50`; key — `directory-lookup.controller.ts:76-80` (`timingSafeApiKeyEqual`) | exact |
| `modules/voicemail/voicemail.controller.ts` (N) | controller | request-response + streaming | `reports/cdr/cdr.controller.ts:18-144` (`JwtAuthGuard` + tenant из `req.user`) | exact |
| `modules/voicemail/voicemail-link.controller.ts` (N) | controller | streaming | guard-only stream; **запрещён** `cdr-public.controller.ts:10-35` | role-match |
| `modules/voicemail/voicemail-link.guard.ts` (N) | middleware | request-response | `callcenter/guards/display-token.guard.ts:20-56` (без `sub`/`level`) | exact |
| `modules/voicemail/llm-summary.service.ts` (N) | service | request-response | decrypt — `ai-agents/util/secret-cipher.util.ts:33-43`; pick — `ai-providers.service.ts:24-27`; HTTP-тела нет | partial |
| `modules/voicemail/wav-pcm.util.ts` (N) | utility | transform | — | **none** |
| `modules/voicemail/migrate-voicemail.ts` (N) | migration | batch | `notifications/migrate-notifications-phase6.ts:20-56` | exact |
| `modules/voicemail/voicemail-ai.adapter.ts` (N, implied ARCHITECTURE) | provider | request-response | `directories/directories-ai.adapter.ts:19-101` (**не** `McpToolsService.regXxx`) | exact |
| `app.module.ts` (M) | config | — | сам себя: `DirectoriesModule` `:34,:215`, `NotificationsModule` `:97,:219` | exact |

### Генератор, типы, DTO, миграция шагов

| Файл | Роль | Data flow | Ближайший аналог | Качество |
|---|---|---|---|---|
| `shared/src/types/voicemail.types.ts` (N) | model (types) | — | `shared/src/types/notification.types.ts:12-33` (`INotificationIntegration` + status unions) | role-match |
| `shared/src/types/dialplan-params.types.ts` (M) | model (types) | — | сам себя, `IVoicemailParams:200-204`; **не** `IMediaOptions:76-83` | exact |
| `shared/src/types/dialplan-condition.types.ts` (M) | model (types) | — | сам себя, `CONDITION_SOURCES:6-12` + `QUEUESTATUS_VALUES:35-41` | exact |
| `backend/.../dialplan.util.ts` (M) | utility | transform | сам себя, `case 'voicemail':432-435` + `emitNotifyDialplan:657-678` + `emitPlayback` | exact |
| `backend/.../dialplan.util.spec.ts` (M) | test | transform | сам себя, `voicemail` `:970-983` (заменить ожидание `VoiceMail(`) | exact |
| `backend/.../dialplan-playback.util.ts` (reuse) | utility | transform | `emitPlayback:110-149` — greeting `mode: 'plain'` | exact |
| `backend/.../dialplan-curl.util.ts` (reuse) | utility | transform | `buildCurlCall` + `URIENCODE` — ingest CURL | exact |
| `routes/dto/dialplan-params/address.params.dto.ts` (M) | dto | request-response | `VoicemailParamsDto:429-439` + `NotifyParamsDto:29-48` | exact |
| `routes/dialplan-actions-migration.util.ts` (M) | utility | batch | сам себя, `KNOWN_TYPES` + `voicemail: { from: 'exten', to: 'target' }:35` | exact |

### Notify attach + STT/LLM

| Файл | Роль | Data flow | Ближайший аналог | Качество |
|---|---|---|---|---|
| `notifications/providers/notification-provider.interface.ts` (M) | model | request-response | сам себя, `INotificationProvider.send:33-38` — расширить optional attach | exact |
| `notifications/providers/telegram.provider.ts` (M) | service | request-response | сам себя, `send:16-46` (`sendMessage` → добавить `sendDocument`) | exact |
| `notifications/providers/email.provider.ts` (M) | service | request-response | сам себя + `mailer.service.ts:74-101` (`sendReportMail` attachments[]) | exact |
| `notifications/notification-dispatcher.service.ts` (M) | service | event-driven | сам себя, `dispatch:40-78` — прокинуть attach, не второй dispatcher | exact |
| `stt-engines/stt-engines.service.ts` (reuse) | service | CRUD | `findAll:13-18` (нет default-флага) | exact |
| `voice-robots/providers/provider-factory.ts` (reuse) | service | transform | `transcribe:59-81` (PCM16 8 kHz) | exact |

### Frontend: шаг voicemail + Surface L + i18n

| Файл | Роль | Data flow | Ближайший аналог | Качество |
|---|---|---|---|---|
| `features/dialplan-apps/model/schemas/voicemail.tsx` (N) | config | transform | `schemas/notify.tsx:4-54` (`optionsSource: 'notifications'`) | exact |
| `features/dialplan-apps/model/schemas/voicemail.test.tsx` (N) | test | transform | `schemas/registrySchemas.test.tsx:1-47` | exact |
| `features/dialplan-apps/model/registry.ts` (M) | config | — | сам себя, stub `voicemail:331`; сосед `notify:323-330` | exact |
| `features/dialplan-apps/model/conditionMap.ts` (M) | utility | transform | сам себя, `http_result:26-28,52` | exact |
| `features/dialplan-apps/ui/ConditionEditor/ConditionEditor.tsx` (M) | component | transform | сам себя, `DIAL_PREFIX`/`QUEUE_PREFIX:17-18` + MultiSelect `:100-116` | exact |
| `pages/CdrReportPage/CdrReportPage.tsx` (M) | component | request-response | сам себя, Button-tabs `:41,123-138` | exact |
| `pages/CdrReportPage/CdrReportPage.test.tsx` (M) | test | — | сам себя, `:35-40` (добавить третью вкладку) | exact |
| `features/cdr/model/lib/cdrFiltersToParams.ts` (M) | utility | transform | сам себя, `CdrUiFilters:3-13` — поле `voicemail?: '1'` | exact |
| `features/cdr/ui/CdrFilter/CdrFilter.tsx` (M) | component | request-response | сам себя, checkbox + `onChange` patch `:17-47` | exact |
| `features/cdr/ui/CdrTable/CdrTable.tsx` (M) | component | request-response | сам себя, колонка `recording:88-97` (`Mic`/`RecordingButton`) | exact |
| `features/cdr/ui/VoicemailDetailsModal/` (N) | component | request-response | shell — `TimeGroupFormModal.tsx:277-290` + `.scrollBody`; Dialog — `CdrLegsModal.tsx:27-38`; плеер — `shared/ui/AudioPlayer` **не** `RecordingButton` | role-match |
| `shared/api/endpoints/voicemailApi.ts` (N) | store | CRUD + streaming | `shared/api/endpoints/cdrApi.ts:76-79` + `rtkApi.ts:98` tag `'Voicemail'` | exact |
| `shared/config/locales/ru.ts`, `en.ts` (M) | config | — | namespace `cdr.voicemail.*` (копии Surface L) + `routes.apps.voicemail.*` | exact |

### Тесты модуля (новые spec)

| Файл | Роль | Data flow | Ближайший аналог | Качество |
|---|---|---|---|---|
| `voicemail-dialplan.controller.spec.ts` (N) | test | event-driven | `dialplan-notify.controller.spec.ts:4-28` | exact |
| `voicemail-scanner.service.spec.ts` (N) | test | batch | `callcenter-zombie.service.spec.ts` — гонять `scanOnce()` без таймера | exact |
| `voicemail-link.guard.spec.ts` (N) | test | request-response | форма как `directories-ai.adapter.spec.ts` (модель `jest.fn`) | role-match |
| `wav-pcm.util.spec.ts` (N) | test | transform | — (кейсы из 13-RESEARCH Validation) | **none** |
| `llm-summary.service.spec.ts` (N) | test | request-response | `ai-providers.service.spec.ts` (мок fetch + decrypt) | role-match |

---

## Pattern Assignments

### 1. Scaffold модуля + AI adapter (не hand-written MCP)

**Аналог модуля:** `packages/backend/src/modules/directories/directories.module.ts:14-29` — свежее, чем `notifications.module.ts`: два контроллера (JWT + internal) + `AiPlatformModule`.

```typescript
@Module({
  imports: [
    SequelizeModule.forFeature([
      Directory,
      DirectoryField,
      DirectoryRecord,
      RouteDirectoryBinding,
      Route,
    ]),
    AiPlatformModule,
  ],
  controllers: [DirectoriesController, DirectoryLookupController],
  providers: [DirectoriesService, DirectoriesAiAdapter],
  exports: [DirectoriesService],
})
export class DirectoriesModule {}
```

Voicemail: `SequelizeModule.forFeature([VoicemailMessage, VoicemailAccessToken])`, контроллеры `VoicemailController` + `VoicemailDialplanController` + `VoicemailLinkController`, providers `VoicemailService` + `VoicemailScannerService` + `LlmSummaryService` + `VoicemailAiAdapter` + `VoicemailLinkGuard`. Импорт `NotificationsModule` (dispatcher) и `SttEngines`/`AiAgents` по необходимости.

**Wiring в `app.module.ts`:** импорт + `imports[]` рядом с `DirectoriesModule` (`:34,:215`) и `NotificationsModule` (`:97,:219`). Модели — в `SequelizeModule.forRoot({ models })`. `synchronize: false`.

**AI / MCP — текущий канон, не `McpToolsService.regXxx`.** `ai-adapter.types.ts:9-12` прямо говорит: новые домены идут через adapter; endpoints/routes оставляют hand-written MCP.

Копировать `directories-ai.adapter.ts:19-101`:

```typescript
@Injectable()
export class DirectoriesAiAdapter implements DomainAiAdapter, OnModuleInit {
  readonly domain = 'directories';
  onModuleInit(): void {
    this.registry.register(this);
  }
  getTools(): AiToolDefinition[] {
    return [this.toolListDirectories(), /* … */];
  }
  private toolListDirectories(): AiToolDefinition {
    return {
      name: 'list_directories',
      description: '…',
      inputSchema: {},
      entityType: 'directory',
      handler: async (_args, uid) => { /* uid = vpbxUserUid, never closed over */ },
    };
  }
}
```

Phase 13 минимум: `list_voicemail_messages`, `get_voicemail_message` (read). Delete только с `destructive: true`. `vpbxUserUid` — аргумент handler, не замыкание (D-23 comment в типах).

---

### 2. Sequelize-модели: сообщения + opaque-токен

**Сообщения** — форма A tenant-scoped (`notification-integration.model.ts:9-33`):

```typescript
@Table({ tableName: 'notification_integrations', timestamps: false })
export class NotificationIntegration extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare uid: number;
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare user_uid: number;
}
```

Для `voicemail_messages` колонка тенанта как у токена (`display-token.model.ts:39-41`):

```typescript
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
```

Две оси статусов (13-RESEARCH Pattern 2; имена на усмотрение планировщика, семантика D-60/D-68 обязательна):

| Колонка | Значения |
|---|---|
| `notify_status` | `pending` \| `sent` \| `failed` |
| `transcript_status` | `pending` \| `ready` \| `failed` \| `not_configured` |

UNIQUE(`vpbx_user_uid`, `uniqueid`) — в миграции через `qi.addIndex`, не декоратором модели (12-PATTERNS §2).

**Токен** — копировать `display-token.model.ts:3-42` в новую таблицу `vm_access_tokens` (не перегружать `cc_display_tokens`):

```typescript
@Table({ tableName: 'cc_display_tokens', timestamps: false })
export class CcDisplayToken extends Model {
  @Column({ type: DataType.STRING(64), allowNull: false })
  declare token: string;
  @Column({ type: DataType.DATE, allowNull: true })
  declare expires_at: Date | null;
  @Column({ type: DataType.DATE, allowNull: true })
  declare revoked_at: Date | null;
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;
}
```

Mint: `randomBytes(32).toString('hex')`, TTL 7 дней (D-67). Плюс `message_uid`.

---

### 3. Миграция CREATE TABLE

**Аналог:** `migrate-notifications-phase6.ts:20-56` — standalone `ts-node`, `ifNotExists`, индекс в try/catch.

```typescript
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
  await qi.createTable('notification_integrations', { /* … */ }, { ifNotExists: true } as any);
  try {
    await qi.addIndex('notification_integrations', ['user_uid'], { name: 'idx_notif_int_user_uid' });
  } catch (e) {
    console.log('[migration] idx_notif_int_user_uid:', (e as Error).message);
  }
  await sequelize.close();
}
```

Создать `voicemail_messages` + `vm_access_tokens`. Тест самого SQL не пишется (норма репо). Идемпотентный ALTER шагов `type=voicemail` — отдельная чистая функция рядом с `dialplan-actions-migration.util.ts` (уже знает `voicemail: { from: 'exten', to: 'target' }`).

---

### 4. Internal ingest: fire-and-forget + timing-safe key

**Не копировать сравнение ключа** из `dialplan-notify.controller.ts:39` (`providedKey !== this.apiKey`). Копировать **форму ответа** (`:32-49`) и **сравнение** из `directory-lookup.controller.ts:76-80`.

Форма (notify `:32-49`):

```typescript
  @Post('notify')
  @HttpCode(200)
  async notify(
    @Headers('x-api-key') headerKey: string,
    @Body() body: NotifyDialplanDto & { api_key?: string },
  ) {
    const providedKey = headerKey || body.api_key;
    // … auth …
    this.dispatcher
      .dispatch(body)
      .catch((e) =>
        this.logger.error(`notify dispatch failed: ${e?.message ?? e}`),
      );
    return { accepted: true };
  }
```

Ключ (`directory-lookup.controller.ts:76-80` + `dialplan-api-key.ts:3-13`):

```typescript
  private assertKey(provided?: string): void {
    if (!timingSafeApiKeyEqual(this.apiKey, provided)) {
      this.logger.warn('Unauthorized internal directory lookup');
      throw new UnauthorizedException('Invalid API key');
    }
  }
```

```typescript
export function timingSafeApiKeyEqual(expected: string, provided?: string): boolean {
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided ?? '');
  const len = Math.max(a.length, b.length, 1);
  const ka = Buffer.alloc(len);
  const kb = Buffer.alloc(len);
  a.copy(ka);
  b.copy(kb);
  return crypto.timingSafeEqual(ka, kb) && a.length === b.length;
}
```

Ingest **не** вызывает STT (D-60). Первый notify — async в Nest после `{accepted:true}` (D-62). Tenant id — из тела CURL, но сверять с ключом/известным `user_uid` query; не доверять как JWT.

**Тест:** `dialplan-notify.controller.spec.ts:23-28` — `{ accepted: true }` до settle dispatch. Для voicemail: тот же контракт + ingest не зовёт scanner/STT.

CURL в hangup-handler строить через `buildCurlCall` (`dialplan-curl.util.ts:33-37` — `URIENCODE` для `${UNIQUEID}` / `${RECORDED_FILE}`). Контекст handler **обязан** заканчиваться `Return()`.

---

### 5. Генератор: заменить `VoiceMail()`, не ActionType

Текущая ветка (`dialplan.util.ts:432-435`) — удалить emission:

```typescript
      case 'voicemail': {
        const vmExten = this.sanitizeDialplanInput(params.exten) || '${EXTEN}';
        dp = `VoiceMail(${vmExten}@default,u)`;
        break;
      }
```

Порядок строк (D-55 + Pitfall 2/11) — обязательный unit-тест:

1. optional `emitPlayback({ mode: 'plain', files: greeting }, { vpbxUserUid })` — **до** handler (`dialplan-playback.util.ts:110-127`)
2. `Set(CHANNEL(hangup_handler_push)=krsk-vm-done-{uid},s,1)`
3. `Record({base}/{uid}/voicemail/${UNIQUEID}-%d.wav,silence,maxdur,k…)` — `k` всегда, user flags `qoxynsu` без чекбокса `k`
4. `Set(CHANNEL(hangup_handler_pop)=)`
5. `Goto(krsk-vm-done-{uid},s,1)`

Greeting analog (`emitPlayback:124-127`):

```typescript
    case 'plain':
      lines.push(optStr ? `Playback(${path},${optStr})` : `Playback(${path})`);
      break;
```

Notify CURL analog (`emitNotifyDialplan:657-678`) — не вызывать Telegram из Asterisk; только ingest:

```typescript
    const curl = buildCurlCall('notify', payload, this.curlCtx(vpbxUserUid));
    return [
      `Set(__KNOTIFY_MSG=${message})`,
      `Set(__KNOTIFY_TARGET=${target})`,
      `Set(__KNOTIFY_SUBJ=${subject})`,
      curl,
    ].join('\nsame => n,');
```

**Тесты** заменить `dialplan.util.spec.ts:970-983` (`VoiceMail(101@default,u)` / `${EXTEN}`). Новые инварианты: `index(hangup_handler_push) < index(Record(`)`, options содержит `k`, нет `VoiceMail(`, путь содержит `/voicemail/` и `.wav`, после Record есть `hangup_handler_pop` до `Goto`.

`IVoicemailParams` (`dialplan-params.types.ts:200-204`) расширить: `greeting?`, `max_duration` default 120, `silence_timeout?`, `record_options` `{q,o,x,y,n,s,u}`, `notify?: INotifyActionParams`, `stt_engine_uid?`, `llm_provider_uid?`. **Не** использовать `IMediaOptions` (`:76-83` — флаги Playback `noanswer/skip/p/mixMode`).

DTO: расширить `VoicemailParamsDto` (`address.params.dto.ts:429-439`) полями как `NotifyParamsDto` (`integration.params.dto.ts:29-48`) — `@ValidateNested` + `@Type` + `@Matches(SAFE_*)`.

Миграция шагов: `dialplan-actions-migration.util.ts` уже держит `voicemail` в `KNOWN_TYPES` и мапит `exten→target`. Дописать дефолты `max_duration=120`. `raw_dialplan` с текстом `VoiceMail(` — **только лог**, не rewrite (Phase 12 rule). Не grep-удалять строку `telegram` (Pitfall 12).

---

### 6. JWT list/detail/stream vs token link

**JWT контроллер** — `cdr.controller.ts:18-29,136-144`:

```typescript
@Controller('reports/cdr')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequiresModule('cdr')
export class CdrController {
  private viewer(req: { user?: { vpbx_user_uid: number; sub: number } }) {
    return { tenantId: req.user!.vpbx_user_uid, userId: req.user!.sub as number };
  }
  @Get('recording/:uniqueid/play')
  playRecording(@Request() req: any, @Param('uniqueid') uniqueid: string, @Res() res: Response) {
    return this.cdrService.streamRecording(req.user.vpbx_user_uid, uniqueid, res, req);
  }
}
```

Voicemail JWT: `GET /api/voicemail` (фильтр), `GET /api/voicemail/:uniqueid`, `GET /api/voicemail/:uniqueid/play?download=1`, retry-STT. Tenant **только** из JWT. Access-scope: `buildCdrLinkedidAccessClause` (`cdr.service.ts:21,140` + `cdr-access-scope.ts:39-40`).

**Resolver пути — копировать guard, не суффикс** (`cdr.service.ts:303-310`):

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

Новый `safeVoicemailFilePath`: те же `..` + `startsWith`; расширение из БД (`.wav`); MIME `audio/wav`. Range — дословно `streamRecording:451-509` (`Accept-Ranges`, `bytes=`, 416, 206). `Content-Disposition` filename `.wav`.

**Запрещённый аналог** (`cdr-public.controller.ts:10-35`): стрим без JWT + `DEFAULT_VPBX_USER_UID`. D-59 запрещает reuse.

**Token guard** — `display-token.guard.ts:20-56`. Expired → 410/404 (D-67); файл на диске остаётся (JWT stream жив). `req.user` без `sub`/`level`:

```typescript
    req.user = {
      vpbx_user_uid: row.user_uid,
      isDisplayToken: true,
    };
```

Token URL чеканится **только** в notify payload. UI никогда не рендерит его (Surface L / Pitfall 10).

---

### 7. Scanner `@Interval` + mutex

`CallCenterZombieService` даёт `@Interval` + извлечённый `checkOnce` (`:40-50`), но **без** mutex. Mutex копировать из `callcenter-shift-janitor.service.ts:23-44` (там `@Cron`, флаг тот же):

```typescript
  private running = false;

  @Cron('*/5 * * * *')
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runOnce();
    } catch (err: any) {
      this.logger.warn(`shift janitor failed: ${err?.message || err}`);
    } finally {
      this.running = false;
    }
  }
```

Склеить: `@Interval('vm-scan', 30_000)` + `if (this.running) return` + `scanOnce()` для spec. Два запроса: `notify_status=pending AND next_notify_at<=now`; `transcript_status=pending`. Lease `scan_locked_until` предпочтительнее `SKIP LOCKED` (13-RESEARCH Open Q4). Backoff notify 1/4/10 мин в `next_notify_at`, не в периоде тика.

**Не** подключать BullMQ (`webhook-queue.service.ts` уже снял его из-за boot hang).

---

### 8. STT + тонкий LLM

**STT:** `SttProviderFactory.transcribe` (`provider-factory.ts:59-81`) ждёт headerless PCM16 8 kHz (`stt-provider.interface.ts:30-33`). Движок: uid с шага, иначе `SttEnginesService.findAll` (`:13-18`) — первого; пусто → `transcript_status=not_configured` (D-63). `sampleRate !== 8000` или `channels !== 1` после `parseWavPcm16` → fail, не silent success.

**LLM ключ:** только `decryptSecret` (`secret-cipher.util.ts:33-43`). Провайдер: `AiProvidersService.findAll` (`:24-27`) — `user_uid IN (0, tenant)`, `capabilities` содержит `'llm'`, `enabled`, **skip** `endpoint` с `wss:`. HTTP-тела chat completions **в репо нет** — брать сниппет из `13-RESEARCH.md` § Thin LLM client. `AbortSignal.timeout(30_000)`. Нет LLM → transcript без summary, не `failed`.

`wav-pcm.util.ts` — реализовать **как есть** из RESEARCH (D-71); аналога парсера WAV нет.

---

### 9. Attach API — расширить провайдеры, не второй dispatcher

Текущий контракт (`notification-provider.interface.ts:33-38`):

```typescript
export interface INotificationProvider {
  send(
    integration: DecryptedNotificationIntegration,
    target: string | undefined,
    message: string,
  ): Promise<NotificationSendResult>;
}
```

Добавить optional 4-й аргумент `{ filename, content, contentType }`. Dispatcher (`:40-78`) прокидывает его в telegram/email; WhatsApp/MAX/VK/webhook — link only.

Telegram сегодня только `sendMessage` (`telegram.provider.ts:36-40`). WAV → `sendDocument` multipart (не `sendVoice` / `sendAudio`). Email: `EmailProvider` зовёт `mailer.sendNotification` без attach; форма вложений уже есть в `mailer.service.ts:74-101`:

```typescript
        attachments: [
          {
            filename: attachment.filename,
            content: attachment.content,
            contentType: attachment.contentType,
          },
        ],
```

Порог attach: `fs.stat` `< 2 * 1024 * 1024` (D-64/D-65). D-66: attach rejected → тот же канал сразу текстом+ссылкой, `notify_attempts` не инкрементировать. Отдельный error class `attachment_rejected`.

`APP_URL` для ссылки — `mailer.service.ts:114` (`config.get('APP_URL') ?? 'https://pbx.krasterisk.ru'`). Предпочесть явный `APP_URL`.

---

### 10. Schema-driven шаг `voicemail`

Stub сегодня (`registry.ts:331`):

```typescript
  voicemail: { type: 'voicemail', labelKey: 'routes.action.voicemail', category: 'notification' },
```

Сосед-эталон `notify:323-330`: `defaultParams` + `schema` + `summarize`. Скопировать `notify.tsx:4-44` для блока notify (`integration_uid` `optionsSource: 'notifications'`, `body`, `target`, `subject`). Greeting — `select`/`custom` промпт как playback files, **не** `IMediaOptions`. Record flags — отдельный набор `q o x y n s u`; `k` не чекбокс. `defaultParams.max_duration === 120` (D-74) — тест.

`terminal` уже `'conditional'` в `dialplan-action-meta.ts` — не менять.

**Тест схемы:** `registrySchemas.test.tsx:1-47` (vitest + RTL + `t(key, fallback)`).

---

### 11. `RECORD_STATUS` как condition source

Добавить в `dialplan-condition.types.ts` рядом с `QUEUESTATUS_VALUES:35-41`:

```typescript
export const CONDITION_SOURCES = [
  'dialstatus',
  'queuestatus',
  'device_state',
  'variable',
  'http_result',
] as const;
```

`+ 'record_status'` и `RECORD_STATUS_VALUES = ['DTMF','SILENCE','SKIP','TIMEOUT','HANGUP','ERROR','OPERATOR']` (все 7, D-56). Один и тот же массив — shared + DTO + UI presets (инвариант-тест).

`conditionMap.ts` — ветка как `http_result:26-28`. `ConditionEditor.tsx` — третий prefix `record:` рядом с `DIAL_PREFIX`/`QUEUE_PREFIX:17-18` и Multiselect `:100-116`. Optgroup «Запись сообщения» — копия Surface E / 12-UI-SPEC.

---

### 12. Surface L на существующем CDR chrome

**Вкладки** — `CdrReportPage.tsx:41,123-138`. Третья Button `variant="default"|"outline"`, иконка `Voicemail`. **Не** мигрировать на `shared/ui/Tabs`.

```tsx
              <Button
                variant={activeTab === 'journal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('journal')}
              >
                <List className="w-4 h-4 mr-2" />
                {t('cdr.tabs.journal', 'Журнал')}
              </Button>
```

Tab и checkbox — **одно** состояние: `CdrUiFilters` (`cdrFiltersToParams.ts:3-13`) + `voicemail?: '1'`. `CdrFilter` патчит через `onChange`; `clearAll:35-47` обязан сбрасывать новое поле.

**Иконки в журнале:** `CdrTable.tsx:88-97` — `RecordingButton` = разговор (`Mic` / popup MP3). Голосовое сообщение — **другая** Lucide-иконка `Voicemail`, tint `info`. Не открывать `RecordingButton` popup для `.wav`.

**Детали:** Dialog (не Sheet). Shell — `TimeGroupFormModal.tsx:277-290` + `.scrollBody` (`TimeGroupFormModal.module.scss:1-9`):

```tsx
    <Dialog open onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent size="large">
        <DialogHeader>
          <DialogTitle>…</DialogTitle>
        </DialogHeader>
        <VStack className={cls.scrollBody}>
```

```scss
.scrollBody {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
```

Плеер: `shared/ui/AudioPlayer` **не** `compact`, JWT stream. Download `?download=1` + `.wav`. Четыре состояния Surface L: `pending` / `done` / `failed`+retry / `not-configured` без retry. Notify fail — только meta-строка (D-69).

**RTK:** `cdrApi.ts:76-79` + tag `'Voicemail'` в `rtkApi.ts:98` (сейчас заканчивается `'TenantSettings'`).

**Тест вкладки:** расширить `CdrReportPage.test.tsx:35-40`.

**i18n:** `t('cdr.voicemail.*', fallback)` — строки из 12-UI-SPEC Copywriting (ru+en). Без длинного тире в UI.

---

## Shared Patterns

### Тенант из JWT, не из body

**Источник:** `cdr.controller.ts:24-29`
**Применять к:** `voicemail.controller.ts`

```typescript
  private viewer(req: { user?: { vpbx_user_uid: number; sub: number } }) {
    return {
      tenantId: req.user!.vpbx_user_uid,
      userId: req.user!.sub as number,
    };
  }
```

### Internal Asterisk endpoint

**Источник:** `directory-lookup.controller.ts:76-80` + `dialplan-notify.controller.ts:32-49`
**Применять к:** `voicemail-dialplan.controller.ts`
Ключ — `timingSafeApiKeyEqual`. Ответ — `{accepted:true}` + async work.

### Opaque token без эскалации

**Источник:** `display-token.guard.ts:46-50`
**Применять к:** `voicemail-link.guard.ts`
`req.user = { vpbx_user_uid, isDisplayToken: true }` — без `sub`/`level`.

### AES ключей провайдера

**Источник:** `secret-cipher.util.ts:33-43`
**Применять к:** `llm-summary.service.ts`
Только `decryptSecret`. Не логировать plaintext. Env `CC_AI_KEY_SECRET`.

### Range + path guard

**Источник:** `cdr.service.ts:303-310,433-509`
**Применять к:** JWT и token stream
Новый resolver `.wav` / `audio/wav`. Не вызывать `safeRecordFilePath`.

### i18n

**Источник:** `notify.tsx` / `CdrReportPage.tsx`
Всегда `t(key, fallback)`. Namespaces: `routes.apps.voicemail.*`, `cdr.voicemail.*`, `routes.chain.conditions.record.*`.

### Тесты

- Backend: Jest, глобалы `describe/it/expect`, мок модели `jest.fn` (как `ai-providers.service.spec.ts`).
- Frontend: Vitest + явный импорт + `t = (k, fb) => fb ?? k`.
- Генератор: точное `toBe` / `indexOf` порядок строк.
- После смены `IVoicemailParams` / `CONDITION_SOURCES`: `npm run build -w @krasterisk/shared` (Pitfall 9).

---

## No Analog Found

| Файл / механизм | Роль | Data flow | Почему нет аналога |
|---|---|---|---|
| `wav-pcm.util.ts` (RIFF chunk walk) | utility | transform | В backend нет парсера аудио. Реализовать сниппет `13-RESEARCH.md` § `parseWavPcm16` (D-71). Не `buf.subarray(44)`. |
| HTTP chat-completions в `llm-summary.service.ts` | service | request-response | Есть реестр `CcAiProvider` + `decryptSecret` + `HttpModule`; клиента к `/v1/chat/completions` нет. Тело запроса — из RESEARCH Code Examples. Не `npm install openai`. |
| 4 состояния расшифровки в Details Dialog | component | request-response | `CdrLegsModal` — таблица ног без STT. Состояния брать из `12-UI-SPEC.md` Surface L, не из кода. |

Частичные (есть роль, нет готового куска): optional attach на `INotificationProvider.send`; two-axis колонки статусов; Record flags ≠ `IMediaOptions`.

**Устаревшие «аналоги», которые нельзя копировать:**

| Запрет | Почему |
|---|---|
| `cdr-public.controller.ts` | Unauthenticated stream (D-59) |
| `safeRecordFilePath` as-is | Хардкод `.mp3` + `audio/mpeg` (D-58/D-71) |
| JWT `audience: 'voicemail-link'` из 12-RESEARCH | Снято D-59 |
| `IMediaOptions` / `IRecordParams` | Playback / leftover media DTO |
| `McpToolsService.regFindCdrCalls` как шаблон нового домена | Новые сущности — `DirectoriesAiAdapter` |
| `DialplanNotifyController` сравнение `!==` | Использовать `timingSafeApiKeyEqual` |
| `sendVoice` / `sendAudio` | WAV только `sendDocument` |
| BullMQ / `webhook-queue` | D-61 + известный boot hang |

---

## Metadata

**Analog search scope:**
`packages/backend/src/modules/{notifications,directories,ai-platform,ai-agents,callcenter,reports/cdr,stt-engines,voice-robots,mcp,mailer,routes,dialplan-bridge}`,
`packages/backend/src/shared/utils`, `packages/backend/src/app.module.ts`,
`packages/frontend/src/{pages/CdrReportPage,features/cdr,features/dialplan-apps,features/timeGroups,shared/api,shared/ui,shared/config}`,
`packages/shared/src/types`.

**Ключевые аналоги (5):**
1. `modules/directories/*` — scaffold модуля + `DirectoriesAiAdapter` (MCP/webhook)
2. `modules/notifications/*` + `directory-lookup.controller.ts` — ingest fire-and-forget + dispatcher/attach
3. `modules/callcenter/{models/display-token,guards/display-token.guard}` — opaque TTL token
4. `modules/reports/cdr/*` — JWT stream Range + access-scope + Surface L host
5. `features/dialplan-apps/{registry,schemas/notify,ConditionEditor}` + `dialplan.util.ts` — шаг и генератор

**Files scanned:** ~40 прочитано целиком или таргетированными диапазонами; ~15 через Grep. Все пути аналогов проверены `git ls-files` (tracked).

**Pattern extraction date:** 2026-09-02
