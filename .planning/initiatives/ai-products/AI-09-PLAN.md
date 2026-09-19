---
initiative: ai-products
phase: AI-09
revision: 2026-09-18-r3
status: planned_dependency_gated
tasks: [TOOL1, TOOL2, TOOL3, TOOL4, TOOL5, TOOL6]
depends_on: [AI-07]
---

# AI-09 — бизнес-tools, исходящий MCP и базы знаний

Чтение: [ROBOTS-SPEC](ROBOTS-SPEC.md), [AI-07](AI-07-PLAN.md), [AI-02](AI-02-PLAN.md), backend D-16/MCP architecture, [ADVANCED-PRODUCT-CONTRACTS](ADVANCED-PRODUCT-CONTRACTS.md). Требования VR-07/08, VR-02 bindings, VR-10 test bench, VR-12 adversarial eval. Не зависит от realtime AI-08; тот использует тот же runtime gateway после появления.

В текущем проекте `McpToolsService` обслуживает административный `AiAdapterRegistryService`/proposals; `cc_ai_toolsets.tools` — mutable JSON. Телефонный робот не получает admin principal и не вызывает произвольные локальные handler refs. Здесь бизнес-runtime boundary, не альтернативный dispatch для административного AI. Reuse schema validation/redaction/secret store, не копировать admin permissions в разговор.

## TOOL1 — connections, schemas и toolset versions

**Owned paths:** новые `ai-tool-connectivity/**`, `ai-voice/tools/**`, bounded `ai-agents/ai-toolsets.*`, shared typed schema/DTO, migrations/manifest/coverage registry. Новые control-plane management actions: D-16 adapter+skill или infrastructure classification с причиной, writes проходят существующий proposal/confirmation contract. Runtime methods автоматически административными tools не становятся.

Таблицы: `ai_business_connections` (tenant/id/kind http|mcp/endpoint/secret_ref/egress_policy/status/revision), `ai_business_tool_revisions` (connection/id/tool_key/revision/input/output schema/hash/description/risk policy), `ai_toolset_versions` (tenant/id/legacy_toolset_uid/revision/immutable binding list/hash), `ai_tool_discovery_runs` (connection/revision/protocol version/digest/status/safe diagnostics). Composite ownership constraints, secrets через C1 store, нет raw credential в tool JSON.

`cc_ai_toolsets` остаётся editable bundle, tools переводятся в typed references к reviewed revisions/policies; immutable versions привязывает robot version. Legacy names/handlerRef/URLs проходят inventory+preview mapping; опасные/непонятные bindings quarantine, не auto-enable. Схема upstream изменилась — новый candidate revision и readiness warning, текущая publication не расширяет права сама.

SaaS connections — HTTPS HTTP/MCP endpoint, no user-supplied stdio shell. Self-hosted local connector возможен отдельным installation-admin allowlisted adapter, не textbox команд. HTTP URL templates только server-owned base и path variables из validated schema, нельзя менять host/scheme/headers auth/tenant моделью. Auth секрет вводит authorised designer, UI возвращает configured boolean/одноразовый create receipt. Outgoing egress reuse AN4 limits/DNS pinning/IP deny; private endpoint только explicit installation egress policy. RBAC designer/admin отдельно от caller principal.

Discovery: negotiate allowlisted MCP protocol versions/transport через pinned maintained SDK после проверки compatibility; timeout/page/size caps. Tool annotations/descriptions/schema — недоверенные данные; `readOnlyHint` не разрешает действие. MCP sampling/elicitation/roots/subscriptions не включать автоматически: v1 tools discovery/call только, неподдержанное request явный refusal. Protocol version и test transcript фиксируются в connection report. Official tools spec требует не доверять annotations от недоверенного сервера: [MCP tools](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/tools.mdx). Это источник проверки, не обещание поддержки всей последней версии.

