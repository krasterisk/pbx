# Architecture

**Analysis Date:** 2026-08-28

## Pattern Overview

**Overall:** Full-stack multi-tenant monorepo — NestJS modular monolith API + React Feature-Sliced Design (FSD) SPA, sharing contracts via `@krasterisk/shared`. Telephony is Asterisk Realtime (PJSIP/ARA) plus AMI (TCP) and ARI (HTTP/WS).

**Key Characteristics:**
- npm workspaces: `packages/backend` (`@krasterisk/backend`), `packages/frontend` (`@krasterisk/frontend`), `packages/shared` (`@krasterisk/shared`); black-box runner in `harness/`
- Tenant SaaS: every domain write/read is scoped by JWT `vpbx_user_uid` (DB column `user_uid` on project tables)
- Frontend never sends tenant IDs; isolation is server-side only
- Dual real-time paths: Socket.IO `/ami-events` for AMI, SSE `GET /api/callcenter/events` for Call Center
- Capacitor 8 Android/iOS shell around the same Vite SPA (`packages/frontend/capacitor.config.ts`)
- Schema is owned: Sequelize `synchronize: false`; migrations live as `migrate-*.ts` next to modules (folder `migrations/` is gitignored)

## Layers

**Shared contracts (`@krasterisk/shared`):**
- Purpose: Cross-package types, enums, and pure utilities used by both API and UI
- Contains: Enums (`UserLevel`, `ActionType`, AMI events), DTO-shaped types (`packages/shared/src/types/*`), dialplan helpers (`packages/shared/src/utils/dialplan-vpbx.ts`, `dial-target-rewrite.ts`)
- Depends on: Nothing in backend/frontend
- Used by: NestJS services/DTOs, RTK endpoint types, FSD entities

**Frontend app shell (`packages/frontend/src/app/`):**
- Purpose: Bootstrap Redux, router, layouts, design tokens
- Contains: `App.tsx`, `store/store.ts`, `router/router.tsx`, `layouts/AppLayout.tsx` / `PlatformLayout.tsx` / `StandaloneLayout.tsx`, `styles/globals.css`
- Depends on: `features/auth`, `widgets/ModuleShell`, `shared/ui`, `shared/hooks`
- Used by: `packages/frontend/src/index.tsx` (and `standalone.tsx` for v3 iframe)

**Frontend FSD pages (`packages/frontend/src/pages/`):**
- Purpose: Thin route orchestrators (compose features/widgets; no fat business logic)
- Contains: `UsersPage`, `MohPage`, `RoutesPage`, `CallCenterAgentPage`, `ModulesHubPage`, `pages/platform/*`
- Depends on: `features/*`, `widgets/*`, `shared/ui`
- Used by: `packages/frontend/src/app/router/router.tsx`

**Frontend features (`packages/frontend/src/features/`):**
- Purpose: Domain UI + page slices (tables, form modals, copy/create/edit triad)
- Contains: `model/slice`, `model/selectors`, `model/types`, `ui/*`, `index.ts` Public API
- Depends on: `entities/*`, `shared/api`, `shared/ui` — no Tailwind in JSX above `shared/ui`
- Used by: Pages and widgets

**Frontend entities (`packages/frontend/src/entities/`):**
- Purpose: Cross-feature business objects (badges, consts, selectors, some RTK slices)
- Contains: `User`, `tenantSettings` (including optimistic `tenantSettingsApi.ts`), `route`, `moh`, `ivr`
- Depends on: `shared/api`, `@krasterisk/shared`
- Used by: Features and pages

**Frontend shared (`packages/frontend/src/shared/`):**
- Purpose: Single RTK API, UI kit, i18n, Capacitor helpers
- Contains: `api/rtkApi.ts` + `api/endpoints/*`, `ui/` (Switch, DataTable, TableRowActions, Stack, Dialog…), `config/locales/{ru,en}.ts`, `lib/capacitor/`
- Depends on: `@krasterisk/shared`, Radix/CVA wrappers only inside `ui/`
- Used by: All FSD layers

**Backend HTTP / WS / SSE (`packages/backend/src/modules/*` controllers + gateways):**
- Purpose: Transport boundary — JWT/RBAC, DTO validation, tenant extraction
- Contains: `*.controller.ts`, `ami/ami.gateway.ts` (Socket.IO namespace `/ami-events`), `callcenter/callcenter-sse.controller.ts`, `mcp/mcp.controller.ts`
- Depends on: Auth guards + services; never trusts tenant IDs from body/query
- Used by: Frontend RTK, MCP clients, Asterisk dialplan-bridge, public wallboard

