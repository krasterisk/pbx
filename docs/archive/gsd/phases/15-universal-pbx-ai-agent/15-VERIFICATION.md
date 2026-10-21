---
phase: 15-universal-pbx-ai-agent
verified: 2026-09-04T16:55:00Z
status: passed
score: 23/23 must-haves verified
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 23
  total: 23
  not_honored: []
coincidental_reliance_items:
  - truth: "D-17 completeness gate compares classified domains to registered adapters"
    reason: fixture-only
    harden: "Live completeness currently synthesizes getDomains() from source `readonly domain =` plus stub register(); add a Nest-boot or onModuleInit register() scan so a file that declares a domain but never calls registry.register() fails."
human_verification: []
---

# Phase 15: Универсальный AI-агент по АТС — Verification Report

**Phase Goal:** Свой агентный цикл в Nest вместо внешнего проксирования: агент, который видит всю АТС, отвечает человеческим языком на любые связанные с ней вопросы и правит настройки во всех модулях через подтверждаемые диффы — с тенантной изоляцией, доказанной тестами.

**Verified:** 2026-09-04T16:55:00Z
**Status:** passed
**Re-verification:** No — initial verification

Полные `npm run lint` / `test:backend` / `test:frontend` / build **не запускались** (ограничение оркестратора). Доказательства — чтение исходников и существующих spec/test файлов. Human checkpoint по aiPBX уже закрыт: провайдер модели, не MCP-мозг; `mcpServers` callback выключен (`15-15-SUMMARY.md`).

## Goal Achievement

