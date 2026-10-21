# AI-09 SUMMARY

Business tools/knowledge contracts, fake HTTP MCP, and a **portable vector index** that reuses the voice-robot nomic embedder.

## Done
- `0018-ai-tools.sql`: connections, tool revisions, robot bindings, KB bases/documents/chunks/releases/ACL.
- Tool gateway denies mutate without approved/sandbox policy. Browser default remains simulated. Product `liveMcp: false`.
- Knowledge source rejects active content/URLs; lexical fallback retrieval is ACL-aware.
- Shared embedder: `modules/embeddings/nomic-embed.ts` (`nomic-ai/nomic-embed-text-v1.5`, dim 256). `SemanticRouterService` loads the same singleton. Analytics does not import `voice-robots/`.
- Portable CI index `hashed_bow_256` in the same 256-dim space; TOOL6 vector recall@5 ≥ 0.85. Lexical live recall@5 **1.00** on ipbx.
- Hub tools and knowledge pages.
- Evidence: [int-rt-tool6](evidence/int-rt-tool6/REMOTE-MATRIX.md), [emulators](evidence/emulators/REMOTE-MATRIX.md).

## Not done
- Citation groundedness LLM eval, real MCP/CRM vendor adapters, production side effects.
- Live SaaS `BillingBalanceService.charge` (emulated wallet is separate).
