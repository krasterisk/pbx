---
initiative: ai-products
phase: AI-01
revision: 2026-09-18-r1
status: detailed_plans_available_partial_foundation
depends_on: [AI-00, DB-02]
requirements: [PL-01, PL-02, PL-03, PL-04, VR-01, AN-01, DBR-01, DBR-02, DBR-03, DBR-06]
---

# AI-01 — продукты, identity и доступ

Канонический индекс детальных планов. Прежний документ из пяти Waves заменён срезами A/B/C; исполнять их как второй параллельный план нельзя. Общая последовательность и actual-readiness gaps — [IMPLEMENTATION-SEQUENCE](IMPLEMENTATION-SEQUENCE.md), assignment — [EXECUTION](EXECUTION.md).

Цель: два независимо включаемых продукта `ai_voice_robots` и `speech_analytics`; SaaS/self-hosted; community build без commercial source; analytics identity без PBX. Сценарные роботы и существующие `cc_ai_agents` сохраняются, новый дублирующий editable robot CRUD не создаётся.

## Исполняемые срезы

| План | Task IDs | Что поставляет |
|---|---|---|
| [AI-01-A — доступ](AI-01-A-ACCESS-PLAN.md) | A1–A3 | Guard/catalog/purchase, локальная лицензия, exact-tenant provider readiness |
| [AI-01-B — интеграции](AI-01-B-INTEGRATIONS-PLAN.md) | B1–B4 | TenantContext, principal/key/grants, management API, identity provisioning |
| [AI-01-C — состав и UI](AI-01-C-COMPOSITION-UI-PLAN.md) | C1–C4 | Нейтральные providers, compile/schema profiles, Hub и приёмка |

Соответствие старых Waves: Wave1 → A1/A2; Wave2 → A3/C1; Wave3 → B1–B4; Wave4 → C3; Wave5 → C2/C4. Первая допустимая implementation задача — A1 после свежего назначения; наличие документа само не запускает все срезы.

## Уже сделано и ещё не принято

Есть начальный catalog/resolver и read-only agent inventory. Resolver пока не подключён к общему ModuleAccessGuard; publication/direct purchase/expiry, BOX license и capability по режиму требуют работы. Это partial foundation, не завершённая Wave1 или вся AI-01.

AI-00 и DB-02 остаются prerequisites полного phase acceptance. A1 чистые policy/guard исправления разрешено исполнять до live Asterisk; SQL срезы требуют проверенного schema baseline и своей dual-DB матрицы. Gaps закрываются по [AI-00-CLOSURE](AI-00-CLOSURE-PLAN.md) и DB-02 plan; они не обходятся mock tests.

## Общая приёмка и границы

Два tenant и tenant0, CLOUD/BOX, explicit deny/expiry, direct API/UI, отсутствие commercial package, standalone без PBX, ключи/ротация/revoke, неизменность прежнего PBX registration и scripted robots. Каждая задача имеет собственные paths/tests/rollback в детальном плане. Итоговые schema/runtime checks на MySQL и PostgreSQL — только выделенный тестовый сервер, без local Docker.

В этой фазе нет реального AI звонка, STT/LLM job, external SIP endpoint, нового wallet, платного settlement или metric editor. Следующий foundation — [AI-02](AI-02-PLAN.md); предметные продукты — дальнейшие ROADMAP фазы.

Rollback отключает новые product entrypoints/descriptors, сохраняет grants/audit/legacy configuration; не возвращает blanket allow новым продуктам и не применяет destructive down к tenant data.
