# Coding Conventions

**Analysis Date:** 2026-08-28

## Naming Patterns

**Files:**
- Backend modules/utils: kebab-case (`call-groups.service.ts`, `dialplan-target.util.ts`) under `packages/backend/src/modules/`
- Frontend FSD slices: PascalCase components (`MohPage.tsx`, `MohFormModal.tsx`); feature folders mix kebab (`call-groups`, `dialplan-apps`) and camel (`voiceRobots`, `callcenter`)
- SCSS modules sit beside the component: `MohPage.module.scss`
- Tests collocated: backend `*.spec.ts`; frontend mostly `*.test.ts` / `*.test.tsx` (some `*.spec.ts` in `features/dialplan-apps`)

**Functions:**
- camelCase; no `async` prefix
- React handlers: `handleSubmit`, `handleLogout`, `handleOpenChange` (`packages/frontend/src/features/moh/ui/MohFormModal/MohFormModal.tsx`)
- Nest CRUD: `findAll` / `findOne` / `create` / `update` / `remove`
- RTK hooks: `useGetXQuery` / `useUpdateXMutation` (`packages/frontend/src/shared/api/endpoints/mohApi.ts`)

**Variables:**
- camelCase; `UPPER_SNAKE` for exported constants (`CALL_GROUP_EXTEN_PATTERN` in `packages/backend/src/modules/call-groups/dto/call-group.dto.ts`)
- Unused args/vars: `_` prefix (`_r`, `_e`) — ESLint `argsIgnorePattern: '^_'`
- No `_` prefix for private members; use TypeScript `private readonly`

**Types:**
- Shared domain interfaces use `I` prefix (`ICallGroup`, `IMohClass` in `packages/shared/src/types/`)
- Newer local types often omit `I` (`TenantSettings`, `MohSchema`, `RingStrategy`)
- Enums: PascalCase name; string members `UPPER_SNAKE` (`PeerStatus.ONLINE`); `UserLevel` is numeric (`SUPERADMIN = 0`) in `packages/shared/src/enums/index.ts`

**Tenant / i18n:**
- JWT tenant is `req.user.vpbx_user_uid`. Never take tenant from body/query (`packages/backend/src/modules/tenant-settings/tenant-settings.controller.ts`)
- DB column `vpbx_user_uid`; Sequelize often maps it to `user_uid` via `field: 'vpbx_user_uid'` (`packages/backend/src/modules/call-groups/call-group.model.ts`)
- Tenant-suffixed Asterisk ids: `moh_{userUid}_{slug}`, `q{exten}_{vpbx}`, `e{exten}_{vpbx}`, `group_{exten}_{vpbx}`
- Locale keys: nested camelCase objects → dotted paths (`common.save`, `moh.title`) in `packages/frontend/src/shared/config/locales/ru.ts` and `en.ts`
- UI copy: `t('moh.title', 'Музыка на удержании')` — key plus Russian fallback

## Code Style

**Formatting:**
- No `.prettierrc` / `.editorconfig`. Backend only: `npm run format -w @krasterisk/backend` (Prettier defaults)
- Observed: single quotes, semicolons, 2-space indent, TypeScript `strict` (`tsconfig.base.json`)
- `no-explicit-any` is **off** in both ESLint configs

**Linting:**
- Flat ESLint: `packages/backend/eslint.config.mjs`, `packages/frontend/eslint.config.js`
- Extends `@eslint/js` recommended + `typescript-eslint` recommended; frontend adds `react-hooks`
- Unused vars: **warn**; unused `_` ignored
- Run from repo root: `npm run lint` (backend then frontend)

## Import Organization

**Order (typical, not enforced by a plugin):**
1. External (`react`, `@nestjs/common`, `vitest`)
2. Workspace / aliases (`@krasterisk/shared`, `@/shared/ui`, `@/features/...`)
3. Relative (`./call-groups.service`, `../../model/slice/mohSlice`)
4. Side-effect / style last (`import cls from './MohPage.module.scss'`)
5. `import type { ... }` for types when the value is unused

**Grouping:**
- Blank line between external, alias, and relative groups
- No alphabetical sort requirement

