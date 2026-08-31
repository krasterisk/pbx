# @krasterisk/harness

Black-box harness layer for Krasterisk v4. Uses **only public interfaces** (HTTP `/api/*`, SSE, Socket.IO, UI, Asterisk lab) — never imports `packages/*/src` or `@krasterisk/shared` (D-H22).

## Layout

```
harness/
├── runner/           # CLI orchestrator (--scenario, --tag)
│   ├── index.ts
│   └── registry.ts # Scenario metadata
├── scenarios/
│   └── api/        # Vitest API scenarios
├── vitest.config.ts
└── README.md
```

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `HARNESS_API_URL` | `http://localhost:5010` | Backend base URL for API scenarios |
| `PLAYWRIGHT_BASE_URL` | `http://localhost:3010` | Frontend base URL (plan 02+) |

## Prerequisites

Most API scenarios require a running backend:

```bash
npm run dev:backend   # from repo root, port 5010
```

## CLI

Run from repo root:

```bash
npm run harness              # all registered scenarios (sequential)
npm run harness:api          # api kind only
```

Or from this package:

```bash
npm run test -- --tag health
npm run test -- --scenario health-smoke
npm run test -- --tag health --parallel   # opt-in parallelism (D-19)
```

### Filters

- `--scenario <id>` — run a single scenario by registry id
- `--tag <tag>` — run scenarios matching tag (e.g. `health`)
- `--kind api|ui|realtime` — filter by scenario kind
- `--parallel` — allow Vitest file parallelism (default: sequential, D-19)
- `--list` — print matched scenarios without executing

## CI

| Workflow | When | What |
|----------|------|------|
| `.github/workflows/harness.yml` | push/PR to `main`/`develop`, plus `workflow_dispatch` | Pre-Asterisk MVP: MySQL service, migrate, wait on `/api/health` + frontend, `npm test` in `harness/` (Node 22) |
| `.github/workflows/harness-asterisk.yml` | `workflow_dispatch` + nightly cron | Lab Asterisk originate (D-10); requires repo secrets |

CI Playwright uses `workers: 1` and no sharding (D-12). Do not pass `--parallel` in the default CI job.

Default lab credentials for the isolated CI MySQL (D-13): `PW_USER=admin`, `PW_PASS=admin`. Override via GitHub secrets for non-default test DBs. Do not point local `npm run harness` at a production tenant — API scenarios include MOH CRUD.

**Phase gate (AGENTS.md):** `npm run lint && npm run test:backend && npm run test:frontend && npm run harness`

`.github/workflows/e2e.yml` and `e2e/` stay until `harness.yml` is green on CI (D-H01/D-23). Then retire them.

## Black-box rule

**Do not** add `@krasterisk/shared` or import from `packages/backend/src` / `packages/frontend/src`. Inline minimal types when needed.

## Reports and CI artifacts (D-11)

Each harness run writes aggregated reports under `harness/reports/`:

| File | Format | Purpose |
|------|--------|---------|
| `reports/summary.md` | Markdown | Human-readable scenario table, failures (truncated), Playwright link |
| `reports/summary.json` | JSON | Machine-readable run summary + optional `GITHUB_SHA` |
| `reports/junit-api.xml` | JUnit | Vitest API/realtime results |
| `reports/junit-ui.xml` | JUnit | Playwright UI results |

Playwright HTML traces live in `harness/playwright-report/`. Generated artifacts are gitignored; only `reports/.gitkeep` is tracked.

**CI upload:** `.github/workflows/harness.yml` uploads artifact `harness-reports` (`harness/playwright-report` + `harness/reports`, retention 14 days) on every run (`if: always()`).

Per-scenario duration metrics are collected in-process (no RSS sampling in MVP).

## Current scenarios

| id | tags | kind | command |
|----|------|------|---------|
| health-smoke | health, smoke | api | `scenarios/api/health-smoke.test.ts` |

More scenarios arrive in plans 02–08 (auth, MOH CRUD, UI smoke, SSE, Asterisk lab).
