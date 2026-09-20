# AI-09 VERIFICATION

PLAN SHA-256 `B724C5ADA940E7B884043302D4F93A2B5C225C1500931FCAF656DBA23B0EC571`.

| Task | Evidence | Gate |
|---|---|---|
| TOOL1 | Additive `0018-ai-tools.sql`; business connections + revisions | Secret-once / draft revision |
| TOOL2 | `tool-gateway.ts` deny mutate unless sandbox/approved | Browser preview remains simulated |
| TOOL3 | Robot tool bindings UNIQUE(version, tool_revision) | Phone robot is not an admin principal |
| TOOL4 | Knowledge source rejects URLs/active content; `vectorRetrieve` + shared nomic helpers | Lexical fallback remains. Portable hashed_bow and nomic singleton reused from robots |
| TOOL5 | Hub `/ai-robots/tools` and `/ai-robots/knowledge`; ACL retrieve | Analytics composition does not ship tool/knowledge HTTP via voice-robots import |
| TOOL6 | Fake HTTP MCP + lexical live recall@5 **1.00**; hashed vector recall@5 ≥ 0.85 | Gates fixed before run. SSRF + phone mutate denied. ONNX nomic optional when model present |

Local units: `mcp-eval`, `knowledge-engine`, `nomic-embed`, `keyword-matcher`. Live MCP: [int-rt-tool6](evidence/int-rt-tool6/REMOTE-MATRIX.md). Vector/emulator: [emulators](evidence/emulators/REMOTE-MATRIX.md). Product runtime `not-installed`.
