---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-07-24T15:23:50.364Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 10 | unrun-verify | .planning/phases/10-full-softphone/10-09-SUMMARY.md |  | [ASSUMED] A1 PlayDTMF + A3 DeviceState/ExtensionState live-Asterisk checkpoint deferred (no live PBX) | open |  | 2026-07-24T15:23:50.364Z |  |

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
  }
]
````
