# Dialplan trunk names and CallerID name
Coordinator /root, codex-direct, baseline e41624e1. Existing dirty main.ts/0031 SQL excluded.
Plan D1 resolve trunk labels in step summaries and legacy selection; D2 optional per-trunk callerIdName, DTO/shared/UI/normalization/compiler, safe failover reset; D3 CallerID name in all modes and name-only without clearing number; D4 targeted regression, required lint/backend/frontend tests and builds, commit/push and production release/live UI check.
Owned files: dialplan-apps editor/schemas/trunk field/tests; shared directory/dialplan types; routes address DTO/tests; dialplan util/carousel util/tests; locales; this record. No migration/config/tenant changes.
Status in_progress. Next implement D1-D3.
D5 steering: route 614 invalid URI 10003; fix PJSIP request user syntax for single/list/failover/legacy and webhook destinations, regenerate production dialplan after release. Official reference: https://docs.asterisk.org/Configuration/Channel-Drivers/SIP/Configuring-res_pjsip/Dialing-PJSIP-Channels/
