# Следующий горизонт: метрики, отчёты, realtime и tools

Ревизия **2026-09-18-r3**. Канонические планы: [AI-05](AI-05-PLAN.md), [AI-06](AI-06-PLAN.md), [AI-08](AI-08-PLAN.md), [AI-09](AI-09-PLAN.md). Уточнения к [PRODUCT-SLICES-CONTRACTS](PRODUCT-SLICES-CONTRACTS.md), не новая параллельная цепочка управления. Режим `codex-direct`, один coordinator; никакие субагенты и runtime jobs этими файлами не назначаются.

## Что теперь детализировано

| План | Tasks | Вход / результат |
|---|---|---|
| AI-05 | MET1–5 | После AI-04: versioned metrics, scoring/applicability, preview/reanalysis/review, editor/eval |
| AI-06A | REP1–4 | После AI-05: общие filters, dashboard, snapshot reports/schedules, budget/bulk operations |
| AI-06P | INT1–3 | После06A + CAP5/DB-03: default/route policies, native ingest/links, backfill/live matrix |
| AI-08 | RT1–5 | После AI-07: realtime, external SIP/edge, outgoing API, lifecycle/onboarding/live profiles |
| AI-09 | TOOL1–6 | После AI-07, независимо от08: business tools/MCP, knowledge ingestion/retrieval/releases, test/eval |

Добавлены 23 task-level задания; всего с предыдущими планами **60**. Это не evidence готовности реализации. Ближайший code assignment по-прежнему A1. Source/spec revisits и upstream checks обязательны перед каждым bounded assignment.

## Согласования интерфейсов

1. **Metric status:** public `scored|unknown|not_applicable|unscorable`, reason/error отдельно; proposed `valid/invalid/insufficient_evidence` описывают внутреннюю валидацию, не второй public enum. Weight/coverage contract один MET2 для API/UI/report.
2. **Content rights:** free-text summary/rationale/quotes/transcript/participant labels требуют content/transcript permission; typed values/quality codes — basic read. Export не расширяет права, recipient/download checks повторяются. Snapshot не обходит последующий revoke/delete.
3. **Analytics scopes:** AI-05 добавляет `analytics:reanalyze`, вместе с проверкой доступа к source/result; `analytics:upload` не даёт его. Preview/reviews/projects/report management v1 только JWT permissions. Scope выдаётся только после регистрации реального action/resolver, не будущего placeholder.
4. **Voice public v1:** canonical `/api/v1/ai-voice`, scopes `robots:read/invoke/control/transcript/audio`, binding deployment. Старые proposed `sessions:read/control` и `/api/integrations/v1/voice` не aliases. Control не даёт audio/transcript, invoke не даёт arbitrary destination. Registry расширяется RT3, существующие ключи не получают новые grants автоматически.
5. **Voice outcomes:** terminal state completed/transferred/failed/cancelled; no_input/no_consent/user_hangup — reason/business result. AutoDial handoff maps to transferred; attempt owner один. Media ready отдельно от call ended.
6. **Neutral delivery:** schema/API AN4 общие, без analytics entitlement/import. Если robot stream реализуется первым, RT3 назначает этот neutral component по AN4 contract, AN4 позднее добавляет analytics event adapter. Один writer/tables/migrations; не ждать аналитического продукта и не копировать второй delivery service. Email report adapter использует общую durable infrastructure с отдельными channel permissions.
7. **Usage:** report/KB/preview/tool jobs и voice operations используют AI-02/PRODUCT-SLICES UsageSubject. Side-effect journal бизнес-tool отдельный по смыслу от provider billing, usage ref общий. Нет второго wallet. Embedding/index rebuild имеет actual usage и explicit estimate; replace не запускает бесконечный скрытый rebuild.
8. **Persistence:** MySQL/PG Sequelize mapping сохраняется. Immutable result JSON и typed metric rows пишутся одной transaction. Report snapshot требует реального MVCC selection; watermark по timestamp/id недостаточен. Full baseline immutable, shared manifest/DTO/registry writer один.
9. **Capture policy:** analytics OFF не выключает обычную PBX запись. Privacy deny выше recording/analytics settings. Pause запрещает новые processing stages, не теряет accepted state, не вызывает backfill при resume. Snapshot policy и emergency recheck различаются.
10. **Admin vs phone:** AiAdapterRegistry/proposals остаётся control plane. Business gateway использует только reviewed published connections/actions с phone principal. Discovery annotations/caller claims не повышают права. Старый `cc_ai_toolsets` JSON не auto-enables runtime tools без inventory/mapping/review.

