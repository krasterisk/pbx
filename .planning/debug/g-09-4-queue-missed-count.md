---
status: confirmed
bug_class: Bohrbug
phase: 09-call-center-agent-panel
created: 2026-07-23T11:30:00Z
updated: 2026-07-23T11:35:00Z
---

# G-09-4: Queue missed_count / RONA never fires on caller hangup

## Symptom

Configured `missed_count = 3`, made 3 calls into queue 700 and hung up before answer — operator never paused.

## Root cause

1. **No queue RINGING path:** `AgentCalled` / `AgentRingNoAnswer` were not forwarded from `AmiService` to `CallCenterAmiService`. Queue offer often never set agent to `RINGING` before `QueueCallerAbandon`.
2. **`evaluateOnMissed` only on personal DialEnd/Hangup** — abandon only called `evaluateRonaOnAbandon`, which filters `status === 'RINGING'`, so both RONA and missed_count no-oped.
3. **Product clash:** always-on RONA at 1 would make `missed_count > 1` unreachable on the queue path once RINGING worked.

## Fix

- Forward `agentcalled` / `agentringnoanswer` → handlers.
- On abandon: snapshot RINGING → `evaluateOnMissed` + RONA; READY if still ringing.
- When `missed_count` exists, skip RONA (threshold owns queue-miss pause).
- **Follow-up:** AgentCalled must update the Join call (not create destuniqueid orphan — Waiting duplicate). AgentRingNoAnswer must run RONA while still RINGING (hangup/RNA often clears RINGING before Abandon).

## Retest

1. Restart backend (AMI listeners bind at connect).
2. Operator on shift in `q700_<tenant>`.
3. Call queue, **wait until softphone rings**, hang up; repeat 3× → pause after 3rd.
4. Hangup **before** ring (still WAITING) does not count.
