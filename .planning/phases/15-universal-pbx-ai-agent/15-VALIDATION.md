---
phase: 15
slug: universal-pbx-ai-agent
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-03
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Источник: `15-RESEARCH.md` § `## Validation Architecture` + `15-AI-SPEC.md` §5 (eval dimensions), §6 (guardrails), §7 (monitoring).
> Task ID уточняются в `/gsd-validate-phase 15`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | Jest `^29.7.0` + ts-jest |
| **Config file (backend)** | `packages/backend/package.json` § `jest` (`rootDir: src`, `testRegex: .*\.spec\.ts$`) |
| **Framework (frontend)** | Vitest `^4.1.4` + `@testing-library/react` + `user-event` + `jsdom` |
| **Config file (frontend)** | `packages/frontend/vite.config.ts`; setup — `src/shared/config/tests/setupTests.ts` |
| **Quick run command** | backend: `npm run test -w @krasterisk/backend -- --testPathPattern="<area>" --no-coverage` · frontend: `npm run test -w @krasterisk/frontend -- <path>` |
| **Full suite command** | `npm run lint && npm run test:backend && npm run test:frontend` |
| **Estimated runtime** | ~15-30 s узкий прогон · полный набор — минуты |
| **Обязательный префикс** | любая задача, меняющая `packages/shared` → сначала `npm run build -w @krasterisk/shared` |
| **Новые пакеты** | **нет** — фаза не устанавливает зависимостей (`15-RESEARCH.md` § Package Legitimacy Audit: пустой install set) |
| **E2E / live Asterisk** | **не требуется** — цикл прогоняется fixture-реплеем (15-22), AMI мокается |
| **Live LLM** | **не требуется и запрещено в тестах** — модельный клиент подменяется fixture-клиентом, исходящих запросов нет |

**Расширение узкого прогона.** `npm run test:ai` сегодня матчит только `modules/ai-agents` и не покрывает ни `ai-platform`, ни `ai-chat`, ни `mcp`. Паттерн расширяется в 15-15 (task 3); до этого пользоваться явным `--testPathPattern`.

---

## Sampling Rate

- **After every task commit:** узкий прогон по `--testPathPattern` затронутого файла / путь vitest (< 30 c)
- **After every plan wave:**
  - backend: `npm run test -w @krasterisk/backend -- --testPathPattern="(pbx-agent|mcp-tools|mcp\.controller|ai\.adapter|ai-adapter-completeness|legacy-tool-migration|read-adapters|diagnostics|route-chain-draft|route-precedence|agent-usage)" --no-coverage`
  - frontend: `npm run test -w @krasterisk/frontend -- src/features/ai-chat src/widgets/AiChatWidget src/widgets/ModuleShell src/features/cloud-admin`
