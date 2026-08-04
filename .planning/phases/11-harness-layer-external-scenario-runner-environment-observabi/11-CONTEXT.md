# Phase 11: Harness Layer - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Построить внешний black-box **Harness Layer** в корневом пакете `/harness` вокруг существующего Krasterisk v4: Runner, Environment, Scenarios, Assertions, Metrics, Reporter, Observability. Harness использует только публичные интерфейсы (HTTP `/api/*`, SSE, Socket.IO `/ami-events`, UI, Asterisk lab). Не переписывать бизнес-логику; минимальный touch `packages/*` — `GET /api/health`. Absorbiровать существующий `e2e/` Playwright. Asterisk/realtime — в scope планирования, staged delivery.

</domain>

<decisions>
## Implementation Decisions

### Architecture (pre-locked, approved 2026-08-04)
- **D-H01:** Absorb `e2e/` into `/harness` (target). Temporary shim only if needed for CI bridge; delete `e2e/` after green. — **Reversibility:** costly — dual entrypoints confuse authors
- **D-H02:** Default assertions = API + SSE + UI. SQL helper exists; use only for Asterisk/CC side-effects without API — not per-scenario default. — **Reversibility:** reversible
- **D-H03:** Asterisk / realtime in planning (env profile, SSE, `/ami-events`, gated live lab).
- **D-H04:** Vitest in `@krasterisk/harness`; do **not** migrate backend Jest unit suite. Frontend unit stays Vitest.
- **D-H05:** Observability v1 = harness-side OTel + structured logs only. No Nest/React OTel SDK without separate v2 approval.
- **D-H06:** Implement stable public `GET /api/health` (CI already waits; missing in source). — **Reversibility:** reversible

### MVP scenarios
- **D-01:** Pre-Asterisk green bar = **Auth + MOH CRUD (API) + agent + supervisor UI smoke + SSE connect/heartbeat** (no live AMI events required).
- **D-02:** First CRUD domain = **MOH** (create → read → update → delete via public API).
- **D-03:** UI smoke covers **`/callcenter/agent` and `/callcenter/supervisor`** (not legacy `/operator` as primary).
- **D-04:** SSE without Asterisk = open EventSource with JWT `?token=`, assert connection / heartbeat / no immediate error.

### Asterisk lab contract
- **D-05:** Minimal telephony happy-path = **Originate → agent ring/answer → hangup**.
- **D-06:** When lab unavailable: **skip** scenarios with `requires: ['asterisk']` (green CI without secrets).
- **D-07:** Ready gate = **AMI TCP connect + ARI HTTP `/asterisk/info` (or equivalent) + optional WSS reachable**.
- **D-08:** Lab config = **env vars + committed `.env.harness.example`** (secrets in CI secrets / local env only).

### CI matrix
- **D-09:** Non-Asterisk harness on **every PR + push to main/develop** (evolve from `e2e.yml`).
- **D-10:** Asterisk lab job = **`workflow_dispatch` + optional nightly** (not every PR).
- **D-11:** Artifacts: **Playwright report + traces + harness markdown/JSON/JUnit**.
- **D-12:** v1 parallelism: **no sharding; `workers=1` in CI**.

### Seed / tenant / accounts
- **D-13:** Credentials = **`PW_USER` / `PW_PASS`** (default `admin`/`admin`), same as current e2e.
- **D-14:** Multi-tenant isolation scenarios **out of MVP** (single tenant).
- **D-15:** Seed data via **public API** after login (not SQL dumps / ORM).
- **D-16:** Cleanup = **delete via API in `finally` / teardown** for scenario independence.

### CLI / launch
- **D-17:** Root scripts: `npm run harness`, `harness:ui`, `harness:api`, `harness:asterisk`.
- **D-18:** Select scenarios by **`--scenario <id>`** and/or **`--tag <tag>`**.
- **D-19:** Default execution **sequential**; **`--parallel` opt-in**.
- **D-20:** Playwright headed/`--ui` as opt-in scripts only; API runner without watch mode in MVP.

### Package layout
- **D-21:** `/harness` is npm **workspace member** `@krasterisk/harness`. — **Reversibility:** costly — workspace + lockfile churn
- **D-22:** **No** dependency on `@krasterisk/shared` (true black-box; minimal inline types if needed).
- **D-23:** Absorb `e2e/` in **one PR** (move + update scripts/CI + delete `e2e/` when green).
- **D-24:** Harness CI uses **Node 22** (align with root `engines`; fix current e2e Node 20 drift).

