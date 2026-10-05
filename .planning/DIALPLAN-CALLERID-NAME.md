# Dialplan trunk names and CallerID name

Coordinator /root, codex-direct, baseline e41624e1. Existing dirty main.ts/0031 SQL excluded.
Plan D1 resolve trunk labels in step summaries and legacy selection; D2 optional per-trunk callerIdName in DTO/shared/UI/normalization/compiler, safe failover reset; D3 CallerID name in all modes and name-only without clearing number; D4 regression/tests/builds/commit/release/live UI; D5 route 614 invalid URI fix: PJSIP request user syntax for single/list/failover/legacy/webhook destinations and regenerate production dialplan.
Owned files: dialplan-apps editor/schemas/trunk field/tests; shared directory/dialplan types; routes address DTO/tests; dialplan util/carousel util/tests; locales; own records. No migration/config/tenant changes.

Status complete, implemented, automated-tests-passed, live-verified, released (2026-10-05). No remaining implementation/release actions.

## Implementation

Trunk step summary resolves actual catalog name; reference query runs only when a totrunk action exists. Select labels use names, values retain IDs. Legacy selections remain visible. Optional callerIdName per trunk works independently of static/directory/pool number modes; empty retains name entering the action. Multi-trunk attempts reset to that entry name before each override, preventing name leakage between providers. DTO rejects unsafe dialplan/list delimiters, compiler sanitizes direct input.
CallerID standalone name moved to primary parameters, available in every number mode. Name-only static action preserves number. Empty static action no longer clears number.
PJSIP dialing uses PJSIP/number@endpoint instead of endpoint/number (which treated the number as an invalid URI). Legacy PJSIP-prefixed IDs handled in canonical lists. Existing non-PJSIP legacy technology paths preserved.
References: https://docs.asterisk.org/Configuration/Channel-Drivers/SIP/Configuring-res_pjsip/Dialing-PJSIP-Channels/ and https://docs.asterisk.org/Latest_API/API_Documentation/Dialplan_Functions/CALLERID/

## Evidence / gates

- lint PASS locally (0 errors), final CI PASS.
- backend PASS final full npm run test:backend: 374 suites, 3560 tests; 11 existing skips.
- frontend PASS npm run test:frontend: 300 files, 1604 tests, exit 0. Targeted editor/field/schema checks: 44 passed.
- shared/backend/frontend builds PASS locally; production Linux frontend build PASS; existing Rollup chunk size/circular export warnings.
- GitHub Actions final bb4a0a2f: quality 37292336610, e2e 37292336739, harness 37292336662, Database contracts 37292336652 all completed success.
- Live UI PASS: route 614 action and select show komandor, CallerID name input editable; test value removed before save. Reopened saved form confirms original destination 10003 and empty name. Standalone CallerID keeps entered name when switching to directory mode (draft cancelled, no persisted route change).
- Live Asterisk PASS: after saving route 614, CLI shows Dial(PJSIP/10003@t_komandor_0,60,tT). PJSIP_DIAL_CONTACTS(t_komandor_0,,10003) resolves PJSIP/10003@t_komandor_0/sip:87.250.221.69. No actual outgoing call was initiated; answer/media not claimed.
- Release PASS: backend/frontend bb4a0a2f running, health ok, AMI/ARI connected, restart counts 0, deploymentMode box / registrationEnabled false preserved.

## Release and rollback

Commits 75a856f5 + bb4a0a2f pushed to krasterisk/pbx main. Release /opt/krasterisk/releases/bb4a0a2f. Backend based on prior 45b96197 with only three compiled owned replacements (dialplan.util.js, dialplan-trunk-carousel.util.js, address.params.dto.js) and matching source/shared types. Frontend image built from 75a856f5 and tagged bb4a0a2f; no frontend changes between commits. Dirty main.ts/0031 excluded. No migration / Asterisk process restart.
Prior source/tag saved in rollback-baseline.txt; deployment script rollback on health failure. Context file backed up at release/asterisk-backup/extensions_sip-out0.conf before regeneration; restore it and dialplan reload if rolling back generator.
Proof screenshot C:/Users/Professional/Documents/Codex/callerid-name-trunk-live.png. Test/build logs in C:/Users/Professional/Documents/Codex/caller-name-* and trunk-dial-syntax-*.