**Path Aliases:**
- Frontend: `@/` → `packages/frontend/src/` (`packages/frontend/tsconfig.json`, `vite.config.ts`)
- All packages: `@krasterisk/shared` → `packages/shared/src`

## Error Handling

**Patterns:**
- Throw Nest HTTP exceptions from services (`NotFoundException`, `BadRequestException`, `ConflictException`, `HttpException`)
- Controllers stay thin; no global `ExceptionFilter` in `packages/backend/src`
- Global `ValidationPipe` in `packages/backend/src/main.ts`: `whitelist`, `forbidNonWhitelisted`, `transform`
- Stable error codes for i18n when needed: `{ code, message, params }` via `callGroupHttpError` in `packages/backend/src/modules/call-groups/call-groups.service.ts`
- Frontend mutations: `unwrap()`; instant-write Switch mutations patch RTK cache in `onQueryStarted` and `patchResult.undo()` on failure (`packages/frontend/src/shared/api/endpoints/callCenterApi.ts`, `packages/frontend/src/entities/tenantSettings/api/tenantSettingsApi.ts`)

**Error Types:**
- Throw on missing tenant row, validation, unique collisions
- Tenant settings: JWT tenant only — no `@Roles(ADMIN)` (`packages/backend/src/modules/tenant-settings/tenant-settings.controller.ts`)
- Expected HTTP failures stay as Nest exceptions (not `Result<T,E>`)

## Logging

**Framework:**
- Per-service `private readonly logger = new Logger(ClassName.name)` (`@nestjs/common`)
- Audit trail: `LoggerService.logAction(userId, action, entityType, entityId, vpbxUserUid, details)` writes `ActionLog` + Telegram (`packages/backend/src/modules/logger/logger.service.ts`)
- Bootstrap / process diagnostics: `console.log` / `console.error` in `packages/backend/src/main.ts`

**Patterns:**
- Log AMI/external failures and apply-dialplan outcomes at the service
- `logAction` swallows its own errors (`console.error('Failed to log action:')`)
- Frontend: no app logger; user feedback via toast / i18n error keys

## Comments

**When to Comment:**
- Why / invariant / decision id: `D-19`, `T-12-14-02`, `Pitfall 5`
- Tenant isolation and Asterisk name rules
- Skip restating CRUD

**JSDoc/TSDoc:**
- Used on non-obvious public methods (`generateClassName` in `packages/backend/src/modules/moh/moh.service.ts`); not required on every export

**TODO Comments:**
- `// TODO: Phase N — description` or `// TODO: When …` (no username). Examples: `packages/backend/src/modules/prompts/prompts.controller.ts`

## Function Design

**Size:**
- Controllers: route + tenant extract + one service call
- Services: longer; extract `*.util.ts` for dialplan / validation
- Early return / guard clauses are normal

**Parameters:**
- Service methods take `vpbx` / `userUid` as a required argument (usually last)
- DTOs for write bodies (`CreateCallGroupDto`); inline body types still appear on older controllers (`packages/backend/src/modules/moh/moh.controller.ts`)

**Return Values:**
- Explicit returns; Sequelize rows mapped via `toJSON()`
- RTK `transformResponse` applies defaults (`withDefaults` in tenant settings)

## Module Design

**Exports:**
- Named exports for pages/widgets (`export const MohPage = memo(...)`; set `displayName`)
- Feature public API via `index.ts` (`packages/frontend/src/features/moh/index.ts`)
- Entity public API only: `@/entities/tenantSettings` aliases `useGetVpbxTenantSettingsQuery` → `useGetTenantSettingsQuery`
- RTK: empty `rtkApi` + `injectEndpoints` in `packages/frontend/src/shared/api/endpoints/*`; hooks also re-exported from `packages/frontend/src/shared/api/api.ts`
- Redux slices: `export const { actions: mohActions, reducer: mohReducer }`

**Barrel Files:**
- `packages/shared/src/index.ts` re-exports enums/types/utils
- `packages/frontend/src/shared/ui/index.ts` is the UI public API — pages/features import from `@/shared/ui`, not raw HTML
- Layout: `VStack` / `HStack` / `Flex` + `Text`; page styles in SCSS modules (see `packages/frontend/.idea/ARCHITECTURE.md`)

---

*Convention analysis: 2026-08-28*
*Update when patterns change*