**Backend domain services:**
- Purpose: Tenant-scoped CRUD, dialplan generation/apply, AMI/ARI side effects, bulk jobs
- Contains: `*.service.ts` (e.g. `moh.service.ts`, `routes.service.ts`, `callcenter.service.ts`, `ami/dialplan-apply.service.ts`)
- Depends on: Sequelize models + `packages/backend/src/shared/utils/dialplan*.ts`
- Used by: Controllers, MCP tools, AI webhook controller

**Persistence / Asterisk:**
- Purpose: MySQL (existing `krasterisk` DB) + live PBX
- Contains: `*.model.ts` (project tables + ARA `ps_endpoints` / `ps_auths` / `ps_aors` / `musiconhold`)
- Depends on: Sequelize with `synchronize: false`, `freezeTableName: true`
- Used by: Services only

## Data Flow

**Authenticated REST (typical CRUD feature):**

1. User hits a page under `AppLayout` (`packages/frontend/src/app/layouts/AppLayout.tsx`) — JWT required
2. Feature table calls an RTK hook from `packages/frontend/src/shared/api/endpoints/{entity}Api.ts`
3. `rtkApi` (`packages/frontend/src/shared/api/rtkApi.ts`) attaches `Authorization: Bearer` from Redux/`localStorage` (native: Secure Storage via `features/auth/lib/tokenStorage.ts`)
4. NestJS `JwtAuthGuard` + `JwtStrategy` (`packages/backend/src/modules/auth/`) set `req.user` (`JwtPayloadUser`: `sub`, `level`, `vpbx_user_uid`)
5. Controller passes **only** `req.user.vpbx_user_uid` into the service (canonical; no `user_uid` fallback chains)
6. Service queries `where: { user_uid: userUid }` (or ARA `tenantid` / `field: 'vpbx_user_uid'` mapped to TS `user_uid`)
7. On update/create: `delete dto.user_uid` so the client cannot retarget another tenant
8. Optional `LoggerService.logAction` writes `action_logs`
9. JSON response updates RTK cache tags; UI re-renders

**Optimistic toggles (Switch bound to RTK cache — MUST):**

Any `Switch` that writes immediately (no Save button) and whose `checked` comes from RTK Query cache must patch the cache in the mutation:

1. UI flip calls a mutation (`updateMyNotifications`, `updateMyUiCustomization` in `packages/frontend/src/shared/api/endpoints/callCenterApi.ts`; `updateVpbxTenantSettings` in `packages/frontend/src/entities/tenantSettings/api/tenantSettingsApi.ts`)
2. `async onQueryStarted` → `api.util.updateQueryData(...)` so the Switch moves instantly
3. On success: write the server payload into the same cache entry
4. On error: `patchResult.undo()` **and** toast/error — do not wait on `invalidatesTags` + refetch
5. Forms with local `useState` + explicit Save are exempt (already optimistic in the form)

**Auth / session:**

1. `POST /api/auth/login` (`packages/backend/src/modules/auth/auth.controller.ts`) returns access + refresh; session row in `user_sessions`
2. Frontend `authSlice` (`packages/frontend/src/features/auth/model/authSlice.ts`) stores tokens; 401 triggers `POST /api/auth/refresh` inside `baseQueryWithReauth`
3. Refresh rotates tokens; failure clears storage and redirects to `/login`
4. Native Capacitor hydrates tokens before UI assumes a session (`hydrateAuthFromStorage` in `store.ts`)

**AMI → browser:**

1. `AmiService` (`packages/backend/src/modules/ami/ami.service.ts`) holds a persistent TCP AMI connection (`asterisk-manager`)
2. Events (PeerStatus, QueueMemberStatus, NewChannel, Hangup) fan out to `AmiGateway` (`ami.gateway.ts`, namespace `/ami-events`)
3. Browser Socket.IO client receives `peerStatus` / `agentStatus` / `newChannel` / `hangup` / `dashboardUpdate`

**Call Center live panel:**

1. Agent page opens SSE `GET /api/callcenter/events?token=<JWT>` (`callcenter-sse.controller.ts`)
2. JWT extracted from query (`JwtStrategy` supports `?token=`)
3. Stream is filtered by `req.user.vpbx_user_uid`; heartbeat every 15s
4. Frontend `features/callcenter` patches RTK cache / `callCenterSlice` from SSE (`agentUpdate`, `presenceUpdate`, `historyRow`, queue metrics)

**Dialplan apply (routes / IVR / call-groups / queues):**

