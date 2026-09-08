# Universal Dialplan Directories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CallerID-bound phonebooks with schema-based, tenant-safe directories that resolve explicit call-value sources and provide stable data to route policies, dialplan actions, and trunk carousels.

**Architecture:** A directory has a declared schema, one indexed lookup field, and exact/pattern records. A pure dialplan compiler is the only code that emits the HTTP lookup protocol. Route policies and action consumers store stable directory/field IDs; the trunk carousel snapshots and always keys by the immutable original CallerID.

**Tech Stack:** TypeScript 5.7, NestJS 11, Sequelize 6/MySQL, React 19, Redux Toolkit/RTK Query, Vitest 4, Jest 29, Asterisk CURL/CUT/BASE64_DECODE.

## Global Constraints

- Clean replacement only: no data migration, dual-read, legacy aliases, compatibility redirects, or fallback parsing.
- Runtime directory access is HTTP-only; do not add ODBC/FUNC_ODBC.
- `CALLERID(num)` is never an implicit lookup key.
- Capture `__KRSK_ORIG_CALLER_NUM` before route policies and route actions.
- Exact match wins; patterns run only after exact miss and use ascending `priority`, then `uid`.
- Technical lookup errors fail open and must not activate `on_no_match` whitelist behavior.
- One carousel lookup request per distinct directory.
- Store trunk `ITrunkListItem.id`, not its display `name`.
- No new npm dependencies.
- Tasks 1–11 are implementation checkpoints, not deployable releases. Execute the plan as one release unit; only deploy after Task 12 removes every old runtime registration and the full gate passes.
- Tenant ownership comes from JWT for management APIs and from generated `user_uid` plus `DIALPLAN_API_KEY` for runtime lookup.
- Frontend follows FSD, SCSS modules, shared UI controls, `useSchemaRefs`, responsive 360–2560 px behavior, and ru/en localization.
- Full verification: `npm run lint`, `npm run test:backend`, `npm run test:frontend`, `npm run build`.

---

## File Structure

### Shared contracts

- Create `packages/shared/src/types/directory.types.ts`: directory schema, records, policies, lookup params, and call-value sources.
- Modify `packages/shared/src/types/dialplan-params.types.ts`: replace phonebook `ValueSource`; move carousel item to the new contract.
- Modify `packages/shared/src/types/route.types.ts`: add `directory_lookup`, use `IRouteDirectoryBinding`.
- Modify `packages/shared/src/types/dialplan-action-meta.ts`: rename the policy host and register the action.
- Modify `packages/shared/src/types/notification.types.ts`: remove phonebook CallerID and old carousel contracts.
- Modify `packages/shared/src/index.ts`: export directory contracts and stop exporting phonebook contracts.
- Delete `packages/shared/src/types/phonebook.types.ts` during final cleanup after every consumer has moved.

### Backend directory domain

- Create `packages/backend/src/modules/directories/directory.model.ts`.
- Create `packages/backend/src/modules/directories/directory-field.model.ts`.
- Create `packages/backend/src/modules/directories/directory-record.model.ts`.
- Create `packages/backend/src/modules/directories/route-directory-binding.model.ts`.
- Create `packages/backend/src/modules/directories/dto/directory.dto.ts`.
- Create `packages/backend/src/modules/directories/directory-normalization.util.ts`.
- Create `packages/backend/src/modules/directories/directory-pattern.util.ts`.
- Create `packages/backend/src/modules/directories/directories.service.ts`.
- Create `packages/backend/src/modules/directories/directories.controller.ts`.
- Create `packages/backend/src/modules/directories/directory-lookup.controller.ts`.
- Create `packages/backend/src/modules/directories/directory-reference.util.ts`.
- Create `packages/backend/src/modules/directories/directory-policy-dialplan.util.ts`.
- Create `packages/backend/src/modules/directories/directories-ai.adapter.ts`.
- Create `packages/backend/src/modules/directories/directories.module.ts`.
- Create `packages/backend/src/modules/directories/setup-directories-schema.ts`: destructive fresh-development schema setup, not a data migration.
- Add colocated `.spec.ts` files for every utility/service/controller/adapter above.
- Delete `packages/backend/src/modules/phonebooks/`.

### Backend dialplan integration

- Create `packages/backend/src/shared/utils/directory-lookup-dialplan.util.ts`.
- Create `packages/backend/src/shared/utils/directory-lookup-dialplan.util.spec.ts`.
- Modify `packages/backend/src/shared/utils/dialplan-target.util.ts`.
- Modify `packages/backend/src/shared/utils/dialplan-number.util.ts`.
- Modify `packages/backend/src/shared/utils/dialplan-trunk-carousel.util.ts`.
- Modify `packages/backend/src/shared/utils/dialplan.util.ts`.
- Modify corresponding specs.
- Modify `packages/backend/src/modules/routes/dto/dialplan-params/value-source.dto.ts`.
- Modify `packages/backend/src/modules/routes/dto/dialplan-params/address.params.dto.ts`.
- Create `packages/backend/src/modules/routes/dto/dialplan-params/directory-lookup.params.dto.ts`.
- Modify `packages/backend/src/modules/routes/dto/dialplan-params/index.ts`.
- Modify `packages/backend/src/modules/routes/dto/route-action.dto.ts`.
- Modify `packages/backend/src/modules/routes/route.model.ts`.
- Modify `packages/backend/src/modules/routes/routes.service.ts`.
- Modify `packages/backend/src/modules/routes/route-apply.service.ts`.
- Modify `packages/backend/src/modules/routes/routes.module.ts`.
- Modify corresponding specs and `packages/backend/src/app.module.ts`.

### Frontend directory management

- Create `packages/frontend/src/shared/api/endpoints/directoryApi.ts`.
- Create `packages/frontend/src/features/directories/` with slice, selectors, table, modal, schema editor, records editor, lookup test, styles, public API, and tests.
- Create `packages/frontend/src/pages/DirectoriesPage/`.
- Delete `packages/frontend/src/shared/api/endpoints/phonebookApi.ts`.
- Delete `packages/frontend/src/features/phonebooks/`.
- Delete `packages/frontend/src/pages/PhonebooksPage/`.
- Modify store, router, navigation, module registry, role grants, locales, and RTK tags.

### Frontend dialplan integration

- Create `packages/frontend/src/features/dialplan-apps/ui/DirectoryLookupField/`.
- Create `packages/frontend/src/features/dialplan-apps/ui/DirectoryLookupOutputsField/`.
- Create `packages/frontend/src/features/dialplan-apps/model/schemas/directoryLookup.tsx`.
- Modify schema refs, schema types, registry, validation, summaries, and tests.
- Replace `ValueSourceField` phonebook mode with directory mode.
- Replace `RoutePhonebooksTab.tsx` with `RouteDirectoriesTab.tsx`.
- Modify `TrunkCarouselTrunksField.tsx` and tests.

### Harness and documentation

- Create `harness/scenarios/api/directories-crud.test.ts`.
- Create `harness/scenarios/realtime/directory-carousel.test.ts`.
- Modify `harness/runner/registry.ts`.
- Create `.docs/DIRECTORIES_MODULE.md`.
- Remove phonebook-specific AI/knowledge text and stale documentation references touched by this feature.

