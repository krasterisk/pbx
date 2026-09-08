# @krasterisk/harness

Black-box harness layer for Krasterisk v4. Uses **only public interfaces** (HTTP `/api/*`, SSE, Socket.IO, UI, Asterisk lab) — never imports `packages/*/src` or `@krasterisk/shared` (D-H22).

## Layout

```
harness/
├── runner/           # CLI orchestrator (--scenario, --tag)
│   ├── index.ts
│   └── registry.ts   # Scenario metadata
├── fixtures/         # Playwright auth, llm-stub, stub-provider
├── pages/            # UI page-objects (AiChatPage)
├── llm-stub/         # OpenAI-compatible stub + fixture scenarios
├── scenarios/
│   ├── api/          # Vitest API scenarios
│   ├── realtime/     # Vitest SSE / Asterisk lab
│   └── ui/           # Playwright UI scenarios
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
npm run harness              # harness/package.json "test": vitest (api + realtime + llm-stub) && playwright
npm run harness:api          # runner --kind api
npm run harness:ai-chat      # runner --tag ai-chat (stub-backed UI specs + registry matches)
```

`npm run test -- --tag` from this package does **not** reach the runner: `test` is `vitest && playwright`. Use the runner scripts instead:

```bash
npm run test:api -- --tag health
npm run test:ai-chat
npx tsx runner/index.ts --scenario health-smoke
npx tsx runner/index.ts --tag health --parallel   # opt-in parallelism (D-19)
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
| `.github/workflows/harness-asterisk.yml` | `workflow_dispatch` only | Lab Asterisk originate (D-10); requires repo secrets |

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

## Stub LLM

The OpenAI-compatible stub (`harness/llm-stub`) serves `/v1/chat/completions` as SSE. UI specs that talk to the assistant must import `test`/`expect` from `fixtures/ai-provider.fixture.ts` and request `stubProvider` so the default chat provider points at the stub.

| Variable | Default | Purpose |
|----------|---------|---------|
| `HARNESS_LLM_STUB_PORT` | `5099` | Base listen port; worker `n` uses `base + n` |
| `HARNESS_API_URL` | `http://localhost:5010` | Backend used to register the stub provider |
| `HARNESS_LIVE_LLM` | unset | Set to `1` to run the live `ai-agent-ivr` apply flow |

```bash
npm run harness:ai-chat      # from repo root — tag ai-chat, no live-llm required
```

Fixture scenarios in `llm-stub/scenarios.ts`: D1 `two-turns` / `with-reasoning` / `with-tools`, plus D3 `plan-ivr`, `question-order`, `steps-then-answer`.

## Current scenarios

| id | tags | kind | command |
|----|------|------|---------|
| health-smoke | health, smoke | api | `scenarios/api/health-smoke.test.ts` |
| auth-login | auth, api | api | `scenarios/api/auth.test.ts` |
| moh-crud | moh, api | api | `scenarios/api/moh-crud.test.ts` |
| directories-crud | directories, api | api | `scenarios/api/directories-crud.test.ts` |
| directory-carousel | directories, realtime | realtime | `scenarios/realtime/directory-carousel.test.ts` |
| agent-smoke | ui, agent, smoke | ui | `scenarios/ui/agent-smoke.spec.ts` |
| supervisor-smoke | ui, supervisor, smoke | ui | `scenarios/ui/supervisor-smoke.spec.ts` |
| ai-agent-ivr | ui, ai-chat, ivr, live-llm | ui | `scenarios/ui/ai-agent-ivr.spec.ts` |
| ai-chat-plan | ui, ai-chat, plan | ui | `scenarios/ui/ai-chat-plan.spec.ts` |
| ai-chat-question | ui, ai-chat | ui | `scenarios/ui/ai-chat-question.spec.ts` |
| ai-chat-history-parity | ui, ai-chat, history | ui | `scenarios/ui/ai-chat-history-parity.spec.ts` |
| sse-heartbeat | sse, realtime | realtime | `scenarios/realtime/sse-heartbeat.test.ts` |
| asterisk-originate | asterisk, realtime | realtime | `scenarios/realtime/asterisk-originate.test.ts` |
| ami-events | asterisk, ami-events, realtime | realtime | `scenarios/realtime/ami-events.test.ts` |
