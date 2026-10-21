# R7O6 — shared softphone and native CDR/CEL, 2026-10-21

Same coordinator/thread 01a14cff-e054-7ba0-931d-95fd94bfb3e8, codex-direct, PLAN R7O continuation. No subagents or cross-chat coordination. No robot/provider models or CC shift lifecycle changes.

## Implemented

- Extracted existing CC SoftphoneWidget presentation into shared/ui/SoftphoneWidget, with CC compatibility adapter and injected journal/contacts/conference/persistence. Shared audio-device hook, keypad, DTMF and quality indicator; ordinary PhoneSessionHost reuses the widget and its existing transport/session service. Incoming calls close the working-number settings modal. No second ordinary dial/answer UI.
- Subscriber-to-subscriber channels take precedence over a shared sip-out context: native WebRTC202→201 is internal, both parties employees.
- Local ignored .env now explicitly configures DASHBOARD_CDR_TIMEZONE=Europe/Moscow, matching PBX +0300 MSK. Other env entries preserved.
- Found real MySQL TIMESTAMP conversion defect after enabling CEL: DB session UTC text was interpreted again as MSK. New cel-timestamp.ts inspects native column type and serializes MySQL TIMESTAMP/PostgreSQL timestamptz as explicit UTC; DATETIME/timestamp-without-zone retain configured source wall time. Used in both business evidence and journey enrichment. Semantics version6 triggers existing bounded retrofit. Schema lookup cached per reader, retries after failures.

## Authorized global PBX change — live verified

User explicitly approved CDR/CEL on ipbx.krasterisk.ru. Applied 2026-10-21T03:52Z, no Asterisk restart, checked no active channels before changes/reloads.

- cdr.conf: unanswered=yes. Does not alter congestion policy.
- cel.conf: enabled bounded route event/application list, no DTMF events, no apps=all.
- cel_odbc.conf: existing connection krasterisk, table cel.
- Native CreateConfig + UpdateConfig produced server backups with comments retained and effective config hashes verified. These are native serialized backups, not byte-identical copies:
  - cdr.conf.cdr-v12-20261021035200453.bak
  - cel.conf.cdr-v12-20261021035200453.bak
  - cel_odbc.conf.cdr-v12-20261021035200453.bak
- Reload cel_odbc.so, cel, cdr each succeeded. Status confirms unanswered logging Yes, CEL Enabled, ODBC CEL backend registered, existing krasterisk connection active.
- R7O6-LOGGING-APPLIED.json contains exact settings, before/after hashes, backup names and status responses. First backup attempt failed because UpdateConfig requires an existing destination; no live files changed then. Corrected to exclusive CreateConfig before native copy. SSH agent key rejected; audit key subsequently succeeded. No security settings changed.
- Rollback if needed: native UpdateConfig from each named backup to its original file, Reload=no, verify effective config against recorded pre-change hash, then reload cel_odbc.so/cel/cdr during idle. Do not restore unrelated settings or restart PBX.

## Native calls and metrics

- Before CEL: successful linkedid1792554194.10, native CDR11555, duration21/billsec10. User explicitly confirmed call passed. Previous unaccepted attempt1792553736.9 retained separately; 201 was not called on that attempt.
- After CEL and a fresh warning before201: successful linkedid1792554743.14, native CDR11556, duration19/billsec9, ANSWERED. Both SIP legs Up/in same bridge, normal cause16; 15 actual CEL rows persisted, including BRIDGE_ENTER/EXIT and LINKEDID_END. R7O6-NATIVE-CALL.json and R7O6-NATIVE-CDR.json.
- CEL proves destination201 conversation03:52:38Z–03:52:43Z, 5s. CDR billsec9 also covers 4s between source202 answer and201 answer in this click-to-call topology. CDR end at03:52:42Z differs from CEL exit by1s; source clocks/granularity preserved, no invented precision.
- R7O6-NATIVE-PREVIEW.json: current compiled production projection functions, actual SQL/enrichment, read-only calculation produces internal calls and correct UTC journey. First call's completion/answer supplied from successful AMI trace for this preview; this is explicitly not a persisted projection or HTTP/browser gate.
- Final short unanswered-only202 test could not establish a channel: Originate Failure0/<unknown>. R7O6-UNANSWERED.json retains failure. No native unattended-write PASS claimed; configuration status and successful-call CEL writes passed. No201 invoked for that test.

## Checks

- Frontend targeted shared/CC/ordinary tests: 48 passed before final settings-modal regression; final affected two suites18 passed (49 unique covered tests). Frontend tsc and targeted ESLint passed. CC shift/session/journal/contact/consultation regressions included in prior48.
- Backend final7 suites101 tests passed: classifier, facts, route, enrichment, CEL timestamp, projection, completion. Earlier44 mock failures and2 hardcoded semantics-v4 expectations corrected; version assertions now follow exported version. Final alias-only schema-query change:6 timestamp tests and lint passed.
- Backend noEmit build and targeted ESLint passed; initial full emit build before timestamp fix passed. Active watcher emitted final timestamp helper/version6, and its actual MySQL expression returned03:52:24.000000Z for first CEL event. This does not prove the already running process reloaded modules.
- Owned diff-check passed. Full root lint/backend/frontend suites not freshly rerun for this slice; historical broad checks are not relabelled final release acceptance.

## Pending / precise next action

1. Persisted call_facts still contains pre-fix00:52 CEL journey while start is03:52. The normal ipbx projection lease is actively owned; bounded refresh script correctly refused to steal it (EXISTING_PROJECTION_OWNER_ACTIVE). Running5010 process22668 is a Nest watch child19092/21028, not former owned19680. Not killed. Verify/update that running projector's loaded code; let semantics:v6 retrofit finish, then rerun r7o6-cdr-read.cjs and assert no00:52 entries. Preview is not this PASS.
2. Actual browser management remains policy-blocked on stale3526 error tab; no workaround or new automated DOM PASS. User manually registered202 and confirmed successful earlier call. Journal/card visual/current ACL/audio-quality acceptance remains separate. No bidirectional RTP measurement (RTPqos null).
3.203 absent in admin/tenant0; do not use tenant358 homonyms. Retest202 registration before further dialing; always warn before any possible201 ring.
4. Eight historical semantic-search misses and full release gates remain outside this native acceptance slice. CDR milestone/release not marked complete.

Scripts are bounded to recorded own native calls. r7o6-refresh-native.cjs default uses normal projection lease; --preview is read-only. Do not force lease ownership, delete source rows, or repeat model/STT corpus runs for this issue. Main frontend left available; no own model/QA test workers left after checks.
