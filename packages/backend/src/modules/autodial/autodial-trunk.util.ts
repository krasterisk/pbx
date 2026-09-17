import type { IAutodialCidPolicy, IAutodialTrunkPoolItem } from '@krasterisk/shared';

export interface AutodialDialTarget {
  trunkId: string;
  callerId: string | null;
  /** PJSIP dial string used verbatim by ARI */
  endpoint: string;
}

/**
 * Weighted round-robin across the campaign's trunks. `cursor` is the campaign's
 * running attempt counter, which keeps the rotation stable across restarts
 * without extra state.
 */
export function selectAutodialTrunk(
  pool: IAutodialTrunkPoolItem[],
  cidPolicy: IAutodialCidPolicy,
  number: string,
  cursor: number,
): AutodialDialTarget | null {
  const usable = (pool ?? []).filter((t) => !!t.trunk_id);
  if (!usable.length) return null;

  const expanded: IAutodialTrunkPoolItem[] = [];
  for (const item of usable) {
    const weight = Math.max(1, Math.min(64, item.weight ?? 1));
    for (let i = 0; i < weight; i++) expanded.push(item);
  }

  const picked = expanded[Math.abs(cursor) % expanded.length];
  return {
    trunkId: picked.trunk_id,
    callerId: resolveCallerId(cidPolicy, picked, cursor),
    endpoint: `PJSIP/${number}@${picked.trunk_id}`,
  };
}

function resolveCallerId(
  policy: IAutodialCidPolicy,
  trunk: IAutodialTrunkPoolItem,
  cursor: number,
): string | null {
  switch (policy?.mode) {
    case 'static':
      return policy.value?.trim() || null;
    case 'rotate': {
      const pool = (policy.pool ?? []).filter((v: string) => !!v.trim());
      if (!pool.length) return policy.value?.trim() || null;
      return pool[Math.abs(cursor) % pool.length];
    }
    case 'per_trunk':
    default:
      return trunk.caller_id?.trim() || policy?.value?.trim() || null;
  }
}