---

### Task 1: Replace shared phonebook contracts

**Files:**
- Create: `packages/shared/src/types/directory.types.ts`
- Modify: `packages/shared/src/types/dialplan-params.types.ts`
- Modify: `packages/shared/src/types/route.types.ts`
- Modify: `packages/shared/src/types/dialplan-action-meta.ts`
- Modify: `packages/shared/src/types/notification.types.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts`

**Interfaces:**
- Produces: `CallValueSource`, `DirectoryValueSource`, `IDirectory`, `IDirectoryField`, `IDirectoryRecord`, `IRouteDirectoryBinding`, `IDirectoryLookupParams`, `ITrunkCarouselItem`.
- Consumers: every later task.

- [ ] **Step 1: Write failing contract/registry tests**

Add assertions that the action union and metadata contain only the new names:

```ts
expect(ActionTypesList).toContain('directory_lookup');
expect(ActionTypesList).not.toContain('trunk_carousel');
expect(DIALPLAN_ACTION_META.directory_lookup).toEqual({
  terminal: 'never',
  allowedIn: ['route', 'directory_policy', 'ivr'],
  family: 'integration',
});
```

Add DTO fixtures using:

```ts
const directorySource: DirectoryValueSource = {
  source: 'directory',
  directoryUid: 7,
  keySource: { source: 'original_caller' },
  valueFieldUid: 17,
  onMissing: 'skip',
};
```

- [ ] **Step 2: Run tests and shared build to verify failure**

Run:

```bash
npm run build -w @krasterisk/shared
npm run test -w @krasterisk/backend -- dialplan-params.spec.ts --runInBand
```

Expected: compilation fails because directory contracts and `directory_lookup` do not exist.

- [ ] **Step 3: Implement the new shared contracts**

Define the exact discriminated unions:

```ts
export type DirectoryFieldType = 'string' | 'phone' | 'number' | 'boolean';
export type DirectoryMatchKind = 'exact' | 'asterisk_pattern';
export type DirectoryKeyNormalization = 'none' | 'digits';
export type DirectoryLookupStatus = 'FOUND' | 'NOT_FOUND' | 'ERROR';

export type CallValueSource =
  | { source: 'fixed'; value: string }
  | { source: 'route_pattern' }
  | { source: 'variable'; name: string }
  | { source: 'original_caller' }
  | { source: 'current_caller' };

export interface DirectoryValueSource {
  source: 'directory';
  directoryUid: number;
  keySource: CallValueSource;
  valueFieldUid: number;
  onMissing: 'keep' | 'empty' | 'skip';
}

export type ValueSource = CallValueSource | DirectoryValueSource;
```

Define directory records and bindings exactly as approved in the design spec. Define carousel items as:

```ts
export type TrunkCallerIdSource =
  | { mode: 'static'; value?: string }
  | {
      mode: 'directory';
      directoryUid: number;
      valueFieldUid: number;
      keySource: { source: 'original_caller' };
      onMissing: 'keep_original';
    };

export interface ITrunkCarouselItem {
  trunkId: string;
  callerId: TrunkCallerIdSource;
  timeout?: number;
}
```

Add only the new contracts in this task. Keep the old type file temporarily so untouched consumers compile, but do not add an adapter between old and new shapes. Task 12 deletes it after all consumers are converted.

- [ ] **Step 4: Re-run focused checks**

Run:

```bash
npm run build -w @krasterisk/shared
npm run test -w @krasterisk/backend -- dialplan-params.spec.ts --runInBand
```

Expected: shared build and focused contract tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts
git commit -m "refactor(directories): define universal lookup contracts"
```

---

### Task 2: Add fresh directory storage and schema validation

**Files:**
- Create: `packages/backend/src/modules/directories/directory.model.ts`
- Create: `packages/backend/src/modules/directories/directory-field.model.ts`
- Create: `packages/backend/src/modules/directories/directory-record.model.ts`
- Create: `packages/backend/src/modules/directories/route-directory-binding.model.ts`
- Create: `packages/backend/src/modules/directories/dto/directory.dto.ts`
- Create: `packages/backend/src/modules/directories/directory-normalization.util.ts`
- Create: `packages/backend/src/modules/directories/directory-normalization.util.spec.ts`
- Create: `packages/backend/src/modules/directories/directory-pattern.util.ts`
- Create: `packages/backend/src/modules/directories/directory-pattern.util.spec.ts`
- Create: `packages/backend/src/modules/directories/setup-directories-schema.ts`
- Create: `packages/backend/src/modules/directories/setup-directories-schema.spec.ts`
- Create: `harness/scenarios/api/directories-schema.test.ts`
- Modify: `packages/backend/package.json`

**Interfaces:**
- Produces: Sequelize models; `normalizeDirectoryKey(value, mode)`; `matchesAsteriskPattern(pattern, value)`.
- Consumes: Task 1 contracts.

- [ ] **Step 1: Write failing normalization and pattern tests**

Cover:

```ts
expect(normalizeDirectoryKey('+7 (900) 123-45-67', 'digits')).toBe('79001234567');
expect(normalizeDirectoryKey(' AbC ', 'none')).toBe('AbC');
expect(matchesAsteriskPattern('_1XX', '123')).toBe(true);
expect(matchesAsteriskPattern('_NXX', '123')).toBe(false);
expect(matchesAsteriskPattern('_[34]X.', '3123')).toBe(true);
expect(matchesAsteriskPattern('_[34', '3123')).toBe(false);
```

- [ ] **Step 2: Run the utility specs to verify failure**

Run:

```bash
npm run test -w @krasterisk/backend -- directory-normalization.util.spec.ts directory-pattern.util.spec.ts --runInBand
```

Expected: modules cannot be resolved.

- [ ] **Step 3: Implement models, utilities, and DTOs**

Use explicit Sequelize indexes:

```ts
@Table({
  tableName: 'directory_records',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'uq_directory_exact_key',
      unique: true,
      fields: ['directory_uid', 'normalized_lookup_value', 'match_kind'],
    },
    { name: 'idx_directory_patterns', fields: ['directory_uid', 'match_kind', 'priority'] },
  ],
})
export class DirectoryRecord extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.INTEGER) declare uid: number;
  @ForeignKey(() => Directory) @Column(DataType.INTEGER) declare directory_uid: number;
  @Column(DataType.STRING(255)) declare lookup_value: string;
  @Column(DataType.STRING(255)) declare normalized_lookup_value: string;
  @Column(DataType.STRING(24)) declare match_kind: DirectoryMatchKind;
  @Column(DataType.INTEGER) declare priority: number;
  @Column(DataType.JSON) declare values: Record<string, string | number | boolean>;
  @Column(DataType.STRING(255)) declare comment: string;
  @CreatedAt @Column(DataType.DATE) declare created_at: Date;
  @UpdatedAt @Column(DataType.DATE) declare updated_at: Date;
}
```

The fresh-schema setup targets a newly recreated development database and creates only:

```text
route_directory_bindings
directory_records
directory_fields
directories
```

Create the four tables with foreign keys and tenant indexes. Do not inspect, drop, read, transform, or copy old phonebook tables; recreating the empty development database is an operator prerequisite, not application migration logic.

Add `"db:setup:directories": "ts-node -r tsconfig-paths/register src/modules/directories/setup-directories-schema.ts"` to the backend package. Export `DIRECTORY_SCHEMA_STATEMENTS` and make each statement idempotent with `CREATE TABLE IF NOT EXISTS`. The unit spec invokes the setup function twice through a mocked Sequelize query interface and asserts it targets only the four new tables. The harness test starts its existing MySQL testcontainer, imports and executes the statements twice with `mysql2`, and asserts the four expected tables and foreign keys exist after both passes.

- [ ] **Step 4: Run utility tests and TypeScript build**

Run:

```bash
npm run test -w @krasterisk/backend -- directory-normalization.util.spec.ts directory-pattern.util.spec.ts --runInBand
npm run test -w @krasterisk/backend -- setup-directories-schema.spec.ts --runInBand
npm exec -w @krasterisk/harness -- vitest run scenarios/api/directories-schema.test.ts
npm run build -w @krasterisk/backend
```

Expected: utility/schema specs, real-MySQL idempotency test, and backend build pass.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/modules/directories packages/backend/package.json harness/scenarios/api/directories-schema.test.ts
git commit -m "feat(directories): add schema-based storage models"
```

