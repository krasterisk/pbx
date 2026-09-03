/**
 * Shared hop budget — must stay byte-identical to
 * packages/backend/src/shared/utils/dialplan-hops.util.ts
 * (DEFAULT_HOP_LIMIT + resolveHopDecision). Shared cannot import backend.
 */

export const DEFAULT_HOP_LIMIT = 10;

export type HopDecision = 'goto' | 'exceed';

/** Same arithmetic as the emitted dialplan: missing var = 0. */
export function resolveHopDecision(
  incoming: number | undefined,
  limit: number = DEFAULT_HOP_LIMIT,
): HopDecision {
  const next = (incoming ?? 0) + 1;
  return next > limit ? 'exceed' : 'goto';
}
