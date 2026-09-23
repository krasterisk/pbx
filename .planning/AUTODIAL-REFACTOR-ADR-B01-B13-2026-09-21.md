# ADR B01–B13 — autodial refactor

Date: 2026-09-21. Status: accepted for the current runtime. These are behavioural decisions already encoded in autodial code; they are not a GSD STATE close and not a production rollout.

Runtime versions actually used: Asterisk `certified-22.8-cert2` on `ipbx.krasterisk.ru`; Nest autodial module in this worktree. Asterisk 22 is not declared the only supported version.

## B01 `queue_names`

**Decision:** Scenario steps route the call. Campaign `queue_names` are the operator-capacity pool and a legacy fallback only for bare `toqueue` without a fixed target.

**Consequence:** Save/start reject `toqueue` without a fixed queue. Disabled `toqueue` steps do not block agentless drafts.

## B02 Empty vs all-disabled schedule

**Decision:** Empty schedule list = unconstrained 24/7. At least one row exists and every row is disabled = closed for new originates.

**Consequence:** Existing campaigns that stored disabled rows as “open” now stay closed until an enabled window exists. Empty list is still implicit 24/7, not a separate explicit mode flag.

## B03 Invalid timezone

**Decision:** Reject save/start for a non-IANA zone. Runtime with a corrupt zone closes the row instead of substituting UTC.

**Consequence:** Legacy aliases that the OS IANA database still knows remain selectable. Lost/invalid zones need an operator fix; no silent UTC.

## B04 Subscriber hours

**Decision:** Before originate, compare the phone `tz_offset_min` to the campaign’s enabled schedule windows. Empty schedule does not invent 09:00–20:00.

**Consequence:** Outside the window the task returns to `pending` without burning an attempt. Source of hours is campaign schedule, not a hidden default.

## B05 AMD voicemail

**Decision:** `on_machine=voicemail` is a real machine tail: WaitForSilence pocket, tenant prompt Playback, CURL `outcome=voicemail`, Hangup. Missing media or unloaded `app_amd` blocks start.

**Consequence:** Isolated Local probe on ipbx: `AMD=MACHINE`, `TRYSTATUS=SUCCESS`, `Playback(beep)`. Campaign-path Prompts file plus attempt row remain a separate live gate.

## B06 Short conversation

**Decision:** `success_min_sec` is time after answer, not agent talk. Abandoned predictive uses missing `MEMBERINTERFACE`.

**Consequence:** Reports still expose one success threshold. A separate agent-talk metric is not a first-class column.

## B07 Stop

**Decision:** Stop/pause halt new originates. `leased` returns to `pending`. `dialing` is not requeued by age.

**Consequence:** Live channels finish through the normal finalize path. Immediate kill of in-flight calls is a different action and is not Stop.

## B08 Editing a used base

**Decision:** Field/phone identity is a stable UID. Delete/replace of a phone, contact, or base that tasks still reference is rejected.

**Consequence:** No automatic retargeting of existing tasks. Orphan `ac_attempts` after campaign hard-delete stay a retention-policy question.

## B09 DNC in the campaign form

**Decision:** Campaign form shows inherited global/base DNC read-only. Only campaign-local rows are deletable there. Global add/delete needs confirmation in the DNC panel.

**Consequence:** Cancelling a campaign draft does not roll back DNC writes. Default new row scope is local when a campaign context exists.

## B10 Retry interval 0

**Decision:** `0` is stored as zero, not coalesced to default. Empty means default.

**Consequence:** Zero still goes through scheduler, DNC, and max-attempts. It does not mean “retry immediately ignoring those gates”.

## B11 CID / carousel

**Decision:** Per-trunk CID (static, pool, directory+fallback) with a legacy campaign-wide adapter. Technical failover legs are extra originates inside one attempt for originate errors only. Busy/no_answer stay on retry.

**Consequence:** Opening a form does not rewrite old `cid_policy`. Isolated SIP CallerID on loopback is proven; a provider may still override From.

## B12 Unsupported scenario step

**Decision:** Capability gate rejects unknown/uncompilable steps on save/start. Compiler may still emit NoOp as a last-resort guard so an unknown type cannot drop the call silently.

**Consequence:** Read/edit of a legacy campaign remains possible; start fails with `AC_SCENARIO_*`. Dynamic queue targets are not guessed.

## B13 Defaults and search

**Decision:** New-record defaults apply only to creates. Opening an old campaign does not normalize stored zeros/empties into new defaults.

**Consequence:** Contact search stays a dedicated control with debounce/page clamp. 1k import-preview is timed; 10k JSON body currently hits HTTP 413 against the 20 MiB DTO cap.