---

### Task 3: Implement tenant-safe directory CRUD and lookup

**Files:**
- Create: `packages/backend/src/modules/directories/directories.service.ts`
- Create: `packages/backend/src/modules/directories/directories.service.spec.ts`
- Create: `packages/backend/src/modules/directories/directory-reference.util.ts`
- Create: `packages/backend/src/modules/directories/directory-reference.util.spec.ts`

**Interfaces:**
- Produces:
  - `DirectoriesService.findAll(userUid)`
  - `findOne(uid, userUid)`
  - `create(dto, userUid)`
  - `update(uid, dto, userUid)`
  - `remove(uid, userUid)`
  - `importCsv(uid, csv, userUid)`
  - `exportCsv(uid, userUid)`
  - `lookup(request): Promise<DirectoryLookupResult>`
  - `findReferences(directoryUid, fieldUid?, userUid)`
- Consumes: Task 2 models/utilities.

- [ ] **Step 1: Write failing service tests**

Test exact precedence and pattern order:

```ts
await expect(service.lookup({
  directoryUid: 7,
  userUid: 100,
  key: '123',
  fieldUids: [17, 18],
})).resolves.toEqual({
  status: 'FOUND',
  matchKind: 'exact',
  values: ['700', 'Alice'],
});
```

Provide two matching patterns with priorities `20` and `10`; assert priority `10` wins. Add a foreign-tenant fixture and assert `NOT_FOUND`. Add validation tests for duplicate directory names per tenant, duplicate exact normalized keys, duplicate pattern text, non-phone patterns, missing lookup field, bad value types, immutable field keys, removal of a referenced field, and removal of a referenced directory. Structured reference assertions must include route UID, action/binding ID, and human-readable location.

Save an action referencing field UID 17, rename the directory and field labels, and assert the same saved action still resolves field UID 17. Persist deliberately scrambled record JSON keys and request unsorted field UIDs `[18, 17]`; assert the result order follows the request, not JSON order.

- [ ] **Step 2: Run the service specs to verify failure**

Run:

```bash
npm run test -w @krasterisk/backend -- directories.service.spec.ts directory-reference.util.spec.ts --runInBand
```

Expected: service and reference collector do not exist.

- [ ] **Step 3: Implement transaction-safe CRUD and lookup**

Lookup order must be structurally explicit:

```ts
const directory = await this.directoryModel.findOne({
  where: { uid: request.directoryUid, user_uid: request.userUid },
  include: [{ model: DirectoryField, as: 'fields' }],
});
if (!directory) return { status: 'NOT_FOUND', values: [] };

const normalized = normalizeDirectoryKey(request.key, directory.key_normalization);
let record = await this.recordModel.findOne({
  where: {
    directory_uid: directory.uid,
    match_kind: 'exact',
    normalized_lookup_value: normalized,
  },
});

if (!record) {
  const patterns = await this.recordModel.findAll({
    where: { directory_uid: directory.uid, match_kind: 'asterisk_pattern' },
    order: [['priority', 'ASC'], ['uid', 'ASC']],
  });
  record = patterns.find((item) => matchesAsteriskPattern(item.lookup_value, normalized)) ?? null;
}
```

Management create/update DTOs identify the lookup field as `lookupFieldKey`. After creating/updating fields, resolve that key inside the same transaction and persist its numeric UID as `lookup_field_uid`; reject an unknown key. Management payload records likewise use immutable field keys. Map them to decimal field UID keys before persistence and map them back to field keys in management responses. CSV headers use field keys plus reserved `comment`, `match_kind`, and `priority`; reject unknown or duplicate headers and preserve quoted delimiters through the already-installed `exceljs` CSV parser. Return runtime values in exactly the requested `fieldUids` order. Reject a field UID outside the directory instead of silently returning another directory's data. Wrap create/update of directory, fields, and records in one Sequelize transaction.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test -w @krasterisk/backend -- directories.service.spec.ts directory-reference.util.spec.ts --runInBand
```

Expected: all directory service tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/modules/directories
git commit -m "feat(directories): implement validated tenant-safe lookup"
```

---

### Task 4: Expose management and runtime HTTP APIs

**Files:**
- Create: `packages/backend/src/modules/directories/directories.controller.ts`
- Create: `packages/backend/src/modules/directories/directories.controller.spec.ts`
- Create: `packages/backend/src/modules/directories/directory-lookup.controller.ts`
- Create: `packages/backend/src/modules/directories/directory-lookup.controller.spec.ts`
- Create: `packages/backend/src/modules/directories/directories.module.ts`
- Modify: `packages/backend/src/app.module.ts`

**Interfaces:**
- Produces: `/directories` management API and `/internal/dialplan/directory-lookup`.
- Consumes: Task 3 service.

- [ ] **Step 1: Write failing controller tests**

Assert:

```ts
expect(await controller.lookup('7', '100', '100', '17,18', 'secret'))
  .toBe(`KDL1|FOUND|${Buffer.from('700').toString('base64')}|${Buffer.from('Alice').toString('base64')}`);
```

Also assert:

- missing server `DIALPLAN_API_KEY`, missing request key, and wrong key all throw `UnauthorizedException`;
- foreign tenant becomes `KDL1|NOT_FOUND`;
- malformed IDs become `KDL1|ERROR`;
- service exception is logged and becomes `KDL1|ERROR`;
- management CRUD always passes `req.user.vpbx_user_uid`;
- lookup-test returns structured status, match kind, and field values.
- CSV import/export uses declared field keys and rejects unknown columns.
- structured lookup telemetry contains duration, outcome, tenant UID, directory UID, and match kind but never key/value data.
- response round-trip preserves `a|b`, Cyrillic/Unicode, commas, line breaks, and empty values.

- [ ] **Step 2: Run controller specs to verify failure**

Run:

