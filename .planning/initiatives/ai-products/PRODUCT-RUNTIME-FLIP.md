# Product runtime / commercial — conscious flip

Coordinator `codex-direct`, 2026-09-20. Default process health remains **`not-installed`** unless opt-in flags are set. This is **not** a claim that MET5 / local-AI / TLS-SRTP-NAT / liveMcp are closed.

## Opt-in pilot (disposable / demo only)

```bash
export AI_PRODUCT_RUNTIME_PILOT=1
export AI_SCHEMA_READY=1
export AI_WORKERS_CONFIGURED=1
# cloud_wallet stays off unless BOTH installation + tenant flags (COM2)
```

`GET /api/health` then returns `productRuntime: 'installed'`, `usable: true`, `pilot: true` for analytics-api / robot-api.

Without `AI_PRODUCT_RUNTIME_PILOT=1`, health stays `not-installed` / `usable: false`.

Tenant capabilities still require real entitlement via `ProductAccessService.decide` (separate from unauthenticated health).

## Commercial readiness posture

| Claim | Status |
|---|---|
| Standalone analytics LIVE-UAT (11A) | evidence closed |
| Standalone robots LIVE-UAT (11R) | evidence closed; native TLS/MCP open |
| Host ODBC modules running | PASS (pending-gates) |
| Release lint | 0 errors |
| Release backend | green after registry/charge-spec fixes |
| Release frontend | see RELEASE evidence |
| Full commercial launch | **not declared** — open gates remain |

`cloud_wallet` / live tenant debit remain off by default.
