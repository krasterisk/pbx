import type { CallRecord } from '@krasterisk/shared';

/** The AI view distinguishes a confirmed conversation from an estimated connection. */
export function callsAiTiming(call: Pick<CallRecord, 'outcome' | 'connectedSec' | 'timingSource'>) {
  const seconds = Number.isFinite(call.connectedSec) && Number(call.connectedSec) >= 0
    ? call.connectedSec : null;
  const conversationConfirmed = call.outcome === 'human';
  const precision = seconds == null ? 'unknown'
    : call.timingSource === 'cel' ? 'observed'
      : call.timingSource === 'cdr' ? 'estimated' : 'unknown';
  return {
    connectedSec: conversationConfirmed ? seconds : null,
    timingSource: call.timingSource ?? null,
    connectionTiming: {
      seconds,
      precision,
      conversationConfirmed,
      meaning: conversationConfirmed ? 'whole_call_human_connection' : 'connection_without_confirmed_human_outcome',
    },
  };
}