```bash
npm run test -w @krasterisk/backend -- directories.controller.spec.ts directory-lookup.controller.spec.ts --runInBand
```

Expected: controllers/module do not exist.

- [ ] **Step 3: Implement the endpoints and module registration**

Encode only field values:

```ts
function encodeLookupResponse(result: DirectoryLookupResult): string {
  if (result.status !== 'FOUND') return `KDL1|${result.status}`;
  return [
    'KDL1',
    'FOUND',
    ...result.values.map((value) => Buffer.from(String(value ?? ''), 'utf8').toString('base64')),
  ].join('|');
}
```

Parse `field_uids` into positive unique integers while preserving first occurrence order. Register new models in both `DirectoriesModule` and the root explicit model list. Keep old source files temporarily until route consumers are converted in Task 6; do not route any new request or action through them.

Wrap runtime lookup timing in `try/finally` and emit one structured `Logger` line containing only `duration_ms`, `outcome`, `user_uid`, `directory_uid`, and `match_kind`. Never interpolate request `key` or returned values.

Load the secret through `ConfigService` and reject unless `timingSafeApiKeyEqual` from `modules/dialplan-bridge/dialplan-api-key.ts` returns true. An empty configured secret must never disable authentication.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test -w @krasterisk/backend -- directories.controller.spec.ts directory-lookup.controller.spec.ts --runInBand
npm run build -w @krasterisk/backend
```

Expected: controller specs pass; no backend import references the deleted module except route/dialplan consumers intentionally addressed next.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/modules/directories packages/backend/src/app.module.ts
git commit -m "feat(directories): expose management and dialplan lookup APIs"
```

---

### Task 5: Centralize dialplan lookup compilation and add the standalone action

**Files:**
- Create: `packages/backend/src/shared/utils/directory-lookup-dialplan.util.ts`
- Create: `packages/backend/src/shared/utils/directory-lookup-dialplan.util.spec.ts`
- Create: `packages/backend/src/modules/routes/dto/dialplan-params/directory-lookup.params.dto.ts`
- Modify: `packages/backend/src/modules/routes/dto/dialplan-params/value-source.dto.ts`
- Modify: `packages/backend/src/modules/routes/dto/dialplan-params/index.ts`
- Modify: `packages/backend/src/modules/routes/dto/route-action.dto.ts`
- Modify: `packages/backend/src/shared/utils/dialplan-target.util.ts`
- Modify: `packages/backend/src/shared/utils/dialplan-number.util.ts`
- Modify: `packages/backend/src/shared/utils/dialplan.util.ts`
- Test: corresponding specs.

**Interfaces:**
- Produces:

```ts
export interface CompileDirectoryLookupRequest {
  token: string;
  directoryUid: number;
  userUid: number;
  keySource: CallValueSource;
  fieldUids: number[];
  outputs?: DirectoryLookupOutput[];
  onMissing: 'keep' | 'empty' | 'skip';
  backendBaseUrl: string;
  apiKey: string;
}

export interface CompiledDirectoryLookup {
  lines: string[];
  statusVar: string;
  valueVars: Map<number, string>;
  canExecuteExpr: string;
}
```

- [ ] **Step 1: Write failing compiler and DTO tests**

Assert generated text:

```ts
expect(compiled.lines.join('\n')).toContain(
  'key=${URIENCODE(${KRSK_ORIG_CALLER_NUM})}',
);
expect(compiled.lines.join('\n')).toContain('field_uids=17,18');
expect(compiled.lines.join('\n')).toContain('BASE64_DECODE');
expect(compiled.lines.join('\n')).not.toContain('PB_');
expect(compiled.valueVars.get(17)).toBe('KRSK_DL_A3_F17');
```

Parameterize every `CallValueSource`: only `{ source: 'current_caller' }` may emit `${CALLERID(num)}`; every other source must not. Assert each request emits:

```ini
Set(CURLOPT(conntimeout)=1)
Set(CURLOPT(httptimeout)=2)
```

Assert one CURL call, no retry labels/branches, and correct decode of pipes, Unicode, commas, line breaks, and empty values.

Validate variable names:

```ts
expect(validateAction({ targetVariable: 'CUSTOMER_NAME' })).toHaveLength(0);
expect(validateAction({ targetVariable: 'CALLERID' })).not.toHaveLength(0);
expect(validateAction({ targetVariable: 'bad-name' })).not.toHaveLength(0);
```

- [ ] **Step 2: Run focused tests to verify failure**

Run:

```bash
npm run test -w @krasterisk/backend -- directory-lookup-dialplan.util.spec.ts dialplan-params.spec.ts --runInBand
```

Expected: compiler/action DTO are missing.

- [ ] **Step 3: Implement the compiler and replace value-source branches**

Compile sources exactly:

```ts
export function callValueSourceExpr(source: CallValueSource): string {
  switch (source.source) {
    case 'fixed': return sanitizeDialValue(source.value);
    case 'route_pattern': return '${EXTEN}';
    case 'variable': return `\${${sanitizeVariableName(source.name)}}`;
    case 'original_caller': return '${KRSK_ORIG_CALLER_NUM}';
    case 'current_caller': return '${CALLERID(num)}';
  }
}
```

Initialize status to `ERROR`; set `CURLOPT(conntimeout)=1` and `CURLOPT(httptimeout)=2` immediately before the single CURL; accept `FOUND` or `NOT_FOUND` only when field 1 is `KDL1`; decode requested values only when status is `FOUND`. For `empty`, clear mapped targets before CURL. For `keep`, assign only on `FOUND`. For `skip`, expose a guard expression consumed by the caller. Do not emit any retry path.

Add `case 'directory_lookup'` to `actionToDialplan`; it delegates entirely to this compiler. Remove `buildPhonebookLookupSet`, `PHONEBOOK_TARGET_VAR`, `PHONEBOOK_PRIO_VAR`, and every phonebook URL branch.

- [ ] **Step 4: Run compiler and dialplan suites**

Run:

```bash
npm run test -w @krasterisk/backend -- directory-lookup-dialplan.util.spec.ts dialplan-target.util.spec.ts dialplan.util.spec.ts dialplan-params.spec.ts --runInBand
```

Expected: all focused suites pass and snapshots contain no `PB_`.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/shared/utils packages/backend/src/modules/routes/dto packages/shared
git commit -m "feat(dialplan): centralize directory lookup compilation"
```

---

### Task 6: Replace route phonebook bindings with directory policies

**Files:**
- Create: `packages/backend/src/modules/directories/directory-policy-dialplan.util.ts`
- Create: `packages/backend/src/modules/directories/directory-policy-dialplan.util.spec.ts`
- Modify: `packages/backend/src/modules/routes/route.model.ts`
- Modify: `packages/backend/src/modules/routes/routes.service.ts`
- Modify: `packages/backend/src/modules/routes/routes.service.spec.ts`
- Modify: `packages/backend/src/modules/routes/route-apply.service.ts`
- Modify: `packages/backend/src/modules/routes/route-apply.service.spec.ts`
- Modify: `packages/backend/src/modules/routes/routes.module.ts`
- Modify: `packages/backend/src/modules/routes/dto/route-action.dto.ts`

**Interfaces:**
- Produces: ordered `route_directory_bindings` and `[dir_policy_{bindingUid}_{tenantUid}]` dialplan contexts.
- Consumes: Tasks 2–5.

- [ ] **Step 1: Write failing ownership and policy tests**

Cover:

- binding DTO requires `directory_uid` and `key_source`;
- field-consuming behavior requires a field UID belonging to that directory;
- cross-tenant directory/field references reject route save;
- generated route captures original CallerID before the first policy;
- an empty original CallerID is captured once and is not recaptured after mutation;
- nested generated routes preserve the inherited capture and marker;
- routes without directory policies still establish the invariant for later actions;
- `on_no_match` acts only on literal `NOT_FOUND`;
- `ERROR` returns without drop/redirect;
- `map_fields` writes only declared targets;
- policies remain ordered by `position`.

Critical order assertion:

```ts
expect(dp.indexOf('Set(__KRSK_ORIG_CALLER_NUM=${CALLERID(num)})'))
  .toBeLessThan(dp.indexOf('Gosub(dir_policy_'));
