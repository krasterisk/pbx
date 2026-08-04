---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-08-04T12:55:24.448Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 10 | unrun-verify | .planning/phases/10-full-softphone/10-09-SUMMARY.md |  | [ASSUMED] A1 PlayDTMF + A3 DeviceState/ExtensionState live-Asterisk checkpoint deferred (no live PBX) | open |  | 2026-07-24T15:23:50.364Z |  |
| 2 | 11 | unrun-verify | harness/scenarios/api/health-smoke.test.ts |  | harness:api health integration requires live backend on :5010 | open |  | 2026-08-04T12:55:24.448Z |  |

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
  }
]
````
