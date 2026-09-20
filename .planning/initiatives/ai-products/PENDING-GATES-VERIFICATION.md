# Pending gates verification — 2026-09-20

## Passed

- Host unixODBC drivers + Asterisk ODBC modules `Running` (probe log).
- `npm run test:db:pending-gates` **3/3** (`i4Evidence` clears `native_pbx_gated` for UDP draft; TLS still unsupported).
- Live Adaptive DSN not overwritten.
- Lint **0 errors**; backend **318/318** suites after D-17 + charge-spec fixes.
- Frontend targeted AI pages **12/12** (18 tests). Conscious pilot flip helper + health wiring.

## Blocked (named)

| Gate | Blocker |
|---|---|
| MET5 | No dual-human 30-call holdout corpus |
| Local-AI STT | No GPU / ollama on ipbx |
| TLS/SRTP/NAT | No PJSIP TLS transport (UDP+WSS only) |
| liveMcp=true | Only fake MCP TOOL6 evidence |
| Full frontend suite | Hangs at vitest `RUN` (baseline) |
| Commercial launch | Not declared; default `productRuntime: not-installed` |

## Product runtime

Default health: `not-installed`. Opt-in: `AI_PRODUCT_RUNTIME_PILOT=1` + `AI_SCHEMA_READY=1` + `AI_WORKERS_CONFIGURED=1` → `installed` / `pilot: true`. See [PRODUCT-RUNTIME-FLIP](PRODUCT-RUNTIME-FLIP.md).
