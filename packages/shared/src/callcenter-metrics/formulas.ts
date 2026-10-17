import type { QueueTotals } from './aggregate';

export const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Offered calls that count in rate denominators: short abandons are excluded (R2), lost calls stay (R1). */
export function effectiveOffered(t: Pick<QueueTotals, 'offered' | 'shortAbandoned'>): number {
  return Math.max(0, t.offered - t.shortAbandoned);
}

/** SLA % = handled within threshold / (offered − short abandons). */
export function computeSla(t: Pick<QueueTotals, 'offered' | 'shortAbandoned' | 'handledInSl'>): number {
  const denom = effectiveOffered(t);
  return denom === 0 ? 0 : round1((t.handledInSl / denom) * 100);
}

/** Answer rate % = handled / (offered − short abandons). */
export function computeAnswerRate(t: Pick<QueueTotals, 'offered' | 'shortAbandoned' | 'handled'>): number {
  const denom = effectiveOffered(t);
  return denom === 0 ? 0 : round1((t.handled / denom) * 100);
}

/** Abandon % = abandoned (beyond short window) / (offered − short abandons). */
export function computeAbandonRate(t: Pick<QueueTotals, 'offered' | 'shortAbandoned' | 'abandoned'>): number {
  const denom = effectiveOffered(t);
  return denom === 0 ? 0 : round1((t.abandoned / denom) * 100);
}

/** ASA = Σ wait of handled / handled, seconds. */
export function computeAsa(t: Pick<QueueTotals, 'handled' | 'sumWaitHandled'>): number {
  return t.handled === 0 ? 0 : round1(t.sumWaitHandled / t.handled);
}

/**
 * AHT = (talk + wrapup) / handled, seconds.
 * `talk_time` is measured from answer to hangup and already includes customer hold,
 * so hold must NOT be added again.
 */
export function computeAht(t: Pick<QueueTotals, 'handled' | 'sumTalkHandled' | 'sumWrapupHandled'>): number {
  return t.handled === 0 ? 0 : round1((t.sumTalkHandled + t.sumWrapupHandled) / t.handled);
}

/** Transfer rate % = transferred / handled. */
export function computeTransferRate(t: Pick<QueueTotals, 'handled' | 'transferred'>): number {
  return t.handled === 0 ? 0 : round1((t.transferred / t.handled) * 100);
}

/** Occupancy % = (talk + wrapup) / (talk + wrapup + ready idle). */
export function computeOccupancy(a: { talkSec: number; wrapupSec: number; idleSec: number }): number {
  const busy = Math.max(0, a.talkSec) + Math.max(0, a.wrapupSec);
  const denom = busy + Math.max(0, a.idleSec);
  return denom === 0 ? 0 : round1((busy / denom) * 100);
}

/** Utilization % = busy time / time logged in. Busy already includes talk, hold, wrap-up and dialing. */
export function computeUtilization(busySec: number, loggedInSec: number): number {
  const denom = Math.max(0, loggedInSec);
  return denom === 0 ? 0 : round1((Math.max(0, busySec) / denom) * 100);
}

/** Pause share % = pause time / time logged in. */
export function computePauseShare(pauseSec: number, loggedInSec: number): number {
  const denom = Math.max(0, loggedInSec);
  return denom === 0 ? 0 : round1((Math.max(0, pauseSec) / denom) * 100);
}

/** Answer rate of an operator % = handled calls / (handled + ring-no-answer offers). */
export function computeAgentAnswerRate(handled: number, offered: number): number {
  const denom = Math.max(0, offered);
  return denom === 0 ? 0 : round1((Math.max(0, handled) / denom) * 100);
}

/** Handled calls per logged-in hour. */
export function computeCallsPerHour(handled: number, loggedInSec: number): number {
  if (loggedInSec <= 0) return 0;
  return round1(Math.max(0, handled) / (loggedInSec / 3600));
}

/** Short conversations % = short handled calls / handled calls. */
export function computeShortCallRate(shortCalls: number, handled: number): number {
  const denom = Math.max(0, handled);
  return denom === 0 ? 0 : round1((Math.max(0, shortCalls) / denom) * 100);
}

/** Mean seconds per handled call; 0 when nothing was handled. */
export function meanSeconds(sumSec: number, handled: number): number {
  return handled > 0 ? Math.round(Math.max(0, sumSec) / handled) : 0;
}

export interface QueueMetricsView {
  sla: number;
  asr: number;
  aht: number;
  asa: number;
  abandonRate: number;
  offered: number;
  answered: number;
  abandoned: number;
  shortAbandoned: number;
  transferred: number;
  maxWait: number;
}

/** The single projection every screen uses. `answered` is kept as the wire name for handled. */
export function buildQueueMetricsView(t: QueueTotals): QueueMetricsView {
  return {
    sla: computeSla(t),
    asr: computeAnswerRate(t),
    aht: computeAht(t),
    asa: computeAsa(t),
    abandonRate: computeAbandonRate(t),
    offered: t.offered,
    answered: t.handled,
    abandoned: t.abandoned,
    shortAbandoned: t.shortAbandoned,
    transferred: t.transferred,
    maxWait: t.maxWait,
  };
}