```

- [ ] **Step 2: Run route suites to verify failure**

Run:

```bash
npm run test -w @krasterisk/backend -- directory-policy-dialplan.util.spec.ts routes.service.spec.ts route-apply.service.spec.ts --runInBand
```

Expected: old phonebook imports/contracts fail.

- [ ] **Step 3: Implement policy persistence, validation, generation, and apply**

Replace includes and models with `Directory`, `DirectoryField`, and `RouteDirectoryBinding`. Persist bindings using:

```ts
{
  route_uid: routeUid,
  directory_uid: input.directory_uid,
  position: index,
  key_source: input.key_source,
  match_mode: input.match_mode,
  behavior_type: input.behavior_type,
  behavior_params: input.behavior_params ?? null,
  actions: input.actions ?? null,
  user_uid: userUid,
}
```

Generate the route prelude once per extension. The separate inherited marker is required because an empty original CallerID cannot itself prove that capture occurred:

```ini
same => n,ExecIf($["${KRSK_ORIG_CALLER_CAPTURED}" != "1"]?Set(__KRSK_ORIG_CALLER_NUM=${CALLERID(num)}))
same => n,ExecIf($["${KRSK_ORIG_CALLER_CAPTURED}" != "1"]?Set(__KRSK_ORIG_CALLER_CAPTURED=1))
```

Apply policy categories to `krasterisk/directories/dir_${userUid}.conf` before the route category, with one reload after both. Since record values and schema are runtime data, record edits do not reapply dialplan. Referenced field deletion is blocked, so schema edits also need no regeneration.

After route and apply consumers compile against directories, remove `PhonebooksModule` from `app.module.ts` and delete `packages/backend/src/modules/phonebooks/`. No compatibility endpoint remains.

- [ ] **Step 4: Run focused route tests**

Run:

```bash
npm run test -w @krasterisk/backend -- directory-policy-dialplan.util.spec.ts routes.service.spec.ts route-apply.service.spec.ts route-action.dto.spec.ts --runInBand
```

Expected: all suites pass; generated policy categories use only the centralized lookup protocol.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/modules/directories packages/backend/src/modules/routes packages/backend/src/app.module.ts
git add -u packages/backend/src/modules/phonebooks
git commit -m "feat(routes): apply ordered directory policies"
```

---

### Task 7: Make trunk carousel CallerID stable and batched

**Files:**
- Modify: `packages/backend/src/shared/utils/dialplan-trunk-carousel.util.ts`
- Modify: `packages/backend/src/shared/utils/dialplan-trunk-carousel.util.spec.ts`
- Modify: `packages/backend/src/shared/utils/dialplan.util.ts`
- Modify: `packages/backend/src/shared/utils/dialplan.util.spec.ts`
- Modify: `packages/backend/src/modules/routes/dto/dialplan-params/address.params.dto.ts`
- Modify: `packages/backend/src/modules/routes/dto/dialplan-params/dialplan-params.spec.ts`

**Interfaces:**
- Produces: carousel compilation from `ITrunkCarouselItem[]`, using `trunkId` and `callerId`.
- Consumes: centralized compiler from Task 5.

- [ ] **Step 1: Write the failing regression tests**

Use two directory rows:

```ts
const trunks: ITrunkCarouselItem[] = [
  {
    trunkId: 't_alpha_100',
    timeout: 20,
    callerId: {
      mode: 'directory',
      directoryUid: 7,
      valueFieldUid: 17,
      keySource: { source: 'original_caller' },
      onMissing: 'keep_original',
    },
  },
  {
    trunkId: 't_beta_100',
    timeout: 30,
    callerId: {
      mode: 'directory',
      directoryUid: 7,
      valueFieldUid: 18,
      keySource: { source: 'original_caller' },
      onMissing: 'keep_original',
    },
  },
];
```

Assert:

- URL key is `${KRSK_ORIG_CALLER_NUM}`;
- only one `directory-lookup` CURL exists for directory 7;
- request fields are `17,18`;
- adding a row from directory 8 produces exactly two CURLs total, one per directory;
- scrambled row order and repeated field UIDs still produce sorted, unique request fields and correct row-to-value mapping;
- every attempt restores original CallerID before applying its resolved value;
- neither attempt's lookup references `${CALLERID(num)}`;
- malformed/NOT_FOUND status leaves original CallerID;
- wrap-around and sequential order tests remain green.

- [ ] **Step 2: Run carousel suites to verify failure**

Run:

```bash
npm run test -w @krasterisk/backend -- dialplan-trunk-carousel.util.spec.ts dialplan.util.spec.ts dialplan-params.spec.ts --runInBand
```

Expected: old `trunk`, `cid_mode`, and `phonebook_uid` shape fails.

- [ ] **Step 3: Implement grouped prefetch and per-attempt restore**

Group directory callers by `directoryUid`, union and numerically sort `valueFieldUid`, compile once per group, and map each result to a safe list slot. Each attempt starts with:

```ini
Set(CALLERID(num)=${KRSK_ORIG_CALLER_NUM})
```

Static mode then sets its value if non-empty. Directory mode sets the decoded value only when the grouped lookup status is `FOUND` and the value is non-empty. Dial directly with:

```ini
Dial(PJSIP/${TC_TRUNK_ID}/${destination},${TC_TIMEOUT},${options})
```

Do not prepend `PJSIP/` to stored values in the frontend; the generator owns transport syntax.

- [ ] **Step 4: Run focused dialplan tests**

Run:

```bash
npm run test -w @krasterisk/backend -- dialplan-trunk-carousel.util.spec.ts dialplan.util.spec.ts dialplan-params.spec.ts --runInBand
```

