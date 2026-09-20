# Следующие срезы: порядок исполнения

Версия **2026-09-18-r3**. Режим `codex-direct`, один координатор. Это результат детального проектирования, не отчёт о реализации. Назначения и фактические проверки — в [EXECUTION](EXECUTION.md). Новые документы уточняют [ROADMAP](ROADMAP.md), не создают второй roadmap.

## Что готово и что исправлено в оценке готовности

DB-01 и ряд DB-02 срезов имеют отдельные verification. DB-02 целиком не закрыта: проверить D2, повтор D1 и итоговый E по их актуальным артефактам. AI-00 содержит исследования и частичное разделение ARI приложений, но не полный набор live/fixture evidence. AI-01 содержит только начальные изменения catalog/resolver и inventory. Ранее слово «implemented» у Wave 1 не означало работающую сквозную авторизацию; новый статус — partial foundation.

| Проверенный участок исходников | Значение для проектирования |
|---|---|
| `cloud-admin/modules-registry.service.ts`, `ModuleAccessGuard` | `tenantHasAiProduct` ещё не включён в общий guard; non-CLOUD bypass остался в других путях. Одного helper недостаточно |
| Catalog seed и `resolvePurchaseOffer` | `is_published` отсутствует в upsert fields; direct purchase не проверяет publication. Скрытый пункт UI не защищает покупку |
| `ai-agents/ai-agent-inventory.service.ts` | Exact tenant полезен, но capability `llm/realtime` проверяется без строгого разделения режимов; загружаются полные provider rows |
| `TenantRegistrationService.create` | Создание User/Tenant и PBX Context связано одной транзакцией; standalone требует разреза зависимости |
| `TenantsService.provision` | Postcommit PBX core modules/billing/mail тоже требуют профиля provisioning; достаточно изменить не только public register |
| `JwtStrategy` | Query token допускается для старого SSE; новые integration API принимают credential только из Authorization header |
| `redis.module.ts` | Optional/nullRedis допустим для старого ядра, но не доказывает готовность очереди AI |
| `BillingBalanceService` | Существуют баланс и блокировки; не создавать второй кошелёк. Текущего charge без operation dedupe недостаточно для AI usage |
| Recording/hangup helpers | Синхронный ffmpeg и отправка webhook не подтверждают close/probe/ready; отсутствие StopMixMonitor в просмотренном handler требует проверки |
| ARI connection/originator/voice robots | Два имени лучше общего, но нужны namespace установки, обработка ApplicationReplaced и проверка владельца событий |

Сверка выполнена на dirty working tree с HEAD `92d342d1398ad7f6b5839f35f12e168741e00d03`. До исполнения повторно проверить изменившиеся исходники; исторические номера прошедших тестов не являются evidence новой ревизии.

## Канонический набор планов

| План / task IDs | Результат | Входной gate |
|---|---|---|
| [AI-00-CLOSURE](AI-00-CLOSURE-PLAN.md), G1–G3 | Закрыть исследовательские и runtime-пробелы AI-00 | Для исследования готов; live только disposable стенд |
| [AI-01-A](AI-01-A-ACCESS-PLAN.md), A1–A3 | Серверная политика продуктов, локальная лицензия, точные provider связи | A1 можно назначать следующим; для SQL A2 — reviewed migration baseline |
| [AI-01-B](AI-01-B-INTEGRATIONS-PLAN.md), B1–B4 | TenantContext, principals/keys, API auth, отдельное provisioning identity | B1 после A1; B2 после B1 и dual-DB schema baseline |
| [AI-01-C](AI-01-C-COMPOSITION-UI-PLAN.md), C1–C4 | Нейтральные providers, профили сборки, Hub/UI, отсутствие PBX в analytics | C1 после A3, C2 после B4; C3 после A1/B3 и server contract |
| [AI-02](AI-02-PLAN.md), D1–D6 | Assets, jobs/outbox, storage, durable usage, отдельные workers | Контракты спроектированы; исполнение после соответствующих AI-01 gates |
| [AI-03](AI-03-PLAN.md), CAP1–CAP5 | Capture intent, node spool/finalization, asset-ready | AI-02; G2; native PBX дополнительно DB-03 |
| [AI-04](AI-04-PLAN.md), AN1–AN6 | Projects, upload, STT/metrics/evidence, callback и UI | AI-01/02; без обязательного Asterisk или AI-03 |
| [AI-07](AI-07-PLAN.md), VR1–VR6 | Versions/deployments, cascade runtime, media/ARI, route/AutoDial, editor | AI-01/02/03 и G1; native DB-03; без аналитики |
| [AI-05](AI-05-PLAN.md), MET1–MET5 | Редактор метрик, scoring, preview/reanalysis, review/eval | AI-04; human calibration до quality claim |
| [AI-06](AI-06-PLAN.md), REP1–REP4 / INT1–INT3 | Standalone reports и отдельный native PBX срез | REP после05; INT дополнительно CAP5/DB-03 |
| [AI-08](AI-08-PLAN.md), RT1–RT5 | Realtime, внешний SIP, call API и lifecycle | AI-07; provider/SIP profile evidence |
| [AI-09](AI-09-PLAN.md), TOOL1–TOOL6 | Business tools/MCP и KB | AI-07; reviewed MCP profile/retrieval benchmark; без зависимости от08 |
| [AI-10](AI-10-PLAN.md), COM1–COM4 / 10A / 10R | Price/SKU, billable switch, license+runtime flag, packaging; analytics/robots onboarding | AI-02 + DB-04 core; 10A после 06A; 10R после 08+09; I4 только native/full-pbx |
| [DB-04](DB-04-PLAN.md), I1–I4 | Clean install matrix, backup/restore, upgrade, PBX ODBC installer | После DB-02; I4 после DB-03; analytics-only не ждёт I4 |

