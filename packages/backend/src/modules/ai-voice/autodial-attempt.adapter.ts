import { createHash, randomUUID } from 'node:crypto';
import { DomainError } from './voice-engine';

export type AutodialVoiceOutcome =
  | 'completed' | 'transferred' | 'no_input' | 'runtime_failed' | 'cancelled';

export function linkAutodialAttempt(input: {
  seen: Map<string, { sessionId: string; outcome: AutodialVoiceOutcome | null }>;
  attemptUuid: string;
  sessionId?: string;
}): { sessionId: string; replay: boolean } {
  const existing = input.seen.get(input.attemptUuid);
  if (existing) return { sessionId: existing.sessionId, replay: true };
  if (!input.sessionId) throw new DomainError('attempt_session_required', 422);
  input.seen.set(input.attemptUuid, { sessionId: input.sessionId, outcome: null });
  return { sessionId: input.sessionId, replay: false };
}

export function completeAutodialAttempt(input: {
  seen: Map<string, { sessionId: string; outcome: AutodialVoiceOutcome | null }>;
  attemptUuid: string;
  outcome: AutodialVoiceOutcome;
  eventKey: string;
  events: Set<string>;
}): { replay: boolean } {
  const row = input.seen.get(input.attemptUuid);
  if (!row) throw new DomainError('attempt_not_linked', 404);
  const digest = createHash('sha256').update(`${input.attemptUuid}:${input.eventKey}`).digest('hex');
  if (input.events.has(digest)) return { replay: true };
  if (row.outcome && row.outcome !== input.outcome) {
    throw new DomainError('terminal_outcome_conflict', 409);
  }
  row.outcome = input.outcome;
  input.events.add(digest);
  return { replay: false };
}

export function newAttemptSessionId(): string {
  return randomUUID();
}
