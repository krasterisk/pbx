---
phase: "15"
slug: "universal-pbx-ai-agent"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-09-05"
---

# Phase 15 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> State B (no prior SECURITY.md). Register authored at plan time. ASVS L1.
> Injection seams (T-15-05 / T-15-09 / T-15-36) were implemented during `/gsd-secure-phase 15`.

**Verdict:** SECURED — 114/115 closed, `threats_open: 0` (T-15-14 open below `block_on: high`)

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| JWT operator → MCP `/api/mcp` and agent loop | Tenant and author come from the token only | tool args, thread id, role |
| Model provider → agent loop | Tool-call arguments are untrusted | names, JSON args, streamed text |
| Tool results / skill bodies / snapshot → model context | Untrusted data at the prompt-assembly seam | CDR rows, entity names, skill markdown |
| Tenant DB → `buildSystemPrompt` / adapters | Entity labels can carry injection text | display names, summaries |
| Agent loop → `cc_ai_audit_log` / proposals | Writes must not precede a pending card | apply payload, audit status |
| Browser SSE → operator | Streamed text is display-only | tokens, tool progress, proposal view |
| Super-admin → usage / providers | Tenant must not see spend or provider keys | encrypted keys, aggregates |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-15-01 | Denial of Service | `PbxAgentLlmClient.chat` | high | mitigate | Abort signal, request timeout, explicit `max_tokens` — `pbx-agent-llm.client.ts` | closed |
| T-15-02 | Tampering | `McpToolsService.sanitizeArgs` | critical | mitigate | `TENANT_ARG_KEYS` stripped; schema invariant in spec | closed |
| T-15-03 | Elevation of Privilege | tool handlers | critical | mitigate | Handler `(args, uid)`; per-tool `it.each` | closed |
| T-15-04 | Tampering | destructive confirm flag | critical | mitigate | Confirm removed from schema; destructive tools propose | closed |
| T-15-05 | Tampering | system prompt assembly | high | mitigate | Snapshot / knowledge / catalog wrapped with `wrapUntrustedData`; fences named in `behaviouralRules()` — `pbx-context-builder.service.ts`, `prompt-injection.util.ts` | closed |
| T-15-06 | Denial of Service | lazy registry build | low | accept | `registerAll()` on bootstrap; uid-independent registry | closed |
| T-15-07 | Information Disclosure | proposal view | high | mitigate | `apply_payload` server-side; `toProposalView` omits it | closed |
| T-15-08 | Information Disclosure | thread reads | critical | mitigate | `vpbx_user_uid` + `user_uid` on every where; no `findByPk` | closed |
| T-15-09 | Tampering | `read_skill` body | high | mitigate | Truncate then `wrapUntrustedData('skill:'+name)` — `agent-skill-registry.service.ts` | closed |
| T-15-10 | Tampering | route precedence | critical | mitigate | `route-precedence.util.ts` + refuse in `pbx-agent-diff.service.ts` | closed |
| T-15-11 | Information Disclosure | provider endpoint | medium | accept | Admin-only D-07; resolver rejects `ws`/`wss`; host allowlist not added | closed |
| T-15-12 | Denial of Service | prompt size | medium | mitigate | Snapshot truncate + catalog descriptions + `PROMPT_TOKEN_CEILING` warn | closed |
| T-15-13 | Tampering | mutating tools | critical | mitigate | `callTool` → `createProposal` for `proposes`; write only in apply | closed |
| T-15-14 | Information Disclosure | persisted personal data | medium | transfer | Retention/purge of thread messages not implemented | open — below high threshold (non-blocking) |
| T-15-15 | Denial of Service | skill body size | medium | mitigate | `SKILL_BODY_MAX_CHARS = 8000` + `[truncated]` | closed |
| T-15-16 | Tampering | missing skills | medium | mitigate | `nest-cli.json` `skills/**/*.md`; catalog `length > 0` | closed |
| T-15-17 | Tampering | thread schema migrate | low | mitigate | `ifNotExists` + guarded index/column | closed |
| T-15-18 | Information Disclosure | provider key | high | mitigate | `decryptSecret` per request; API returns `encrypted_api_key: ''` | closed |
| T-15-19 | Elevation of Privilege | apply RBAC | critical | mitigate | `canMutate` / `READONLY` → denied + audit, no write | closed |
| T-15-20 | Repudiation | apply audit | high | mitigate | `writeApplyAudit` before the response (ok/error/denied) | closed |
| T-15-21 | Tampering | partial apply after switch failure | high | accept | Failure keeps proposal `pending` + `switch_failed` | closed |
| T-15-22 | Tampering | apply status | medium | mitigate | Apply only `status: 'pending'` in scoped where | closed |
| T-15-23 | Tampering | FAB trigger | medium | mitigate | FAB removed; spec asserts former floating trigger absent | closed |
| T-15-24 | Denial of Service | shortcut listener | low | mitigate | add/remove listener in one effect | closed |
| T-15-25 | Information Disclosure | tenant model selector | medium | mitigate | No model selector in the tenant panel | closed |
| T-15-26 | Elevation of Privilege | forged tenant key | critical | mitigate | uid is a parameter; forged-key suite in `legacy-tool-migration.spec.ts` | closed |
| T-15-27 | Tampering | handwritten tools | high | mitigate | Handwritten regs deleted; no-duplicate assertion | closed |
| T-15-28 | Tampering | legacy inventory | high | mitigate | `LEGACY_TOOL_INVENTORY` per-name; fail if a name is missing | closed |
| T-15-29 | Denial of Service | CDR search | medium | mitigate | `CDR_SEARCH_MAX_LIMIT` clamp | closed |
| T-15-30 | Spoofing | thread identity | critical | mitigate | `rejectBodyIdentity`; tenant/author/role from JWT | closed |
| T-15-31 | Tampering | tool entry | critical | mitigate | Single entry `callTool`; webhook controller deleted | closed |
| T-15-32 | Denial of Service | agent steps | high | mitigate | `maxSteps` before model call; abort before each dispatch | closed |
| T-15-33 | Denial of Service | SSE idle | medium | mitigate | `SseStreamSession` + heartbeat | closed |
| T-15-34 | Tampering | confirm-in-schema | critical | mitigate | Confirm not in schema; mutation only via proposal | closed |
| T-15-35 | Tampering | deleted chat proxy | high | mitigate | `ai-chat.service.ts` absent; `AIPBX_*` banned in spec | closed |
| T-15-36 | Tampering | instructions in tool results | high | mitigate | `toModelToolContent()` fences every tool-role message to the model; SSE/persist stay raw — `pbx-agent-loop.service.ts` | closed |
| T-15-37 | Information Disclosure | endpoint passwords | critical | mitigate | Password absent from proposal/tool result | closed |
| T-15-38 | Denial of Service | bulk create | high | mitigate | `BULK_CREATE_CEILING = 50`, refuse at tool time | closed |
| T-15-39 | Elevation of Privilege | per-tool RBAC | critical | mitigate | Role pre-check on apply + READONLY fixtures | closed |
| T-15-40 | Information Disclosure | cross-tenant resolve | critical | mitigate | Resolve inside tenant; enumerated cross-tenant suite | closed |
| T-15-41 | Tampering | delete references | high | mitigate | Delete names `referencedRoutes`; re-check at confirm | closed |
| T-15-42 | Tampering | update tools | critical | mitigate | Update tools `proposes: true` | closed |
| T-15-43 | Tampering | IVR digit / overflow | high | mitigate | Validated against tenant entities | closed |
| T-15-44 | Information Disclosure | name vs tenant | critical | mitigate | Name and tenant separate; cross-tenant fixtures | closed |
| T-15-45 | Elevation of Privilege | records RBAC | critical | mitigate | Per-tool role fixtures; records untouched | closed |
| T-15-46 | Tampering | delete summary | high | mitigate | Summary lists feeding routes + menus | closed |
| T-15-47 | Tampering | raw dialplan | high | mitigate | Typed action contract; raw `app`/`appdata` refused | closed |
| T-15-48 | Tampering | precedence on apply | critical | mitigate | Precedence on proposal and apply | closed |
| T-15-49 | Tampering | route apply path | critical | mitigate | Confirm → `routeApplyService.applyContext` only | closed |
| T-15-50 | Tampering | `apply_dialplan` | high | mitigate | Name absent from the registry | closed |
| T-15-51 | Tampering | emergency pattern | critical | mitigate | `isEmergencyPattern` always specific | closed |
| T-15-52 | Tampering | reload failure | high | mitigate | Reload fail → pending + error, not applied | closed |
| T-15-53 | Information Disclosure | thread list | critical | mitigate | Reads scoped tenant+author; client does not send tenant | closed |
| T-15-54 | Tampering | thread delete | medium | mitigate | Delete confirm; keep conversation is the safe action | closed |
| T-15-55 | Tampering | client slice | medium | mitigate | Committed history on server; store is in-flight | closed |
| T-15-56 | Information Disclosure | refs | critical | mitigate | Refs in tenant scope; cross-tenant fixtures | closed |
| T-15-57 | Elevation of Privilege | group/MOH writes | critical | mitigate | READONLY denied + untouched | closed |
| T-15-58 | Tampering | membership summary | medium | mitigate | Added/removed named explicitly | closed |
| T-15-59 | Information Disclosure | MOH files | medium | mitigate | Metadata only, no bytes/paths | closed |
| T-15-60 | Tampering | registry collision | high | mitigate | Collision assertion in both specs | closed |
| T-15-61 | Tampering | confirm payload | critical | mitigate | Confirm sends only `proposalId` | closed |
| T-15-62 | Tampering | double apply UI | medium | mitigate | Buttons disabled in-flight; server `not_pending` | closed |
| T-15-63 | Tampering | failed apply retry | high | mitigate | Failed apply stays pending + error + retry | closed |
| T-15-64 | Tampering | summary markup | high | mitigate | Summary as `<Text>`, not markup | closed |
| T-15-65 | Tampering | expired proposal | medium | mitigate | Expired → «ask again», not retry | closed |
| T-15-66 | Spoofing | MCP auth | critical | mitigate | `JwtAuthGuard` only; service-token header path removed | closed |
| T-15-67 | Tampering | webhook controller | critical | mitigate | `ai-webhook.controller.ts` absent | closed |
| T-15-68 | Elevation of Privilege | session tenant | high | mitigate | Session bound to tenant; cross-tenant resume rejected | closed |
| T-15-69 | Tampering | private regs | high | mitigate | No `private reg(`; registry = adapter declarations | closed |
| T-15-70 | Tampering | knowledge-base service | medium | mitigate | `knowledge-base.service.ts` absent | closed |
| T-15-71 | Information Disclosure | key secret | high | mitigate | `assertProviderKeySecret()` fail-fast outside development | closed |
| T-15-72 | Repudiation | split audit locations | low | accept | Pre-migration rows stay in `action_logs`; new rows in `cc_ai_audit_log` | closed |
| T-15-73 | Information Disclosure | portal user fields | critical | mitigate | `PORTAL_USER_FIELDS` allow list; secrets asserted absent | closed |
| T-15-74 | Information Disclosure | users tenant | critical | mitigate | Tenant param + per-batch + enumerated suite | closed |
| T-15-75 | Tampering | users domain | high | mitigate | Users domain is read-only; no mutating tool | closed |
| T-15-76 | Tampering | timezone | medium | mitigate | Timezone = tenant setting, not server zone | closed |
| T-15-77 | Information Disclosure | settings secrets | critical | mitigate | Allow lists; secrets = presence only | closed |
| T-15-78 | Information Disclosure | platform settings | critical | mitigate | Narrow projection | closed |
| T-15-79 | Information Disclosure | message bodies | high | mitigate | Bodies excluded / truncated preview | closed |
| T-15-80 | Tampering | messaging send | high | mitigate | No send tool in messaging adapters | closed |
| T-15-81 | Information Disclosure | messaging tenant | critical | mitigate | Tenant param + cross-tenant assertions | closed |
| T-15-82 | Tampering | streamed text render | high | mitigate | Streamed text as Text nodes; raw payloads not rendered | closed |
| T-15-83 | Denial of Service | stop / abort | high | mitigate | `AbortController`; events after stop ignored; abort on close | closed |
| T-15-84 | Tampering | stream outcomes | medium | mitigate | Stop / ceiling / failed are distinct outcomes | closed |
| T-15-85 | Tampering | progress copy | low | mitigate | Localized progress map + fallback | closed |
| T-15-86 | Information Disclosure | speech engines | critical | mitigate | Engine allow list; credentials absent | closed |
| T-15-87 | Information Disclosure | speech tenant | critical | mitigate | Tenant param + per-tool suite | closed |
| T-15-88 | Tampering | synthesize/transcribe | high | mitigate | No synthesize/transcribe tools | closed |
| T-15-89 | Tampering | dangling engine | medium | mitigate | Dangling engine → `missing: true` | closed |
| T-15-90 | Tampering | operations constants | high | mitigate | Shared `OPERATIONS_*` in four adapters | closed |
| T-15-91 | Information Disclosure | operations tenant | critical | mitigate | Tenant param + suite | closed |
| T-15-92 | Information Disclosure | prompts | medium | mitigate | Prompts: metadata only | closed |
| T-15-93 | Tampering | operations writes | high | mitigate | No mutating tools in operations adapters | closed |
| T-15-94 | Denial of Service | operations preview | medium | mitigate | Clamp + preview on a large fixture | closed |
| T-15-95 | Tampering | diagnostic commands | critical | mitigate | `DIAGNOSTIC_READ_COMMANDS` allow list; unknown refused | closed |
| T-15-96 | Information Disclosure | live channels | critical | mitigate | Live channels filtered by tenant contexts | closed |
| T-15-97 | Elevation of Privilege | dialplan show | critical | mitigate | Context ownership before `dialplan show` | closed |
| T-15-98 | Denial of Service | diagnostics caps | medium | mitigate | Channel/event caps + truncation reported | closed |
| T-15-99 | Tampering | diagnostics skill | medium | mitigate | Evidence order; absent = absent | closed |
| T-15-100 | Tampering | eval harness | high | mitigate | Harness fixtures only the LLM client | closed |
| T-15-101 | Tampering | eval writes | critical | mitigate | Mutating + `assertNoWrite` | closed |
| T-15-102 | Elevation of Privilege | eval forged uid | critical | mitigate | Forged uid scenario; peer tenant unchanged | closed |
| T-15-103 | Tampering | eval network | medium | mitigate | Suite must not reach the network | closed |
| T-15-104 | Tampering | empty eval reason | high | mitigate | Empty reason → fail | closed |
| T-15-105 | Tampering | tool/skill map | medium | mitigate | Tool domain must resolve to a skill | closed |
| T-15-106 | Tampering | skill frontmatter | medium | mitigate | Frontmatter parse per file, file named | closed |
| T-15-107 | Tampering | skill inventory | high | mitigate | Filesystem listing vs registry both directions | closed |
| T-15-108 | Elevation of Privilege | admin usage | high | mitigate | `JwtAuthGuard` + `SuperAdminGuard`; tenant reject | closed |
| T-15-109 | Information Disclosure | spend UI | medium | mitigate | Pricing/spend admin-only; tenant selector removed | closed |
| T-15-110 | Repudiation | silent write interval | critical | mitigate | `@Interval('agent-silent-write')` logs tenant/tool/row | closed |
| T-15-111 | Tampering | spend unavailable | medium | mitigate | Spend `unavailable` ≠ zero | closed |
| T-15-112 | Information Disclosure | usage aggregation | medium | mitigate | Conversation rows only; voice CDR not read | closed |
| T-15-113 | Information Disclosure | proposal serialization | high | mitigate | `AgentProposalView` omits payload | closed |
| T-15-114 | Tampering | live-ops pause tools | medium | accept | `LIVE_OPS_TOOLS` = pause/unpause only | closed |
| T-15-SC | Tampering | package installs | low | accept | No packages installed this phase (one accepted risk) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `block_on: high` count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