Expected: regression and existing traversal tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/shared/utils packages/backend/src/modules/routes/dto
git commit -m "fix(dialplan): stabilize directory CallerID across trunk attempts"
```

---

### Task 8: Replace frontend phonebook state and API with directories

**Files:**
- Create: `packages/frontend/src/shared/api/endpoints/directoryApi.ts`
- Create: `packages/frontend/src/features/directories/model/slice/directoriesSlice.ts`
- Create: `packages/frontend/src/features/directories/model/slice/directoriesSlice.test.ts`
- Create: `packages/frontend/src/features/directories/model/selectors/directoriesSelectors.ts`
- Create: `packages/frontend/src/features/directories/model/selectors/directoriesSelectors.test.ts`
- Create: `packages/frontend/src/features/directories/index.ts`
- Modify: `packages/frontend/src/app/store/store.ts`
- Modify: `packages/frontend/src/shared/api/rtkApi.ts`

**Interfaces:**
- Produces: directory RTK hooks and `directories` page state.
- Consumes: Task 1 API contracts and Task 4 endpoints.

- [ ] **Step 1: Write failing slice and endpoint contract tests**

Assert tri-state modal behavior and selection using `IDirectory`, not phonebook types. Type-check endpoint hooks for:

```ts
useGetDirectoriesQuery();
useGetDirectoryQuery(uid);
useCreateDirectoryMutation();
useUpdateDirectoryMutation();
useDeleteDirectoryMutation();
useImportDirectoryCsvMutation();
useLookupTestDirectoryMutation();
```

- [ ] **Step 2: Run frontend tests to verify failure**

Run:

```bash
npm run test -w @krasterisk/frontend -- src/features/directories
```

Expected: directory feature modules do not exist.

- [ ] **Step 3: Implement state and API**

Use RTK tag `DialplanDirectories` to avoid collision with the existing call-center `Directory` tag. Management paths are `/directories`; CSV and lookup-test stay nested under a directory UID.

Store only modal state and selected IDs in Redux:

```ts
export interface DirectoriesState {
  modalOpen: boolean;
  modalMode: 'create' | 'edit' | 'copy';
  editingItem: IDirectory | null;
  selectedIds: number[];
}
```

Form drafts remain local component state. Add the `directories` reducer alongside the old reducer in this task; Task 12 removes the old reducer after router/page conversion.

Keep old phonebook frontend files untouched until page and route consumers are replaced in Tasks 9–11. Task 12 deletes them; no new code imports them.

- [ ] **Step 4: Run focused tests and type build**

Run:

```bash
npm run test -w @krasterisk/frontend -- src/features/directories
npm run build -w @krasterisk/frontend
```

Expected: focused tests pass; remaining build failures identify old UI imports to replace in Tasks 9–10.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/shared/api packages/frontend/src/features/directories packages/frontend/src/app/store/store.ts
git commit -m "refactor(frontend): replace phonebook state with directories"
```

---

### Task 9: Build the schema-and-record directory editor

**Files:**
- Create: `packages/frontend/src/features/directories/ui/DirectoriesTable/DirectoriesTable.tsx`
- Create: `packages/frontend/src/features/directories/ui/DirectoriesTable/DirectoriesTable.module.scss`
- Create: `packages/frontend/src/features/directories/ui/DirectoryFormModal/DirectoryFormModal.tsx`
- Create: `packages/frontend/src/features/directories/ui/DirectoryFormModal/DirectoryFormModal.module.scss`
- Create: `packages/frontend/src/features/directories/ui/DirectorySchemaEditor/DirectorySchemaEditor.tsx`
- Create: `packages/frontend/src/features/directories/ui/DirectorySchemaEditor/DirectorySchemaEditor.module.scss`
- Create: `packages/frontend/src/features/directories/ui/DirectoryRecordsEditor/DirectoryRecordsEditor.tsx`
- Create: `packages/frontend/src/features/directories/ui/DirectoryRecordsEditor/DirectoryRecordsEditor.module.scss`
- Create: `packages/frontend/src/features/directories/ui/DirectoryLookupTest/DirectoryLookupTest.tsx`
- Create: colocated tests and `index.ts` files.
- Create: `packages/frontend/src/pages/DirectoriesPage/DirectoriesPage.tsx`
- Create: `packages/frontend/src/pages/DirectoriesPage/DirectoriesPage.module.scss`
- Create: `packages/frontend/src/pages/DirectoriesPage/index.ts`

**Interfaces:**
- Produces: complete directory management surface.
- Consumes: Task 8 hooks.

- [ ] **Step 1: Write failing interaction tests**

Test:

- a new directory cannot save without one lookup field;
- marking a field as lookup unmarks the previous field;
- pattern option is disabled unless the lookup field type is `phone`;
- exact/pattern priority fields serialize correctly;
- copy clears directory name but retains schema and records;
- API reference error prevents field deletion and lists route/action locations;
- lookup test renders `FOUND`, `NOT_FOUND`, and `ERROR` distinctly;
- 360 px test marker shows the records region uses horizontal scrolling.

- [ ] **Step 2: Run editor tests to verify failure**

Run:

```bash
npm run test -w @krasterisk/frontend -- src/features/directories src/pages/DirectoriesPage
```

Expected: UI components are missing.

- [ ] **Step 3: Implement the editor**

Represent the draft explicitly:

```ts
interface DirectoryDraft {
  name: string;
  description: string;
  keyNormalization: DirectoryKeyNormalization;
  lookupFieldKey: string;
  fields: IDirectoryFieldDraft[];
  records: IDirectoryRecordDraft[];
}
```

Management drafts and payload records use immutable field keys, so new schema and records can be submitted atomically before numeric field UIDs exist. Do not invent temporary numeric IDs and do not infer columns by scanning record JSON. CSV headers use immutable field `key`; `comment`, `match_kind`, and `priority` are reserved metadata headers.

Use `TableRowActions`/`TableRowAction`, shared controls, SCSS modules, localized copy, and one scrollable modal body with fixed header/footer.

- [ ] **Step 4: Run focused frontend tests**

Run:

```bash
npm run test -w @krasterisk/frontend -- src/features/directories src/pages/DirectoriesPage
```

