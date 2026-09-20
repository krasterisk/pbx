# Release npm checks — 2026-09-20

Host: local workspace (not ipbx). Logs under this directory.

| Check | Result | Notes |
|---|---|---|
| `npm run lint` | **PASS** (exit 0) | 0 errors; warnings remain (backend ~99, frontend ~82) — [lint.log](lint.log) |
| `npm run test:backend` | **PASS** (exit 0) after fixes | Suites **318** passed / 1 skipped; tests **3160** passed / 11 skipped — [test-backend-rerun.log](test-backend-rerun.log) |
| `npm run test:frontend` (full) | **HUNG** at `RUN` (~7 min timeout) | Known baseline hang; not treated as silent pass — [test-frontend.log](test-frontend.log) |
| Frontend targeted AI pages | **PASS** 12 files / 18 tests | StandaloneAiApp + SpeechAnalytics* + AiRobots* + AiProductLanding — [test-frontend-targeted.log](test-frontend-targeted.log) |

## Release-blocker fixes applied this assignment

1. `module-coverage.registry.ts` — classify `asterisk-odbc` + `embeddings` as infrastructure (D-17 completeness).
2. `purchase-module.service.spec.ts` — expect idempotent `charge(..., 'charge', operationKey)` arity.

## Product runtime

Conscious opt-in documented in [PRODUCT-RUNTIME-FLIP.md](../PRODUCT-RUNTIME-FLIP.md). Default health stays `not-installed`.
