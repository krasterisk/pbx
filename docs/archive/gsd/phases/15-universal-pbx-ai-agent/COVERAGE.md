# API Coverage — Phase 15 Universal PBX AI Agent

**Written:** 2026-09-05  
**Surfaces:** OpenAI-compatible chat completions via `PbxAgentLlmClient` (thin HTTP `fetch` / axios)  
**Default:** INTEGRATE. Every OPT-OUT has a one-line reason.  
**Not rows:** First-party Nest `/api/mcp`, agent SSE, JWT, AMI diagnostics, tenant CRUD adapters (in-process, not third-party SDKs). aiPBX and other vendors are **model providers** through `cc_ai_providers`, not tool orchestrators.

No new npm packages. Client reuses `resolveChatCompletionsUrl` + `decryptSecret`.

---

## 1. LLM — OpenAI-compatible `POST /v1/chat/completions`

Canonical shape: [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat). Endpoint comes from an administrator-configured `CcAiProvider` row (D-07). Seed-shaped example: vendor `openai`, `https://api.openai.com/v1/chat/completions`.

| capability | decision | reason |
|---|---|---|
| POST {endpoint} JSON body | INTEGRATE | D-06 thin client; no vendor SDK |
| model from provider.defaults.model | INTEGRATE | Admin-provisioned default; tenants do not pick |
| temperature from defaults (fallback 0.2) | INTEGRATE | Tool-heavy turns stay low-temperature |
| max_tokens explicit cap (fallback 4096) | INTEGRATE | T-15-01; never unbounded |
| messages[] roles system / user / assistant / tool | INTEGRATE | In-process loop + fenced untrusted tool results |
| stream / SSE deltas | INTEGRATE | D-09 incremental text + AbortSignal |
| tools / function calling | INTEGRATE | Native tools when provider advertises them |
| tools-unsupported fallback (catalog in system message) | INTEGRATE | Degraded path logged; tools never silently dropped |
| Read choices[0].message.content | INTEGRATE | Non-stream axios path (summarization) |
| Accumulate streamed tool_calls by index | INTEGRATE | Arguments arrive in fragments |
| Auth bearer → Authorization: Bearer | INTEGRATE | CcAiProvider.auth_type |
| Auth api_key_header → X-API-Key | INTEGRATE | Alternate auth_type |
| Auth none / custom → no key header | INTEGRATE | Provider modes that send no secret |
| AbortSignal on fetch / axios | INTEGRATE | D-09 stop + disconnect |
| Request timeout 60s | INTEGRATE | T-15-01 hang bound |
| Reject ws / wss endpoints | INTEGRATE | resolveChatCompletionsUrl; T-15-11 |
| Treat tool results and skill bodies as untrusted data | INTEGRATE | T-15-05 / T-15-09 / T-15-36 fences |
| response_format / json_schema | OPT-OUT | Agent replies are streamed prose plus tool calls, not a schema card |
| n > 1 completions | OPT-OUT | One completion per loop step |
| logprobs / top_logprobs | OPT-OUT | Not displayed |
| seed | OPT-OUT | Not required for operator-facing turns |
| store | OPT-OUT | Do not persist prompts at the vendor |
| top_p / presence_penalty / frequency_penalty | OPT-OUT | Provider defaults via temperature only |
| Vision / image_url parts | OPT-OUT | Input is operator text and tool JSON |
| Audio input on chat | OPT-OUT | Voice CDR / voicemail stay on existing STT, not this client |
| Web search / hosted tools | OPT-OUT | Tools are in-process MCP adapters, not vendor-hosted |
| Embeddings API | OPT-OUT | No retrieval index this phase |
| Assistants / Responses / Batch APIs | OPT-OUT | Chat completions only |
| Fine-tuning / files / moderation APIs | OPT-OUT | Out of D-06 / D-07 scope |
| Official openai npm SDK | OPT-OUT | T-15-SC; no packages this phase |
| Scheme + host allowlist beyond ws/wss reject | OPT-OUT | T-15-11 accepted: admin-only providers (D-07) |
| MCP callback / service-token tenant header to aiPBX | OPT-OUT | 15-15-T0: aiPBX is an LLM provider, not a tool orchestrator |
