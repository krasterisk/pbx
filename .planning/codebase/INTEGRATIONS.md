# External Integrations

**Analysis Date:** 2026-08-28

## APIs & External Services

**Payment Processing:**
- Internal tenant ledger (not Stripe/PayPal) - SaaS module licenses and balance in MySQL
  - SDK/Client: Nest services in `packages/backend/src/modules/cloud-admin/billing/`
  - Auth: JWT for `/api/billing/*` (tenant) and `/api/cloud-admin/billing/tenants/:id/*` (superadmin)
  - Incoming bank credits: Alfa-Bank via companion `alfawebhook` → `POST /api/billing/bank-webhook` (`BANK_WEBHOOK_SECRET` Bearer)
  - Accounting export: SBIS when `ACCOUNTING_PROVIDER=sbis` (`SBIS_LOGIN`, `SBIS_PASS`, `SBIS_ACC`, `SBIS_PBX_SUBJECT_CODE`, `SBIS_PBX_SUBJECT`, plus seller `OOO_INN` / `OOO_KPP` / `OOO_NAME`)
  - Reminder cadence override: `BILLING_REMINDER_DAYS`

**Email/SMS:**
- SMTP (nodemailer 8.0.5) - activation codes, call notifications, scheduled report attachments
  - SDK/Client: `packages/backend/src/modules/mailer/mailer.service.ts`
  - Auth: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` (port 465 → `secure: true`)
  - Public links in mail use `APP_URL`
- Beeline A2P SMS - transactional SMS
  - Integration method: REST `POST https://a2p-sms-https.beeline.ru/proto/http/rest` (`packages/backend/src/modules/sms/sms.service.ts`)
  - Auth: header `X-ApiKey` from `SMS_BEELINE_TOKEN`

**External APIs:**
- Asterisk AMI - live peer/queue/channel events, originate/control
  - Integration method: persistent TCP via `asterisk-manager` 0.2.0 (`packages/backend/src/modules/ami/ami.service.ts`)
  - Auth: `AMI_HOST` (default 127.0.0.1), `AMI_PORT` (5038), `AMI_LOGIN`, `AMI_SECRET` (must match `manager.conf`)
  - Skips connect when `AMI_SECRET` is empty; exponential reconnect 5s–60s
- Asterisk ARI - Stasis / voice robots, bridges, channel vars
  - Integration method: HTTP + WS via `ari-client` 2.2.0 (`packages/backend/src/modules/ari/ari-http-client.service.ts`, `ari-connection.service.ts`)
  - Auth: `ARI_PROTOCOL`, `ARI_HOST`, `ARI_PORT` (8088), `ARI_USER`, `ARI_PASSWORD`
  - Stasis app: `ARI_APP_NAME` (default `krasterisk_voicerobots` in `packages/backend/src/modules/ari/ari-app-name.ts`)
  - Media: `EXTERNAL_RTP_HOST`, `RTP_MIN_PORT`, `RTP_MAX_PORT`
- Asterisk PJSIP WebRTC - browser/native softphone REGISTER
  - Integration method: `GET /api/callcenter/webrtc/config` returns `ASTERISK_WSS_URL` + ICE (`packages/backend/src/modules/callcenter/callcenter-webrtc.controller.ts`)
  - SIP domain: `SIP_DOMAIN` (fallback `DB_HOST`); provision port `SIP_PORT` (default 5060)
  - STUN default `stun:stun.l.google.com:19302` unless `WEBRTC_STUN_SERVERS`; optional TURN `WEBRTC_TURN_URL`, `WEBRTC_TURN_USERNAME`, `WEBRTC_TURN_PASSWORD`
- Yandex Cloud SpeechKit - streaming STT/TTS for voice robots and IVR
  - Integration method: gRPC v3 to `stt.api.cloud.yandex.net:443` and `tts.api.cloud.yandex.net:443` (`yandex-streaming-stt.provider.ts`, `yandex-streaming-tts.provider.ts`); REST templates also seeded for AI Agents
  - Auth: IAM (`t1.*`) or API key (`AQVN*`) stored per-row in `tts_engines` / `stt_engines` (`token` + `settings.folder_id`), not in `.env`
  - Debug flags: `DEBUG_YANDEX_SPEECHKIT`, `DEBUG_YANDEX_STT`, `DEBUG_YANDEX_TTS`
  - Protos: clone `https://github.com/yandex-cloud/cloudapi` into `packages/backend/src/modules/voice-robots/proto`
