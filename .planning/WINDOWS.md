---
schema_version: 1
open_count: 10
waived_count: 0
fixed_count: 4
total_count: 14
last_updated: 2026-09-03T17:30:55.825Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 10 | unrun-verify | .planning/phases/10-full-softphone/10-09-SUMMARY.md |  | [ASSUMED] A1 PlayDTMF + A3 DeviceState/ExtensionState live-Asterisk checkpoint deferred (no live PBX) | open |  | 2026-07-24T15:23:50.364Z |  |
| 2 | 11 | unrun-verify | harness/scenarios/api/health-smoke.test.ts |  | harness:api health integration requires live backend on :5010 | open |  | 2026-08-04T12:55:24.448Z |  |
| 3 | 11 | unrun-verify | harness/scenarios/api/auth.test.ts |  | Live harness:api --tag auth deferred (backend not running during 11-03 execution) | open |  | 2026-08-04T13:01:43.629Z |  |
| 4 | 11 | unrun-verify | harness/scenarios/api/moh-crud.test.ts |  | Live harness:api --tag moh deferred (backend not running during 11-03 execution) | open |  | 2026-08-04T13:02:03.163Z |  |
| 5 | 12 | deviation | packages/frontend/src/shared/config/locales/ru.ts |  | 12-02 close-out skipped ru.ts/en.ts (mixed with unrelated WIP); routes.chain keys remain unstaged | fixed |  | 2026-08-19T06:47:39.880Z | 2026-08-31T06:28:20.736Z |
| 6 | 12 | deviation | packages/frontend/src/shared/config/locales/ru.ts |  | routes.action.congestion added in working tree but not committed (WIP mix) | fixed |  | 2026-08-19T07:27:22.769Z | 2026-08-31T06:28:22.651Z |
| 7 | 12 | unrun-verify | packages/backend/src/modules/call-groups/migrate-call-groups-exten.ts |  | Live MySQL ALTER not run; human must execute migrate-call-groups-exten.ts twice | fixed |  | 2026-08-20T02:38:06.854Z | 2026-08-31T06:28:23.354Z |
| 8 | 12 | unrun-verify | packages/backend/src/modules/call-groups/migrate-call-groups-ring-options.ts |  | Live ALTER not run; unit tests mock QI. Human must run migrate-call-groups-ring-options.ts twice. | fixed |  | 2026-08-20T03:04:02.403Z | 2026-08-31T06:28:24.216Z |
| 9 | 14 | stub | packages/shared/src/utils/dialplan-walk/walkDialplanGraph.ts | 14 | Returns outcome.kind stub / hopsUsed -1 so specs compile and stay RED | open |  | 2026-09-03T17:30:38.927Z |  |
| 10 | 14 | stub | packages/shared/src/utils/dialplan-walk/exactRouteResolver.ts | 16 | Always returns ambiguous with empty matches | open |  | 2026-09-03T17:30:42.097Z |  |
| 11 | 14 | stub | packages/backend/src/modules/route-references/action-reference.util.ts | 53 | Only ivr and queue kinds match; remaining kinds reserved for 14-02 | open |  | 2026-09-03T17:30:48.046Z |  |
| 12 | 14 | skipped-test | packages/backend/src/modules/route-references/action-reference.util.spec.ts | 85 | it.failing notify.integration_uid and voicerobot.robot_uid until 14-02 | open |  | 2026-09-03T17:30:50.848Z |  |
| 13 | 14 | skipped-test | packages/backend/src/modules/route-references/action-reference.util.spec.ts | 104 | it.failing directory field scan until 14-02 | open |  | 2026-09-03T17:30:54.506Z |  |
| 14 | 14 | deviation | packages/shared/package.json |  | Added Jest test script to @krasterisk/shared so Wave 0 verify can run | open |  | 2026-09-03T17:30:55.825Z |  |

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
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-19T06:47:39.880Z",
    "resolved_at": "2026-08-31T06:28:20.736Z"
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "12",
    "file": "packages/frontend/src/shared/config/locales/ru.ts",
    "line": null,
    "description": "routes.action.congestion added in working tree but not committed (WIP mix)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-19T07:27:22.769Z",
    "resolved_at": "2026-08-31T06:28:22.651Z"
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "12",
    "file": "packages/backend/src/modules/call-groups/migrate-call-groups-exten.ts",
    "line": null,
    "description": "Live MySQL ALTER not run; human must execute migrate-call-groups-exten.ts twice",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-20T02:38:06.854Z",
    "resolved_at": "2026-08-31T06:28:23.354Z"
  },
  {
    "id": 8,
    "kind": "unrun-verify",
    "phase": "12",
    "file": "packages/backend/src/modules/call-groups/migrate-call-groups-ring-options.ts",
    "line": null,
    "description": "Live ALTER not run; unit tests mock QI. Human must run migrate-call-groups-ring-options.ts twice.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-20T03:04:02.403Z",
    "resolved_at": "2026-08-31T06:28:24.216Z"
  },
  {
    "id": 9,
    "kind": "stub",
    "phase": "14",
    "file": "packages/shared/src/utils/dialplan-walk/walkDialplanGraph.ts",
    "line": 14,
    "description": "Returns outcome.kind stub / hopsUsed -1 so specs compile and stay RED",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T17:30:38.927Z",
    "resolved_at": null
  },
  {
    "id": 10,
    "kind": "stub",
    "phase": "14",
    "file": "packages/shared/src/utils/dialplan-walk/exactRouteResolver.ts",
    "line": 16,
    "description": "Always returns ambiguous with empty matches",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T17:30:42.097Z",
    "resolved_at": null
  },
  {
    "id": 11,
    "kind": "stub",
    "phase": "14",
    "file": "packages/backend/src/modules/route-references/action-reference.util.ts",
    "line": 53,
    "description": "Only ivr and queue kinds match; remaining kinds reserved for 14-02",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T17:30:48.046Z",
    "resolved_at": null
  },
  {
    "id": 12,
    "kind": "skipped-test",
    "phase": "14",
    "file": "packages/backend/src/modules/route-references/action-reference.util.spec.ts",
    "line": 85,
    "description": "it.failing notify.integration_uid and voicerobot.robot_uid until 14-02",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T17:30:50.848Z",
    "resolved_at": null
  },
  {
    "id": 13,
    "kind": "skipped-test",
    "phase": "14",
    "file": "packages/backend/src/modules/route-references/action-reference.util.spec.ts",
    "line": 104,
    "description": "it.failing directory field scan until 14-02",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T17:30:54.506Z",
    "resolved_at": null
  },
  {
    "id": 14,
    "kind": "deviation",
    "phase": "14",
    "file": "packages/shared/package.json",
    "line": null,
    "description": "Added Jest test script to @krasterisk/shared so Wave 0 verify can run",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T17:30:55.825Z",
    "resolved_at": null
  }
]
````