- **Before `/gsd-secure-phase 15`:** `npm run lint && npm run test:backend && npm run test:frontend` — всё зелёное
- **Before `/gsd-verify-work 15`:** тот же полный гейт повторно, плюс eval-набор (15-22) и completeness-тест (15-23)
- **Max feedback latency:** 30 c

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-T1 | 15-01 | 1 | D-22 tenant keys stripped from tool args | T-15-02 | `sanitizeArgs` removes every tenant key | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="mcp-tools" --no-coverage` | ✅ extend | ⬜ pending |
| 15-01-T2 | 15-01 | 1 | D-18/D-19 model-visible confirm flag removed | T-15-04 | Destructive dispatch refuses until proposals exist | unit | same as above | ✅ extend | ⬜ pending |
| 15-01-T3 | 15-01 | 1 | D-22 per-tool uid-as-parameter invariant; D-16/D-17 `getDomains()` | T-15-03 | Table-driven assertion over whole registry | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="ai-adapter-registry\|mcp-tools" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-02-T1 | 15-02 | 1 | D-10/D-11 skills read from `src/skills`, catalog non-empty | T-15-16 | Path resolver works from `dist` | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="agent-skill-registry" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-02-T2 | 15-02 | 1 | D-10 `read_skill` body on demand, capped | T-15-09, T-15-15 | Bodies are tool results, never prompt text | unit | same as above | ❌ W0 | ⬜ pending |
| 15-02-T3 | 15-02 | 1 | D-11 skills present in production build | T-15-16 | `nest-cli.json` asset declaration | unit | same as above | ❌ W0 | ⬜ pending |
| 15-03-T1 | 15-03 | 1 | D-26 threads/messages persist, tenant+author scoped | T-15-08 | Every where clause carries tenant and author | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="pbx-agent-thread" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-03-T2 | 15-03 | 1 | D-08 token counters on thread rows | T-15-14 | Chat usage not written into voice CDR | unit | same as above | ❌ W0 | ⬜ pending |
| 15-03-T3 | 15-03 | 1 | D-26 idempotent standalone migration | T-15-17 | Create-if-absent, no schema sync | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="pbx-agent-thread" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-04-T1 | 15-04 | 2 | D-06/D-07 provider resolved server-side; abort reaches provider | T-15-01 | Explicit timeout + max tokens; no request after abort | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="pbx-agent-llm\|ai-providers" --no-coverage` | ✅ partial | ⬜ pending |
| 15-04-T2 | 15-04 | 2 | D-10 catalog without bodies; D-13/D-14 language+tone; D-15/D-27 one state snapshot | T-15-05, T-15-12 | Data-vs-instruction rule stated; budgeted snapshot | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="pbx-context-builder" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-04-T3 | 15-04 | 2 | D-06/D-09 structured provider errors; no-tool-support fallback | T-15-18 | Key never logged; abort asserted at client boundary | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="pbx-agent-llm" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-05-T1 | 15-05 | 2 | D-18/D-19/D-20 proposal → confirmed write + one orchestrator reload | T-15-13, T-15-113 | Apply payload never serialized to client | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="pbx-agent-diff" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-05-T2 | 15-05 | 2 | D-21 role parity; audit before response | T-15-19, T-15-20 | Denied status + denied audit row, no write | unit | same as above | ❌ W0 | ⬜ pending |
| 15-05-T3 | 15-05 | 2 | Pitfall 10 precedence + emergency safety | T-15-10 | Catch-all above specific refused pre-apply | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="route-precedence\|pbx-agent-diff" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-06-T1 | 15-06 | 1 | D-23/D-24 topbar trigger, hotkey, FAB removed, Escape + focus trap | T-15-23, T-15-24 | Nothing agent-related in softphone corner | component | `npm run test -w @krasterisk/frontend -- src/widgets/ModuleShell src/widgets/AiChatWidget` | ✅ partial | ⬜ pending |
| 15-06-T2 | 15-06 | 1 | D-25 520px panel, rail slot, no inline geometry, no model select | T-15-25 | Model identity not tenant-facing | component | `npm run test -w @krasterisk/frontend -- src/widgets/AiChatWidget` | ❌ W0 | ⬜ pending |
| 15-06-T3 | 15-06 | 1 | D-14 locale keys (first writer of `en.ts`/`ru.ts`) | — | No hardcoded strings | component | same as above | ❌ W0 | ⬜ pending |
| 15-07-T1 | 15-07 | 2 | D-27 adapter-wins precedence; D-22 contexts isolation | T-15-26, T-15-27 | No duplicate tool names in registry | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="legacy-tool-migration\|mcp-tools" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-07-T2 | 15-07 | 2 | D-12/D-15 CDR summary + search, cap preserved | T-15-29 | Result-count clamp asserted | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="legacy-tool-migration" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-07-T3 | 15-07 | 2 | D-27 eighteen-name inventory baseline | T-15-28 | Fails on duplicate or vanished tool | unit | same as above | ❌ W0 | ⬜ pending |
| 15-08-T1 | 15-08 | 3 | D-06/D-13/D-26 in-process turn, one dispatch path, persisted as produced | T-15-30, T-15-31 | Tenant/author from token only | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="pbx-agent-loop\|agent-sse" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-08-T2 | 15-08 | 3 | D-09 step ceiling, cancel propagation; D-18 proposal event | T-15-32, T-15-34 | No model call past ceiling; abort in two positions | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="pbx-agent-loop" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-08-T3 | 15-08 | 3 | D-06 proxy deleted; D-26 conversation scoped | T-15-35 | Import-absence assertion; env reads removed | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="ai-chat.controller\|pbx-agent-loop" --no-coverage` | ✅ extend | ⬜ pending |
| 15-09-T1 | 15-09 | 3 | D-18/D-22/D-27 subscriber create as proposal; credential relocated | T-15-37 | No secret in summary/result/transcript | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="endpoints-ai.adapter" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-09-T2 | 15-09 | 3 | D-18/D-21 bulk ceiling + delete proposal + role denial | T-15-38, T-15-39 | Batch bounded; denied leaves rows intact | unit | same as above | ❌ W0 | ⬜ pending |
| 15-09-T3 | 15-09 | 3 | D-15/D-18/D-27 trunk create/delete proposals, dependents named | T-15-40, T-15-41 | Cross-tenant covered by enumerated suite | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="trunks-ai.adapter\|legacy-tool-migration" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-10-T1 | 15-10 | 3 | D-18/D-27 IVR update is a mutation; digit targets validated | T-15-42, T-15-43 | Legacy non-destructive flag rejected | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="ivrs-ai.adapter" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-10-T2 | 15-10 | 3 | D-15/D-18/D-27 queue CRUD proposals, overflow validated | T-15-44, T-15-46 | Queue name + tenant passed separately | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="queues-ai.adapter" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-10-T3 | 15-10 | 3 | D-21/D-22 per-tool role + cross-tenant for six tools | T-15-45 | Adapter-served, no handwritten twin | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="ivrs-ai.adapter\|queues-ai.adapter\|legacy-tool-migration" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-11-T1 | 15-11 | 3 | D-15/D-18/D-20 typed chain draft; one orchestrator call | T-15-47, T-15-49 | Zero direct calls to low-level applier | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="route-chain-draft\|routes-ai.adapter" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-11-T2 | 15-11 | 3 | D-19/D-20 standalone apply retired; precedence + impact note | T-15-48, T-15-50, T-15-51, T-15-52 | Failed reload leaves proposal pending | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="routes-ai.adapter" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-11-T3 | 15-11 | 3 | D-12 routes skill; Phase 14 tools referenced conditionally | — | No files from unexecuted Phase 14 modules | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="agent-skill-registry" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-12-T1 | 15-12 | 2 | D-26 conversation list/detail, restored after reload | T-15-53 | Foreign conversation not found | component | `npm run test -w @krasterisk/frontend -- src/features/ai-chat src/widgets/AiChatWidget` | ❌ W0 | ⬜ pending |
| 15-12-T2 | 15-12 | 2 | D-26 four rail states + guarded delete | T-15-54, T-15-55 | Client store holds in-flight state only | component | `npm run test -w @krasterisk/frontend -- src/features/ai-chat` | ❌ W0 | ⬜ pending |
| 15-12-T3 | 15-12 | 2 | D-14 rail locale keys (second writer of locales) | — | No hardcoded strings | component | same as above | ❌ W0 | ⬜ pending |
| 15-13-T1 | 15-13 | 3 | D-15/D-18 call-group membership as proposal, members validated | T-15-56, T-15-58 | Added/removed sets stated explicitly | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="call-groups-ai.adapter" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-13-T2 | 15-13 | 3 | D-15/D-18 hold-music read + assign, class ownership validated | T-15-59 | Metadata only, no audio or paths | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="moh-ai.adapter" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-13-T3 | 15-13 | 3 | D-21/D-22 per-tool role + cross-tenant + no name collision | T-15-57, T-15-60 | New names do not shadow existing tools | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="call-groups-ai.adapter\|moh-ai.adapter\|legacy-tool-migration" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-14-T1 | 15-14 | 3 | D-19 confirm from card with identifier only | T-15-61, T-15-62 | No confirm flag or entity id in request | component | `npm run test -w @krasterisk/frontend -- src/features/ai-chat` | ❌ W0 | ⬜ pending |
| 15-14-T2 | 15-14 | 3 | D-19/D-21 applied/rejected/denied/failed/expired states | T-15-63, T-15-65 | Failed apply stays pending with retry | component | same as above | ❌ W0 | ⬜ pending |
| 15-14-T3 | 15-14 | 3 | D-19 card copy from design contract (third writer of locales) | T-15-64 | Summary rendered as text nodes | component | same as above | ❌ W0 | ⬜ pending |
| 15-15-T0 | 15-15 | 4 | D-28 external service coordination | — | Human decision recorded before the header path breaks | checkpoint | `checkpoint:human-action` — blocking | N/A | ⬜ pending |
| 15-15-T1 | 15-15 | 4 | D-11/D-27 all 18 registrations + both bypass paths deleted | T-15-67, T-15-69, T-15-70 | Registry count equals adapter declarations | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="mcp-tools\|legacy-tool-migration" --no-coverage` | ✅ extend | ⬜ pending |
| 15-15-T2 | 15-15 | 4 | D-28 token-only tenant on `/api/mcp`; header ignored | T-15-66, T-15-68 | Service token + tenant header → 401 | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="mcp.controller\|mcp-tools" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-15-T3 | 15-15 | 4 | D-16/D-27 key-secret fail-fast, widened `test:ai`, corrected architecture doc | T-15-71, T-15-72 | Startup fails loudly outside development | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="app.module\|mcp-tools" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-16-T1 | 15-16 | 4 | D-12/D-15 schedule read + evaluation in tenant zone | T-15-76 | No mutating tool declared | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="read-adapters-schedule-identity" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-16-T2 | 15-16 | 4 | D-12/D-15 number read with resolved destination | T-15-74 | Unrouted reported, not omitted | unit | same as above | ❌ W0 | ⬜ pending |
| 15-16-T3 | 15-16 | 4 | D-15/D-22 portal users, allow-listed, read-only | T-15-73, T-15-75 | Secret absence asserted on declared shape | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="read-adapters-schedule-identity\|legacy-tool-migration" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-17-T1 | 15-17 | 4 | D-15 tenant settings read, secrets as presence only | T-15-77 | Allow list, no mutating tool | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="read-adapters-settings-messaging" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-17-T2 | 15-17 | 4 | D-15/D-22 platform settings as default-excluding projection | T-15-78 | New setting invisible by default | unit | same as above | ❌ W0 | ⬜ pending |
| 15-17-T3 | 15-17 | 4 | D-12/D-15 messaging read, no send, bodies bounded | T-15-79, T-15-80, T-15-81 | No send tool declared | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="read-adapters-settings-messaging\|legacy-tool-migration" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-18-T1 | 15-18 | 4 | D-09/D-13 per-step progress in human language, incremental text | T-15-82, T-15-85 | Raw tool payloads never rendered | component | `npm run test -w @krasterisk/frontend -- src/features/ai-chat` | ❌ W0 | ⬜ pending |
| 15-18-T2 | 15-18 | 4 | D-09 stop / ceiling / failure / disconnect as four outcomes | T-15-83, T-15-84 | Nothing renders after a stop; abort on close | component | `npm run test -w @krasterisk/frontend -- src/features/ai-chat src/widgets/AiChatWidget` | ❌ W0 | ⬜ pending |
| 15-18-T3 | 15-18 | 4 | Design contract stick-to-bottom; mid-stream card (fourth writer of locales) | — | Following derived from scroll position | component | `npm run test -w @krasterisk/frontend -- src/widgets/AiChatWidget src/features/ai-chat` | ❌ W0 | ⬜ pending |
| 15-19-T1 | 15-19 | 5 | D-12/D-22 channel read via command allow list + derived tenant filter | T-15-95, T-15-96 | No command string accepted from a caller | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="diagnostics.service" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-19-T2 | 15-19 | 5 | D-12/D-13 events + compiled dialplan, ordered and bounded | T-15-97, T-15-98 | Foreign context refused | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="diagnostics" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-19-T3 | 15-19 | 5 | D-12/D-13 diagnostics skill prescribes evidence order | T-15-99 | Absent evidence reported as absent | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="agent-skill-registry" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-20-T1 | 15-20 | 3 | D-12/D-15 robot read resolves engine state | T-15-89 | Missing dependency reported | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="read-adapters-speech" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-20-T2 | 15-20 | 3 | D-15 engine reads without credentials, no billable action | T-15-86, T-15-88 | Allow list asserted on declared shape | unit | same as above | ❌ W0 | ⬜ pending |
| 15-20-T3 | 15-20 | 3 | D-12/D-22 shared engine skill accepted by coverage rule | T-15-87 | Per-tool cross-tenant assertions | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="read-adapters-speech\|agent-skill-registry\|legacy-tool-migration" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-21-T1 | 15-21 | 3 | D-12/D-15 notifications read, count-clamped, body-truncated | T-15-90, T-15-94 | No mutating tool declared | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="read-adapters-operations" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-21-T2 | 15-21 | 3 | D-15 prompts/requests/claims read, media-free, bounded | T-15-92, T-15-93 | Prompt references named, no audio | unit | same as above | ❌ W0 | ⬜ pending |
| 15-21-T3 | 15-21 | 3 | D-12/D-16 shared operational skill + coverage handoff | T-15-91 | Per-tool cross-tenant assertions | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="read-adapters-operations\|agent-skill-registry\|legacy-tool-migration" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-22-T1 | 15-22 | 5 | D-06 fixture replay through the real loop, tool sequence asserted | T-15-100, T-15-103 | Only the model client is substituted | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="pbx-agent-eval" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-22-T2 | 15-22 | 5 | D-09/D-18/D-22 ten scenarios across the dataset buckets | T-15-101, T-15-102 | Proposal + no-write asserted together | unit | same as above | ❌ W0 | ⬜ pending |
| 15-22-T3 | 15-22 | 5 | AI-SPEC §5 named script + remaining ten specified | — | Adversarial pair reserved for secure phase | unit | same as above | ❌ W0 | ⬜ pending |
| 15-23-T1 | 15-23 | 6 | D-17 unclassified module / missing adapter / unreasoned exclusion → red | T-15-104, T-15-107 | Directory listing read from filesystem | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="ai-adapter-completeness" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-23-T2 | 15-23 | 6 | D-16/D-17 skill presence, shared-skill declarations, frontmatter validity | T-15-105, T-15-106 | Malformed skill is a build break | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="ai-adapter-completeness\|agent-skill-registry" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-23-T3 | 15-23 | 6 | D-16 convention written as architecture statement + developer skill | — | Normative doc + explanatory skill, no duplication | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="agent-skill-registry\|ai-adapter-completeness" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-24-T1 | 15-24 | 5 | D-07/D-08 per-tenant tokens and spend, administrator-only | T-15-108, T-15-109, T-15-112 | Tenant role forbidden on every endpoint | unit | `npm run test -w @krasterisk/backend -- --testPathPattern="agent-usage" --no-coverage` | ❌ W0 | ⬜ pending |
| 15-24-T2 | 15-24 | 5 | AI-SPEC §7 funnel, error rate, silent-write detector | T-15-110 | Mutation without proposal trail logged at error | unit | same as above | ❌ W0 | ⬜ pending |
| 15-24-T3 | 15-24 | 5 | D-07/D-08 default model + usage view (fifth writer of locales) | T-15-111 | Unavailable spend distinct from zero | component | `npm run test -w @krasterisk/frontend -- src/features/cloud-admin` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Требование D-22: покрытие «тест на каждый tool»