- AI provider templates (tenant-supplied keys, encrypted with `CC_AI_KEY_SECRET`) in `packages/backend/src/modules/ai-agents/seed/providers.seed.ts`:
  - OpenAI Realtime `wss://api.openai.com/v1/realtime` and Chat Completions `https://api.openai.com/v1/chat/completions`
  - Qwen / DashScope `wss://dashscope.aliyuncs.com/api/v1/realtime`
  - Ollama local `http://127.0.0.1:11434/api/chat`
  - Piper TTS local `http://127.0.0.1:5000/api/tts`
  - Whisper STT local `http://127.0.0.1:9000/asr`
- aiPBX Chat + MCP - in-app AI assistant
  - Integration method: SSE proxy to `{AIPBX_URL}` with `AIPBX_TOKEN`, `AIPBX_CHAT_ID` (`packages/backend/src/modules/ai-chat/ai-chat.service.ts`)
  - Callback: aiPBX calls `{KRASTERISK_PUBLIC_URL}/api/mcp` with `Authorization: Bearer <KRASTERISK_SERVICE_TOKEN>` and `X-Vpbx-User-Uid`
  - Legacy tools: `/api/ai-tools/*` (`packages/backend/src/modules/ai-chat/ai-webhook.controller.ts`)
- Telegram Bot API - admin/ops alerts and tenant notification channel
  - SDK/Client: `node-telegram-bot-api` 0.67.0 (`packages/backend/src/modules/telegram/telegram.service.ts`)
  - Auth: `TELEGRAM_BOT_TOKEN`, default chat `TELEGRAM_CHAT_ID` (polling disabled)
- SBIS Online - e-invoicing JSON-RPC
  - Endpoint: `https://online.sbis.ru/auth/service/` (`packages/backend/src/modules/cloud-admin/billing/accounting/providers/sbis-accounting.provider.ts`)
- Google STUN - ICE for WebRTC (public STUN; no Google account)
- Hugging Face model download - Nomic Embed Text v1.5 on first semantic-router use (`@huggingface/transformers`); not an authenticated API

## Data Storage

**Databases:**
- MySQL 8.0 (existing Asterisk Realtime + Krasterisk app schema, typical DB name `krasterisk`)
  - Connection: `DB_DIALECT` (default `mysql`), `DB_HOST`, `DB_PORT` (3306), `DB_USER`, `DB_PASSWORD`, `DB_NAME` in `.env.example`; Sequelize in `packages/backend/src/app.module.ts`
  - Client: sequelize 6.37.6 / sequelize-typescript 2.1.6 / mysql2 3.12.0
  - `synchronize: false`, `timestamps: false`, `freezeTableName: true` — does not auto-alter Asterisk tables
  - Realtime tables written by backend: `ps_endpoints`, `ps_auths`, `ps_aors` (reads `ps_contacts`); app tables include `users`, `user_sessions`, `action_logs`, CDR, queues, IVR, voice robots, callcenter `cc_*`, `billing_balances`, `billing_transactions`, `webhook_failures`, `device_tokens`
  - Tenant isolation column: `vpbx_user_uid` (see `packages/backend/.idea/ARCHITECTURE.md`)
  - Migrations: per-module `migrate-*.ts` next to features; root `db:migrate` runner file is missing
  - CI/harness compose: `mysql:8.0` in `.github/workflows/e2e.yml` and `harness/environment/compose/docker-compose.yml` (`MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE` — values are CI defaults, not production secrets)

**File Storage:**
- Local/Asterisk filesystem - MixMonitor WAV + ffmpeg MP3
  - Path: `RECORDS_BASE_PATH` (prod observed `/usr/records`; overridable via `system_settings.records_base_path`)
  - Public download base in hangup webhooks: `RECORDS_BASE_URL`
- IVR TTS cache directory: `TMPDIR` or `/tmp/krasterisk-ivr-tts` (`packages/backend/src/modules/ivrs/ivr-tts-cache.service.ts`)
- No S3/GCS client in application packages

**Caching:**
- Redis (optional) - shared ioredis client when `REDIS_HOST` is set (`REDIS_PORT` default 6379)
  - Client: ioredis 5.10.1 via `packages/backend/src/modules/redis/redis.module.ts`
  - If unset or connect fails: null stub; webhook retries fall back to in-memory `setTimeout` (3 attempts) as documented in `.env.example`
