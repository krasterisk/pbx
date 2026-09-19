# C4 — open-source / composition tree

Date: 2026-09-19. Local isolated TypeScript graphs, no production DB, no local Docker.

`harness/database/check-analytics-source-boundary.cjs` copies the compile graph into a temporary workspace (`.analytics-source-gate-*`, `.community-source-gate-*`) and builds it there. User sources are not deleted.

| Product | Backend files in graph | Forbidden sources | Result |
|---|---|---|---|
| analytics-api | 51 | PBX (`ari`, `ami`, `autodial`, `voice-robots`, `routes`, `app.module`, …) | pass — [analytics-source-boundary.log](analytics-source-boundary.log) |
| robot-api | 51 | same PBX set | pass — [robot-source-boundary.log](robot-source-boundary.log) |
| community-pbx | 636 | `ai-agents`, `commercial-ai.composition.ts`, `app.module.ts` | pass — [community-source-boundary.log](community-source-boundary.log) |

This is the documented OSS/community allowlist gate. License files were not rewritten. Frontend standalone Vite configs remain the product shells; they do not import AppRouter, autodial, callcenter, or scenario robots.
