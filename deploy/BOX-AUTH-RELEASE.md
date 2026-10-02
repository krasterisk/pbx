# Box authentication release

- Coordinator: current Codex chat, `/root`; mode: `codex-direct`.
- Baseline: `main` at `965b0c15`, including the local dialplan, CDR, firewall and Yandex asset fixes explicitly requested for commit/push.
- Scope: auth widgets, auth public config and registration policy, env documentation, verification and release to `185.177.216.132`.
- Plan: use the existing `DEPLOYMENT_MODE`; prohibit public signup on BOX; make the auth layout responsive; commit/push the requested local changes; release those commits to the box.
- Acceptance: BOX `/auth/config` reports mode and disabled signup; `/auth/register` returns 403; direct `/register` redirects to login; branding is inside the card, controls occupy opposite upper corners, company hint absent; login fits normal desktop/mobile viewports.
- Verification: targeted auth/backend and frontend tests; backend and frontend production builds; required repository lint/backend/frontend suites; live public-config, registration rejection and responsive browser checks.
- Status: released (2026-10-02). No delegated writers. Existing production secrets remain in `/opt/krasterisk/env/production.env`.

## Evidence before release

- Targeted backend tests: 14 passed; frontend auth/routes/CDR tests: 64 passed.
- Backend production compilation passed; targeted lint passed for changed auth files.
- Local live layout: 1280x720, 390x844, 320x568 and 844x390 fit without document scrollbars; language and theme switching work.
- Required lint: baseline failure, 6 errors in speech-analytics code. Required backend suite: 370 suites / 3527 tests passed; existing Telegram sanitizer and AI connectivity composition tests failed.
- Frontend production Vite build passed. Complete frontend suite: 317 files / 1576 tests passed; one existing SpeechAnalyticsProjectPage test failed because its API mock lacks useGetSaProjectVersionsQuery. Code commit 85797eb8 pushed to krasterisk/pbx main. Release and live checks completed below.


## Production release evidence

- Code commit: `85797eb8`, pushed to `https://github.com/krasterisk/pbx.git`, branch `main`.
- Exact Git archive SHA256: `1e5e11b81369fc1fecff161831636f763572c9c4ac9d088c5f6bdc4bb6e94137`; verified after upload.
- Both Docker builds passed. Running images: `krasterisk-backend:85797eb8` and `krasterisk-frontend:85797eb8`.
- PostgreSQL schema: `0031-cdr-chain.sql`; pending migrations empty; dirty marker null.
- Source rollback: `/opt/krasterisk/backup/source-before-85797eb8.tar.gz`; previous image tag: `58df5e-box11`, recorded in `/opt/krasterisk/backup/image-tag-before-85797eb8`.
- Live API: health 200; public config reports `deploymentMode=box`, `registrationEnabled=false`; registration POST rejected with 403; existing admin login 200.
- CDR regression API: timeline 200, 3 distinct CDR legs, 14 events, observed destinations 902 and 614.
- Production browser: 1280x720, 320x568 and 844x390 have document dimensions equal to viewport, no scrollbars. Branding inside card, corner controls present, organization hint and registration link absent. Direct `/register` redirects to `/login`.
- Screenshot: `C:/Users/Professional/Documents/Codex/box-auth-production.jpg` (local evidence).
- Gates: implementation pass; targeted automated checks pass; production builds pass; live checks pass; required whole-repository lint/tests fail on the unrelated baseline cases listed above.
- Next action: no remaining work in this auth release scope. Unrelated lint/test failures remain for their respective owners.
