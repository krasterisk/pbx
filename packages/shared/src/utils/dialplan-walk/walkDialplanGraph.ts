import { DEFAULT_HOP_LIMIT } from '../dialplan-hops';
import type { WalkDialplanOptions, WalkDialplanResult } from './types';

/**
 * Cross-entity dry-run walker (D-43…D-47, D-38). Wave 0 stub — 14-04 greens the spec.
 * Hop accounting MUST import DEFAULT_HOP_LIMIT from the shared hop module.
 */
export function walkDialplanGraph(_options: WalkDialplanOptions): WalkDialplanResult {
  return {
    segments: [],
    breadcrumbs: [],
    hopsUsed: -1,
    hopLimit: DEFAULT_HOP_LIMIT,
    outcome: { kind: 'stub' },
  };
}
