---
initiative: ai-products
phase: AI-01
slice: B
revision: 2026-09-18-r2
status: planned
tasks: [B1, B2, B3, B4]
depends_on: [A1]
---

# AI-01-B — внешние интеграции и identity без PBX

Чтение: [AI-01-A](AI-01-A-ACCESS-PLAN.md), [ARCHITECTURE](ARCHITECTURE.md), [ANALYTICS-SPEC](ANALYTICS-SPEC.md), [ROBOTS-SPEC](ROBOTS-SPEC.md), [DATABASE-PORTABILITY](DATABASE-PORTABILITY.md). Требования PL-02…04, AN-01/02/10, VR-10, DEP-03/07. Никаких SIP trunk credentials в API-ключах: SIP onboarding остаётся AI-08.

## B1 — доверенный TenantContext

**Owned paths:** новый `packages/backend/src/modules/integration-credentials/` (auth policy/guards), узкий shared contract, JWT adapter, coverage registry/tests. Никакой массовой замены legacy auth всех PBX endpoints.

```ts
type TenantContext = Readonly<{
  tenantUid: number;              // trusted owner UID, включая 0
  principalId: string;            // user:<uid> или стабильный integration UUID
  principalKind: 'user' | 'integration';
  credentialId?: string;          // версия ключа, не principal
  permissionRevision: string;
  requestId: string;
}>;
```

Context создаёт сервер после authentication. Нельзя принимать готовый context из JSON, `tenant_uid`, query, SIP headers или callback. JWT adapter проверяет текущего пользователя/tenant membership и suspension для новых product routes; подписи старого JWT недостаточно после отзыва доступа. `tenants.id` разрешается отдельно через owner UID. SUPERADMIN tenant actions — отдельный audited path с проверенным target, без произвольного client header и универсального bypass.

Общий resource authorization: `authorize(ctx, product, action, resourceKind, resourceId)`. Repository получает context и всегда применяет tenant predicate. Свой и чужой несуществующий resource для valid principal дают одинаковый 404. Нет permissions — 403 без listing чужих IDs. TenantContext не переносится по Redis как доверенная полномочная user-сессия: worker загружает job по ID и tenant из SQL, проверяет admission snapshot и актуальные cancel/revoke правила.

JWT и integration key — разные parsers. Новые integration routes принимают `Authorization: Bearer krint_v1_<selector>_<secret>`; query token запрещён. Existing SSE fallback не переносить сюда и не ломать всей платформе. Два credential источника одновременно — 400. Все ошибки/логи/request tracing редактируют Authorization и secret body fields.

**Приёмка:** spoof tenant/body/path; tenant0; revoked user JWT; mismatch target tenant; missing/ambiguous credential; foreign-resource 404; SQL scoped queries. Только auth tests, без runtime provider.

## B2 — principal, credential generations, grants

**Вход:** B1 + reviewed dual-DB schema baseline. **Owned paths:** `integration-credentials/**`, additive SQL/manifest, shared DTO/OpenAPI, `harness/database/**` scoped fixtures. Единственный migration writer — coordinator.

Логическая схема (физические имена tenant UID согласовать с DB conventions):

| Таблица | Поля / constraints / индексы |
|---|---|
| `ai_integration_principals` | id UUID PK, tenant_uid, label <=120, product, status active/disabled, permission_revision BIGINT, created_by, timestamps; UNIQUE(tenant_uid,id), index tenant/product/status |
| `ai_integration_credentials` | id UUID, tenant_uid, principal_id, selector, secret_digest BINARY(32)/BYTEA, predecessor_id nullable, generation, expires_at, revoked_at, created_at/actor; UNIQUE(selector), UNIQUE(principal_id,generation); composite tenant/principal FK |
| `ai_integration_grants` | id UUID, tenant_uid, principal_id, resource_kind project/deployment, resource_id UUID, scope, created_at; UNIQUE(principal_id,resource_kind,resource_id,scope), composite tenant/principal FK; reverse index tenant/resource for removal |
| `ai_integration_audit` | id UUID, tenant_uid, principal_id, actor, action, request_id, metadata allowlist, created_at; no credentials/secrets; index tenant/time |