- TTS audio cache in-process (`packages/backend/src/modules/voice-robots/services/tts-cache.service.ts`)

## Authentication & Identity

**Auth Provider:**
- Custom JWT (Passport), not Auth0/Supabase
  - Implementation: `@nestjs/jwt` + `passport-jwt` (`packages/backend/src/modules/auth/`)
  - Access token: `JWT_SECRET`, `JWT_EXPIRES_IN` (default `2h`); extracted from `Authorization: Bearer` or `?token=` (SSE)
  - Refresh token: `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` (default `30d`); stored in `user_sessions` with rotation on `POST /api/auth/refresh`
  - Token storage (web): `localStorage` keys `accessToken`, `refreshToken`, `user` (`packages/frontend/src/features/auth/lib/tokenStorage.ts`)
  - Token storage (native): `@aparajita/capacitor-secure-storage` (Android Keystore / iOS Keychain)
  - Passwords: bcrypt; registration email codes via SMTP (`POST /api/auth/register`, `POST /api/auth/activation`) — BOX/OPENSOURCE only
  - RBAC: `RolesGuard` + `@Roles()` on `user.level`; multi-tenant bind from JWT `vpbx_user_uid`
  - Service-to-service: `KRASTERISK_SERVICE_TOKEN` + `X-Vpbx-User-Uid` (`packages/backend/src/modules/auth/service-token.guard.ts`)
  - Dialplan → backend: `DIALPLAN_API_KEY` (header `x-api-key` or body; empty disables validation on some paths)

**OAuth Integrations:**
- None for end-user login (no Google/GitHub social sign-in)
- Yandex / OpenAI / Qwen credentials are per-tenant provider rows, not OAuth redirect flows

## Monitoring & Observability

**Error Tracking:**
- None in app packages (no Sentry DSN)

**Analytics:**
- None (no Mixpanel/GA product analytics SDK)

**Logs:**
- NestJS `Logger` / stdout (PM2-oriented process diagnostics in `packages/backend/src/main.ts`)
- Telegram duplication of critical `LoggerService` / `action_logs` events
- Harness-only: pino 9.14.0 + OpenTelemetry SDK 0.221.0 (`harness/observability/logger.ts`) — not wired into Nest/React
- Liveness: public `GET /api/health` (`packages/backend/src/modules/health/health.controller.ts`)
- Call-center queue log: `CC_QUEUE_LOG_BACKEND` (`realtime` default) and `CC_QUEUE_LOG_PATH` (default `/var/log/asterisk/queue_log`); window `CC_QUEUE_LOG_RECENT_HOURS`

## CI/CD & Deployment

**Hosting:**
- Self-hosted Nest + static SPA (BOX) or multi-tenant CLOUD SaaS; `APP_VERSION`, `APP_URL`, `DEFAULT_VPBX_USER_UID`
- No root Dockerfile; optional MySQL-only compose for harness
- Frontend flavors: `VITE_API_URL` / `VITE_WSS_URL`; native runtime overrides via Capacitor Preferences keys `apiUrlOverride`, `wssUrlOverride` (`packages/frontend/src/shared/lib/capacitor/envUrls.ts`)
- Swagger UI: `http://localhost:{BACKEND_PORT}/api/docs`

**CI Pipeline:**
- GitHub Actions
  - `.github/workflows/e2e.yml` — Playwright Chromium on `main`/`develop` PR/push; MySQL 8 service; env `DB_*`, `JWT_SECRET`, `CC_AI_KEY_SECRET`, `PW_USER`, `PW_PASS`, `PLAYWRIGHT_BASE_URL`
  - `.github/workflows/harness-asterisk.yml` — `workflow_dispatch` + nightly cron; lab secrets `AMI_*`, `ARI_*`, `HARNESS_ORIGINATE_EXTEN`, `HARNESS_AGENT_INTERFACE`
- Secrets location: GitHub repo secrets for lab AMI/ARI; local `.env` / `.env.local` / `.env.harness` (gitignored)
- Node in CI: 20 (see STACK.md engines mismatch)

## Environment Configuration