## Решения, которые нужно измерить или утвердить

| Gate | Что известно сейчас | Выход до исполнения/выпуска |
|---|---|---|
| R3-PROVIDER | Realtime interface RT1 | Provider/model/protocol, region/BYOK, RU traces, latency/quality/budget; неподдержанный profile disabled |
| R3-SIP | Authenticated connection→tenant→DID | Certified TLS/SRTP/NAT/codec/transfer profiles конкретного edge, isolated contexts |
| R3-MCP | Discovery/call permissions TOOL1/2 | Pinned SDK/protocol allowlist, supported auth profile, hostile-server suite; не вся latest spec автоматически |
| R3-KB | Portable SQL metadata, derivative index | TOOL3 benchmark lexical/exact/optional vector, corpus/hardware/capacity/ACL/delete, reviewed ADR перед implementation |
| R3-QUALITY | Typed schema/provenance/dataset separation | Rubric/human calibration и holdout thresholds до live run; synthetic pass не точность AI |
| R3-BUSINESS | Shadow ledger/local BYOK | [AI-10](AI-10-PLAN.md) COM1–COM2: price book/trial/SKU и billable switch; grace/refunds/invoice до live switch |
| R3-DEPLOY | SaaS/self-hosted/OpenSource, две DB | [DB-04](DB-04-PLAN.md) I1–I3 + [AI-10](AI-10-PLAN.md) COM3–COM4: install/restore/upgrade, license lifecycle, packaging |

Gates не мешают заранее зафиксировать схемы/ошибки/границы. Если измерение меняет интерфейс, coordinator обновляет контракт и потребителей до code changes. Исполнитель не выбирает новый стек сам и не объявляет непроверенный profile ready.

## Self-review и дальнейший предел детализации

Проверка текущим `/root`, не independent review. Прочитаны roadmap/spec, текущие MCP dispatcher/toolsets и route form recording fields. Согласованы scopes/voice endpoint/outcome и neutral delivery dependency. Каждый task имеет owned paths/dependencies/acceptance. Runtime тесты используют synthetic/fake fixtures и disposable узел, без реальных рассылок/дозвонов/списаний при обычных tests.

Проектирование не запускало код, migrations, local Docker, provider requests или remote operations. При реализации обязательны project lint/backend/frontend и целевые MySQL/PG/live tests только на `root@ipbx.krasterisk.ru`; paid providers/live calls с разрешёнными credentials/budget. Проверка документов отдельно от runtime evidence.

Итоговая проверка r3: Node — 21 документ, 204 относительные ссылки, 60 уникальных task headings, 9 SHA-256 в EXECUTION; exit0/errors=[]. `git diff --check -- .planning/initiatives/ai-products` — без whitespace errors, только Git LF/CRLF notices. Новые untracked планы включены в Node проверку. Runtime suites для документационного изменения не запускались; прежние PASS не присваивались новой реализации.

Task-level [AI-10](AI-10-PLAN.md) (COM1–4, 10A, 10R) и [DB-04](DB-04-PLAN.md) (I1–I4) записаны 2026-09-20-r1; это design, не implementation evidence. Остаётся AI-11A/R (release/pilot). Release gates уже заданы ROADMAP; точные финансовые migrations/operator commands привязывать к реализованной схеме и измеренным deployment profiles при назначении. Feature-level horizon AI-01…10 и DB-04 покрыт планами; implementation только через EXECUTION assignment.