D-22 требует кросс-тенантного теста **на каждый tool**, а фаза добавляет более сотни. Ручной список строк здесь означал бы гарантированную дыру, поэтому покрытие обеспечивается двумя механизмами:

1. **Глобальный enumerated suite** (`legacy-tool-migration.spec.ts`, 15-07) — перечисляет реестр и применяет к каждому найденному tool одинаковые утверждения: uid из dispatch, подделка в аргументах игнорируется, тенант A не видит данных B. Новый адаптер попадает под тест в момент регистрации, без правки файла.
2. **Локальные per-tool фикстуры** в спеке каждого домена — падают с читаемым сообщением на конкретном хендлере.

Оба обязательны: первый ловит домен, который забыли, второй даёт диагностику. Гейт фазы считает D-22 закрытым только если enumerated suite перечисляет **не меньше** tools, чем `getAllTools()`, и ни один tool не помечен как пропущенный.

---

## Wave 0 Gaps (from RESEARCH § Wave 0 Gaps)

- [ ] `ai-adapter-registry.service.spec.ts` — реестр + `getDomains()` (15-01)
- [ ] `agent-skill-registry.service.spec.ts` — каталог, `read_skill`, резолвер от `dist` (15-02)
- [ ] `pbx-agent-thread.service.spec.ts` — треды/сообщения/счётчики (15-03)
- [ ] `pbx-context-builder.service.spec.ts` — промпт, каталог без тел, язык, снимок состояния (15-04)
- [ ] `pbx-agent-llm.client.spec.ts` — провайдер, стрим, abort (15-04)
- [ ] `pbx-agent-diff.service.spec.ts` + `route-precedence.util.spec.ts` — D-18…D-21 (15-05)
- [ ] `legacy-tool-migration.spec.ts` — enumerated cross-tenant + инвентарь 18 (15-07)
- [ ] `pbx-agent-loop.service.spec.ts` + `agent-sse.util.spec.ts` — цикл, потолок, отмена (15-08)
- [ ] `mcp.controller.spec.ts` — JWT-only тенант, отказ сервисному токену (15-15)
- [ ] Per-domain `*-ai.adapter.spec.ts` для каждого нового адаптера (15-09, 15-10, 15-11, 15-13)
- [ ] Batch-спеки read-only доменов: `read-adapters-schedule-identity`, `read-adapters-settings-messaging`, `read-adapters-speech`, `read-adapters-operations` (15-16, 15-17, 15-20, 15-21)
- [ ] `diagnostics.service.spec.ts` + `diagnostics-ai.adapter.spec.ts` (15-19)
- [ ] `pbx-agent-eval.harness.ts` + `evals/reference-scenarios.json` — 10 сценариев (15-22), 20 к ship
- [ ] `ai-adapter-completeness.spec.ts` + `module-coverage.registry.ts` (15-23)
- [ ] `agent-usage.service.spec.ts` — расход, funnel, silent-write detector (15-24)
- [ ] Фронтенд: `AiChatWidget.test.tsx` (новый), `ThreadList.test.tsx`, `DiffConfirmCard.test.tsx`, `useAgentStream.test.ts`, `AiChatSettingsCard.test.tsx`; расширение `ModuleShell.test.tsx`
- [ ] Расширение `test:ai` паттерна на `ai-platform|ai-chat|mcp` (15-15)
- [ ] Framework install: **не требуется** — Jest и Vitest уже настроены

