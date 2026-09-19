---
initiative: ai-products
phase: AI-01
slice: C
revision: 2026-09-18-r1
status: planned
tasks: [C1, C2, C3, C4]
---

# AI-01-C — состав установки, provider core и интерфейс

Чтение: [AI-01-A](AI-01-A-ACCESS-PLAN.md), [AI-01-B](AI-01-B-INTEGRATIONS-PLAN.md), [DEPLOYMENT-PROFILES](DEPLOYMENT-PROFILES.md), [DEPLOYMENT-LICENSING](DEPLOYMENT-LICENSING.md), обе `packages/*/.idea/ARCHITECTURE.md`. Для Hub обязателен локальный `.cursor/skills/sketch-findings-krasterisk-v4/SKILL.md`: single-column list, ModuleShell/sidebar/breadcrumb, отдельный marketplace и platform admin. Требования PL-01…04, DEP-01/03/06/07, VR-01, AN-01, DBR-06.

## C1 — провайдеры не зависят от модуля роботов

**Вход:** A3. **Owned paths:** `ai-agents/ai-providers.service.*` и model export facade, новый `ai-connectivity/**`, imports `voicemail`/`ai-chat`, `ai-agents.module.ts`, module coverage registry, targeted tests. Shared AppModule/DTO writer один.

1. Inventory import graph и providers tables/secrets consumers. Перенести нейтральный provider repository/config/encryption policy в `AiConnectivityModule`. Одна таблица `cc_ai_providers`, один credential store, прежние UID и ciphertext. Сохранить facade exports, пока consumers не переведены; не заводить второй editable provider catalog.
2. Убрать зависимость provider service от voicemail URL helper: HTTP endpoint normalization — нейтральный чистый helper. Предыдущие consumers получают тот же public contract без импорта robot CRUD/controllers или PBX listeners.
3. API public provider DTO — allowlist: secretConfigured boolean, маскированный auth summary. Encrypted secret тоже не public DTO. Internal resolver получает credential только после tenant/capability check; secret не входит в prompt/job/outbox payload.
4. Нет dev fallback encryption key при production/local commercial enable. Validated installation secret configuration, versioned envelope/key ID; миграция существующего ciphertext — отдельный reviewed command с backup и decrypt/re-encrypt verification. C1 не переэнкриптирует всё при startup. Rotation с прежним ключом сохраняет возможность чтения принятых jobs в пределах retention; отсутствие ключа fail closed.
5. `ProviderRevision` пока контракт: immutable sanitized config/capability snapshot + server credential reference. D1 реализует persistence для jobs; удалить/disable provider может только owner, активный operation проверяет policy до отправки. Административный AI, voicemail, robots и analytics используют общую конфигурацию с независимыми permissions.

**Приёмка:** прежние voicemail/ai-chat/provider CRUD проходят regression; provider read response без ciphertext; tenants A/B/0; core connectivity boot без robot controllers; production missing key отказ; существующий ciphertext fixture читается без переписывания DB. Никаких реальных provider calls.

## C2 — compile-time composition и schema profiles

**Вход:** B4, C1, A2 local-policy contract. **Owned paths:** backend bootstrap/composition, neutral identity/connectivity modules, database runner/manifest/profile readiness, package build scripts; frontend composition manifest/imports; новые migrations profiles и fixtures. Старые миграции immutable. До edits снять точные shared-file owners.

Runtime env flag не доказывает OpenSource boundary: TypeScript не должен требовать отсутствующий commercial source. Descriptor allowlist собирается build composition entrypoint, не произвольным `import(pathFromTenant)`. Modules объявляют code, exported contracts, routes, models, schema components, required services. Disabled и absent — разные состояния: absent не оставляет routes/cron/queues/OpenAPI/menu.

| Состав | Компоненты | Что не стартует |
|---|---|---|
| community-pbx | нейтральное identity/connectivity, имеющееся открытое PBX ядро | новые commercial product source/runtime |
| analytics-api | identity, policy, integrations, connectivity, storage/jobs contracts, analytics plugin | Context/AMI/ARI/Realtime, autodial, PBX cron и provisioning |
| robot-api/edge | identity/policy/integrations/connectivity, robot plugin, явно выбранный telephony adapter | analytics runtime; внутренний PBX, если выбрана standalone edge |
| full-pbx | existing PBX + выбранные commercial plugins | отключённые plugins и дубли scheduler |

C2 создаёт skeleton roots, не заявляет готовый AI-07 telephony edge. Neutral provider contracts не требуют AI-chat license. License adapters/tenant repositories не должны импортировать весь CloudAdminModule с его фоновыми tasks. Выносить только действительно необходимые нейтральные services, сохраняя прежние facade.

Legacy `public/voice-robots` и `/internal/dialplan/*` не входят в analytics/robot public API composition. В full-pbx выполнить inventory внешней экспозиции старых unauthenticated surfaces: обязательная auth/scoped compatibility migration либо явно закрытый network/route exposure до внешнего релиза. Не считать «новый клиент их не использует» защитой; не отключать существующих v3 клиентов молча. Legacy dialplan webhook с optional static key не использовать как доверенную ingestion identity.

### Миграции без скрытой зависимости от PBX

Существующий `0001-current-schema.sql` создаёт full PBX schema. Исключить AppModule import недостаточно для обещания analytics без PBX tables. Решение: добавить profile-aware manifest поверх **того же runner**, не второй framework.

