# Optional BLF / presence — EXECUTION and PLAN

Coordinator/writer: Codex `/root`; mode: `codex-direct`; baseline: main, 327ca234.
Scope: endpoint subscription policy, tenant hints, endpoint form, box modules.
Excluded dirty baseline: backend/src/main.ts and database/migrations/0031-cdr-chain.sql.

## Tasks

1. Reuse allow_subscribe as optional permission (new endpoints off); force a
   server-owned tenant subscribe_context. Preserve existing enabled subscribers.
2. Generate isolated hint-only contexts for primary + WebRTC devices; reconcile
   create/update/delete/bulk operations and startup/retry without reloading on reads.
3. Add a labelled BLF checkbox in endpoint Calls tab, remove managed raw fields.
4. Include required presence/dialog generators in box build/runtime profile.
5. Targeted isolation/lifecycle/UI tests, required lint/backend/frontend suites,
   build, commit/push, deploy and verify SIP SUBSCRIBE/NOTIFY and hint states live.

Acceptance: disabled subscriber cannot subscribe; enabled subscriber gets status
for own organization's extensions only; deleting device removes its hint; modules
and configuration survive restart. No DB migration or entitlement changes.

## Acceptance / evidence (2026-10-05)

Status: released / live-verified. Application commit/image: `571c691b`, main.
User follow-up: `t_komandor_0` was wrongly listed as a subscriber. Subscriber API
now filters primary IDs and rejects trunk detail/credentials/update/delete;
the trunk stays in Asterisk's shared ps_endpoints table and in Trunks UI.

- Targeted backend: 3 suites / 17 tests pass, including tenant policy, retries,
  deletion cleanup, trunk exclusion and ownership override.
- Endpoint form: 4 tests pass, explicit opt-in/disable payload and existing flag.
- Required lint: exit 0 (existing 115 backend / 87 frontend warnings, no errors).
- Full backend suite: exit 0 (376 suites; final source also passed CI).
- Full local frontend: exit 0, 300 files / 1606 tests, all eight Windows chunks.
- Both local builds pass; runtime images built from the committed source and
  an overlay of only owned compiled endpoint files. Dirty main.ts / 0031 excluded.
- All application CI workflows green: quality 37299370568, e2e 37299370503,
  harness 37299370621, Database contracts 37299370479 (MySQL/PostgreSQL).
- Runtime discovered certified-22 requires res_pjsip_outbound_publish as well;
  profile/build checks now include all ten required modules in both disk probes.
  Dependency and all body generators loaded without restarting Asterisk.
- Health ok; backend/frontend image 571c691b; rollback baseline saved in release.
- Real SIP loopback test on temporary 998901: REGISTER 200; dialog/presence
  SUBSCRIBE 200; NOTIFY terminated → early → confirmed; presence closed/open;
  AMI ringing=8, in-use=1, unavailable=4. Foreign hint (present in another context)
  rejected 404; disabled subscriber rejected 603; raw foreign context overridden.
  Unsubscribe 200; fixture deleted; foreign test file removed by trap. Final
  hints contain only 201/202 and no active test subscriptions remain.
- Live browser: two subscriber rows, no t_komandor_0; checkbox toggles both ways;
  form cancelled, existing subscriber permission left off. SIP+WebRTC aggregation
  tested at unit level; the live call used a SIP fixture, not a hardware BLF key.

Logs/screenshots: Documents/Codex/blf-*.log, blf-endpoint-settings.png,
endpoints-trunk-filter-live.png. No credentials in evidence.
Next action: no implementation work remaining; user can opt in a phone under
Subscribers → Edit → Pickup (Перехват) → BLF and use extension numbers as BLF keys.
