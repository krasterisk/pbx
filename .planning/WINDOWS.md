---
schema_version: 1
open_count: 7
waived_count: 0
fixed_count: 0
total_count: 7
last_updated: 2026-08-20T02:38:06.854Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 10 | unrun-verify | .planning/phases/10-full-softphone/10-09-SUMMARY.md |  | [ASSUMED] A1 PlayDTMF + A3 DeviceState/ExtensionState live-Asterisk checkpoint deferred (no live PBX) | open |  | 2026-07-24T15:23:50.364Z |  |
| 2 | 11 | unrun-verify | harness/scenarios/api/health-smoke.test.ts |  | harness:api health integration requires live backend on :5010 | open |  | 2026-08-04T12:55:24.448Z |  |
| 3 | 11 | unrun-verify | harness/scenarios/api/auth.test.ts |  | Live harness:api --tag auth deferred (backend not running during 11-03 execution) | open |  | 2026-08-04T13:01:43.629Z |  |
| 4 | 11 | unrun-verify | harness/scenarios/api/moh-crud.test.ts |  | Live harness:api --tag moh deferred (backend not running during 11-03 execution) | open |  | 2026-08-04T13:02:03.163Z |  |
| 5 | 12 | deviation | packages/frontend/src/shared/config/locales/ru.ts |  | 12-02 close-out skipped ru.ts/en.ts (mixed with unrelated WIP); routes.chain keys remain unstaged | open |  | 2026-08-19T06:47:39.880Z |  |
| 6 | 12 | deviation | packages/frontend/src/shared/config/locales/ru.ts |  | routes.action.congestion added in working tree but not committed (WIP mix) | open |  | 2026-08-19T07:27:22.769Z |  |
| 7 | 12 | unrun-verify | packages/backend/src/modules/call-groups/migrate-call-groups-exten.ts |  | Live MySQL ALTER not run; human must execute migrate-call-groups-exten.ts twice | open |  | 2026-08-20T02:38:06.854Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "10",
    "file": ".planning/phases/10-full-softphone/10-09-SUMMARY.md",
    "line": null,
    "description": "[ASSUMED] A1 PlayDTMF + A3 DeviceState/ExtensionState live-Asterisk checkpoint deferred (no live PBX)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-24T15:23:50.364Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "11",
    "file": "harness/scenarios/api/health-smoke.test.ts",
    "line": null,
    "description": "harness:api health integration requires live backend on :5010",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-04T12:55:24.448Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "11",
    "file": "harness/scenarios/api/auth.test.ts",
    "line": null,
    "description": "Live harness:api --tag auth deferred (backend not running during 11-03 execution)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-04T13:01:43.629Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "11",
    "file": "harness/scenarios/api/moh-crud.test.ts",
    "line": null,
    "description": "Live harness:api --tag moh deferred (backend not running during 11-03 execution)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-04T13:02:03.163Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "12",
    "file": "packages/frontend/src/shared/config/locales/ru.ts",
    "line": null,
    "description": "12-02 close-out skipped ru.ts/en.ts (mixed with unrelated WIP); routes.chain keys remain unstaged",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-19T06:47:39.880Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "12",
    "file": "packages/frontend/src/shared/config/locales/ru.ts",
    "line": null,
    "description": "routes.action.congestion added in working tree but not committed (WIP mix)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-19T07:27:22.769Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "12",
    "file": "packages/backend/src/modules/call-groups/migrate-call-groups-exten.ts",
    "line": null,
    "description": "Live MySQL ALTER not run; human must execute migrate-call-groups-exten.ts twice",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-20T02:38:06.854Z",
    "resolved_at": null
  }
]
````