**Development:**
- Required env vars: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `JWT_REFRESH_SECRET`
- Softphone: `ASTERISK_WSS_URL` (must be the live PJSIP WSS — do not invent a sample)
- Secrets location: repo-root `.env` (from `.env.example`); frontend `.env.local`; harness `.env.harness`
- Mock/stub: AMI skipped without `AMI_SECRET`; Redis stub without `REDIS_HOST`; Telegram/SMS/SMTP no-op when tokens empty; accounting `none` unless SBIS vars set
- Frontend Vite proxy: `/api` and `/socket.io` → `http://localhost:5010` (`packages/frontend/vite.config.ts`)
- Dialplan callback URL as seen from Asterisk: `DIALPLAN_BACKEND_URL` (default `http://127.0.0.1:5010/api`)

**Staging:**
- Documented Vite flavors in `packages/frontend/.env.example`: `VITE_API_URL=https://staging.example.com/api`, `VITE_WSS_URL=wss://staging.example.com/socket.io`
- Separate MySQL and Asterisk recommended; `ARI_APP_NAME` should differ from prod so Stasis events are not shared
- `HAS_ASTERISK=0` in harness unless a lab is attached

**Production:**
- Secrets management: server `.env` (not committed); Firebase `google-services.json` placed under `packages/frontend/android/app/` and gitignored (`packages/frontend/docs/ANDROID_WEBRTC_NOTES.md`)
- `HELMET_HSTS=true` when TLS is terminated in front of the API
- `WEBHOOK_SECRET` HMAC for outbound CRM payloads (`X-Krasterisk-Signature`)
- Failover: AMI auto-reconnect; webhook dead-letter table `webhook_failures`; Redis optional for persistence across restarts
- Target Asterisk example (not a hard pin): `ipbx.krasterisk.ru` Certified 22.8

## Webhooks & Callbacks

**Incoming:**
- Asterisk dialplan CURL → `POST /api/internal/dialplan/{custom-webhook,before-dial,on-answer,on-hangup}` (`packages/backend/src/modules/routes/dialplan-webhooks.controller.ts`)
  - Verification: `DIALPLAN_API_KEY` when set
  - Events: `before_dial`, `on_answer`, `on_hangup`, custom DIALTO (synchronous extension return)
- Dialplan bridge (additional internal HTTP): `packages/backend/src/modules/dialplan-bridge/dialplan-bridge.controller.ts` — `x-api-key` / body `api_key`, timing-safe compare
- Bank / alfawebhook → `POST /api/billing/bank-webhook`
  - Verification: `Authorization: Bearer <BANK_WEBHOOK_SECRET>`
  - Events: incoming payment (INN match → deposit tenant balance)
- aiPBX MCP → `POST|GET|DELETE /api/mcp` (`Mcp-Session-Id`)
  - Verification: JWT or `KRASTERISK_SERVICE_TOKEN`
- aiPBX legacy tools → `/api/ai-tools/*` (`JwtOrServiceTokenGuard`)
- FCM device register → `POST /api/marketplace/device-token` (JWT; stores token, does not send campaigns) (`packages/backend/src/modules/cloud-admin/device-token.controller.ts`)
- Capacitor push: `@capacitor/push-notifications` after native login (`packages/frontend/src/shared/lib/capacitor/push.ts`) — requires Firebase `google-services.json` (no FCM server key in `.env` for this skeleton)

**Outgoing:**
- Route CRM/analytics webhooks - configured per route in UI (`before_dial`, `on_answer`, `on_hangup`, custom)
  - Delivery: `packages/backend/src/modules/routes/dialplan-webhooks.service.ts` + `webhook-queue.service.ts`
  - Auth modes: bearer token or custom headers; optional HMAC-SHA256 with `WEBHOOK_SECRET` → `X-Krasterisk-Signature`
  - Retry: in-memory exponential backoff (3 attempts); exhausted jobs persist to `webhook_failures`
  - Hangup payload may include MP3 URL under `RECORDS_BASE_URL`
- Voice-robot step webhooks - HTTP from session pipeline (`packages/backend/src/modules/voice-robots/services/voice-robot-session.ts`); can return `say_text` for TTS and set ARI channel vars `ROBOT_STATUS` / `WEBHOOK_DATA`
- Tenant notification integrations - channels `telegram` | `email` | `webhook` | `whatsapp` | `max` | `vk` (`packages/backend/src/modules/notifications/`)
- Marketplace / billing: internal `charge` / `activateModule` (no external payment processor webhook except bank/SBIS)

---

*Integration audit: 2026-08-28*
*Update when adding/removing external services*
