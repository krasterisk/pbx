# R12: index completion and projection throughput

2026-10-23. Coordinator /root, same chat, codex-direct, sole writer. PLAN R12 revision1 tasks1–4. Baseline b03e97cf plus accepted dirty R11; unrelated changes preserved. No commit or remote deployment.

## Diagnosis and completion

The v4 backfill had already completed22Oct20:24:01 Asia/Krasnoyarsk, after the R11 session. Read-only verification23Oct found all10234tenant0 facts at schema4, zero missing/current-version gaps on the configured PBX node, completed full-history CDR and projection checkpoints. The index was not restarted or forcibly marked ready. Lease ownership, cursors and readiness flags were not manually reset or overridden; normal background ingestion continues.

The slow path rebuilt full per-call projections: one transaction per call, sequential inserts for every index dimension, participant replacement and two aggregate bucket adjustments even if dimensions/outcome/time bucket were unchanged. Measured local DB round trips were64–77ms, median67ms. These repeated round trips accumulate across the archive. Fact replay originally handled500calls before its next checkpoint and normal ingestion cycle, so readiness/progress appeared frozen during long batches. This is a code-path/latency diagnosis, not a measured replay A/B throughput benchmark.

## Changes

- Index dimensions are inserted in bound multi-row batches of at most100, inside the same existing fact/call transaction. Unicode search labels are still normalized in JavaScript. Empty dimensions still clear the old index. MySQL/PostgreSQL replacement lexer checks cover quoted Unicode values and bounded batches.
- Counter buckets are left untouched when tenant/node/direction/origin/outcome and the5-minute bucket are unchanged. Real classification/bucket changes still subtract/add atomically. Facts, participant ACL rows and revision updates remain transactional.
- Fact retrofit batches are100 instead of500, independently of cheap source-read/pending/semantic batch limits. Durable cursor, lease fencing and idempotent resume remain; shutdown is checked before advancing the fact checkpoint. This makes progress/normal ingestion resume between shorter chunks.
- No frontend source changes; all22accepted R11 frontend hashes match. No HTTP fallback reads raw CDR/CEL and no readiness/authorization checks were removed.

## Validation

Root lint passed0errors with existing127backend/102frontend warnings. Root backend511suites/5068tests passed,27conditional skips; the runner retained its existing worker-teardown warning and returned0. Final affected4suites/83tests passed, including native-group enrichment, calls readiness, transactional write failure, bound SQL and retrofit restart/fencing. Backend production build passed; runtime restarted locally PID492324, health200. Full required root frontend13batches/491files/2677tests passed, exit0. No R12 checks remain running. Final verification.json binds all five successful required receipts, sourceDelta[] and frontendDelta[] to the captured baseline.

Ordinary browser: Cyrillic search “Поддержка” finds24calls in16–22Oct; uppercase yields the same24. Group condition opens its catalogue with a normal “Нет данных” state; tenant0 contains no native-group history. Explicit group501 query returns a ready0-call empty result rather than skeletons. Positive native-group classification/filter behavior is synthetic automated evidence, not a claim of real matching group calls. Both final search24rows and group empty state were checked after the runtime restart. QA console errors[], own tab12 closed, no viewport/settings/saved-filter changes. Original tab1 reloaded with its16–22Oct period preserved,133calls and no skeletons. browser-proof.json and screenshots retain these observations.

Evidence: C:/Users/Professional/Documents/DevArtifacts/krasterisk_v4/runs/cdr-reports-ux/r12-20261023. diagnosis.json contains timed aggregate read-only queries, version coverage and checkpoints; logs/receipts contain commands and outcomes. Source-freeze4owned backend files, frontendDelta[]. Runtime screenshots contain ordinary authorized application state. No new calls, synthetic production history, inference, permission changes or release.