1. Feature save hits REST (`routes`, `ivrs`, `call-groups`, `queues`)
2. Service generates tenant-suffixed contexts (`q{exten}_{uid}`, `e{exten}_{uid}`, `group_{exten}_{uid}` — never raw `${EXTEN}` in Dial/Queue)
3. `DialplanApplyService` (`packages/backend/src/modules/ami/dialplan-apply.service.ts`) writes via AMI CreateConfig/UpdateConfig + `dialplan reload`
4. Dialplan apps from Asterisk call `POST /api/internal/dialplan/notify` (`dialplan-bridge`) with `DIALPLAN_API_KEY`

**MCP / AI tools:**

1. Client POSTs JSON-RPC to `/api/mcp` (`packages/backend/src/modules/mcp/`)
2. `JwtOrServiceTokenGuard` identifies tenant (`JWT` or `KRASTERISK_SERVICE_TOKEN` + `X-Vpbx-User-Uid`)
3. Isolated `McpServer` registers tools in `mcp-tools.service.ts` — new user-facing entities must add `create_/update_/delete_` tools
4. Legacy webhook twin: `packages/backend/src/modules/ai-chat/ai-webhook.controller.ts` (`/api/ai-tools/*`)

**State Management:**
- Server: request-scoped; Call Center also keeps in-memory maps (`CallCenterStateService`, metrics accumulators) keyed by tenant
- Client: RTK Query cache is the server-data source of truth; feature slices hold modal/table chrome only (`isModalOpen`, `modalMode: 'create' | 'edit' | 'copy'`, `selectedItem`)
- Local form drafts stay in `useState` / react-hook-form — never in Redux
- Tokens: web `localStorage`; native `@aparajita/capacitor-secure-storage`

## Key Abstractions

**NestJS domain module:**
- Purpose: One telephony/admin domain = module + controller + service + Sequelize model + DTO
- Examples: `packages/backend/src/modules/moh/`, `modules/routes/`, `modules/call-groups/`, `modules/tenant-settings/`
- Pattern: Controller extracts `req.user.vpbx_user_uid`; service always takes `userUid: number`

**Tenant column mapping:**
- Purpose: Isolate rows without trusting the client
- Examples: JWT `vpbx_user_uid`; TS/DB project columns `user_uid`; ARA columns `vpbx_user_uid` mapped with `@Column({ field: 'vpbx_user_uid' }) declare user_uid`; PJSIP `ps_endpoints.tenantid`
- Pattern: Canonical names from `packages/frontend/.idea/ARCHITECTURE.md` (Multi-Tenant Isolation)

**FSD feature slice:**
- Purpose: Table + modal + page chrome for one domain
- Examples: `packages/frontend/src/features/users/`, `features/trunks/`, `features/routes/`, `features/moh/`
- Pattern: Public `index.ts`; slice triad `openCreateModal` / `openEditModal` / `openCopyModal`; UI in named folders with `.module.scss`

**RTK injectEndpoints:**
- Purpose: One `createApi` instance, entity files inject tags/hooks
- Examples: `packages/frontend/src/shared/api/rtkApi.ts`, `endpoints/userApi.ts`, `endpoints/callCenterApi.ts`, `entities/tenantSettings/api/tenantSettingsApi.ts`
- Pattern: `providesTags` / `invalidatesTags`; optimistic mutations use `onQueryStarted` + `undo()`

**Optimistic toggle:**
- Purpose: Instant Switch UX for server-backed settings
- Examples: `updateMyNotifications`, `updateMyUiCustomization` (`callCenterApi.ts`); `updateVpbxTenantSettings` (`tenantSettingsApi.ts`); outbound-work Switch patches both RTK `getAgentMe` and `callCenterSlice`
- Pattern: Patch → fulfill overwrite → undo + toast

**Dialplan chain builder:**
- Purpose: Schema-driven step editor reused by routes (and hosts via `hostTypes`)
- Examples: `packages/frontend/src/features/dialplan-apps/` (`registry.ts`, `model/schemas/*`, `ui` StepSheet); backend `packages/backend/src/shared/utils/dialplan.util.ts`
- Pattern: Registry + `FieldSchema` only (no per-app React pages); catalogs via `useSchemaRefs.ts`

**Module Hub / ModuleShell:**
- Purpose: Modular IA — Hub catalog, in-module chrome, platform console
- Examples: `widgets/ModuleHub`, `widgets/ModuleShell`, routes `/modules`, `/system/modules`, `/platform/*` (`PlatformLayout`, SuperAdmin only)
- Pattern: Hub grants + `role_start` defaults; command palette is `shared/ui/CommandPalette` (Dialog+Input, no `cmdk`)

**Guards:**
- Purpose: AuthN/AuthZ at the boundary
- Examples: `jwt-auth.guard.ts`, `roles.guard.ts` + `@Roles()`, `superadmin.guard.ts`, `jwt-or-service-token.guard.ts`, `cloud-admin/module-access.guard.ts`
- Pattern: SUPERADMIN bypasses tenant `@Roles`; platform routes use `SuperAdminGuard` / FE `RequireRole`