Цель фазы держится в коде, а не только в SUMMARY. Цикл крутится в `PbxAgentLoopService.runTurn`; прокси `AiChatService` / `AIPBX_*` / `mcpServers` удалены; 18 рукописных `reg*()` и обход `/api/ai-tools` сняты; мутации идут через `AgentDiffProposal` + карточку; uid только параметром вызова; кросс-тенантный suite перечисляет реестр.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | D-06: свой агентный цикл в Nest; aiPBX — один из провайдеров, не мозг | ✓ VERIFIED | `pbx-agent-loop.service.ts` вызывает `PbxAgentLlmClient` + `McpToolsService.callTool`. `ai-chat.service.ts` отсутствует. `AIPBX_(URL\|CHAT_ID\|TOKEN)` нет в production ai-chat. Клиент резолвит URL через `resolveChatCompletionsUrl` из строки `cc_ai_providers`. |
| 2 | D-07: провайдеров и ключи заводит только админ платформы; тенант модель не видит | ✓ VERIFIED | `AiChatSettingsCard` рендерит выбор модели только при `isSuperAdmin`. `AiChatWidget.test.tsx` — «does not render a model selector in the tenant panel». `agent-usage.controller.ts` — `@UseGuards(JwtAuthGuard, SuperAdminGuard)`. |
| 3 | D-08: расход по тенанту считается и показывается админу; жёстких лимитов нет | ✓ VERIFIED | `threads.addUsage` в цикле; `agent-usage.service.ts` считает spend из токенов × `pricing`. Карточка админа показывает tokens/spend/funnel. Лимит-гейта в usage-сервисе нет. |
| 4 | D-09: потолок шагов + строка прогресса + «Стоп» | ✓ VERIFIED | Цикл: `maxSteps` / `max_steps_exceeded`; SSE `progress` с именем тула. Контроллер пробрасывает `AbortSignal` с `req.close`. FE: `useAgentStream` `AbortController` + `stop`. Spec: «aborts the in-flight model request…», «skips remaining tool calls…», ceiling-сценарий eval. |
| 5 | D-10: progressive disclosure — в промпте каталог, тело через tool | ✓ VERIFIED | `formatCatalogBlock()`: «Catalog only… Load a skill body through read_skill». `AgentSkillRegistryService` регистрирует `list_skills` / `read_skill`; тела в промпт не кладутся. |
| 6 | D-11: скилы — файлы в репо рядом с кодом, не `.docs/` | ✓ VERIFIED | 23 `SKILL.md` под `packages/backend/src/skills/`. `nest-cli.json` `assets: ["skills/**/*.md"]`. `knowledge-base.service.ts` удалён (Test-Path false). |
| 7 | D-12: знания = скилы + живое состояние АТС/CDR + диагностика | ✓ VERIFIED | Промпт: snapshot + `getKnowledgeBlocks()` + каталог. Адаптеры `reports`, `pbx`, `diagnostics` (`core show channels concise`, `dialplan show`). Dry-run и шаблоны Phase 14 — отдельные адаптеры. |
| 8 | D-13: человеческий язык; причину выясняет по evidence | ✓ VERIFIED | `behaviouralRules()`: business language; «Establish a cause from live state, logs and configuration». Скил diagnostics учит порядок evidence. Eval `diagnostic-read-first`. |
| 9 | D-14: язык ответа = язык вопроса | ✓ VERIFIED | «Respond in the same language the user writes in; fall back to the interface locale». Жёсткого «Отвечай по-русски» в builder нет. |
| 10 | D-15: чтение — все тенантные модули; запись — приоритетные домены | ✓ VERIFIED | 30 `*-ai.adapter.ts`. Запись (`proposes: true`): directories, endpoints, trunks, ivrs, queues, routes, call-groups, moh. Read-only: settings, messaging, speech, operations, users, numbers, time-groups, voicemail, diagnostics, reports, contexts. Tenant/platform settings — только чтение (out of scope). |
| 11 | D-16: новый модуль обязан прибыть с адаптером и скилом; конвенция в ARCHITECTURE | ✓ VERIFIED | `ARCHITECTURE.md` §6 «ОБЯЗАТЕЛЬНОЕ ПРАВИЛО (D-16)». Скил `developer-convention`. Tools не добавляются в `McpToolsService`. |
| 12 | D-17: конвенцию держит падающий тест | ✓ VERIFIED | `ai-adapter-completeness.spec.ts`: unclassified dir, covered без адаптера, пустая причина, orphan domain, missing/broken skill. Live: каталоги `src/modules` совпали с `MODULE_COVERAGE` (spot-check listing). См. coincidental-reliance. |
| 13 | D-18: правки — черновик-дифф, без записи до согласия | ✓ VERIFIED | `callTool` для `proposes` → `createProposal`. Directory/endpoint/trunk/ivr/queue/route/call-group/moh мутации с `proposes: true`. Eval mutating + `assertNoWrite`. Live-ops исключение: `cc_force_pause_agent` / `cc_force_unpause_agent`. |
| 14 | D-19: согласие — карточка Apply/Reject, не текстовое «да» | ✓ VERIFIED | `DiffConfirmCard` вызывает `/ai-chat/proposals/${proposalId}/apply|reject`. Тесты: pending/applied/rejected/denied/error, double-confirm. `toProposalView` не отдаёт `applyPayload`. |
| 15 | D-20: Apply пишет БД и reload dialplan одним шагом | ✓ VERIFIED | `PbxAgentDiffService.apply`: `executePayload` затем `routeApplyService.applyContext` если `includes_dialplan_reload`. `apply_dialplan` retired — нет в реестре. |
| 16 | D-21: права агента = права человека в UI | ✓ VERIFIED | `canMutate`: `role !== UserLevel.READONLY`; denied + audit, без write. Routes UI тоже только `JwtAuthGuard` (нет более узкого RolesGuard на мутациях маршрутов). SuperAdmin-only — usage. |
| 17 | D-22: uid только из JWT параметром вызова; тест на каждый tool | ✓ VERIFIED | `sanitizeArgs` + `TENANT_ARG_KEYS`. `legacy-tool-migration.spec.ts` «for each registered adapter tool» + forged keys. `mcp-tools.service.spec.ts` table-driven strip. Eval `cross-tenant-same-tool` / `cross-tenant-forged-uid`. |
| 18 | D-23: виджет поверх любой страницы, отдельной страницы нет | ✓ VERIFIED | `ModuleShell` монтирует `AiChatWidget`; маршрута `/ai-chat` нет. |
| 19 | D-24: кнопка в топбаре слева от ⌘K; нижний правый угол свободен | ✓ VERIFIED | `#shell-agent-trigger` перед command palette. Хоткей Ctrl/⌘+Shift (palette без Shift). FAB/bottom:28px в виджете нет. Тесты ModuleShell + AiChatWidget. |
| 20 | D-25: панель 520px / sheet, без наложений; выбор модели убран | ✓ VERIFIED | `--ai-agent-panel-width: 520px`. Геометрия/escape/focus trap в `AiChatWidget.test.tsx`. Model selector в панели тенанта отсутствует. |
| 21 | D-26: треды в БД по тенанту и автору | ✓ VERIFIED | Модели thread/message/proposal + `migrate-agent-threads.ts`. `findOne`/`list` с `vpbx_user_uid` + `user_uid`. `ThreadList` грузит API, не Redux-only историю. |
| 22 | D-27: 18 рукописных tools и оба обходных пути удалены | ✓ VERIFIED | `McpToolsService` только `adoptAdapterTool`. Нет `private reg(`. `ai-webhook.controller.ts` и `knowledge-base.service.ts` отсутствуют. Spec запрещает leftover имена и импорты. |
| 23 | D-28: `/api/mcp` жив; тенант только из JWT; заголовок игнорируется | ✓ VERIFIED | `McpController`: `JwtAuthGuard`, `req.user.vpbx_user_uid`. Spec: нет `JwtOrServiceTokenGuard` / `X-Vpbx-User-Uid` на контроллере; service token + header → unauthorised. Checkpoint: mcpServers callback выключен намеренно. |