### Claude's Discretion
- Exact MOH API paths/payload shapes — follow Swagger `/api/docs` at plan/research time.
- Exact ARI readiness URL path if `/asterisk/info` differs in lab — verify against live Asterisk.
- Internal Runner registry file layout within `/harness` as long as D-17…D-20 CLI contracts hold.
- Whether PR-1 includes `/api/health` in same PR as scaffold or adjacent tiny PR — either OK if documented.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture / phase
- `.planning/CANONICAL_REFS.md` — index of must-read architecture docs
- `packages/frontend/.idea/ARCHITECTURE.md` — FSD, UI, auth storage patterns
- `packages/backend/.idea/ARCHITECTURE.md` — NestJS, multi-tenant, JWT/RBAC, AMI/ARI
- `.planning/phases/11-harness-layer-external-scenario-runner-environment-observabi/11-ARCHITECTURE.md` — approved harness architecture + PR stages + D-H01…D-H06
- `.planning/ROADMAP.md` — Phase 11 scope / PR staging

### Existing E2E / CI (absorb / evolve)
- `e2e/README.md` — Playwright conventions, `HAS_ASTERISK`, credentials
- `e2e/playwright.config.ts` — baseURL, traces, Chromium
- `e2e/fixtures/auth.fixture.ts` — `POST /api/auth/login` + localStorage seed
- `e2e/tests/operator-happy-path.spec.ts` — operator smoke (migrate to agent/supervisor routes)
- `.github/workflows/e2e.yml` — MySQL service, wait `/api/health`, Playwright job

### Public surfaces (black-box)
- Backend Swagger: `http://localhost:5010/api/docs` (runtime) — API contracts for MOH/auth
- `packages/backend/src/modules/callcenter/callcenter-sse.controller.ts` — SSE `?token=` auth
- `packages/backend/src/modules/ami/ami.gateway.ts` — Socket.IO `/ami-events`
- Root `package.json` — workspaces, `test:e2e`, `db:migrate`, engines Node ≥22

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `e2e/fixtures/auth.fixture.ts`: worker-scoped API login + localStorage injection — port into harness UI fixtures
- Current Playwright config patterns: `retain-on-failure` trace/screenshot/video, Chromium-only
- Root scripts `test:e2e` / `test:e2e:install` — replace with `harness*` aliases
- Backend migrations CLI: `npm run db:migrate` — Environment migrate hook

### Established Patterns
- Black-box auth: `POST /api/auth/login` with `{ login, password }` → `accessToken` / `refreshToken` / `user`
- Call center realtime prefers **native EventSource** (SSE), not socket.io-client for CC state
- Routes: `/callcenter/agent`, `/callcenter/supervisor`; `/operator` is legacy redirect
- CI already starts MySQL service + `dev:backend` + `dev:frontend` and waits on `/api/health` (**endpoint missing in source** — D-H06)

### Integration Points
- New package under root `workspaces` + lockfile
- Evolve `.github/workflows/e2e.yml` → harness workflow(s); optional second workflow for Asterisk
- Minimal backend: public health controller under `/api/health`
- Harness must not import `packages/backend/src` or `packages/frontend/src`

</code_context>

<specifics>
## Specific Ideas

- Pre-Asterisk MVP is a vertical slice: API (auth+MOH) + dual CC pages + SSE connect — not API-only or UI-only.
- Telephony bar is narrow on purpose: originate/answer/hangup first; full queue path deferred beyond MVP lab scenario.
- Reports triad (md/json/junit) required in CI artifacts alongside Playwright traces.

</specifics>

<deferred>
## Deferred Ideas

- Multi-tenant isolation harness scenarios (two tenants, negative visibility cases) — later phase/PR after MVP
- Queue-based call path as primary Asterisk scenario (originate path is MVP)
- App-level OpenTelemetry / Tracetest (v2)
- Backend Jest → Vitest migration
- CI sharding / high parallelism
- Dedicated `harness` seed user (vs admin/admin)
- Forever thin `e2e/` shim as target model (rejected)

</deferred>

---

*Phase: 11-harness-layer-external-scenario-runner-environment-observabi*
*Context gathered: 2026-08-04*
