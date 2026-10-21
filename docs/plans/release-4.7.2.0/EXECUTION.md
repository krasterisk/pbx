# Release 4.7.2.0 — PLAN / EXECUTION

- Coordinator: /root, codex-direct, 2026-10-21. No subagents.
- Human assignment: repeat version bump, commit/push current work to krasterisk/pbx main and deploy box 185.177.216.132.
- Baseline: main 10308472; existing staged repository-layout migration and application changes preserved.
- Owned paths: release version metadata, this release record; bounded fixes needed for release gates. Existing initiative designs are preserved; no adjacent phase execution.
- S1 in_progress: inventory source/publication inputs; exclude private/generated outputs, keep .planning untracking.
- S2 pending: lint, backend/frontend tests, build, version/database checks. Fix concrete gate failures.
- S3 pending: commit and push reviewed snapshot, inspect applicable GitHub Actions.
- S4 blocked: SSH supplied key rejected. After restored access: fresh production/schema preflight, private backup, test upgrade and compatible rollback, build/redeploy backend/frontend, health/authenticated smoke.
- Preserve production credentials, customer module grants, firewall and native Asterisk configuration.
- Evidence: ARTIFACTS_ROOT/runs/release-4.7.2.0/20261021; root configured C:/Users/Professional/Documents/Codex/Artifacts/krasterisk_v4.
- Acceptance: published source with passing gates; live verification and release require actual deployment. No release claimed before S4.

## Gate update
- Version 4.7.2.0, synchronized by canonical version:set tool.
- lint PASS (0 errors; existing warnings), full build PASS (shared/backend/frontend).
- Backend PASS: 508 suites, 5017 tests; 27 skipped.
- Database runner PASS57/57, schema PASS10/10 after explicit reviewed ownership update for business_goal0053 and phone_sessions0055; immutable baseline SQL preserved. Metadata fingerprint29d62d84cf348a759e76594cd71d8635c0ccc272096c86bfbfe89f259049bb95; column delta125. No guard weakened.
- WebRTC consultation targeted PASS8/8. Full frontend still running; CI checks pending.
- Publication: source/docs/tools and synthetic inputs included; .planning removed from tracking, never force-added. Private/generated outputs and unrelated API9057 deployment scratch excluded. No credential patterns found in selected files. Dependency declarations unchanged.
- Production SSH denied supplied key twice (including IdentitiesOnly); deployment blocked pending restored access. Production was not changed.