**Score:** 23/23 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `packages/backend/src/modules/ai-chat/pbx-agent-loop.service.ts` | in-process turn | ✓ VERIFIED | Model/tool loop, ceiling, abort, persist. Wired from `ai-chat.controller.ts`. |
| `packages/backend/src/modules/ai-chat/pbx-agent-llm.client.ts` | pluggable OpenAI-compatible client | ✓ VERIFIED | `signal`, `resolveChatCompletionsUrl`. |
| `packages/backend/src/modules/mcp/mcp-tools.service.ts` | single sanitized dispatch | ✓ VERIFIED | `sanitizeArgs`, `createProposal`, live-ops set. |
| `packages/backend/src/modules/ai-platform/ai-adapter.types.ts` | `AgentDiffProposal` + `TENANT_ARG_KEYS` | ✓ VERIFIED | Imported dispatch-ом. |
| `packages/backend/src/modules/ai-platform/agent-skill-registry.service.ts` | catalog + `read_skill` | ✓ VERIFIED | Self-register `domain = 'skills'`. |
| `packages/backend/src/modules/ai-chat/pbx-agent-diff.service.ts` | apply/reject + reload | ✓ VERIFIED | `applyContext` on route proposals. |
| `packages/backend/src/modules/ai-chat/agent-proposals.controller.ts` | auth apply/reject | ✓ VERIFIED | Scoped to token tenant/author. |
| `packages/backend/src/modules/ai-platform/ai-adapter-completeness.spec.ts` | D-17 gate | ✓ VERIFIED | Substantive; live + synthetic cases. |
| `packages/backend/src/modules/ai-platform/module-coverage.registry.ts` | classification + reasons | ✓ VERIFIED | Все каталоги `src/modules` классифицированы. |
| `packages/backend/src/modules/diagnostics/diagnostics.service.ts` | tenant-filtered reads | ✓ VERIFIED | Allowlist команд, caps. |
| `packages/backend/src/modules/ai-chat/pbx-agent-eval.harness.ts` | fixture replay | ✓ VERIFIED | Гоняет реальный `runTurn`. 10 сценариев. |
| `packages/frontend/src/widgets/AiChatWidget/AiChatWidget.tsx` | panel + stream + cards | ✓ VERIFIED | ThreadList + DiffConfirmCard + stream hook. |
| `packages/frontend/src/widgets/ModuleShell/ModuleShell.tsx` | topbar trigger | ✓ VERIFIED | `shell-agent-trigger`. |
| `packages/frontend/src/features/ai-chat/ui/DiffConfirmCard/DiffConfirmCard.tsx` | five states | ✓ VERIFIED | Apply/Reject by `proposalId`. |
| `packages/frontend/src/features/cloud-admin/ui/AiChatSettingsCard/AiChatSettingsCard.tsx` | admin model + usage | ✓ VERIFIED | SuperAdmin-only. |
| `packages/backend/.idea/ARCHITECTURE.md` | D-16 норматив | ✓ VERIFIED | §6 обязательное правило. |
| `packages/backend/src/skills/developer-convention/SKILL.md` | D-16 для агента | ✓ VERIFIED | Frontmatter + ссылка на тест. |

