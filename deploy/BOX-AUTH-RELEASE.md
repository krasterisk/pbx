# Box authentication release

- Coordinator: current Codex chat, `/root`; mode: `codex-direct`.
- Baseline: `main` at `965b0c15`, including the local dialplan, CDR, firewall and Yandex asset fixes explicitly requested for commit/push.
- Scope: auth widgets, auth public config and registration policy, env documentation, verification and release to `185.177.216.132`.
- Plan: use the existing `DEPLOYMENT_MODE`; prohibit public signup on BOX; make the auth layout responsive; commit/push the requested local changes; release those commits to the box.
- Acceptance: BOX `/auth/config` reports mode and disabled signup; `/auth/register` returns 403; direct `/register` redirects to login; branding is inside the card, controls occupy opposite upper corners, company hint absent; login fits normal desktop/mobile viewports.
- Verification: targeted auth/backend and frontend tests; backend and frontend production builds; required repository lint/backend/frontend suites; live public-config, registration rejection and responsive browser checks.
- Status: in progress. No delegated writers. Existing production secrets remain in `/opt/krasterisk/env/production.env`.

## Evidence before release

- Targeted backend tests: 14 passed; frontend auth/routes/CDR tests: 64 passed.
- Backend production compilation passed; targeted lint passed for changed auth files.
- Local live layout: 1280x720, 390x844, 320x568 and 844x390 fit without document scrollbars; language and theme switching work.
- Required lint: baseline failure, 6 errors in speech-analytics code. Required backend suite: 370 suites / 3527 tests passed; existing Telegram sanitizer and AI connectivity composition tests failed.
- Frontend production Vite build passed. Complete frontend suite: running (first two chunks passed). Next action: commit/push, build the exact committed source, finish the suite before release, then verify public BOX config and live login layout.
