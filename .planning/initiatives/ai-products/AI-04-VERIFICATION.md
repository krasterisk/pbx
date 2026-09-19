# AI-04 VERIFICATION

PLAN SHA-256 `5FF4CC1BA401713E83C30D5D2D5E1AEB15A38A0F1C2010EF069943F70533DD2A`.

| Task | Evidence | Gate |
|---|---|---|
| AN1 | `speech-analytics/an-analytics.spec.ts` publish/stale draft; live SQL 0011 MySQL **3/3** PG **3/3** | Dual-engine uniqueness |
| AN2 | ingest-engine + public/JWT controllers; `admit(..., transaction)` | Same domain service; 202 only after commit |
| AN3 | pipeline + 30 synthetic eval cases | Silence unscorable; fabricated evidence rejected |
| AN4 | `webhook-security.spec.ts` + SQL 0012 HTTPS CHECK | HMAC + SSRF |
| AN5 | `SpeechAnalyticsProjectsPage.test.tsx` + Hub routes | Optimistic intake Switch |
| AN6 | `run-an-analytics.cjs` MySQL+PG analytics-api profile | Technical pilot. Commercial RU holdout not run |

Live matrix: [REMOTE-MATRIX](evidence/cap-an/REMOTE-MATRIX.md). Local lint 0 errors; backend 297/3075; frontend 254/1405. Health `productRuntime` stays `not-installed` (not a launch).
