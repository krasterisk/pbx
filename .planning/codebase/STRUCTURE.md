# Codebase Structure

**Analysis Date:** 2026-08-28

## Directory Layout

```
krasterisk-v4/
├── packages/
│   ├── backend/                 # @krasterisk/backend — NestJS API
│   │   ├── src/                 # main.ts, app.module.ts, modules/, shared/
│   │   ├── models/              # Non-TS assets (e.g. silero_vad.onnx)
│   │   └── .idea/               # Backend ARCHITECTURE.md (gitignored)
│   ├── frontend/                # @krasterisk/frontend — React FSD + Capacitor
│   │   ├── src/                 # FSD: app, pages, widgets, features, entities, shared
│   │   ├── android/ ios/        # Capacitor native projects
│   │   ├── docs/                # e.g. ANDROID_WEBRTC_NOTES.md
│   │   └── .idea/               # Frontend ARCHITECTURE.md (gitignored)
│   └── shared/                  # @krasterisk/shared — types, enums, utils
│       └── src/                 # enums/, types/, utils/, fixtures/
├── harness/                     # External black-box runner (Vitest + Playwright)
│   ├── runner/                  # Scenario executor
│   ├── scenarios/               # api/, realtime/, ui/
│   ├── environment/             # DB/Asterisk fixtures
│   └── observability/           # OTel/pino (harness-only)
├── e2e/                         # Legacy Playwright suite (absorbed by harness)
├── .planning/                   # GSD artifacts (STATE, ROADMAP, codebase map)
├── .github/workflows/           # CI (e2e.yml, harness-asterisk.yml)
├── package.json                 # Workspaces + lint/test/dev scripts
├── tsconfig.base.json           # Path alias @krasterisk/shared
├── .env.example                 # Env template (no secrets)
├── AGENTS.md                    # Agent entry + verify commands
└── GSD_GUIDE.md                 # How to run /gsd-* commands
```

## Directory Purposes

