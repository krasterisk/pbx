# AI-06 VERIFICATION

PLAN SHA-256 `1868DDF54A768EBDC01BF84FE7773B7AF3BCCC793FB6B6DEB5FE0A146257873B`.

| Task | Evidence | Gate |
|---|---|---|
| REP1 | Additive `0015-sa-reporting.sql`; FilterSpec/HMAC cursor/CSV neutralize units | Formula/expression injection denied. `=cmd` neutralized |
| REP2 | Dashboard ranking min 20; Hub `/speech-analytics/dashboard` pause Switch | Ranking copy `insufficient_sample`. Optimistic pause undo |
| REP3 | Export/schedule snapshot 50k / bulk 1000 units | Fake receiver only. No production mailbox |
| REP4 | Budget reserve/pause units; JWT `/speech-analytics/budgets` | No wallet debit |
| INT1 | `capture-policy.ts` inherit/off/on; RouteForm analytics field | Missing analytics = inherit. `default_enabled=false`. `route_off` ≠ `privacy_deny` |
| INT2 | `internal-admission.ts` + JWT relations/backfill-preview; live UniqueID relations | Duplicate ready replay. Late CDR enrich. Pause skip. Arbitrary path denied. Uninstalled tenant skip ≠ 0. Snippets require transcript rights |
| INT3 | Isolated `[krasterisk-ai-lab]` plus generated-route `[krasterisk-ai-generated]` MixMonitor + `cdr-custom` on test ipbx | inbound/outbound/IVR/robot/transfer wav+CDR; generated UUID wav 95084 bytes; 0 leftover active channels. `nativeCaptureApply` follows `DURABLE_CAPTURE`. DB-03 writer **closed** in [mix-db03-charge](evidence/mix-db03-charge/REMOTE-MATRIX.md) |

Local INT2 units: `internal-admission.spec.ts`. Live lab: [int-rt-tool6](evidence/int-rt-tool6/REMOTE-MATRIX.md). Prior lint 0 errors; backend 303/3097 baseline; dual-DB contracts MySQL/PG **16/16**. Product runtime `not-installed`.
