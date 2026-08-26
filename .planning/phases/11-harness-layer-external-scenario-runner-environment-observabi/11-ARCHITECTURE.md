# Phase 11 — Harness Layer Architecture

**Status:** Approved 2026-08-04 — discuss/plan next; no implementation until planned  
**Date:** 2026-08-04  
**Role:** Principal Software Architect

---

## 1. Project facts (as-is)

| Fact | Evidence |
|------|----------|
| Monorepo | `packages/{shared,backend,frontend}`, **npm workspaces** (not pnpm) |
| Backend | NestJS 11, Sequelize, MySQL, Redis/BullMQ, AMI/ARI, Socket.IO, SSE, Swagger |
| Frontend | React FSD, RTK Query, Vite |
| Unit tests | Backend **Jest**; frontend **Vitest** — leave untouched |
| Existing E2E | Top-level `e2e/` Playwright (outside workspaces), operator smoke |
| CI E2E | `.github/workflows/e2e.yml` — GHA MySQL only; no lint/unit CI workflow |
| OpenTelemetry in app | **Absent** (only transitive lockfile entry) |
| Docker Compose / Dockerfile | **Absent**; deploy via PM2 |
| `/api/health` | **CI waits on it, controller missing in source** — required minimal app change |

**Public interfaces Harness may use:**

- HTTP REST `/api/*` (JWT auth, tenant via token — never trust body tenant)
- SSE `/api/callcenter/events?token=…`, wallboard SSE
- Socket.IO AMI gateway (real-time AMI fan-out)
- Browser UI routes (`PLAYWRIGHT_BASE_URL`, default `:3010`)
- Health wait in CI: `http://localhost:5010/api/health`
- Asterisk gated by `HAS_ASTERISK` / readiness (lab provided by ops)

**Harness must NOT import** Nest modules, Sequelize models, React internals, or RTK slices.

---

## 2. Research summary (Aug 2026) → decisions

### Frontend E2E

| Option | 2026 verdict | Decision |
|--------|--------------|----------|
| **Playwright** | De-facto standard: free sharding, Trace Viewer, multi-tab, agentic traces | **Adopt / extend** (already in repo) |
| Cypress | Strong component DX; paid/awkward CI parallel | Reject for harness |
| POM classes | Fixtures > POM for small/medium suites | Prefer **Playwright fixtures** (business actions) |

### Backend environment

| Option | 2026 verdict | Decision |
|--------|--------------|----------|
| **Testcontainers** | Best for CI isolation, dynamic ports, Ryuk cleanup | **Primary for deps** (MySQL, Redis) |
| **Docker Compose** | Best for local long-lived multi-service stack | **Local + optional full-stack / asterisk profile** |
| GHA `services:` only | Works today; weak for multi-dep / parallel | Keep as interim; migrate toward Testcontainers |

Hybrid (industry consensus 2026): Compose for developer day stack; Testcontainers for automated harness runs.

### API test runner (inside harness)

| Option | Verdict | Decision |
|--------|---------|----------|
| **Vitest** | Faster greenfield; already on frontend | **Harness uses Vitest** (align with FE) |
| Jest | Backend unit suite only | **Do not migrate** backend unit tests |
| Nest `TestingModule` + Supertest | White/gray-box | **Avoid** for harness (violates black-box) |
| HTTP client vs running process | True black-box | **axios/fetch** (or Supertest against live URL) |

### Observability

| Option | Verdict | Decision |
|--------|---------|----------|
| Harness-side OTel SDK + structured logs | No app changes | **v1** |
| App instrumentation + Tracetest | Powerful; requires Nest/React OTel | **v2 optional**, separate approval |
| MSW | Mock third-party only | Use only if external SaaS must be stubbed; keep own API live |

### Package manager

User mentioned pnpm; repo uses **npm workspaces**. Decision: **keep npm** (minimal change).

---

## 3. Target architecture

```
                    ┌─────────────────────────────────────┐
                    │           Harness Runner            │
                    │  sequential | parallel | single ID  │
                    └──────────────┬──────────────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           ▼                       ▼                       ▼
    Environment              Scenarios                 Metrics
    (compose / TC)        (API + UI + AMI)        (latency, mem…)
           │                       │                       │
           │              ┌────────┴────────┐              │
           │              ▼                 ▼              │
           │         Assertions         Observability      │
           │   (HTTP/SSE/UI + SQL*)    (OTel + slog)       │
           │              │                 │              │
           └──────────────┴────────┬────────┴──────────────┘
                                   ▼
                              Reporter
                         (md / json / junit)
                                   │
                                   ▼
                    System Under Test (black box)
         NestJS :5010  ·  React :3010  ·  MySQL/Redis  ·  Asterisk lab
```

\* SQL assertions: optional helper for Asterisk/CC side-effects without API — not default (D-H02).

### Component responsibilities

1. **Runner** — discovers scenario modules by convention; runs by id / tag / suite; concurrency config; failure isolation.
2. **Environment** — up/down deps; wait-for-ready; migrate via public CLI (`npm run db:migrate`); seed via API; cleanup; Asterisk profile readiness.
3. **Scenarios** — independent workflows; register metadata (`id`, `tags`, `requires`).
4. **Assertions** — HTTP, SSE, UI locators; optional SQL for telephony side-effects.
5. **Metrics** — per-scenario timers, HTTP count/errors, process RSS (where available), pass/fail.
6. **Reporter** — aggregate → `reports/*.md|json|xml`.
7. **Observability** — OTel spans around scenario/step; JSON logs with `trace_id` / `scenario_id`.