AI-01-PLAN служит индексом A/B/C, старые Waves не являются конкурирующими заданиями. AI-01…10 и DB-04 детализированы: 60 AI-задач (01…09) + 6 COM/10A/10R + 4 DB-04. Согласование границ — [PRODUCT-SLICES-CONTRACTS](PRODUCT-SLICES-CONTRACTS.md) и [ADVANCED-PRODUCT-CONTRACTS](ADVANCED-PRODUCT-CONTRACTS.md). Перед исполнением сверить upstream implementation; план не evidence выполненных зависимостей. AI-11 release/pilot ещё требует task-level plan.

## Последовательность и точки остановки

1. **A1**: закрыть обход продуктовой политики; regression всех старых модулей. Маленький первый assignment без provider runtime, PBX и live платежей.
2. **A2 → A3 → B1 → B2 → B3 → B4**: license, provider ownership, credentials и identity. A2 криптография/локальная лицензия допускает отдельный review gate; без него self-hosted коммерческий продукт остаётся закрытым.
3. **C1 → C2 → C3 → C4**: сборка и UI. UI shell показывает readiness; не создаёт впечатления работающих звонков/аналитики. C4 закрывает AI-01 только вместе с требуемыми AI-00/DB evidence.
4. **D1 → D2 → D3 → D4 → D5 → D6**: последовательно один schema/API writer. D3 media и D4 metering логически независимы после D2, но это не назначение параллельных агентов.
5. После D6 — сверка AI-03/04/07 с реальными contract fixtures; назначить CAP1 и/или AN1 по gates, затем VR1 и runtime по его prerequisites. Аналитика продолжает MET→REP→INT, роботы RT/TOOL согласно готовым планам. Общие writers назначаются последовательно; релизы продуктов не ждут друг друга.
6. Commercial/release: COM1–COM3 параллельно DB-04 I1–I3; затем 10A / 10R; I4 для native PBX. AI-11A/R — отдельный task-level plan после evidence AI-10.

G1–G3 и незакрытые DB-02 gates выполняются отдельными assignments, не теряются в A/B/C. Код контракта без runtime-зависимости можно делать до live Asterisk; readiness фазы и выпуск от этого не становятся зелёными. Native PBX приёмка дополнительно ждёт DB-03; standalone analytics не ждёт Asterisk.

Остановить конкретный срез при новом конфликте writers, изменении публичного контракта/схемы, отсутствии проверенного алгоритма восстановления или неожиданной production-зависимости. Перепланировать этот срез, сохраняя работающие независимые части. Не скрывать незакрытый gate словами «mock passed».

## Общие правила SQL, API и приёмки

- Один engine на установку, Sequelize и существующий migration runner. Миграции additive, отдельные SQL для MySQL/PostgreSQL; следующий свободный номер выбирается при назначении. Applied SQL/checksums не переписывать.
- `tenantUid` в wire-контрактах и семантическое `tenant_uid` в таблицах планов — доверенный owner UID. В Sequelize новых tenant-owned models: attribute `user_uid` → physical column `vpbx_user_uid`, как у существующих AI-моделей; тип/разрядность совпадают с reviewed DB-02 owner UID. Не путать его с `tenants.id`. Tenant 0 валиден. Новые row IDs — UUID lowercase, wire string; старые integer UID не преобразовывать в UUID.
- Каждый запрос к tenant resource содержит tenant predicate; для child references — composite tenant+ID FK/unique, где обе таблицы новые. Для legacy — explicit exact-owner repository check в транзакции. SQL aliases/DTO не создают новый каталог tenants.
- UUID/hash/idempotency identifiers сравниваются побайтово (ASCII/binary collation на MySQL), не через locale/case-insensitive defaults. UTC timestamps, явная точность. Boolean/JSON/decimal сериализация имеет одинаковые goldens; BIGINT/DECIMAL wire string, не JS float.
- Ограничения, индексы, stale-write/concurrency тесты проверяются на обеих СУБД. Никаких PG-only partial indexes, advisory lock или SKIP LOCKED без MySQL реализации. Не полагаться на nullable UNIQUE как универсальное правило idempotency.
- Новые модули классифицировать в `ai-platform/module-coverage.registry.ts` по D-16; сервисные credentials/ledger/license не становятся tools административного LLM автоматически.
- Каждый implementation assignment: свежий baseline, PLAN SHA-256, task IDs, точные owned paths, targeted checks; в конце SUMMARY/VERIFICATION с командами, exit codes и logs. `npm run lint`, `npm run test:backend`, `npm run test:frontend` перед «готово»; failures baseline явно отделять от новых.
- DB/Redis/container проверки только `root@ipbx.krasterisk.ru`, ключ `krasterisk_ipbx_agent`, новый disposable namespace. Не трогать действующие контейнеры/звонки. Никакого local Docker.

## Передача реализации модели Sol

Исполнитель получает **один task**, а не команду «сделай весь roadmap». Координатор фиксирует назначение, hash и acceptance; Sol реализует, сообщает diff/evidence/deviations. Сложные изменения границ, схемы и recovery возвращаются на review, не становятся самостоятельным перепланированием исполнителя. GSD хранит документы; второй GSD orchestrator не запускается. Субагенты этим документом не назначаются.

Первое задание: «Реализовать только A1 по AI-01-A-ACCESS-PLAN, актуализировать EXECUTION; никаких A2/B/AI-02 автоматически внутри assignment». Готовность следующих задач проверяет тот же координатор. Тарифы, первый production provider и коммерческие условия лицензии остаются release-решениями; они не мешают A1 и контрактным тестам.