## Entry Points

**Backend HTTP:**
- Location: `packages/backend/src/main.ts`
- Triggers: `npm run dev:backend` / Nest listen (`BACKEND_PORT` default 5010)
- Responsibilities: Helmet/CORS, global prefix `api`, `ValidationPipe` (whitelist + forbidNonWhitelisted), Swagger at `/api/docs`, process diagnostics

**Backend composition root:**
- Location: `packages/backend/src/app.module.ts`
- Triggers: NestFactory.create
- Responsibilities: Config (root `.env`), Sequelize model registry (`synchronize: false`), Throttler (60/min global), import all domain modules

**Frontend SPA:**
- Location: `packages/frontend/src/index.tsx` → `packages/frontend/src/app/App.tsx`
- Triggers: Vite `:3010` / Capacitor WebView
- Responsibilities: i18n, design tokens, native API-base override, Redux + `RouterProvider`

**Frontend standalone (v3 iframe):**
- Location: `packages/frontend/src/standalone.tsx` + `standalone.html`
- Triggers: Hash routes under `/standalone` or v3 embed
- Responsibilities: HashRouter subset (voice-robots, komandor, STT/TTS); API via `/api/public/*` (no JWT)

**Public / machine entry points:**
- `GET /api/health` — `packages/backend/src/modules/health/health.controller.ts` (no JWT)
- `GET /callcenter/wallboard` — display-token SSE, outside `AppLayout`
- `POST/GET/DELETE /api/mcp` — MCP Streamable HTTP
- `POST /api/internal/dialplan/notify` — Asterisk → backend (`DIALPLAN_API_KEY`)

## Error Handling

**Strategy:** NestJS exceptions at the API boundary; RTK Query errors + toasts on the client; 401 intercepted for refresh.

**Patterns:**
- `ValidationPipe` rejects unknown DTO keys; class-validator on DTOs; Zod `inputSchema` on MCP tools
- Services throw `NotFoundException` when `findOne({ uid, user_uid })` misses (cross-tenant looks like 404)
- `baseQueryWithReauth` retries once after refresh; else wipe tokens and `window.location.href = '/login'`
- Optimistic mutations: `patchResult.undo()` + `toast.error` (see `agentStartOutboundWork` in `callCenterApi.ts`)
- Process-level: `uncaughtException` / `unhandledRejection` logged in `main.ts`

## Cross-Cutting Concerns

**Logging:**
- `LoggerService` + `ActionLog` (`packages/backend/src/modules/logger/`) after mutating CRUD
- Telegram bot duplicates critical events (`packages/backend/src/modules/telegram/`)
- Nest `Logger` in AMI/SSE/MCP services

**Validation:**
- HTTP: class-validator DTOs + global ValidationPipe
- Dialplan action params: `packages/backend/src/shared/pipes/action-params-validation.util.ts`
- MCP: Zod in `mcp-tools.service.ts`
- FE forms: HTML constraints + explicit submit checks; `aria-invalid` under fields

**Authentication / authorization:**
- JWT access (short) + refresh rotation (`user_sessions`)
- `RolesGuard` on `@Roles(UserLevel.ADMIN|SUPERVISOR|…)`
- `SuperAdminGuard` for `/platform` and cloud-admin
- FE `RequireRole` (`packages/frontend/src/app/router/RequireRole.tsx`) for supervisor/admin/platform routes
- Service token path for aiPBX/MCP (`X-Vpbx-User-Uid`)

**Tenant isolation:**
- JWT field `vpbx_user_uid`; controllers pass it as `userUid`
- Project tables: `user_uid` + index; ARA: `field: 'vpbx_user_uid'` or `tenantid` / context suffix (`sip-out{uid}`)
- Pickup/call groups namespaced `t{vpbxUserUid}_{slug}`
- Frontend must not put `user_uid` / `vpbx_user_uid` on query strings or bodies

**i18n / UI system:**
- `useTranslation()` + `packages/frontend/src/shared/config/locales/{ru,en}.ts`
- Tokens only from `packages/frontend/src/app/styles/globals.css` `@theme` (`var(--color-*)`, `var(--z-index-*)`)
- Layers above `shared/ui`: Stack/Text/shared controls; SCSS modules; Lucide icons; no emoji; no em dash in UI copy

**Rate limiting:**
- Global `ThrottlerGuard` 60/min (`app.module.ts`); stricter `@Throttle` on login/register and AI POST

---

*Architecture analysis: 2026-08-28*
*Update when major patterns change*