### Frontend harness

- **Harness Runner owns orchestration**; Playwright as browser driver for `kind: ui`.
- Artifacts: screenshot + trace on failure (`retain-on-failure`).
- Auth: `storageState` / setup project pattern.

### Backend harness

- Start app process against Testcontainers MySQL (+ Redis when needed).
- Seed via **auth + CRUD HTTP**, not model imports.
- Asterisk/AMI: `requires: ['asterisk']`, skip unless lab ready (`HAS_ASTERISK=1`).

---

## 4. Directory structure

```
/harness
  package.json                 # @krasterisk/harness (workspace)
  tsconfig.json
  vitest.config.ts             # API scenario runner
  playwright.config.ts         # UI (absorb from e2e/)
  runner/
  environment/
    compose/                   # docker-compose.yml + profiles (incl. asterisk)
    testcontainers/
    readiness.ts
    seed.ts
    teardown.ts
  scenarios/
    api/
    ui/                        # absorbed Playwright specs
    realtime/                  # SSE / ami-events / asterisk-gated
  assertions/
    http.ts
    sse.ts
    ui.ts
    sql.ts                     # opt-in helper (D-H02)
  metrics/
  reporters/
  fixtures/
  utils/
  reports/                     # gitignored
  README.md
```

**Migration of `e2e/` (D-H01):** move into `harness/scenarios/ui`; root `test:e2e` → harness; delete `e2e/` after CI green.

**Do not modify** `packages/*/src` except D-H06 health (+ justified per-PR exceptions).

---

## 5. Module dependency map (Harness → app)

| Harness needs | App surface | Notes |
|---------------|-------------|-------|
| Auth login/refresh | `auth` HTTP | JWT as public client |
| Tenant CRUD smoke | `users`, `roles`, `moh`, `ivrs`, `queues`, … | Start with 2–3 stable domains |
| Operator UI | FE `/callcenter/agent` + SSE | Absorb operator happy-path |
| Migrations | `npm run db:migrate` | Public script |
| Health | `GET /api/health` | **Implement** (D-H06) |
| Real-time | SSE, Socket.IO `/ami-events` | PR-7 first-class |
| Asterisk | AMI/ARI/WSS lab | Planned; gated readiness |

---

## 6. Minimal app-code changes

| Change | Why | Decision |
|--------|-----|----------|
| `GET /api/health` | CI waits; missing in source | **Required** (D-H06) |
| `data-testid` | Only if a11y locators fail | Prefer `getByRole` |
| App OTel | v2 | Deferred (D-H05) |
| Root workspace + scripts | Wire harness | Allowed |

---

## 7. Implementation plan (one PR per stage)

| PR | Title | Deliverables |
|----|-------|--------------|
| **PR-1** | Scaffold | `/harness` package, Runner + registry, README; optional `/api/health` |
| **PR-2** | Environment | Testcontainers MySQL (+ Redis), readiness, migrate, teardown; local compose |
| **PR-3** | Backend scenarios | API client, http assertions, auth + 2–3 CRUD scenarios |
| **PR-4** | Frontend absorb | Move `e2e/` → harness UI; fixtures; trace/screenshot |
| **PR-5** | Metrics + Reporter | md / json / junit; CI artifacts |
| **PR-6** | Observability | Harness OTel + structured logs |
| **PR-7** | Asterisk / realtime | Env profile; SSE + ami-events scenarios; SQL helper where needed; gated job |
| **PR-8** | CI harden | `harness.yml`; sharding; Node ≥22 align |

---

## 8. Constraints checklist

- [x] No dependency on app internals  
- [x] Acts as external user  
- [x] Public interfaces only  
- [x] Extensible scenarios without Runner edits  
- [x] Minimal impact on existing code  
- [x] CI/CD support  
- [x] Asterisk/realtime in planning (staged)

---

## 9. Locked decisions (approved 2026-08-04)

| ID | Decision |
|----|----------|
| **D-H01** | **Absorb `e2e/` into `/harness`**. Temporary redirect PR only if needed; delete `e2e/` after CI green. |
| **D-H02** | **Default assertions = API + SSE + UI.** SQL helper in plan; use only for Asterisk/CC side-effects without API — not per-scenario default. |
| **D-H03** | **Asterisk / realtime in planning** (env profile, SSE, `/ami-events`, gated live lab). |
| **D-H04** | **Vitest@harness** (FE unit stays Vitest). **Do not** migrate backend Jest for Harness. |
| **D-H05** | **Observability v1 = harness-side only** (OTel + structured logs). No Nest/React OTel without separate v2 approval. |
| **D-H06** | **Minimal app touch:** stable public `GET /api/health`. |

### Deferred / rejected

- Forever thin `e2e/` shim as target  
- SQL as default assertion path  
- Backend Jest → Vitest migration in Phase 11  
- App-level OpenTelemetry in v1  

---

## 10. Next

`/gsd-discuss-phase 11` → `/gsd-plan-phase 11` → execute by PR stages.