`T-15-SC` is declared in every plan; it is one accepted risk.

---

## Focus checks (injection seams)

| Check | Threat | Evidence | Result |
|-------|--------|----------|--------|
| Untrusted snapshot / knowledge / catalog fenced | T-15-05 | `wrapUntrustedData('pbx_snapshot' \| 'domain_knowledge' \| 'skill_catalog')` — `pbx-context-builder.service.ts` | CLOSED |
| Fence named in behavioural rules | T-15-05 | `behaviouralRules()` cites `<<<UNTRUSTED_DATA>>>` / `<<<END_UNTRUSTED_DATA>>>` | CLOSED |
| Injected entity name cannot break the fence | T-15-05 | `pbx-context-builder.service.spec.ts` — close-fence + `ignore previous` / `system:` | CLOSED |
| `read_skill` body hardened | T-15-09 | Truncate then wrap `skill:{name}` — `agent-skill-registry.service.ts` | CLOSED |
| Fake system override in a skill body | T-15-09 | `agent-skill-registry.service.spec.ts` evil-skill fixture | CLOSED |
| Tool results fenced for the model only | T-15-36 | `toModelToolContent()` on live push and history replay; SSE/persist raw | CLOSED |
| Tool-result injection fixture | T-15-36 | `pbx-agent-loop.service.spec.ts` — model sees fence; stream/persist unchanged | CLOSED |
| Neutralize EN/RU ignore-previous + role tags | T-15-05/09/36 | `prompt-injection.util.ts` + spec | CLOSED |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-15-06 | T-15-06 | Registry is uid-independent; bootstrap `registerAll()` removes the ordering hazard. Residual is a boot-time log only. | phase-15 plans (15-01) | 2026-09-05 |
| AR-15-11 | T-15-11 | Providers are created only by platform administrators (D-07). `resolveChatCompletionsUrl` rejects `ws`/`wss`. A scheme+host allowlist was not added. | phase-15 plans (15-04) | 2026-09-05 |
| AR-15-21 | T-15-21 | Batched switch writes cannot be rolled back. Failure keeps the proposal pending with `switch_failed` so the half state is visible and retryable. | phase-15 plans (15-05) | 2026-09-05 |
| AR-15-72 | T-15-72 | Not a data migration. Pre-migration rows stay in `action_logs`; new agent rows go to `cc_ai_audit_log`. | phase-15 plans (15-15) | 2026-09-05 |
| AR-15-114 | T-15-114 | `cc_force_pause_agent` / `cc_force_unpause_agent` change live agent state via `callTool` and are not drafts. Scope is those two names only. | phase-15 plans (15-05) | 2026-09-05 |
| AR-15-SC | T-15-SC | No npm/pip/cargo packages added for this phase. Frontmatter is hand-parsed; the LLM client reuses the in-repo HTTP pattern. | phase-15 plans (all) | 2026-09-05 |

*Accepted risks do not resurface in future audit runs.*

T-15-14 (thread retention/purge) is **not** accepted. It stays open below the high threshold and can be closed in a later cleanup without reopening this phase.

---

## Unregistered Flags

None. SUMMARY files have no `## Threat Flags` section.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open (blocking) | Open (below high) | Run By |
|------------|---------------|--------|-----------------|-------------------|--------|
| 2026-09-05 | 115 | 111 | 3 (T-15-05, T-15-09, T-15-36) | 1 (T-15-14) | gsd-security-auditor (first pass) |
| 2026-09-05 | 115 | 114 | 0 | 1 (T-15-14) | gsd-security-auditor (re-audit after injection seams) |

## Security Audit 2026-09-05

| Metric | Count |
|--------|-------|
| Threats found | 115 |
| Closed | 114 |
| Open (blocking ≥ high) | 0 |
| Open (non-blocking) | 1 |
| Unregistered flags | 0 |
| ASVS level | 1 |
| block_on | high |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-05