Первый auth profile — отдельный service credential конкретного MCP server, разрешённый его проверенным transport contract. OAuth-required servers unavailable до отдельного validated connector adapter; не подставлять API key или пользовательский JWT как универсальный bearer. Для будущего OAuth адаптера обязательны tenant/user-bound state, PKCE, redirect allowlist, audience/resource binding, encrypted refresh credentials и запрет token passthrough; discovery URL не даёт права пересылать чужой token.

**Приёмка:** tenant0/A/B, secret redaction, malicious discovery/schema/annotations, changed schema, huge list/ref recursion, endpoint SSRF/redirect, unsupported MCP requests, preserved old toolset read с отказом unsafe runtime use.

## TOOL2 — scoped ToolGateway и side effects

**Вход:** TOOL1, VR4 operation journal, D4 subject metering. **Owned paths:** business tool executor/operation repository, neutral egress client, ai-voice turn coordinator hooks, fake upstream harness.

Phone principal server-built: tenant/session/deployment/version, allowed tool revisions/resource bindings, verified caller claims (если есть), deadlines/budgets. Caller ID/слова «я директор» не identity verification. Tools requiring protected account data требуют доверенный external auth assertion bound session+expiry+resource; отсутствие →deny/handoff, не запрос секретов для сохранения в transcript.

Gateway order: published allowlist → exact tenant/connection/schema revision → input validation → resource/verified-claim policy → quota/deadline → persisted operation claim → outbound call → output schema/size validation → result/audit/usage. Inject server tenant/resource fields после model validation, запретить model overrides. Native realtime и cascade tool calls идут этим gateway; имена unregistered tools не dynamic function lookup.

`ai_business_tool_operations`: tenant/id/session_id/tool_revision_id/provider_call_id/local_operation_key/request_hash/state/attempt/upstream_idempotency_key/result_ref/error/deadline; UNIQUE(session_id,local_operation_key), mapping UNIQUE(session_id,provider_call_id) когда ID есть (не полагаться только на nullable unique). Semantic dedupe key может включать tool revision+business resource+action nonce по контракту действия; один лишь hash одинаковых args не запрещает законное повторное действие в следующем turn. Operation ID выдаёт gateway до отправки.

Mutating tools публикуются только с доказанным upstream idempotency либо status reconciliation contract; иначе v1 unavailable для autonomous call. Timeout после dispatch →outcome_unknown; не повторять действие вслепую и не сказать клиенту «сделано». Side effect final result независим от audio epoch: barge-in останавливает речь, но не отменяет уже выполненную запись CRM. Повторный output delivery в model не запускает upstream снова. Read-only retries bounded при подтверждённой policy, annotations alone недостаточно.

Pilot budget: max8 tool calls/session, max2 concurrent **read-only**, mutating последовательны; deadline10s default/max30s явно в policy, output64KiB, schema depth8/ref recursion reject. Long call допускает нейтральное сообщение ожидания, но не скрывает latency. HTTP/MCP output — untrusted data, не system instructions; секретные поля redacted до model/transcript. Audit хранит operation/ref/decision/digest, полный payload только если retention/ACL позволяют. External auth tokens не передаются другому upstream без явной connection-bound audience.

**Приёмка:** forged tenant/tool/URL, prompt injection, schema drift, auth claims expired, duplicate provider call, timeout after side effect, cancel during tool, late result epoch, read-only parallel budget, upstream returns secret/huge result. Exactly-once внешнего действия не обещать без upstream evidence.

## TOOL3 — KB ingestion и выбор retrieval профиля

**Owned paths:** новый `knowledge/**` domain/ingestion/retrieval ports, AI-02 job/storage adapters, shared types, migrations/coverage registry; parser sandbox. Никакого ingestion/chunking в аудио event loop.