**packages/backend/src/**
- Purpose: NestJS application source
- Contains: TypeScript modules, Sequelize models, colocated `*.spec.ts`
- Key files: `main.ts` (listen :5010, prefix `api`), `app.module.ts` (Sequelize + module imports), `sync.ts`
- Subdirectories: `modules/` (one folder per domain), `shared/pipes`, `shared/utils` (dialplan generators)

**packages/backend/src/modules/**
- Purpose: Domain modules (controller + service + model + dto + migrate-*.ts)
- Contains: ~40 modules — `auth`, `users`, `roles`, `endpoints`, `trunks`, `routes`, `contexts`, `ivrs`, `queues`, `call-groups`, `moh`, `prompts`, `tts-engines`, `stt-engines`, `phonebooks`, `time-groups`, `numbers`, `reports/cdr`, `ami`, `ari`, `callcenter`, `ai-agents`, `ai-chat`, `mcp`, `cloud-admin`, `tenant-settings`, `system-settings`, `notifications`, `dialplan-bridge`, `health`, `logger`, `mailer`, `telegram`, `redis`, `voice-robots`, `service-requests`, `komandor-claims`, `sms`, `config`
- Key files: `{name}.module.ts`, `{name}.controller.ts`, `{name}.service.ts`, `{name}.model.ts` or `models/`
- Subdirectories: Large domains nest further (`callcenter/models`, `callcenter/reports`, `cloud-admin/billing`, `reports/cdr`)

**packages/frontend/src/app/**
- Purpose: Application shell
- Contains: Store, router, layouts, global CSS tokens
- Key files: `App.tsx`, `store/store.ts`, `router/router.tsx`, `router/RequireRole.tsx`, `layouts/AppLayout.tsx`, `layouts/PlatformLayout.tsx`, `layouts/StandaloneLayout.tsx`, `styles/globals.css`
- Subdirectories: `layouts/`, `router/`, `store/`, `styles/variables/`

**packages/frontend/src/pages/**
- Purpose: Thin route pages (orchestrate features)
- Contains: One folder per screen (`UsersPage/`, `MohPage/`, `CallCenterAgentPage/`, `platform/`)
- Key files: `{Name}Page.tsx` (+ optional `index.ts`, `*.module.scss`)
- Subdirectories: `platform/` — SuperAdmin console pages

**packages/frontend/src/features/**
- Purpose: Domain UI + Redux page slices
- Contains: Feature folders (`users`, `routes`, `dialplan-apps`, `callcenter`, `modules`, `auth`, …)
- Key files: `index.ts` Public API; `model/slice/`, `model/selectors/`, `model/types/`; `ui/{Component}/`
- Subdirectories: Typical `model/` + `ui/`; `dialplan-apps/model/schemas/` for StepSheet; `callcenter/ui/` for ARM widgets

**packages/frontend/src/entities/**
- Purpose: Shared business objects
- Contains: `User`, `tenantSettings`, `route`, `moh`, `ivr`, `prompt`, `tenant`, `voiceRobot`, …
- Key files: `index.ts` Public API; `model/types`, `model/consts`, `ui/` badges
- Subdirectories: `tenantSettings/api/` holds RTK `tenantSettingsApi.ts`

**packages/frontend/src/widgets/**
- Purpose: Shell chrome reused across pages
- Contains: `ModuleShell`, `ModuleHub`, `MobileBottomBar`, `Header`, `Sidebar`, `AiChatWidget`, `UserBlock`
- Key files: `ModuleShell/ModuleShell.tsx`, `ModuleHub/`
- Subdirectories: One folder per widget + `index.ts`

**packages/frontend/src/shared/**
- Purpose: Cross-cutting UI, API, i18n, native helpers
- Contains: `api/` (rtkApi + endpoints), `ui/` (design-system primitives), `config/locales/`, `hooks/`, `lib/capacitor/`
- Key files: `api/rtkApi.ts`, `api/api.ts` (hook barrel), `ui/index.ts`, `config/i18n.ts`
- Subdirectories: `ui/{ComponentName}/` with `{Name}.tsx` + `{Name}.module.scss` + `index.ts`

**packages/shared/src/**
- Purpose: Published types/enums/utils for both apps
- Contains: `enums/index.ts`, `types/*.types.ts`, `utils/*.ts`, `fixtures/`
- Key files: `index.ts` package barrel
- Subdirectories: `enums/`, `types/`, `utils/`, `fixtures/`

**harness/**
- Purpose: External scenario runner (does not live inside packages/*)
- Contains: `runner/`, `scenarios/{api,realtime,ui}/`, `environment/`, `assertions/`, `observability/`
- Key files: `vitest.config.ts`, `playwright.config.ts`, `package.json`
- Subdirectories: Kind-split scenarios; reports generated locally

**.planning/**
- Purpose: GSD project state and this codebase map
- Contains: `STATE.md`, `PROJECT.md`, `ROADMAP.md`, `CANONICAL_REFS.md`, `codebase/`
- Key files: `CANONICAL_REFS.md` (index of architecture docs)
- Subdirectories: `codebase/`, `phases/`, `sketches/`, `intel/`

## Key File Locations

**Entry Points:**
- `packages/backend/src/main.ts` — API bootstrap, Swagger `/api/docs`
- `packages/backend/src/app.module.ts` — Module + Sequelize model registry
- `packages/frontend/src/index.tsx` — SPA mount
- `packages/frontend/src/app/App.tsx` — Redux + Router
- `packages/frontend/src/standalone.tsx` — v3 iframe HashRouter build
- `packages/frontend/index.html` / `standalone.html` — Vite HTML shells

**Configuration:**
- `package.json` — workspaces, `lint`, `test:backend`, `test:frontend`, `dev:*`
- `tsconfig.base.json` — `@krasterisk/shared` paths
- `packages/backend/nest-cli.json` — Nest sourceRoot `src`, proto assets
- `packages/backend/tsconfig.json` / `tsconfig.build.json`
- `packages/frontend/vite.config.ts` / `vite.standalone.config.ts`
- `packages/frontend/capacitor.config.ts` — `webDir=dist`
- `packages/frontend/.env.example`, root `.env.example`
- `packages/backend/eslint.config.mjs`, `packages/frontend/eslint.config.js`

**Core Logic:**
- `packages/backend/src/modules/` — REST/SSE/WS/MCP domains
- `packages/backend/src/modules/auth/` — JWT, refresh, roles, SuperAdmin
- `packages/backend/src/modules/ami/dialplan-apply.service.ts` — AMI config apply
- `packages/backend/src/shared/utils/dialplan.util.ts` — dialplan generator
- `packages/frontend/src/shared/api/endpoints/` — RTK injectEndpoints (one file per entity)
- `packages/frontend/src/features/dialplan-apps/` — route-chain editor
- `packages/frontend/src/app/store/store.ts` — slice registration
- `packages/frontend/src/app/router/router.tsx` — all routes

**Testing:**
- Backend: colocated `*.spec.ts` under `packages/backend/src/` (Jest `rootDir: src`)
- Frontend: colocated `*.test.ts(x)` / `*.spec.ts` next to slices/components (Vitest)
- Shared: `packages/shared/src/utils/*.spec.ts`
- Harness: `harness/scenarios/`
- E2E leftover: `e2e/tests/`

**Documentation:**
- `packages/frontend/.idea/ARCHITECTURE.md` — FSD, optimistic toggles, tenant rules (MUST READ)
- `packages/backend/.idea/ARCHITECTURE.md` — Nest modules, AMI/ARI, MCP
- `AGENTS.md`, `GSD_GUIDE.md`, `.planning/CANONICAL_REFS.md`
- Module notes: `.docs/*_MODULE.md` (gitignored, local)

## Naming Conventions

**Files:**
- Backend: `kebab-case.controller.ts`, `kebab-case.service.ts`, `kebab-case.model.ts`, `kebab-case.module.ts`, `dto/*.dto.ts`
- Backend tests: `{name}.spec.ts` next to the unit
- Backend one-shot migrations: `migrate-{domain}-{topic}.ts` inside the module
- Frontend components: `PascalCase.tsx` + `PascalCase.module.scss` + `index.ts` in a folder of the same name
- Frontend slices: `{name}Slice.ts`, `{name}Schema.ts`, `{name}Selectors.ts`
- Frontend RTK: `{entity}Api.ts` in `shared/api/endpoints/`
- Frontend tests: `{Name}.test.ts(x)` or `{name}.spec.ts` colocated
- Shared types: `{domain}.types.ts`

**Directories:**
- Backend modules: kebab-case (`call-groups`, `tts-engines`, `tenant-settings`, `cloud-admin`)
- Frontend pages: `PascalCase` + `Page` suffix (`UsersPage`, `MohPage`)
- Frontend features: mix of kebab (`dialplan-apps`, `ai-agents`) and camel (`voiceRobots`, `timeGroups`) — match neighbors in the same domain
- Frontend widgets/entities: Pascal or camel matching existing (`ModuleShell`, `User`, `tenantSettings`)
- `shared/ui` collections: PascalCase folder per primitive

**Special Patterns:**
- Feature Public API: `features/{name}/index.ts` — import from here, not internals
- Entity Public API: `entities/{Name}/index.ts`
- Copy/duplicate: slice `modalMode: 'create' | 'edit' | 'copy'`
- Table row actions: only `TableRowActions` / `TableRowAction` from `@/shared/ui`
- Optimistic Switch mutations: `onQueryStarted` + `updateQueryData` + `undo()`
- Path alias: `@/` → `packages/frontend/src/`; `@krasterisk/shared` → `packages/shared/src`

## Where to Add New Code

**New Feature (full stack):**
- Primary UI: `packages/frontend/src/features/{name}/` (`model/` + `ui/` + `index.ts`)
- Thin page: `packages/frontend/src/pages/{Name}Page/{Name}Page.tsx`
- Route: `packages/frontend/src/app/router/router.tsx` (under `AppLayout` or `PlatformLayout`)
- RTK: `packages/frontend/src/shared/api/endpoints/{name}Api.ts` → `injectEndpoints` on `rtkApi`; re-export hooks from `shared/api/api.ts`
- Slice register: `packages/frontend/src/app/store/store.ts`
- i18n: `packages/frontend/src/shared/config/locales/ru.ts` and `en.ts`
- Backend: `packages/backend/src/modules/{name}/` — `{name}.module.ts`, `.controller.ts`, `.service.ts`, `.model.ts`, `dto/`
- Register module + Sequelize model in `packages/backend/src/app.module.ts`
- Tests: `*.spec.ts` / `*.test.ts` colocated; slice/selector unit tests required; new feature UI needs integration tests
- If user-facing PBX entity: tools in `packages/backend/src/modules/mcp/mcp-tools.service.ts` and twin routes in `ai-chat/ai-webhook.controller.ts`

**New Component / shared primitive:**
- Implementation: `packages/frontend/src/shared/ui/{Name}/{Name}.tsx` + `.module.scss` + `index.ts`
- Export from `packages/frontend/src/shared/ui/index.ts`
- Focus: `ring-inset` pattern (see Input/Select/Textarea)
- Tests: colocated `*.test.tsx` when adding behavior

**New Route / Nest controller method:**
- Definition: `{domain}.controller.ts` with `@UseGuards(JwtAuthGuard)` (and `@Roles` if needed)
- Handler: service method `(…, userUid: number)` using `req.user.vpbx_user_uid`
- Model: `declare user_uid: number` (`field: 'vpbx_user_uid'` only for Asterisk/legacy columns)
- Tests: `{domain}.controller.spec.ts` / `{domain}.service.spec.ts` including cross-tenant 404

**Utilities:**
- Dialplan/shared TS: `packages/backend/src/shared/utils/` or `packages/shared/src/utils/`
- FE helpers: `packages/frontend/src/shared/lib/`
- Types used by both: `packages/shared/src/types/` + export from `packages/shared/src/index.ts`

## Special Directories

**.idea/ (under packages/frontend and packages/backend):**
- Purpose: Canonical architecture docs agents must read
- Source: Hand-maintained (`ARCHITECTURE.md`)
- Committed: No (root `.gitignore` lists `.idea/`) — present in working trees used by GSD

**.docs/:**
- Purpose: Local `*_MODULE.md` domain notes
- Source: Authors on disk
- Committed: No

**packages/backend/migrations/ and \*\*/migrations/:**
- Purpose: Env-specific SQL runner (`db:migrate` → `migrations/run-migrations.js`)
- Source: Ops / not in git
- Committed: No — in-module `migrate-*.ts` scripts are the in-repo alternative

**packages/frontend/android/, ios/, dist/, dist-standalone/:**
- Purpose: Capacitor native trees and Vite build output
- Source: `npx cap sync` / `vite build`
- Committed: Native project folders yes; `dist/` / `dist-standalone/` no

**harness/reports/, coverage/, .backup/:**
- Purpose: Generated test/coverage/tenant-json backups
- Source: Test runs / phase-12 backups
- Committed: No

**\*\*/scripts/, \*\*/proto/cloudapi/, \*\*/data/tts-cache/:**
- Purpose: Deploy scripts, cloned Yandex protos, TTS binary cache
- Source: External clone / runtime
- Committed: No

---

*Structure analysis: 2026-08-28*
*Update when directory structure changes*