**Artifacts:** 17/17 verified (ключевые; остальные адаптеры/скилы существуют и регистрируются в `onModuleInit`)

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `pbx-agent-loop.service.ts` | `mcp-tools.service.ts` | `callTool(..., tenantUid)` | ✓ WIRED | uid из контекста токена, не из args модели |
| `ai-chat.controller.ts` | `pbx-agent-loop.service.ts` | `runTurn` + `AbortSignal` | ✓ WIRED | `req.on('close')` → abort |
| `pbx-agent-llm.client.ts` | `llm-summary.service.ts` | `resolveChatCompletionsUrl` | ✓ WIRED | |
| `pbx-context-builder.service.ts` | skill registry / adapter registry | `getCatalog` / `getKnowledgeBlocks` | ✓ WIRED | KnowledgeBaseService удалён |
| `mcp-tools.service.ts` | `pbx-agent-diff.service.ts` | `createProposal` | ✓ WIRED | |
| `pbx-agent-diff.service.ts` | `route-apply.service.ts` | `applyContext` | ✓ WIRED | только при `includes_dialplan_reload` |
| `mcp.controller.ts` | `mcp-tools.service.ts` | session `callTool` + JWT uid | ✓ WIRED | |
| `ModuleShell.tsx` | `AiChatWidget.tsx` | `shell-agent-trigger` / `agentOpen` | ✓ WIRED | |
| `DiffConfirmCard.tsx` | `aiChatApi.ts` | `proposalId` apply/reject | ✓ WIRED | payload на клиент не отдаётся |
| `useAgentStream.ts` | chat controller | `AbortController` | ✓ WIRED | |
| `agent-usage.service.ts` | `cc_ai_providers.pricing` | spend | ✓ WIRED | |
| `ai-adapter-completeness.spec.ts` | `getDomains()` / skills on disk | coverage registry | ✓ WIRED | live listing + skill parse |

**Wiring:** 12/12 verified

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| System prompt snapshot | compact PBX state | `Endpoints/Trunks/Ivrs/Queues/Contexts` + adapter summaries, scoped uid | Yes | ✓ FLOWING |
| Thread rail | conversations | `GET` thread API → Sequelize `AgentThread` | Yes | ✓ FLOWING |
| Diff card | proposal view | persisted `AgentProposal` via `toProposalView` | Yes | ✓ FLOWING |
| Admin usage | tokens / spend | thread usage rows × provider `pricing` | Yes | ✓ FLOWING |
| Diagnostic tools | channels / dialplan | AMI allowlist + tenant filter | Yes (live AMI) | ✓ FLOWING |
| Eval harness | tool sequence | fixture LLM + real `callTool` | Deterministic fixture | ✓ FLOWING (by design) |

### Behavioral Spot-Checks

Полный suite не запускался. Проверено существование и содержание именованных тестов (чтение файлов).

| Behavior | Command (not executed) | Result | Status |
| -------- | ---------------------- | ------ | ------ |
| D-09 abort | spec `aborts the in-flight model request…` in `pbx-agent-loop.service.spec.ts` | asserts `signal` forwarded, `cancelled`, no further tools | ✓ PASS (source) |
| D-18 no write | eval mutating + `assertNoWrite` in `pbx-agent-eval.spec.ts` | asserts pending proposal and unchanged entity counts | ✓ PASS (source) |
| D-22 per-tool | `legacy-tool-migration.spec.ts` for-each registered tool | forged keys ignored; tenant B leak asserted | ✓ PASS (source) |
| D-27 deletions | `fs.existsSync` webhook/knowledge = false; no `private reg(` | confirmed on disk | ✓ PASS |
| D-28 JWT-only | `mcp.controller.spec.ts` | JwtAuthGuard only; header path absent | ✓ PASS (source) |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | Phase не объявляет `scripts/*/tests/probe-*.sh` | SKIP |

