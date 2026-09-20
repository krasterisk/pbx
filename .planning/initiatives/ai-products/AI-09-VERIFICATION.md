# AI-09 VERIFICATION

PLAN SHA-256 `B724C5ADA940E7B884043302D4F93A2B5C225C1500931FCAF656DBA23B0EC571`.

| Task | Evidence | Gate |
|---|---|---|
| TOOL1 | Additive `0018-ai-tools.sql`; business connections + revisions | Secret-once / draft revision |
| TOOL2 | `tool-gateway.ts` deny mutate unless sandbox/approved | Browser preview remains simulated |
| TOOL3 | Robot tool bindings UNIQUE(version, tool_revision) | Phone robot is not an admin principal |
| TOOL4 | Knowledge source rejects URLs/active content | Lexical fallback, not semantic quality |
| TOOL5 | Hub `/ai-robots/tools` and `/ai-robots/knowledge`; ACL retrieve | Analytics composition does not ship tool/knowledge HTTP |
| TOOL6 | Not executed | Live MCP / recall@5 / dedicated vector index **not** claimed |

Local units: `tool-gateway`, `knowledge-engine`. Live SQL bindings/ACL: [REMOTE-MATRIX](evidence/rep-rt-tool/REMOTE-MATRIX.md). Dual-DB contracts: [contracts-0018](evidence/contracts-0018/REMOTE-MATRIX.md) MySQL **16/16** + PG **16/16**. Product runtime `not-installed`.