1. Existing installations получают profile `full-pbx` и прежнюю неизменённую цепочку 0001…N. History/checksum сохраняются. Migration state идентифицируется stream/profile+id+checksum; upgrade старого journal explicit и tested, без повторного выполнения baseline.
2. Новая clean analytics installation использует minimal base stream для существующих identity/auth/tenant/catalog/provider tables, без Context/CDR/queue_log/realtime. Новые access/integration/shared-AI tables создаёт общая additive chain A2/B2/D1, а не второй create в minimal baseline. Точные names/columns копируются из reviewed canonical schema inventory, не альтернативная ORM модель. В manifest объявить ownership table каждым schema component; повторный create одной таблицы запрещён.
3. Shared-AI additive migrations применяются к обоим профилям с явными dependencies и едиными contracts. Аналогичная схема на MySQL/PG. Нельзя вручную фильтровать statements из full SQL в runtime или молча ставить full baseline mark в minimal installation.
4. Profile фиксируется в schema state; startup model/table readiness проверяет только свой компонентный набор. Смена `analytics`→`full-pbx` env не разрешает авто-diff. V1 возвращает `profile_upgrade_required`; расширение standalone до PBX — отдельный migration plan с data-preserving evidence. Документировать эту границу в installer.
5. Community source build и standalone minimal schema — разные gates: первый доказывает отсутствие commercial dependencies, второй — отсутствие PBX schema/runtime. Выполнить оба.

**Приёмка:** clean minimal MySQL/PG; full existing upgrade/replay с прежними checksums; profile mismatch до HTTP listen; missing schema fail closed; duplicate component запрещён; analytics не обращается к PBX tables. Unit mock не заменяет реальный profile boot.

## C3 — Hub, страницы подключения и управление доступом

**Вход:** A1/A2, B3 contracts; C1 provider facade. **Owned paths:** `features/modules/lib/moduleRegistry.ts`, `app/router/**` фактический router, product pages/features, existing ModuleShell/Hub extension points, shared RTK endpoints, RU/EN locales/tests. `features/voiceRobots/**` read-only кроме доказанной интеграционной правки.

Canonical URLs: `/ai-robots` и `/speech-analytics`; внутри текущего AI-раздела — ссылка «AI-роботы» на тот же route/product, без второго license/CRUD. Существующие сценарные роботы и их URL не переименовывать. В Hub два независимо доступных продукта. Экран provider connections нейтрален к покупке AI-chat.

AI-01 поставляет landing/readiness и integration credentials, не редактор разговоров и не аналитику:

| Экран | Содержание / обязательные состояния |
|---|---|
| Product landing | license/activation + отдельная runtime readiness; locked, expired, not installed, enabled/not configured, temporary unavailable |
| Подключения | principal list, scopes+bindings summary, expiry/status, create/rotate/revoke; empty state объясняет ресурс, нужный до grant |
| Secret-once dialog | copy/download по явному действию, clear при закрытии, предупреждение о невозможности повторного просмотра; отсутствует в query cache/localStorage/analytics events |
| Provider readiness | имеющиеся конфигурации и конкретные issues A3; ссылка на исправление; без имитации успешного test-call |
| Analytics-only shell | нет обязательного PBX onboarding/номеров/транков; доступ к проектам появится в AI-04 |

Секрет copy требует реального результата create/rotate; lost response UI предлагает новую generation, не бесконечно повторяет команду. Revoke/rotation показывают последствия перед действием. Switch активации использует RTK `onQueryStarted` optimistic patch+undo, disabled while mutation, сохраняет фильтры/scroll; rejection возвращает прежнее состояние и локализованную причину. Изменение entitlement или provider readiness само по себе не выдаёт grant.

Deep-link guard использует server product catalog, pending state до resolve, не мелькает защищённый контент. Logout/смена tenant очищает RTK product/credentials cache. Изменение лицензии обновляет server policy, а не только menu. Empty/403/404/503 состояния различимы и не раскрывают чужие ресурсы. Без общего JSON-editor вместо предметной формы scopes/bindings.

**Приёмка:** user/tenant switch; restricted deep link/direct API; expired while page open; failed optimistic toggle undo; inaccessible bindings; secret никогда в state persistence; keyboard/focus/labels, RU/EN и 360/1440 px. Shared primitives + SCSS, FSD imports. Проверка screenshot/browser доступным инструментом, не только snapshot tests.

## C4 — приёмка AI-01 целиком

**Owned paths:** profile harness/tests/build scripts и AI-01 SUMMARY/VERIFICATION; code fixes только в отдельном recorded sub-assignment.

1. Temporary build workspace без commercial source (копия с allowlist; не удалять пользовательские исходники): backend/frontend core build и tests. Документированный состав open-source tree, license решения не менять автоматически.
2. Analytics profile на disposable MySQL и PG с недоступным PBX: no AMI/ARI socket attempts, no PBX cron, no PBX tables, identity+capabilities HTTP работают; неверный profile не стартует. HTTP probes legacy public CRUD/CDR/dialplan возвращают отсутствие route, а не успешный unauthenticated response; full-pbx exposure remediation имеет отдельные negative tests и compatibility evidence.
3. SaaS/self-hosted x tenant A/B/0 x product allow/deny x integration/JWT matrix. BOX offline/BYOK не требует облака/баланса. Core without package не регистрирует endpoints, menus, schedules.
4. Выполнить проектные checks и targeted migration/auth/UI tests. Сохранить stdout, exit code, версии runtime/DB, профиль/schema revision. Успех отдельных tests не закрывает full gate.

**Rollback:** убрать новый descriptor/entrypoint, остановить admission; сохранить data и старый full-pbx профиль. Minimal installation нельзя запускать full AppModule как fallback. AI-01 завершена только при выполненных A/B/C acceptance и явно закрытых phase prerequisites; иначе summary перечисляет partial slices. Следующий план — [AI-02](AI-02-PLAN.md).
