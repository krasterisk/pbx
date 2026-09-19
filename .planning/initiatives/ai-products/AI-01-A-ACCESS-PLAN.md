---
initiative: ai-products
phase: AI-01
slice: A
revision: 2026-09-18-r1
status: planned
tasks: [A1, A2, A3]
---

# AI-01-A — доступ к продуктам и существующим AI-конфигурациям

Обязательное чтение: [IMPLEMENTATION-SEQUENCE](IMPLEMENTATION-SEQUENCE.md), [DEPLOYMENT-LICENSING](DEPLOYMENT-LICENSING.md), [ARCHITECTURE](ARCHITECTURE.md), [PROVIDER-MATRIX](PROVIDER-MATRIX.md). Требования: PL-01…04, VR-01, AN-01, DEP-01…05, DBR-01…03/06. A1 готов к ограниченному назначению; A2/A3 имеют gates ниже.

## Контракт решения о доступе

`ProductAccessDecision` содержит `product`, `allowed`, `reason`, `source`, `policyRevision`, `evaluatedAt`, `validUntil`, `limits`. Источники: cloud entitlement, verified local license, documented legacy mapping. Публичная версия не содержит tenant billing ID, license payload или provider secrets. Причины стабильны: `package_missing`, `tenant_inactive`, `not_entitled`, `entitlement_expired`, `product_disabled`, `license_invalid`, `license_expired`, `runtime_unavailable`. HTTP 401 — нет identity, 403 — нет права, 503 — право есть, обязательный runtime недоступен; последний статус не разрешает работу.

Порядок: trusted identity → installed descriptor → состояние tenant → entitlement/license → tenant activation → permission → operation admission. Published catalog отвечает за доступность предложения **новой покупки**, а не отбирает ранее купленный продукт. Runtime availability и финансовый admission — отдельные слои; наличие лицензии не означает готовый provider или бесплатный запуск.

| Ситуация | Решение |
|---|---|
| CLOUD: новая строка active/trial, срок не истёк, tenant допустим | Проверить activation и operation permission |
| Новая строка inactive/expired или active с истёкшим expires_at | Запрет, legacy fallback не выполняется |
| Новой строки нет, legacy `cc_ai_voice` active/trial и срок действителен | Только `speech_analytics`, документированный compatibility source |
| Есть только `voice_robot` | Никакого права на AI-роботов; сценарные работают как прежде |
| Tenant suspended/cancelled либо истёкший tenant trial | Запрет нового processing; retention/export регулируются отдельным permission, без нового provider запуска |
| BOX: валидная локальная лицензия с соответствующим product | Те же activation, quota и resource checks; cloud wallet не нужен для local/BYOK |
| OpenSource без коммерческого package | Нет product controllers/runtime. Нейтральные providers для существующих функций остаются |
| SUPERADMIN | Platform administration через явные admin endpoints; tenant processing требует выбранного и проверенного TenantContext и обычного admission |

Не подменять activation записью выдачи entitlement. `setTenantHubModuleStatus` для новых продуктов может только включать/выключать имеющееся право. До A2 BOX запрещает новые продукты по умолчанию. Старые продукты не переводить массово на новую политику в A1.

## A1 — единый guard, каталог и запрет самовыдачи прав

**Owner:** один backend writer. **Owned paths:** `packages/backend/src/modules/cloud-admin/modules-registry.service.ts` и tests; `packages/backend/src/modules/cloud-admin/module-access.guard.ts` и tests; узкий product-policy/decorator в существующем auth/common слое; относящиеся shared DTO и API tests. EXECUTION/SUMMARY/VERIFICATION инициативы — тот же owner. Не менять PBX services, billing debit, frontend, migration baseline.

1. Зафиксировать fixtures текущего `tenantHasModule`, by-ID access, catalog, Hub toggle и purchase. Инвентаризировать все входы для двух новых product codes; отметить старые alias routes. Целевой policy вызывается из каждого нового продукта, а не только helper tests.
2. Выделить чистый policy resolver и adapter к существующим Tenant/TenantModule. Проверять expires_at по единому clock и статус tenant; trial_end учитывается отдельно от module expiry. Нулевой UID не falsy. При неизвестном коде запрещать.
3. Подключить guard к новым codes и тестовому защищённому HTTP endpoint. Для legacy guard superadmin bypass сохранить только прежнее поведение старых модулей; новые product operations всегда идут через policy. JWT tenant выбирается сервером, отсутствующий user возвращает 401.
4. Catalog insert гарантированно создаёт `is_published=false`; последующие startup upsert не переписывают operator-managed publication. Однократную коррекцию уже созданных черновых AI entries выполнять отдельным явным maintenance path, не ежедневным startup. Проверить insert и повторный seed на обоих engines.
5. `resolvePurchaseOffer` отказывает неопубликованному предложению и продукту без release-enabled offer. Нулевой price не означает free entitlement; AI продукты без утверждённого тарифа не имеют purchasable offer. Перепроверять offer на сервере в transaction покупки. Не менять существующие free/core предложения.
6. Tenant Hub toggle не создаёт `tenant_modules active` при отсутствии права. До появления отдельного activation store в A2 переключение новых продуктов возвращает `409 product_configuration_pending`; скрывать это временное ограничение нельзя. В A2 toggle пишет только activation, OFF сохраняет grant и предыдущие конфигурации. Unknown product и direct by-ID purchase проходят те же проверки.
7. Согласовать catalog status/direct API: одна policy projection. До A2 production activation adapter новых продуктов возвращает not-configured; новый processing закрыт даже при найденном grant. Старые license codes/endpoints не переводятся в это состояние. После A2 используется отдельный activation store. Первоначально без долгого allow-cache; если текущая инфраструктура cache обязательна, version/invalidation на deactivate/revoke и fail-closed expiry — часть tests.

