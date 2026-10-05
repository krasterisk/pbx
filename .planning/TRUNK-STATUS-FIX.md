# Trunk status correction

Coordinator Codex /root; mode codex-direct; baseline main 6a9e64a5, server f4e998e5-acres.
Scope: backend trunk list/live reachability/qualify resync, frontend API + shared status rendering/mobile/polling/i18n and tests. Existing dirty main.ts/0031 SQL excluded.
Plan T1: AMI contact status separate from registration, fail unknown on AMI error and tenant-only probes; T2: shared desktop/mobile badge + 15s polling + available counts; T3: regression/unit/build/lint and CI gates; T4: deploy checked patch, live browser verification.
Status in_progress. Next action tests and build.

Implemented T1/T2. New reachabilityStatus is independent of registrationStatus; only tenant-owned t_* endpoints are probed, bounded 8 actions per batch. Unknown on AMI failure; NonQualified distinct from Unreachable. No registration query for IP-only lists. Safe qualify CLI synchronization after create/update. Shared TrunkStatus renders desktop/mobile; list polls 15s, cached status becomes Unknown on HTTP error.
Evidence: real AMI ContactStatusDetail status Reachable confirmed for t_komandor_0. Full backend 374 suites/3543 tests passed before final synchronization guard; final targeted 15 tests passed after guard. Frontend badge 6 tests passed; lint 0 errors (existing 116 backend/87 frontend warnings). Backend builds passed. Full frontend/build/CI gates pending.
Next action: commit owned patch, pass CI, prepare images and live browser verification.
