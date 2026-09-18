# Three-company live pilot

Manual, destructive-to-test-fixtures integration exercise. Never part of the default CI job.

Prerequisites: a running local backend on `localhost:5010`, explicit authorization for the development MySQL/Asterisk and LLM provider, current root `.env`. Run from repository root with `KRASTERISK_LIVE_PILOT=yes` and a non-production `NODE_ENV`.

```powershell
$env:KRASTERISK_LIVE_PILOT='yes'
node harness/scenarios/manual/three-company-pilot.cjs setup
node harness/scenarios/manual/three-company-pilot.cjs 10 endpoints
node harness/scenarios/manual/three-company-pilot.cjs 50 endpoints
node harness/scenarios/manual/three-company-pilot.cjs 150 endpoints
node harness/scenarios/manual/three-company-pilot.cjs 10 scenario harness/scenarios/manual/ivr.json
node harness/scenarios/manual/three-company-pilot.cjs 10 scenario harness/scenarios/manual/ivr-route.json
node harness/scenarios/manual/three-company-pilot.cjs 10 scenario harness/scenarios/manual/ivr-timeout.json
node harness/scenarios/manual/three-company-pilot.cjs 50 scenario harness/scenarios/manual/queue.json
node harness/scenarios/manual/three-company-pilot.cjs 50 scenario harness/scenarios/manual/conference.json
node harness/scenarios/manual/three-company-pilot.cjs 150 scenario harness/scenarios/manual/beep.json
node harness/scenarios/manual/three-company-pilot.cjs 150 diagnostics
node harness/scenarios/manual/three-company-pilot.cjs 150 isolation
```

The fixture is specific to the reviewed development environment: provider **16** belongs to source tenant **0**. Setup copies its encrypted settings inside MySQL to the newly registered test companies. It does not print credentials. Change and review those IDs before using another environment. Company quotas are fixture changes, not a subscription-purchase test.

Run commands **sequentially**: `.tmp/production-pilots.json` contains shared state, generated passwords and access tokens. Do not commit or publish it. Raw SSE/trace files in `.tmp` are private debugging artifacts. Re-running `endpoints` continues from the current endpoint count. Scenario re-runs may create another draft and must be reviewed for duplicate objects.

`PASS` means the permitted tool card applied and replay was idempotent. It does **not** prove every requested semantic detail or audio delivery. Independently check numbers, timeouts, runtime dialplan, AMI registration, two-way media, CDR and negative tenant isolation. The initial live audit deliberately found cases where a successfully applied card was incomplete.

`isolation` verifies owned endpoint counts and rejects foreign context IDs. `inventory` saves tools/skills. `apply-context` recompiles only that company's test context after a compiler fix. `cleanup-drafts` rejects unused pending cards; it does not delete applied configuration. Test companies remain for inspection; remove them only through an explicitly reviewed cleanup process. Never delete an ambiguous claimed workflow to make a test green.

The repeatable target and known failures are recorded in `.planning/PRODUCTION-READINESS-2026-09-17.md`.