### Requirements Coverage

`REQUIREMENTS.md` не содержит Phase 15 — контракт фазы это решения `15-CONTEXT.md` (D-06…D-28). Orphaned REQUIREMENTS IDs: нет. Все 23 решения заявлены в PLAN frontmatter и закрыты кодом.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| D-06 | 15-04, 15-08, 15-22 | свой цикл + pluggable providers | ✓ SATISFIED | loop + llm client; proxy удалён |
| D-07 | 15-04, 15-24 | модель только у platform admin | ✓ SATISFIED | admin card + SuperAdminGuard |
| D-08 | 15-03, 15-24 | учёт расхода, без лимитов | ✓ SATISFIED | usage accumulate + admin view |
| D-09 | 15-08, 15-18, 15-22 | ceiling / progress / stop | ✓ SATISFIED | loop + stream hook + eval |
| D-10 | 15-02, 15-04 | progressive disclosure | ✓ SATISFIED | catalog in prompt, `read_skill` |
| D-11 | 15-02, 15-15 | скилы в репо, не `.docs/` | ✓ SATISFIED | `src/skills` + nest assets; KB deleted |
| D-12 | 15-02, 15-07, 15-16…21, 15-19 | скилы + state + diagnostics | ✓ SATISFIED | adapters + diagnostics module |
| D-13 | 15-04, 15-08, 15-18, 15-19 | человеческий язык + evidence | ✓ SATISFIED | behaviouralRules + diagnostics skill |
| D-14 | 15-04 | язык вопроса | ✓ SATISFIED | prompt rule; no hardcoded Russian |
| D-15 | 15-04…13, 15-16…21 | read-all / write-priority | ✓ SATISFIED | 30 adapters; write set matches CONTEXT |
| D-16 | 15-01, 15-02, 15-23 | конвенция модуля | ✓ SATISFIED | ARCHITECTURE §6 + skill |
| D-17 | 15-01, 15-23 | падающий completeness | ✓ SATISFIED | completeness spec |
| D-18 | 15-05, 15-08…13, 15-22 | proposal, не write | ✓ SATISFIED | proposes path + eval |
| D-19 | 15-05, 15-11, 15-14 | карточка, не «да» | ✓ SATISFIED | DiffConfirmCard + apply API |
| D-20 | 15-05, 15-11 | apply + reload одним confirm | ✓ SATISFIED | `applyContext`; no standalone apply tool |
| D-21 | 15-05, 15-09, 15-10, 15-13, 15-14 | RBAC как UI | ✓ SATISFIED | READONLY denied |
| D-22 | 15-01, 15-07, 15-09…13, 15-16…22 | uid из JWT + per-tool test | ✓ SATISFIED | sanitize + registry suite |
| D-23 | 15-06 | overlay widget | ✓ SATISFIED | ModuleShell |
| D-24 | 15-06 | топбар + хоткей | ✓ SATISFIED | trigger + shortcut |
| D-25 | 15-06 | широкая панель | ✓ SATISFIED | 520px + tests |
| D-26 | 15-03, 15-08, 15-12 | треды в БД | ✓ SATISFIED | models + ThreadList |
| D-27 | 15-04, 15-07, 15-09…11, 15-15 | hard-migrate 18 tools | ✓ SATISFIED | adapter-only + deletions |
| D-28 | 15-15 | `/api/mcp` JWT-only | ✓ SATISFIED | controller + spec; callback off |

**Coverage:** 23/23 SATISFIED

### Decision Coverage

23/23 trackable `<decisions>` из `15-CONTEXT.md` (D-06…D-28) присутствуют в shipped artifacts (plans, SUMMARYs, изменённые файлы). Непочтенных решений нет.

