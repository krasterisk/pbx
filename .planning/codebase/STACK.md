# Technology Stack

**Analysis Date:** 2026-08-28

## Languages

**Primary:**
- TypeScript 5.7.3 - All application code in `packages/backend`, `packages/frontend`, `packages/shared`, plus harness/e2e tooling

**Secondary:**
- JavaScript - Nest CLI/`postbuild` copy scripts, Vite config emit (`packages/frontend/vite.config.js`), per-module `migrate-*.ts` runners invoked via Node
- SQL / Asterisk dialplan - generated or applied against existing MySQL Realtime tables and Asterisk contexts (not a first-class language in the repo)
- Protocol Buffers - Yandex Cloud SpeechKit gRPC protos under `packages/backend/src/modules/voice-robots/proto` (copied to `dist` in `packages/backend/package.json` `postbuild`)

## Runtime

**Environment:**
- Node.js >= 22.0.0 (`engines` in `/workspace/package.json` and `packages/frontend/package.json`; Capacitor 8 also requires Node 22+)
- Observed local/cloud agent runtime: Node 22.14.0
- Note: GitHub Actions still pin `node-version: '20'` in `.github/workflows/e2e.yml` and `.github/workflows/harness-asterisk.yml` — below the workspace `engines` floor
- Browser runtime: modern Chromium/WebKit/Firefox (Vite SPA); Capacitor 8 WebView on Android/iOS
- Backend compile target: CommonJS ES2022 (`packages/backend/tsconfig.json`)
- Frontend compile target: ESNext + DOM, bundler module resolution (`packages/frontend/tsconfig.json`)

**Package Manager:**
- npm 10.9.7 (observed); workspaces declared in `/workspace/package.json`
- Workspaces: `packages/shared`, `packages/backend`, `packages/frontend`, `harness`
- Lockfile: `package-lock.json` present at repo root
- Root package name/version: `krasterisk-v4` `4.5.1`; workspace packages `@krasterisk/backend` `4.4.1`, `@krasterisk/frontend` `4.4.3`, `@krasterisk/shared` `1.0.0`

## Frameworks