Expected: all directory management tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/features/directories packages/frontend/src/pages/DirectoriesPage
git commit -m "feat(frontend): add schema-based directory editor"
```

---

### Task 10: Add reusable directory lookup controls and standalone action UI

**Files:**
- Create: `packages/frontend/src/features/dialplan-apps/ui/DirectoryLookupField/DirectoryLookupField.tsx`
- Create: `packages/frontend/src/features/dialplan-apps/ui/DirectoryLookupField/DirectoryLookupField.module.scss`
- Create: `packages/frontend/src/features/dialplan-apps/ui/DirectoryLookupField/DirectoryLookupField.test.tsx`
- Create: `packages/frontend/src/features/dialplan-apps/ui/DirectoryLookupOutputsField/DirectoryLookupOutputsField.tsx`
- Create: colocated styles/tests/index files.
- Create: `packages/frontend/src/features/dialplan-apps/model/schemas/directoryLookup.tsx`
- Modify: `packages/frontend/src/features/dialplan-apps/ui/ValueSourceField/ValueSourceField.tsx`
- Modify: `packages/frontend/src/features/dialplan-apps/model/schema.types.ts`
- Modify: `packages/frontend/src/features/dialplan-apps/model/useSchemaRefs.ts`
- Modify: `packages/frontend/src/features/dialplan-apps/model/registry.ts`
- Modify: validation/registry tests.

**Interfaces:**
- Produces: reusable controls for `DirectoryValueSource` and `IDirectoryLookupParams`.
- Consumes: directory API from Task 8.

- [ ] **Step 1: Write failing component and registry tests**

Test:

- directory selection loads fields from the selected directory;
- expected type filters fields without hiding the current invalid selection;
- changing directory clears an incompatible field;
- key source supports fixed, route pattern, variable, original caller, current caller;
- output target rejects lowercase, punctuation, duplicates, `CALLERID`, and `KRSK_*`;
- `directory_lookup` is present in the system category and allowed hosts;
- `useSchemaRefs` owns the `dialplanDirectories` catalog query.

- [ ] **Step 2: Run focused tests to verify failure**

Run:

```bash
npm run test -w @krasterisk/frontend -- DirectoryLookupField DirectoryLookupOutputsField registrySchemas useSchemaRefs
```

Expected: controls and registry entry are missing.

- [ ] **Step 3: Implement controls and schema**

`DirectoryLookupField` emits only complete discriminated values:

```ts
onChange({
  source: 'directory',
  directoryUid,
  keySource,
  valueFieldUid,
  onMissing,
});
```

The standalone action schema contains a directory selector, `CallValueSource` control, outputs custom field, and `keep|empty` policy. Add `dialplanDirectories` to `OptionsSource`, `CATALOG_DEFAULTS`, and `useSchemaRefs`; do not query RTK directly inside schema renderers.

- [ ] **Step 4: Run focused frontend tests**

Run:

```bash
npm run test -w @krasterisk/frontend -- DirectoryLookupField DirectoryLookupOutputsField registrySchemas SchemaFields StepSheet
```

Expected: all focused UI/editor tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/features/dialplan-apps
git commit -m "feat(dialplan-ui): add reusable directory lookup action"
```

---

### Task 11: Convert route policies and trunk carousel UI

**Files:**
- Create: `packages/frontend/src/features/routes/ui/RouteFormModal/RouteDirectoriesTab.tsx`
- Create or rename: `packages/frontend/src/features/routes/ui/RouteFormModal/RouteDirectoriesTab.test.tsx`
- Modify: `packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.tsx`
- Modify: `packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.test.tsx`
- Delete: `packages/frontend/src/features/routes/ui/RouteFormModal/RoutePhonebooksTab.tsx`
- Delete: `packages/frontend/src/features/routes/ui/RouteFormModal/RoutePhonebooksTab.test.tsx`
- Modify: `packages/frontend/src/features/dialplan-apps/ui/TrunkCarouselTrunksField/TrunkCarouselTrunksField.tsx`
- Modify: `packages/frontend/src/features/dialplan-apps/ui/TrunkCarouselTrunksField/TrunkCarouselTrunksField.test.tsx`
- Modify: `packages/frontend/src/features/dialplan-apps/model/schemas/totrunk.tsx`
- Modify: `packages/frontend/src/features/dialplan-apps/model/schemas/callerid.tsx`
- Modify: `packages/frontend/src/shared/api/endpoints/routeApi.ts`

**Interfaces:**
- Produces: explicit directory policy payloads and new carousel item shape.
- Consumes: Tasks 1, 8, and 10.

- [ ] **Step 1: Write failing route/carousel UI tests**

Assert a new carousel row:

```ts
expect(onChange).toHaveBeenCalledWith({
  trunks: [{
    trunkId: '',
    callerId: { mode: 'static', value: '' },
    timeout: 60,
  }],
});
```

Directory mode must serialize:

```ts
{
  trunkId: 't_beta_100',
  callerId: {
    mode: 'directory',
    directoryUid: 7,
    valueFieldUid: 18,
    keySource: { source: 'original_caller' },
    onMissing: 'keep_original',
  },
  timeout: 45,
}
```

Test that UI displays immutable key and fallback as explanatory text, trunk options use `item.id`, and route save emits `directory_uid`, `key_source`, and field UIDs without phonebook properties.

- [ ] **Step 2: Run focused tests to verify failure**

Run:

```bash
npm run test -w @krasterisk/frontend -- TrunkCarouselTrunksField RouteFormModal RouteDirectoriesTab
```

Expected: old phonebook shape and component names fail.

- [ ] **Step 3: Implement the converted UI**

Route policy presets:

- `set_name`: one `fieldUid`;
- `set_number`: one `fieldUid` or fixed value;
- `redirect`: one `fieldUid` or fixed extension;
- `map_fields`: one or more `{ fieldUid, targetVariable }`;
- `drop`: no field;
- `custom`: existing action editor with host `directory_policy`.

For carousel directory mode render directory and phone-compatible result-field selects. Keep these read-only semantics visible:

```text
Ключ поиска: исходный CallerID
Если данных нет: сохранить исходный CallerID
```

Remove phonebook options from standalone CallerID schema. Directory-backed CallerID uses the reusable `DirectoryLookupField`; static/list/carousel modes remain only if they are current non-phonebook functionality.

- [ ] **Step 4: Run route and dialplan UI suites**

Run:

```bash
npm run test -w @krasterisk/frontend -- TrunkCarouselTrunksField RouteFormModal RouteDirectoriesTab DialplanAppsEditor StepSheet
```