**Приёмка:** HTTP negative matrix CLOUD/BOX/tenant0/foreign tenant/expired/trial/superadmin; explicit deny перекрывает legacy; unpublished direct purchase/by-ID/toggle не выдаёт права; опубликованный старый продукт не меняется при seed; доступные scripted robots/autodial regression не сломаны. Не проводить реальный платёж. Targeted unit + API tests и проектные checks. Remote DB fixture для обоих engines при изменении catalog upsert.

**Rollback:** выключить новые product entrypoints, сохранить explicit deny/grants; не возвращать blanket allow для новых codes. Старые маршруты остаются на своём code.

## A2 — локальная лицензия и активация

**Вход:** A1; schema baseline проверен. **Owned paths:** новый нейтральный `product-access/` или согласованный A1 policy location; local-license adapter/import endpoint; dual-engine migrations+manifest; module coverage registry. Фактический directory выбрать один раз в assignment, не держать две реализации.

Решение v1: offline проверка подписанного документа. Payload: `version`, `licenseId`, `issuer`, `keyId`, `installationId`, tenant binding, product grants/limits, `notBefore`, `expiresAt`, `revision`. Подпись проверяется над точными байтами payload существующей поддерживаемой crypto библиотекой; алгоритм фиксирован server allowlist (Ed25519), не выбирается payload. Private signing key не хранится в коробке или репозитории. Public key rotation — trusted installation config, не URL из license. Канонизация/encoding и fixture vectors закрепляются до implementation review.

Лицензия ограничивает продукт/ресурс, не диктует обязательный SaaS-wallet. Offline revocation после выдачи не гарантируется: срок/обновление по договору, никакого выдуманного online revoke. Проверить clock rollback, записывать max observed validation time; restore на старую копию диска нельзя обещать защитить этим механизмом. Срок и grace — signed policy; v1 grace=0. Просрочка останавливает новые jobs/sessions, разрешает cleanup/end уже принятых в пределах snapshots. Export собственных данных — отдельное право без processing. Коммерческие условия утвердить до выдачи реальных лицензий.

Новые логические таблицы:

| Таблица | Поля и ограничения |
|---|---|
| `ai_product_activation` | tenant UID + product PK, enabled, revision, actor, updated_at. Existing valid legacy entitlement переносит activation явно по preview/report; для новых покупок и отсутствующего права default OFF |
| `ai_local_license_documents` | UUID, license_id, signed payload bytes, signature, digest, installation binding, imported_at/actor, revision; UNIQUE license_id+revision, одинаковая revision с иным digest — conflict |
| `ai_local_license_bindings` | tenant UID + product PK, document_id FK, revision; одна активная binding, замена в transaction; история документов сохраняется |

License import только installation admin, целевой tenant подтверждён; один atomic replace bindings после полной проверки. Меньшая revision того же license отвергается; смена license ID требует отдельного explicit replace с audit. Не добавлять startup auto-license и demo allow. Signed payload не логировать целиком, audit digest+actor+decision. Local policy не импортирует CloudAdminModule вместе с его scheduler.

**Приёмка:** валидная/подменённая/неизвестный key/wrong installation/tenant/product/future/expired license; повтор import; downgrade; concurrent replace; tenant0; offline boot без cloud network; local BYOK без balance table lookup. Dual-DB upgrade/replay и expiry clock tests. Security review contract обязателен до commercial enable, fixtures не означают выпуск лицензий.

## A3 — точный provider contract и безопасная legacy inventory

**Вход:** A1. **Owned paths:** `ai-agents/ai-agent-inventory.service.*`, `ai-agents.service.*`, provider/toolset repositories/tests, узкий shared readiness DTO. Новых robot drafts/tables здесь нет.

1. Inventory читает явный список безопасных полей provider: UID, owner, enabled, capabilities; encrypted_api_key и payload tools не выбираются. Server pagination, stable UID sort, лимит 100; tenant predicate во всех запросах, в том числе joins/count.
2. `AgentConfigurationReadiness` возвращает issues `{code, role, referenceUid}` без endpoint/secret. Cascade требует model=llm, stt=stt, tts=tts; realtime требует model=realtime. Включённость/ownership отдельно от advertised capabilities. Наличие строки не доказывает сетевую работоспособность или codec support.
3. Единая проверка результирующей конфигурации при create/update: сначала merge stored+patch, затем exact-owner/enabled/capability. Для new-product publish/admission обязательно повторить; disabled provider нельзя обойти ранее сохранённым agent.
4. Read-only migration report на legacy references, в том числе tenant0/duplicate `unique_id`. Не копировать providers или секреты между tenants автоматически. Сохранить чтение и возможность исправления ошибочных агентов; новый publish/start запрещён до исправления. Существующее CRUD изменение validation вводить с regression и явным сообщением о конкретной связи, без скрытого удаления legacy rows.
5. Источник редактируемой конфигурации остаётся `cc_ai_agents`; AI-07 добавит immutable version/sessions. Shared platform templates/grants не реализуются через `IN (0, tenant)`; до отдельного grant model они недоступны.

**Приёмка:** tenants A/B/0; every role x enabled/capability; PATCH mode/provider link/resultant-state; disabled-after-save; secret-field selection regression; pagination; исторический invalid draft доступен для исправления, но не admission. Не вызывать реальные STT/LLM/TTS.

**Финал A:** SUMMARY/VERIFICATION отделяет A1 policy, A2 self-hosted и A3 inventory. Если A2 ещё не сделан, запрещено писать «SaaS/BOX права готовы». Общий следующий срез — B1.
