# AI-01-C2 — промежуточный результат и приёмка

**Статус:** active / partial. Remote SQL/boot gate текущей ревизии пройден; C2 и AI-01 не закрыты. Управление остаётся `codex-direct`, назначение — [EXECUTION](EXECUTION.md), источник требований — [AI-01-C](AI-01-C-COMPOSITION-UI-PLAN.md), C2. Full-PBX migrations `0001`–`0007` не изменялись.

## Реализовано

- Один migration runner выбирает неизменённый `full-pbx` или минимальные `analytics-api`/`robot-api` profiles. Profile фиксируется в schema state; старый full-PBX journal получает profile metadata под lock без повторного baseline. Startup с чужим, грязным или неполным profile отказывает до HTTP listen. Минимальный `0001-ai-standalone-base.sql` генерируется из проверенного full baseline только offline-командой `build-minimal-baseline.cjs`; additive `0004`–`0007` общие для обоих движков и standalone profiles.
- Статические Nest entrypoints `analytics.main.ts` и `robot.main.ts` импортируют нейтральные identity/connectivity/access/integration modules и только свои health controllers. `ProductAccessCoreModule` отделён от административных контроллеров. Standalone login выдаёт короткоживущий JWT после bcrypt и проверки актуального tenant state; `GET /api/v1/identity/self` и `GET /api/v1/identity/capabilities` отдают tenant context и policy текущего профиля без заявления, что product runtime установлен. Refresh/self-registration пока не реализованы. Installer CLI `standalone-provision.main.ts` создаёт первый или следующий tenant из password через stdin, без PBX contexts. Health отвечает `productRuntime: not-installed`.
- `community.main.ts` / `CommunityPbxModule` собирает существующее PBX-ядро без `AiAgentsModule`. Shared bootstrap вынесен в `pbx-core.composition.ts`; full-pbx `AppModule` добавляет только `commercial-ai.composition.ts`. Audit log model и secret cipher больше не тянут commercial robot source в community graph.
- Отдельные React entrypoints `analytics.html`/`robot.html` показывают API, product runtime и вход администратора через identity/capabilities HTTP. Токен остаётся в памяти вкладки. Страницы PBX и сценарных voiceRobots не импортируются. Vite build gate прекращает сборку при попадании исходников AppRouter, autodial, callcenter, routes, scenario robots или AI-agents.

## Доказательства текущей ревизии

- Backend `npm test -- --no-coverage`: 277 passed / 1 skipped suites, 3002 passed / 11 skipped tests. Targeted identity HTTP 2/2, capabilities service 3/3, community boundary 2/2.
- Source-boundary: community 635 backend TS files, commercial `ai-agents` absent; analytics 51 files; robot 51 files. `npm run test:community:composition`: 1268 artifacts, no `ai-agents`/`app.module`. `npm run test:analytics:composition`: 100 artifacts, no PBX runtime modules.
- Frontend targeted shell 4/4; `npm run build:analytics -w @krasterisk/frontend` успешен. ESLint по изменённым backend/frontend файлам: 0 errors.
- Harness `run-analytics-boot.cjs` проверяет identity/capabilities 200 после login и 401 без токена; имя disposable БД — `krasterisk_ci_${product}`, чтобы пройти `seed-ci` guard.
- Текущая ревизия на `root@ipbx.krasterisk.ru`: MySQL 8.4.11 **14/14** и PostgreSQL 17.11 **14/14** contracts; analytics и robot HTTP boot на обеих СУБД — health 200, login 200/401, identity/capabilities 200/401, integrations 200/401, PBX routes 404. Узкий fixture 115 554 байт, без source/`node_modules`/.env. [REMOTE-MATRIX](evidence/c2/REMOTE-MATRIX.md). Предыдущие 13/13 логи не заменяют этот прогон.
- `IntegrationCredentialsModule` экспортирует `IntegrationKeyRateLimiter`, иначе standalone identity HTTP не поднимает `TenantContextGuard`.

## Открытые пункты C2

1. ~~Remote MySQL/PG contracts + analytics/robot HTTP boot текущей ревизии.~~ Сделано 2026-09-19: [REMOTE-MATRIX](evidence/c2/REMOTE-MATRIX.md).
2. Browser login на живом API не проверялся: targeted UI tests покрывают form/capabilities, но не live DOM против реальной БД. Frontend full suite по-прежнему имеет известный `ConferenceRoomFormModal` locale assertion и ранее зависала; полный прогон не засчитан.
3. Full-PBX internal dialplan/IVR optional-key handlers now fail-closed via `timingSafeApiKeyEqual`. `VoiceRobotsPublicController` unauthenticated fixed-tenant CRUD остаётся — v3 client нельзя молча отключить. [Inventory](AI-01-C2-LEGACY-EXPOSURE.md).
4. Analytics processing, agent runtime/SIP edge, project/metric UI, landing/credentials и Marketplace интеграция относятся к следующим назначенным задачам C3, AI-02/04/07; skeleton их не заменяет.

## Следующее действие

v3 public voice-robots compatibility rollout (не молча удалять URL) либо C4. Browser login vs live DB не проверялся. Не объявлять C2 complete.
