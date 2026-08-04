# Phase 11: Harness Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-04
**Phase:** 11-harness-layer-external-scenario-runner-environment-observabi
**Areas discussed:** MVP-сценарии, Asterisk lab контракт, CI матрица, Seed / тенант / учётки, CLI / запуск, Пакет harness

---

## MVP-сценарии

| Option | Description | Selected |
|--------|-------------|----------|
| Auth + CRUD + UI smoke | Vertical slice before Asterisk | ✓ |
| API only | UI later | |
| UI only | API later | |
| You decide | | |

**User's choice:** Auth + MOH CRUD + agent+supervisor UI + SSE heartbeat  
**Notes:** CRUD domain = MOH; UI = agent + supervisor; SSE = connect/heartbeat without AMI events

---

## Asterisk lab контракт

| Option | Description | Selected |
|--------|-------------|----------|
| Originate → answer → hangup | Narrow telephony E2E | ✓ |
| Queue call full path | | |
| Registration/presence only | | |
| Skip without lab | Green CI without secrets | ✓ |
| Fail if tagged / fail always | | |
| AMI+ARI+optional WSS ready | | ✓ |
| Env + .env.harness.example | | ✓ |

**User's choice:** All recommended options (1,1,1,1)  
**Notes:** Lab will be prepared by ops; harness must skip cleanly when unreachable

---

## CI матрица

| Option | Description | Selected |
|--------|-------------|----------|
| Every PR + main/develop | Non-Asterisk harness | ✓ |
| workflow_dispatch + optional nightly | Asterisk job | ✓ |
| PW report/traces + md/json/junit | Full artifacts | ✓ |
| workers=1, no sharding | Stable v1 | ✓ |

**User's choice:** All recommended options (1,1,1,1)

---

## Seed / тенант / учётки

| Option | Description | Selected |
|--------|-------------|----------|
| PW_USER/PW_PASS admin/admin | Match current e2e | ✓ |
| No tenant isolation in MVP | Later PR | ✓ |
| Seed via public API | | ✓ |
| API delete teardown | | ✓ |

**User's choice:** All recommended options (1,1,1,1)  
**Notes:** Multi-tenant isolation deferred

---

## CLI / запуск

| Option | Description | Selected |
|--------|-------------|----------|
| Root harness* scripts | | ✓ |
| --scenario / --tag | | ✓ |
| Sequential default; --parallel opt-in | | ✓ |
| Playwright headed/ui opt-in; API no watch | | ✓ |

**User's choice:** All recommended options (1,1,1,1)

---

## Пакет harness

| Option | Description | Selected |
|--------|-------------|----------|
| npm workspace @krasterisk/harness | | ✓ |
| No @krasterisk/shared | Black-box | ✓ |
| Single PR absorb e2e | | ✓ |
| Node 22 CI | Align engines | ✓ |

**User's choice:** All recommended options (1,1,1,1)

---

## Claude's Discretion

- Exact MOH/Swagger payload shapes
- Exact ARI readiness path if lab differs
- Runner internal file layout within CLI contracts
- Whether `/api/health` ships in scaffold PR or adjacent micro-PR

## Deferred Ideas

- Multi-tenant isolation harness scenarios
- Queue call as primary Asterisk path
- App OTel v2; Jest→Vitest migration; CI sharding; dedicated harness user