Expected: focused tests pass and serialized actions match backend DTOs.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/features/routes packages/frontend/src/features/dialplan-apps packages/frontend/src/shared/api/endpoints/routeApi.ts
git commit -m "feat(routes-ui): configure directory policies and trunk CallerID"
```

---

### Task 12: Complete navigation, AI adapter, docs, harness, and cleanup

**Files:**
- Create: `packages/backend/src/modules/directories/directories-ai.adapter.ts`
- Create: `packages/backend/src/modules/directories/directories-ai.adapter.spec.ts`
- Modify: `packages/backend/src/modules/directories/directories.module.ts`
- Modify: `packages/backend/src/modules/ai-chat/knowledge-base.service.ts`
- Modify: AI/MCP adapter tests that enumerate tools.
- Modify: `packages/backend/src/modules/cloud-admin/hub-modules.seed.ts`
- Modify: `packages/frontend/src/app/router/router.tsx`
- Modify: `packages/frontend/src/widgets/Sidebar/lib/buildNavigation.ts`
- Modify: `packages/frontend/src/features/modules/lib/moduleRegistry.ts`
- Modify: `packages/frontend/src/features/modules/lib/moduleRegistry.test.ts`
- Modify: `packages/frontend/src/features/roles/lib/roleGrants.ts`
- Modify: `packages/frontend/src/shared/config/locales/ru.ts`
- Modify: `packages/frontend/src/shared/config/locales/en.ts`
- Create: `.docs/DIRECTORIES_MODULE.md`
- Create: `harness/scenarios/api/directories-crud.test.ts`
- Create: `harness/scenarios/realtime/directory-carousel.test.ts`
- Modify: `harness/runner/registry.ts`
- Modify: `harness/package.json`
- Delete: stale phonebook files and imports found by final search.

**Interfaces:**
- Produces: discoverable module, AI operations, operator documentation, and end-to-end verification.
- Consumes: all previous tasks.

- [ ] **Step 1: Write failing integration and exhaustiveness tests**

AI tools must expose:

```text
list_directories
create_directory
update_directory
delete_directory
list_directory_records
add_directory_records
remove_directory_records
```

Harness API scenario creates a directory with `internal_number`, `cid_alpha`, and `cid_beta`, tests exact and pattern lookup, rejects a foreign tenant, then deletes it.

Realtime scenario asserts the generated/configured sequence:

```text
incoming=100
trunkA callerid=700 DIALSTATUS=NOANSWER
trunkB lookup-key=100 callerid=800
```

It also runs a simulated empty/malformed backend response and asserts both attempts retain `100`.

- [ ] **Step 2: Run focused cross-cutting tests to verify failure**

Run:

```bash
npm run test -w @krasterisk/backend -- directories-ai.adapter.spec.ts mcp-tools.service.spec.ts
npm run test -w @krasterisk/frontend -- moduleRegistry
npm run test:directories -w @krasterisk/harness
```

Expected: AI, navigation, and harness cases are missing.

- [ ] **Step 3: Implement integrations and remove stale names**

Use `/directories` as the only frontend route; do not add `/phonebooks` redirect. Use `nav.directories` keys in both locales. Update the knowledge block to explain explicit key sources, exact-before-pattern behavior, field UIDs, and technical fail-open behavior.

Replace router, store, navigation, and module imports first. Then delete `phonebookApi.ts`, `features/phonebooks/`, `pages/PhonebooksPage/`, and `packages/shared/src/types/phonebook.types.ts`.

Register `DirectoriesAiAdapter` as a `DirectoriesModule` provider with the same AI platform imports used by existing adapters. Test registration through both MCP discovery and generic webhook dispatch.

Add the focused harness script:

```json
"test:directories": "vitest run scenarios/api/directories-crud.test.ts scenarios/realtime/directory-carousel.test.ts"
```

Run repository searches and remove every runtime/config contract match:

```bash
rg "phonebook_uid|phonebookUid|varKey|PB_|RoutePhonebook|PhonebookEntry|cid_mode.*phonebook" packages/backend packages/frontend packages/shared
```

Allowed matches after cleanup: historical `.planning` documents only; no match is allowed under `packages/`.

- [ ] **Step 4: Run the complete verification gate**

Run:

```bash
npm run lint
npm run test:backend
npm run test:frontend
npm run build
npm run harness
```

Expected: all commands exit 0. Record any live-Asterisk-only prerequisite separately; do not label the realtime scenario passed unless it actually ran against the configured host.

- [ ] **Step 5: Commit**

```bash
git add .docs packages/backend packages/frontend packages/shared harness
git commit -m "feat(directories): complete universal dialplan directory integration"
```

---

### Task 13: CSV workflow and directory UX hardening

Added after Task 12. Tasks 1–12 shipped the runtime contract but left the CSV round trip without a user interface and left the editor harder to use than it needs to be.

**Files:**
- Modify: `packages/shared/src/types/directory.types.ts`
- Modify: `packages/backend/src/modules/directories/directories.service.ts`
- Modify: `packages/backend/src/modules/directories/directories.controller.ts`
- Modify: `packages/backend/src/modules/directories/dto/directory.dto.ts`
- Modify: `packages/backend/src/modules/directories/directories.service.spec.ts`
- Modify: `packages/backend/src/modules/directories/directories.controller.spec.ts`
- Create: `packages/frontend/src/shared/lib/csv/` (parse, encoding-aware read, template build, blob download)
- Create: `packages/frontend/src/shared/ui/FileImportButton/`
- Modify: `packages/frontend/src/shared/api/endpoints/directoryApi.ts`
- Create: `packages/frontend/src/features/directories/ui/DirectoryCsvPanel/`
- Modify: `packages/frontend/src/features/directories/ui/DirectoryFormModal/DirectoryFormModal.tsx`
- Modify: `packages/frontend/src/features/directories/ui/DirectorySchemaEditor/DirectorySchemaEditor.tsx`
- Modify: `packages/frontend/src/features/directories/ui/DirectoryRecordsEditor/DirectoryRecordsEditor.tsx`
- Modify: `packages/frontend/src/shared/config/locales/ru.ts`, `en.ts`
- Modify: colocated specs for each changed component.

**Interfaces:**
- Produces: replace-semantics CSV import, authenticated export, schema-derived template, simplified responsive editor.
- Consumes: Tasks 1–12.

- [ ] **Step 1: Write failing CSV contract and UI tests**

Backend:

- import replaces every existing record and bumps `revision` exactly once;
- any row error rolls back and leaves prior records untouched;
- `0712345`, `+79001234567`, `2024-01-15`, and long numeric strings survive as text;
- BOM and both `;` / `,` delimiters parse; quoted newlines survive;
- an empty cell in a required column is rejected, not coerced to `0` or `''`;
- export emits `;` + UTF-8 BOM with deterministic row order;
- export then import into an empty directory reproduces the records.

Frontend:

- import is blocked while the draft is dirty and while the directory is unsaved;
- preview shows delimiter, row count, mapped and unknown columns, and the replace warning with the current record count;
- cancel changes nothing; confirm calls the mutation once;
- row-addressed backend errors render as a list;
- export downloads through the authenticated blob path, not an anchor href;
- template contains schema keys plus `comment`, `match_kind`, `priority`;
- lookup field is chosen by a single control, and a blocked save states its reason;
- records render as cards below the mobile breakpoint and paginate above 25 rows.

- [ ] **Step 2: Run focused suites to verify failure**

```bash
npm run test -w @krasterisk/backend -- directories.service.spec.ts directories.controller.spec.ts --runInBand
npm run test -w @krasterisk/frontend -- src/features/directories src/shared/lib/csv
```

- [ ] **Step 3: Implement**

Backend: parse and validate the whole file before any write; then, in one transaction, delete existing records, insert the parsed set, and bump `revision`. Read CSV as raw text so no cell is coerced to `Number` or `Date`. Accept a BOM and both delimiters; write `;` + BOM. Return `{ imported, replaced, errors }` where each error carries the physical file line.

Frontend: extract CSV helpers and a file-input wrapper into `shared`, add the authenticated blob export, and add a records-tab CSV panel with preview and explicit replace confirmation. Split the modal into tabs, rename the field `label` control to a plain display-name label, replace the per-field lookup switches with one selector, surface save-blocked and API errors, and give records a mobile card mode plus pagination.

- [ ] **Step 4: Re-run focused suites plus responsive checks**

- [ ] **Step 5: Commit**

```bash
git add packages/shared packages/backend packages/frontend docs
git commit -m "feat(directories): add CSV workflow and simplify the editor"
```

---

## Plan Completion Checklist

- [ ] Every requirement in `docs/superpowers/specs/2026-08-28-universal-dialplan-directories-design.md` maps to a task above.
- [ ] No task adds compatibility parsing or data conversion.
- [ ] Shared type names match backend DTO and frontend payload names.
- [ ] `on_no_match` never runs on `ERROR`.
- [ ] Carousel grouping is by directory and requests each field UID once.
- [ ] All direct and policy consumers delegate to the centralized compiler.
- [ ] No generated runtime path emits or reads `PB_*`.
- [ ] No source file under `packages/` references the old phonebook contract.
- [ ] Full lint, tests, build, and harness commands are recorded with outcomes during execution.

