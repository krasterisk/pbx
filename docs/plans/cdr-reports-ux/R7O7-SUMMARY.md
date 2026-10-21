# R7O7 — единый телефон и сохранённая история, 2026-10-21

Coordinator: same /root, thread01a14cff-e054-7ba0-931d-95fd94bfb3e8, codex-direct, canonical PLAN R7O. No agents or cross-chat coordination. Existing dirty baseline preserved. No CC shift lifecycle, robot models or provider changes.

## Implemented

- One shared SoftphoneWidget: inline number/device selection and switching, common dialpad and audio controls, ordinary CDR journal and shared tenant contacts. Desktop uses the existing popover; no separate ordinary settings Sheet. Mobile retains the common widget's responsive container.
- Server checks live channels, leases, CC occupancy and enabled WebRTC companion; SIP mode additionally requires a reachable registered endpoint. Fresh availability before atomic acquisition; switching failure preserves the previous session. Endpoint search handles the actual tenant's large directory.
- Browser Web Lock retries after HMR/previous-owner release, without creating another transport. Recovery fetches current credentials for the connected number. Credentials remain in memory.
- Bounded microphone acquisition:15s timeout, actionable device/permission message, late microphone tracks stopped after timeout or session cancellation. Reuses SIP.js/CC shared transport, no new implementation of SIP.
- Native persisted CDR records reprojected under the normal projection lease. MySQL/CEL timestamp correction now observed in stored facts and actual browser card.
- Removed repeated labels such as202 ·202. Long route-coverage explanation moved into a tooltip with a short visible status.

## Live evidence

Actual full application localhost3010, admin tenant0, actual PBX and configured SQL; not a preview fixture.

1. WebRTC202 registration, inline switching WebRTC202 → SIP201 → WebRTC202, ordinary journal and contacts observed in browser. SIP selection only offered the actual registered201; WebRTC offered enabled202. No call during switching.
2. Journal uses authorized CDR API and opens its actual call card. Contacts search201 returns internal201,1201 and shared contact Иван201; buttons enabled through the current phone session.
3. Initial202→201 attempt did not send INVITE; user confirmed no ring and SQL showed no new CDR. Media preparation had remained pending; cancellation was followed by `Peer connection undefined`. No unsupported claim that permission was explicitly denied.
4. After media became available, actual USB/audio device labels appeared. Bounded factory installed; WebRTC test connected with RTCP metrics. **Dialing202 was routed by the PBX to PJSIP/e201_0** (raw dst202, actual destination201). This routing was discovered afterward; future202 tests must also be treated as possible desk201 calls and warned beforehand. Do not assume self-dial is isolated. No PBX forwarding configuration changed.
5. Explicitly warned immediately before the subsequent202→201 test. User confirmed «Да, зазвонил». UI showed connected audio metrics and hangup returned it to idle. This proves ringing and an established WebRTC session; human two-way audibility was not separately attested.
6. CDR11558/linkedid1792560766.50: start05:32:46Z, bridge05:32:49Z, end05:32:55Z; duration9s, connected6s, wait3s,15 CEL events. Existing projection stored internal/human and the matching route. Browser card shows the same sequence and durations; title receives focus. Evidence: [native SQL](../../../.artifacts/legacy/.planning/cdr-reports-ux/R7O7-NEW-NATIVE-CDR.json), [final card](../../../.artifacts/legacy/.planning/cdr-reports-ux/R7O7-native-card-final.png), [inline selector](../../../.artifacts/legacy/.planning/cdr-reports-ux/R7O7-inline-selection.png), [contacts](../../../.artifacts/legacy/.planning/cdr-reports-ux/R7O7-contacts-final.png).
7. Earlier native calls reprojected without stealing an active lease: [R7O7-NATIVE-CDR](../../../.artifacts/legacy/.planning/cdr-reports-ux/R7O7-NATIVE-CDR.json). Historical one-second CDR/CEL boundary granularity is retained rather than silently rewriting source facts.

## Automated checks and limits

- Current phone backend32 tests PASS. Earlier frozen eight-suite CDR/phone regression132 PASS; later backend delta is the reachable-SIP availability guard and its passing focused test.
- Current frontend35 unique focused tests PASS: host15, contacts/journal3, CC widget8, media access4, phone actions4, route1. Media timeout/late-cancellation cases tested without model/network calls. CC shift behavior not altered.
- Final current-source frontend `tsc --noEmit -p packages/frontend/tsconfig.json` PASS, including media cancellation and route/number copy changes. Scoped lint PASS with two existing `disconnectInternal` dependency warnings; cosmetic final delta lint PASS. Diff check PASS.
- Both frozen full-repository lint and frontend/backend types PASS. Full backend:4969 passed,9 failed,27 conditional skips; failures were the snapshot's missing standalone scenario examples and missing curl. These two suites were replayed on Windows with actual existing fixtures/tools:13 PASS. The original full command remains recorded as FAIL.
- Both full frontend attempts reached20min runner timeout, with three failures in `pages/RegisterPage/RegisterPage.test.tsx` also observed. No fresh all-green full frontend/release claim. Logs/commands/results: [CI receipt](../../../.artifacts/legacy/.planning/cdr-reports-ux/R7O7-CI-COLLECT.json), [later root frontend receipt](../../../.artifacts/legacy/.planning/cdr-reports-ux/R7O7-FINAL-COLLECT.json). These are frozen snapshots; focused late changes above are separate evidence.
- Both owned LAN CI containers and checked /var/tmp roots removed after completion; cleanup receipts retained. Foreign resources untouched. Browser viewport reset; user tab left open on actual card. No active test call remains.

## Remaining / next action

Phone selection/switching, contacts/journal and native persisted-history browser gates are now live-verified within the cases above. **Whole CDR/release is not accepted.** Remaining: finish full frontend regression (diagnose registration failures and timeout separately), review eight semantic-search misses against saved real-call sources and trustworthy date labels, and verify unanswered-attempt native recording. Human two-way audio and mobile physical-device audio remain separate acceptance items. Reuse saved SA outputs; no repeat full STT/LLM corpus or extra201 calls without a new purpose and warning. Do not edit robot/provider models or CC shift lifecycle.