Таблицы: `kb_bases` (tenant/id/name/status/draft_revision), `kb_documents` (base/id/source asset/hash/status/tombstone), `kb_document_revisions` (document/revision/extraction config/digest), `kb_chunks` (tenant/revision/id/ordinal/text_ref/provenance/tokens/hash), `kb_embedding_revisions` (chunk/embedding profile/dimension/vector ref/hash/state), `kb_releases` (base/id/revision/immutable membership+index manifest/hash/status), `kb_release_members` (release/document_revision), `kb_access_bindings` (tenant/base/user-or-robot binding/permissions/revision). Composite tenant FKs, UUID IDs, original storage private. Metadata SQL authoritative на MySQL и PG; retrieval index — rebuildable derivative.

V1 источники: upload UTF-8 txt/md, text PDF и docx (max20MiB/document,200 pages,100k extracted tokens); MIME/probe, zip bomb/external links/macros rejection, CPU/memory/time caps. OCR/scans и web crawler disabled с понятным reason, не пустой successful index. PDF/docx parsers не выполняют active content и network fetch. Duplicate document hash не склеивает разные tenants/ACL; replace создаёт revision, старый release остаётся immutable до tombstone policy.

Pipeline upload→extract→normalize→chunk→embed→build index→validate→release candidate, AI-02 idempotency/leases/unknown provider/usage. Chunk v1 target512 tokens/overlap64, stable tokenizer/profile revision, preserves document/page/section offsets; таблицы/heading boundaries не режутся произвольно без provenance. Изменение tokenizer/embedding dims требует новый index release, смешанные vector dimensions запрещены.

Retrieval ADR **до production implementation**: benchmark lexical baseline, переносимый exact vector для bounded corpus и optional dedicated vector index по одной holdout выборке. Pilot cap10k chunks/base. PostgreSQL/pgvector не становится обязательной второй СУБД; MySQL profile равноправен. SQL metadata+vector blob/immutable index artefact позволяет portable implementation; approximate index выбирается только если measured latency/recall требует и обе installation profiles воспроизводимы. Нельзя выбрать engine по вкусу исполнителя и объявить benchmark выполненным.

Benchmark outputs: recall@5/nDCG, RU tokenization, zero-result/unanswerable rate, p95 latency at10 concurrent queries, rebuild time/disk/memory, deletion/ACL behavior. Target pilot recall@5≥0.85 и p95≤500ms на declared corpus/hardware — предлагаемые release-profile gates, фиксируются до запуска. Если не выполнены — reduce supported corpus/выбрать другой adapter и повторить; task remains dependency-gated. Lexical fallback честно помечен, не заявляется эквивалентом semantic retrieval.

**Приёмка:** malformed PDF/docx, source offsets, embedding retry/unknown, wrong dimension, job crash, rebuild exact manifest, dual-DB parity, no external egress local profile, benchmark report. Fake embeddings только deterministic contracts, не semantic quality.

## TOOL4 — retrieval ACL, публикация и удаление

**Вход:** TOOL3 accepted retrieval ADR, VR1 version bindings. **Owned paths:** knowledge release/ACL/query/deletion services, ai-voice knowledge tool adapter, cache/invalidation tests.

Publish создаёт immutable release с document revisions/tokenizer/embedding/index digests, active pointer CAS. Robot publish фиксирует release ID; изменение draftKB не меняет текущие sessions. Query проверяет tenant/robot-version/base/release permission до retrieval; postfilter снова проверяет tombstones/current ACL. TopK after deny может недобрать документов; bounded refill, никогда заполнение чужими results. Cache key включает tenant/release/ACL revision/query hash/embedding profile; per-tenant cache, revoke invalidates, TTL не заменяет permissions.

Deletion/revoke важнее immutable serving: immediate SQL tombstone/ACL revision запрещает новые chunks/results даже старым robot versions; фоновые jobs удаляют derivative indexes/embeddings/original по retention, с receipts/retry. Уже полученный worker context нельзя «забыть» обещанием: перед каждым дальнейшим retrieval/ответом проверить revocation; при revoke mid-generation cancel affected output where possible и пометить ограничения уже сказанного. Не откатывать pointer на release с tombstoned content как способ обойти delete. Backup deletion отражается retention policy, не обещать физическое стирание всех backup мгновенно.