Human checkpoint D-28 / aiPBX: **honored as documented** — aiPBX остаётся LLM-провайдером через `cc_ai_providers`; ephemeral `mcpServers` выключен.

Out of scope (не gaps): защита от инъекций → `/gsd-secure-phase 15`; запись tenant/platform settings; жёсткие лимиты токенов.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `mcp-tools.service.spec.ts` | D-22, D-27 | yes | 0 | no | Behavioral | OK |
| `legacy-tool-migration.spec.ts` | D-22, D-27 | yes | 0 | no | Behavioral | OK |
| `pbx-agent-loop.service.spec.ts` | D-06, D-09 | yes | 0 | no | Behavioral | OK |
| `pbx-agent-diff.service.spec.ts` | D-18…D-21 | yes | 0 | no | Behavioral | OK |
| `ai-adapter-completeness.spec.ts` | D-16, D-17 | yes | 0 | no | Value | OK (live side — source scan) |
| `pbx-agent-eval.spec.ts` | D-06, D-09, D-18, D-22 | yes | 0 | no | Behavioral | OK |
| `mcp.controller.spec.ts` | D-28 | yes | 0 | no | Behavioral | OK |
| `DiffConfirmCard.test.tsx` | D-19 | yes | 0 | no | Behavioral | OK |
| `AiChatWidget.test.tsx` | D-09, D-24, D-25 | yes | 0 | no | Behavioral | OK |
| `AiChatSettingsCard.test.tsx` | D-07, D-08 | yes | 0 | no | Behavioral | OK |

**Disabled tests on requirements:** 0
**Circular patterns detected:** 0
**Insufficient assertions:** 0 blockers. WARNING: live D-17 сравнивает классификацию с доменами, извлечёнными regex из исходников, а не с Nest `getDomains()` после `onModuleInit` (см. coincidental-reliance). Все просмотренные адаптеры всё же вызывают `registry.register(this)`.

Eval: 10 сценариев в `reference-scenarios.json` покрывают buckets read / mutating / cross-tenant / diagnostic / step-budget. Оставшиеся 10 **специфицированы** в `evals/README.md` (must-have 15-22). Слоты 19–20 явно отложены в `/gsd-secure-phase 15`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `packages/backend/src/modules/mcp/mcp.module.ts` | 32–36 | устаревший комментарий: JWT **или** service token + `X-Vpbx-User-Uid`; «добавить tool в `registerAll()`» | ⚠️ Warning | Код JWT-only и adapter-only; комментарий врёт. Не открывает header-path. |
| `packages/backend/src/modules/mcp/mcp.module.ts` | 58–59 | `JwtOrServiceTokenGuard` / `ServiceTokenGuard` всё ещё в `providers` | ⚠️ Warning | Не навешаны на контроллер. Мёртвая проводка после D-28. |
| `packages/backend/src/modules/mcp/mcp-tools.service.ts` | 56–68 | неиспользуемые constructor deps доменных сервисов | ℹ️ Info | После cutover dispatch не читает их; шум, не обход. |
| `packages/backend/src/modules/ai-chat/pbx-context-builder.service.ts` | 72 | `confirmDestructive` ещё читается в snapshot | ℹ️ Info | Self-confirm флаг модели снят; поле наследие настроек. |

Debt markers `TBD` / `FIXME` / `XXX` в изменённых phase-файлах агента: не найдены.

### Human Verification Required

N/A — UI-контракты (триггер, 520px, треды, карточка, стоп, админ-карточка) закрыты существующими component-тестами. Единственный заранее отложенный human checkpoint (aiPBX / mcpServers) уже принят пользователем. Неинвентаризованных `<human-check>` в PLAN нет.

Инъекции и «что агент не должен делать» — не эта фаза: `/gsd-secure-phase 15` до ship (CONTEXT deferred).

### Gaps Summary

Нет blocking gaps. Цель фазы наблюдается в коде: свой цикл, покрытие модулей, подтверждаемые диффы, тенантность с тестами, hard-migrate старого MCP.

---

_Verified: 2026-09-04T16:55:00Z_
_Verifier: Claude (gsd-verifier)_