Resource tables появятся AI-04 (projects) и AI-07 (deployments), поэтому polymorphic grant FK на несуществующие таблицы не добавлять. `IntegrationResourceResolver` имеет явный registry по compiled product descriptor; отсутствующий resolver **всегда запрещает** создание grant/use. Resolver подтверждает tenant, status и возможность scope при grant create и каждом запросе. Удаление domain resource атомарно отключает grants с тем же transaction либо tombstone domain row; последующий check в любом случае deny. Новые scopes регистрируются кодом, не свободной строкой из admin payload.

**Нет фиктивного проекта ради выдачи ключа.** В AI-01 допускается principal/credential без grants: он может читать только собственную sanitized capability/readiness. Scoped upload/start остаются недоступны до AI-04/07. UI показывает «создайте проект/развёртывание», а не пример работоспособного upload. Unit resolver fixtures не регистрировать в production composition.

Ключ: selector из 16 случайных байтов, secret из 32 случайных байтов CSPRNG, base64url фиксированной длины. Lookup по selector; хранить SHA-256 от version+selector+secret с однозначными разделителями; constant-time digest comparison. Высокоэнтропийный machine secret не пользовательский пароль. Отсутствующий selector не должен заметно отличаться ответом от неверного digest; rate limit по IP+selector, без SQL scan. Перед auth ограничить длину и charset. Plain secret один раз в response, `Cache-Control: no-store`; не audit/log/localStorage, не persistent Redux cache. Restore хранит digest, без возможности получить старый secret.

Scopes v1:

| Product / resource | Scope | Даёт |
|---|---|---|
| speech_analytics/project | `analytics:upload` | Создать/завершить собственный upload и принять первый analysis import для связанного проекта (AI-04); reanalysis не разрешает |
| speech_analytics/project | `analytics:read` | Статус и структурированные результаты без transcript/audio |
| speech_analytics/project | `analytics:transcript` | Отдельный доступ к transcript/evidence text |
| speech_analytics/project | `analytics:audio` | Авторизованный audio playback |
| speech_analytics/project | `analytics:cancel` | Отмена run в разрешённом проекте |
| ai_voice_robots/deployment | `robots:invoke` | Будущий API start, только опубликованный deployment |
| ai_voice_robots/deployment | `robots:read` | Собственные deployment sessions/status, без secret/prompt/tool payload |

Не выдавать управление providers/prompts/MCP, IAM, billing через эти scopes. Transcript цитаты не просачиваются в `analytics:read` через rationale/evidence/ошибки — serializer field allowlist. Binding project означает все разрешённые данные проекта; UI явно это объясняет. Ограничение до одной загрузки — отдельная будущая capability, не обещать его.

### Rotation/revoke concurrency

В v1 ровно одна действующая generation на principal; overlap grace отсутствует. Все create/rotate/revoke блокируют principal row `FOR UPDATE`. Rotate принимает `expectedGeneration`; transaction создаёт next generation, отзывает predecessor, пишет audit, увеличивает permission revision. Concurrent одинаковые ожидания: один success, второй 409. Неотозванный predecessor нельзя сохранить из-за stale update. Disable principal немедленно запрещает все generations независимо от expires_at.

Сеть может потерять ответ с единственным secret. Повтор той же операции возвращает metadata receipt без secret и инструкцию безопасно выпустить следующую generation с актуальным expectedGeneration; не хранить secret ради idempotent replay. Для create требовать client operation UUID, UNIQUE(tenant,actor,operation_id) в отдельной command receipt таблице либо существующем audit command store с реальным uniqueness; простого requestId в логах недостаточно. Повтор create не создаёт невидимый второй principal. Схему `ai_integration_commands` включить в миграцию: tenant, actor, operation_id PK; command_hash, principal_id, resulting_generation, completed_at; никаких secret bytes.

Credential cache в v1 отсутствует: SQL проверяет revoke/expiry каждый запрос. Уже committed job не отменяется только из-за rotation ключа; principal disable останавливает новые admissions, существующие jobs управляются cancel policy. Перед выдачей результата/access URL проверять текущие права.

