# Phase 9 — Deferred Items (out-of-scope, pre-existing)

Issues discovered during plan execution that are pre-existing and unrelated to the
current task's changes, per the executor's SCOPE BOUNDARY rule (only auto-fix issues
directly caused by the current task).

## From 09-01 (database + model foundation)

- `npx tsc -p packages/backend/tsconfig.json --noEmit` reports 7 errors in unrelated
  spec files (`call-groups.service.spec.ts`, `ivrs.service.spec.ts`,
  `keyword-matcher.service.spec.ts`) — confirmed present both before and after 09-01's
  changes.
- `npm run test:cc -w @krasterisk/backend` reports 1 failing test —
  `callcenter-chat.service.spec.ts › emitEvent ccChatMessage with recipientUserIds on
  direct send` (`sender_user_id: undefined` / `channel_key: "dm:NaN:NaN"` mismatch).
  Unrelated to models/migration work.

## From 09-02 (Tabs primitive + AgentStatus model foundation)

- `npx tsc --noEmit -p packages/frontend/tsconfig.json` reports 1 pre-existing error:
  `src/features/callcenter/model/slice/callCenterSlice.test.ts(123,64): error TS2322:
  Type 'null' is not assignable to type 'string | undefined'.` — the `pauseReason: null`
  literal on an existing (unmodified) test line predates this plan; confirmed via
  `git diff` that line 123 was not touched by 09-02. `updateAgent`'s payload type allows
  `pauseReason?: string` but the test passes `null` to exercise the slice's runtime
  `pauseReason === null` branch (SSE sends `null` on the wire). Logged, not fixed —
  belongs to whichever plan next touches `callCenterSlice.ts`'s action payload typing.

## From 09-07 (call-control set: park/conference/zombie-reset/warm-transfer/click-to-call)

- `npx jest --testPathPattern="modules/callcenter" --no-coverage` reports 1 pre-existing
  failure — the same `callcenter-chat.service.spec.ts › emitEvent ccChatMessage with
  recipientUserIds on direct send` mismatch logged under 09-01, confirmed still present
  and untouched by this plan's changes (`git log` shows the file was last modified by
  07-07, not by any 09-xx plan).
