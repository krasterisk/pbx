# AI-06 VERIFICATION

PLAN SHA-256 `1868DDF54A768EBDC01BF84FE7773B7AF3BCCC793FB6B6DEB5FE0A146257873B`.

| Task | Evidence | Gate |
|---|---|---|
| REP1 | Additive `0015-sa-reporting.sql`; FilterSpec/HMAC cursor/CSV neutralize units | Formula/expression injection denied. `=cmd` neutralized |
| REP2 | Dashboard ranking min 20; Hub `/speech-analytics/dashboard` pause Switch | Ranking copy `insufficient_sample`. Optimistic pause undo |
| REP3 | Export/schedule snapshot 50k / bulk 1000 units | Fake receiver only. No production mailbox |
| REP4 | Budget reserve/pause units; JWT `/speech-analytics/budgets` | No wallet debit |
| INT1 | `capture-policy.ts` inherit/off/on; RouteForm analytics field | Missing analytics = inherit. `default_enabled=false`. `route_off` ≠ `privacy_deny` |
| INT2–3 | Not executed | Native MixMonitor apply **off**. CDR/КЦ/AutoDial live links **not** claimed |

Local: lint 0 errors; backend targeted reporting/capture + inventory 7/7; frontend targeted 7 files / 22 passed (full vitest hung at `RUN` on Windows, same baseline). Analytics composition 188 artifacts, robot 162 artifacts. Live SQL: [REMOTE-MATRIX](evidence/rep-rt-tool/REMOTE-MATRIX.md) MySQL **4/4** + PG **4/4**. Product runtime `not-installed`.
