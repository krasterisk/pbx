# AI-03 VERIFICATION

PLAN SHA-256 `B0FADF33A409EB507B896E2622EB9D4245C7CBCC1FA2073AE70D4842BF5BA534`.

| Task | Evidence | Gate |
|---|---|---|
| CAP1 | Unit `recording-capture/cap1.spec.ts`; live SQL `run-cap1-capture.cjs` MySQL **2/2** and PostgreSQL **2/2** | SQL uniqueness / foreign asset. No PBX required |
| CAP2 | `route-recording.util.spec.ts`, `routes.service.spec.ts` durable branch, hangup golden, generated lab on test ipbx | Flag default OFF. Isolated `[krasterisk-ai-generated]` MixMonitor applied; customer routes not rewritten |
| CAP3 | spool unit tests + `recording-node.ts`; robot composition includes `recording-capture.module.js`, analytics does not | No AppModule import |
| CAP4 | privacy deny + robot adapter | Analytics auto-start not enabled |
| CAP5 | [REMOTE-MATRIX](evidence/cap-an/REMOTE-MATRIX.md), generated apply [mix-db03-charge](evidence/mix-db03-charge/REMOTE-MATRIX.md) | Test Asterisk MixMonitor executed. Live Adaptive ODBC DSN not replaced |

Local: lint 0 errors; backend 297 suites / 3075 passed (11 skipped); frontend 254 files / 1405 passed; analytics composition 164 artifacts; robot composition 116 artifacts.

Rollback: leave `DURABLE_CAPTURE` unset/0. Do not delete unacked spool objects.