Retrieval tool возвращает bounded excerpts+document/chunk/release/page refs с relevance provenance. Caller/model не задаёт произвольный baseId или search всех tenants. Prompt treats excerpt instructions as data. Low support →no-answer/handoff; citation validator допускает только реально retrieved/authorised refs. Валидный ID цитаты не доказывает factual entailment — отдельный eval TOOL6.

**Приёмка:** revoked during query/cache, cross-tenant identical text/hash, old release delete, stale index after rebuild, model forged citation, chunk instructions «ignore policy», low relevance/unanswerable, concurrent publish/rollback и no direct object URL leak.

## TOOL5 — UX tools/knowledge и безопасный тест

**Owned paths:** aiRobots tools/connections/knowledge pages/editor bindings, shared RTK/types/locales/tests. Использовать нейтральные connection/secret patterns C3, отдельный product editor не вторую admin MCP консоль.

Connection wizard показывает destination, permissions/data access, discovery diff и admin-reviewed capability. Никакого «подключить все tools» по умолчанию. Designer выбирает конкретные tool revisions/resources, timeout и side-effect policy; unknown unsupported mutation заблокирована с объяснением. Secret never re-read. Probe без business side effects; тест mutating tool только явно sandbox connection/test resource, не production CRM default.

KB: upload/status/errors/retry → documents/page provenance → test search → release → robot binding. Search test показывает snippets/score/provenance только по content ACL. Publication diff перечисляет additions/deletes/reindex compatibility и оценку expense; upload не даёт instant ready. Index job cancellation не удаляет previous release.

Browser test default simulated tools/read-only fixture data, side effects disabled; event trace отличает simulated/actual/read-only/mutating/unknown. Для real business test отдельный explicit opt-in с approved resource/action, не implicit действие после voice Start. Нельзя представить simulated CRM success как реальную операцию. Runtime logs/private schema details в debug drawer только designer.

**Приёмка:** unsafe binding denied before publish, secret redaction, schema drift review, failed ingestion recovery, zero-result search, revoke hidden data, RU/EN360/1440/keyboard, existing scripted/AI-chat UI regression.

## TOOL6 — adversarial/eval matrix и rollback

**Owned paths:** fake HTTP/MCP servers, knowledge corpus/eval harness, remote composition tests, AI-09 SUMMARY/VERIFICATION. Выбор SDK/protocol version зафиксировать с official docs/digest в implementation evidence.

Hard scenarios: malicious discovery/tools/output/documents, SSRF/redirect/private endpoints, token exfiltration, caller impersonation, forged args/citations, tenant0/A/B, duplicate side effect/unknown result, barge-in during mutation, disable connection mid-call, long output/budget overflow, concurrent KB reindex/delete. No admin PBX mutation from phone principal; proposals infrastructure не обходится.

Held-out минимум30 answerable и15 unanswerable queries, document/source labels и tool business task expected outcomes; tuning corpus отдельно. Измерить retrieval recall, answer groundedness, citation precision, appropriate abstention, task success и latency/cost. Zero cross-tenant/secret leaks, accepted invented citations=0, повторный mutation при replay=0; content-quality numeric gates фиксируются перед real run, не подгоняются после. Real adapter tests для каждого published provider/connection profile, mocks недостаточно.

MySQL/PG + standalone robot profile без analytics runtime; чтобы callbacks работали, neutral delivery component извлечён из AN4 contract, но запускается без аналитического продукта. Build/lint/backend/frontend, restore/rebuild test indexes из SQL+storage manifest. Rollback disables new tool/KB bindings/admissions, сохраняет in-flight unknown operations для reconciliation; не удалять journal и не повторять mutation. Далее AI-10R/11R, а не автоматическое включение тарификации.
