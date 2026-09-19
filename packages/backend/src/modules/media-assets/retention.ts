import type { AssetState } from './asset-state-machine';

export function mayDeleteAsset(input: {
  state: AssetState;
  activeJobCount: number;
  now: Date;
  retentionAt: Date | null;
}): boolean {
  if (input.activeJobCount > 0) return false;
  if (input.state === 'ready' && input.retentionAt && input.retentionAt > input.now) return false;
  return input.state === 'ready' || input.state === 'failed' || input.state === 'quarantined';
}

export function expireUpload(expiresAt: Date, now: Date, leaseUntil: Date | null): 'expire' | 'hold' {
  if (leaseUntil && leaseUntil > now) return 'hold';
  return expiresAt <= now ? 'expire' : 'hold';
}
