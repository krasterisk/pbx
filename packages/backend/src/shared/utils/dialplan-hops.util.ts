/**
 * D-25: inherited hop counter across toroute / toivr.
 * Increment and guard MUST be emitted together (emitHopPrologue) so the
 * counter cannot grow without a check.
 *
 * Double underscore: a single-underscore channel var does not survive Goto
 * into another context, and the guard would silently reset.
 */

/** Inherited channel variable — the leading `__` is load-bearing. */
export const HOPS_VAR = '__KRSK_HOPS';

/**
 * Default hop budget. 10 is well above any meaningful IVR/route chain
 * (typically 2–4 hops) and well below the point where Asterisk starts
 * burning CPU on tight Goto loops.
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

export function emitHopIncrement(): string {
  return `Set(${HOPS_VAR}=$[\${${HOPS_VAR}} + 1])`;
}

export function emitHopGuard(onExceed: string): string {
  return [
    `GotoIf($[\${${HOPS_VAR}} <= ${DEFAULT_HOP_LIMIT}]?+3)`,
    `NoOp(KRSK hop limit exceeded)`,
    onExceed,
  ].join('\nsame => n,');
}

export function emitHopPrologue(
  gotoTarget: string,
  opts?: { onExceed?: string; routeId?: string },
): string {
  const onExceed = opts?.onExceed ?? 'Congestion()';
  const routeId = (opts?.routeId ?? gotoTarget).replace(/[(),?\[\]{}$\\";\n\r]/g, '').trim();
  return [
    emitHopIncrement(),
    `GotoIf($[\${${HOPS_VAR}} <= ${DEFAULT_HOP_LIMIT}]?${gotoTarget})`,
    `NoOp(KRSK hop limit exceeded route=${routeId})`,
    onExceed,
  ].join('\nsame => n,');
}
