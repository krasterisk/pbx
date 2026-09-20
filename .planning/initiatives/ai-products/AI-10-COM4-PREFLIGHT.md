# Commercial preflight (AI-10 COM4)

This is a packaging/preflight checklist, not DB-04 I1 installer/restore/upgrade. SQL runner ownership stays with the database module. MIT source license is unchanged.

## Community vs commercial

| Artifact | Runtime imports | `productRuntime` |
|---|---|---|
| Community PBX | no `speech-analytics` / `ai-voice` product modules | `community-core` |
| `analytics-api` | analytics composition | `not-installed` until schema ∧ workers ∧ entitlement |
| `robot-api` | robots composition | same |
| `full-pbx` | PBX + optional commercial modules | not flipped by COM4 |

Checks: `npm run test:community:composition --prefix packages/backend` and `test:community:source-boundary`.

## Boot refuse

Commercial profiles do not start when `DB_SCHEMA_PROFILE` does not match the composition (`StandaloneAiCoreModule.forProfile`). Schema readiness still requires `db:migrate` (I1 owns the installer).

## Preflight (no production connection)

`node harness/database/commercial-preflight.cjs`

- Dialect pin: `DB_DIALECT=mysql|postgres`
- Profile: `DB_SCHEMA_PROFILE=full-pbx|analytics-api|robot-api`
- Customer data-at-rest / provider secret present: `CC_AI_KEY_SECRET` (not in development fallback)
- Workers declared: `AI_WORKERS_CONFIGURED=1` or `AI_PROCESS_ROLES`
- Offline license profile must not set `AI_LICENSE_HEARTBEAT=1`
- Publisher private key must **never** be on a customer install (`AI_PUBLISHER_PRIVATE_KEY` fails closed)

Customer holds data-at-rest keys. Publisher signing keys stay with the issuer. Restore/backup procedures are DB-04 I2/I3.