**Core:**
- NestJS 11.0.10 (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`) - REST API (`/api` prefix), Swagger at `/api/docs`, WebSocket gateways
- React 19.1.0 + React DOM 19.1.0 - SPA (Feature-Sliced Design) in `packages/frontend`
- Express (via `@nestjs/platform-express` 11.0.10) - HTTP adapter
- Capacitor 8.4.2 (`@capacitor/core`, `@capacitor/android`, `@capacitor/ios`) - native shell, `appId` `com.krasterisk.app` in `packages/frontend/capacitor.config.ts`

**Testing:**
- Jest 29.7.0 + ts-jest 29.2.5 + `@nestjs/testing` 11.0.10 - backend unit tests (`*.spec.ts` under `packages/backend/src`)
- Vitest 4.1.4 + Testing Library (React 16.3.2 / jest-dom 6.9.1 / user-event 14.6.1) + jsdom 29.0.2 - frontend unit tests
- Playwright 1.50.0 - `e2e/` (Chromium) and `harness/` UI scenarios
- Harness extras: Vitest 3.0.5, tsx 4.19.3, Testcontainers MySQL 10.28.0 (`harness/package.json`)

**Build/Dev:**
- TypeScript 5.7.3 - shared compiler; `tsconfig.base.json` (strict, ES2022, path alias `@krasterisk/shared`)
- Nest CLI 11.0.4 (`nest build`) - backend compile; proto assets via `packages/backend/nest-cli.json`
- Vite 6.3.1 + `@vitejs/plugin-react` 4.4.1 + `@tailwindcss/vite` 4.1.3 - frontend bundler; dev server port 3010, proxies `/api` and `/socket.io` to `localhost:5010` (`packages/frontend/vite.config.ts`)
- Tailwind CSS 4.1.3 + Sass 1.99.0 + Radix UI primitives + CVA - design system (see `packages/frontend/.idea/ARCHITECTURE.md`)
- ESLint 10.7.0 + typescript-eslint 8.64.0 - `npm run lint` at root

## Key Dependencies

[Only include dependencies critical to understanding the stack - limit to 5-10 most important]

**Critical:**
- sequelize 6.37.6 + sequelize-typescript 2.1.6 + `@nestjs/sequelize` 11.0.0 - ORM over existing Asterisk Realtime MySQL (`synchronize: false` in `packages/backend/src/app.module.ts`)
- mysql2 3.12.0 - MySQL driver
- asterisk-manager 0.2.0 - persistent AMI TCP client (`packages/backend/src/modules/ami/ami.service.ts`)
- ari-client 2.2.0 - Asterisk REST Interface HTTP + WebSocket (`packages/backend/src/modules/ari/`)
- `@nestjs/jwt` 11.0.0 + passport-jwt 4.0.1 + bcrypt 6.0.0 - access/refresh JWT + password hashing
- `@reduxjs/toolkit` 2.6.1 + react-redux 9.2.0 - client state and RTK Query API layer
- sip.js 0.21.2 - Call Center WebRTC softphone (`packages/frontend/src/features/callcenter/lib/useWebRTCPhone.ts`)
- `@grpc/grpc-js` 1.14.3 + `@grpc/proto-loader` 0.8.0 - Yandex SpeechKit STT/TTS streaming (`packages/backend/src/modules/voice-robots/providers/`)
- `@modelcontextprotocol/sdk` 1.29.0 - MCP Streamable HTTP server for aiPBX (`packages/backend/src/modules/mcp/`)
- `@capacitor/push-notifications` 8.1.2 + `@aparajita/capacitor-secure-storage` 8.0.0 - FCM token register + native token vault

**Infrastructure:**
- `@nestjs/platform-socket.io` 11.0.10 + socket.io-client 4.8.1 - AMI events namespace `/ami-events` (`packages/backend/src/modules/ami/ami.gateway.ts`)
- ioredis 5.10.1 - optional Redis (`REDIS_HOST`); stubbed when unset (`packages/backend/src/modules/redis/redis.module.ts`). `bullmq` 5.76.5 is declared but webhook delivery currently uses in-memory retry (`packages/backend/src/modules/routes/webhook-queue.service.ts`)
- helmet 8.1.0 + `@nestjs/throttler` 6.5.0 - security headers / 60 req/min global limit
- axios 1.16.0 (backend) / 1.8.4 (frontend) + `@nestjs/axios` 4.0.1 - outbound HTTP (SMS, SBIS, aiPBX, CRM webhooks)
- ioredis-adjacent local ML: `@huggingface/transformers` 4.1.0 (semantic embeddings) and `onnxruntime-node` 1.24.3 (Silero VAD) in voice-robots
- react-router-dom 7.5.0, i18next 24.2.2, tanstack/react-table 8.21.3, recharts 2.15.3, react-hook-form 7.72.1 - SPA routing/i18n/tables/charts/forms

## Configuration

**Environment:**
- Root env file loaded by Nest `ConfigModule.forRoot` from `../../../.env` relative to compiled `dist` (`packages/backend/src/app.module.ts`) — template: `.env.example`
- Frontend Vite env: `packages/frontend/.env.example` → `.env.local` / flavor files; keys `VITE_API_URL`, `VITE_WSS_URL`
- Harness: `harness/.env.harness.example` → `.env.harness` (gitignored)
- Critical backend vars (names only): `DB_DIALECT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`, `AMI_*`, `ARI_*`, `BACKEND_PORT`, `DEPLOYMENT_MODE`
- Secrets for mail/SMS/Telegram/billing/AI live in env (see `.planning/codebase/INTEGRATIONS.md`); AI provider API keys at rest are AES-256-GCM encrypted with `CC_AI_KEY_SECRET` (`packages/backend/src/modules/ai-agents/util/secret-cipher.util.ts`)

**Build:**
- `/workspace/tsconfig.base.json` - shared TS options and `@krasterisk/shared` paths
- `packages/backend/tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`
- `packages/frontend/tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vite.standalone.config.ts`, `capacitor.config.ts`
- `packages/shared/tsconfig.json` - emits `dist/` CJS for backend `require`
- Root scripts: `dev:backend` (build shared + Nest watch on 5010), `dev:frontend` (Vite 3010), `build`, `lint`, `test:backend`, `test:frontend`, `harness:*`, `db:migrate*`
- `npm run db:migrate` is wired to `packages/backend/migrations/run-migrations.js`, which is **absent** in this tree; schema changes are applied via per-module `migrate-*.ts` scripts under `packages/backend/src/modules/`

## Platform Requirements

**Development:**
- Linux/macOS/Windows with Node.js 22+ and npm 10+
- MySQL 8.0 reachable via `DB_*` (local, CI service, or `harness/environment/compose/docker-compose.yml`)
- Optional: Redis (`REDIS_HOST`), live Asterisk (AMI 5038 / ARI 8088 / PJSIP WSS), Docker for Testcontainers (`USE_TESTCONTAINERS=1`)
- Android Studio ≥ 2025.2.1 for Capacitor native builds (documented in `packages/frontend/capacitor.config.ts`)
- Yandex Cloud `cloudapi` proto clone required for SpeechKit gRPC (see `packages/backend/package.json` `postbuild` warning)

**Production:**
- Self-hosted or SaaS box: Nest process on `BACKEND_PORT` (default 5010), Vite-built static SPA, same-host or reverse-proxied
- `DEPLOYMENT_MODE` in `.env.example`: `CLOUD` | `BOX` | `OPENSOURCE`. `packages/backend/src/modules/cloud-admin/deployment-mode.ts` treats only lowercase `cloud` as SaaS; other code paths uppercase-compare `BOX`/`OPENSOURCE`
- No Dockerfile at repo root; research notes historical PM2 deploy (`/opt/krasterisk_v4`) — `ecosystem.config.js` is **not** in this tree
- Asterisk preferred line: Certified 22 (observed prod `certified-22.8-cert2`); PJSIP Realtime, not `chan_sip` (`packages/backend/.idea/ARCHITECTURE.md` §8)
- Helmet HSTS/CSP upgrade-insecure-requests gated by `HELMET_HSTS=true` (`packages/backend/src/main.ts`) — off by default for HTTP boxes
- Recordings path default `/usr/records` via `RECORDS_BASE_PATH`

---

*Stack analysis: 2026-08-28*
*Update after major dependency changes*