**Приёмка:** real dual-DB create/revoke/rotate races; secret отсутствует в DB/log/API list; потерянный ответ; no grants; unknown resolver/scope; same resource UUID другого tenant; expired principal/user; parameterized injection strings. Migration upgrade/replay, cleanup fixtures, no local Docker.

## B3 — management API и внешняя capability поверхность

**Вход:** B2 + A1, A2 для BOX allow. **Owned paths:** controllers/DTO/OpenAPI в `integration-credentials/**`, shared contracts/tests. Prefix v1 внутри существующего API prefix, не удваивать `/api`.

| Метод / относительный route | Auth / поведение |
|---|---|
| `GET /v1/integrations` | JWT tenant admin, pagination <=100; safe metadata |
| `POST /v1/integrations` | JWT admin + product grant, operation UUID; principal и generation1 atomic, 201 secret once |
| `PUT /v1/integrations/:id/grants` | JWT admin, expected permission revision; полный validated set, 409 stale |
| `POST /v1/integrations/:id/rotate` | JWT admin, operation UUID+expectedGeneration; 201 secret once |
| `POST /v1/integrations/:id/revoke` | JWT admin; idempotent disable, 204 |
| `GET /v1/integrations/self/capabilities` | Integration key; только собственные scopes, bound resource IDs и capability states |

Register static self route до `:id` либо исключить shadowing test. Generic product readiness не раскрывает инфраструктурные адреса: available/not_configured/temporarily_unavailable + documented action. Product API key не администрирует свои grants и не выпускает новые keys. Sanitize validation errors. Rate-limit management/auth; reverse proxy trust/IP chain явно из installation config, не из любого X-Forwarded-For.

**Приёмка:** HTTP/OpenAPI contract examples для 201/204/400/401/403/404/409/429/503, redaction и Cache-Control; owner/admin permissions; management key forbidden; capabilities без PBX/provider запроса. Credentials endpoints не открываются global application JWT decorator случайно.

## B4 — identity provisioning отдельно от PBX

**Owned paths:** `auth/tenant-registration.service.*`, `auth.module.ts`, bounded registration call site, `cloud-admin/tenants.service.*` provision branch, нейтральный tenant identity service/module, core registration fixtures. Не переводить всю auth систему на новую tenancy схему.

1. Выделить `CreateTenantIdentity` (User/Tenant transaction, login uniqueness, activation state) без Context, AMI, ARI, Realtime, dialplan imports. Сохранять existing owner UID mapping; initial temporary0 не виден вне transaction. DB uniqueness ловит concurrent login, одного pre-check недостаточно.
2. `provisioningProfile` выбирается сервером из установленного descriptor/разрешённого onboarding action: `pbx` либо `analytics`. Не принимать arbitrary modules/tenant ID из public form. Существующие PBX registration default и Context fixtures сохраняются.
3. PBX adapter создаёт Context/core module setup только в PBX профиле. Analytics profile не создаёт PBX modules/contexts/trunks и не подключает PBX services. Existing CLOUD signup-disabled policy сохраняется; analytics account можно создавать trusted tenant admin/platform flow, не открыть публичную регистрацию неявно.
4. Postcommit mail/audit/billing учитывать в orchestration: identity success не откатывается из-за mail failure; durable уведомления потом используют D2 outbox. Local/BYOK не требует создания SaaS balance. SaaS баланс создаётся существующим billing adapter только если его deployment policy требует; он не выдаёт product entitlement.
5. Присоединение PBX к existing analytics identity — отдельный idempotent provisioning command, не новая организация и не переписывание owner UID. До реализации command возвращать capability unavailable, не создавать повторный tenant.

**Приёмка:** BOX existing registration regression; isolated analytics tenant identity на обеих DB; login race; rollback до commit без сирот; mail failure без дубликата; disabled CLOUD self-signup сохранён; spy composition не инстанцирует Context/AMI/ARI при analytics. Полный standalone boot доказать в C2/C4, одного spy недостаточно.

**Rollback B:** отключить новые routes/descriptors, отозвать keys при необходимости audited action; rows/audit сохраняются. PBX registration продолжает прежний серверный profile. Не удалять tenants или credentials migration down на production.