---

## Ограничения, влияющие на трактовку зелёного

- **Phase 14 не выполнена.** `dialplan_dry_run`, `list_templates`, `apply_template`, `build_from_description` могут отсутствовать в реестре. Ни один тест фазы 15 не имеет права требовать их наличия; скил маршрутов упоминает dry-run условно (15-11 T3). Если Phase 14 выполнена раньше — её два адаптера попадают под enumerated suite и completeness-тест автоматически.
- **Защита от инъекций вне scope.** Тесты фазы проверяют, что тела скилов и результаты tools попадают в контекст **как данные** (отдельная роль сообщения, не системный промпт) — то есть что шов для хардненинга существует. Сами инъекционные сценарии (2 слота в reference-набор) закрывает `/gsd-secure-phase 15`.
- **Внешняя координация.** `15-15-T0` — единственный blocking-human чекпойнт фазы: конфигурация внешнего сервиса лежит не в этом репозитории, и до её решения ломать заголовочный путь нельзя.

---

## Phase Gate Checklist

Before `/gsd-secure-phase 15`:

1. `npm run lint` green
2. `npm run test:backend` green
3. `npm run test:frontend` green
4. `ai-adapter-completeness` green — каждый модуль классифицирован, у covered есть адаптер и скил
5. `legacy-tool-migration` green и strict — 18 legacy-имён адаптерные либо явно retired, ноль рукописных регистраций
6. Enumerated cross-tenant suite перечисляет не меньше tools, чем `getAllTools()` (D-22)
7. `pbx-agent-eval` green — не меньше 10 сценариев
8. `mcp.controller` green — сервисный токен + `X-Vpbx-User-Uid` даёт 401 (D-28)
9. `15-15-T0` чекпойнт закрыт и решение записано в SUMMARY

Before `/gsd-verify-work 15`:

10. Полный гейт повторно зелёный после хардненинга
11. Reference-набор доведён до 20 сценариев, включая 2 adversarial
12. Silent-write detector отработал хотя бы один раз на непустом окне и дал пустой результат
