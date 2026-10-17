import type { IQueueStats } from '../model/types/callCenterSchema';
import { abandonTone, slaTone, type KpiThresholds, type KpiTone } from './kpiThresholds';

export interface QueueTileMetrics {
  /** The queue has effective traffic today (short abandons do not count), so ratios mean something. */
  hasTraffic: boolean;
  longestWaitSec: number;
  waitTone: KpiTone;
  sla: number;
  slaTone: KpiTone;
  /** Abandon rate over effective offered calls, one decimal. */
  abandonPct: number;
  abandonTone: KpiTone;
  asaSec: number;
  ahtSec: number;
}

/** Wait tone: past max_wait_sec is critical, from 70% of it a warning, otherwise calm. */
export function waitTone(longestWaitSec: number, thresholds: KpiThresholds): KpiTone {
  if (longestWaitSec <= 0) return 'default';
  if (thresholds.maxWaitSec <= 0) return 'success';
  if (longestWaitSec > thresholds.maxWaitSec) return 'destructive';
  if (longestWaitSec >= thresholds.maxWaitSec * 0.7) return 'warning';
  return 'success';
}

export function queueTileMetrics(
  queue: IQueueStats,
  longestWaitSec: number,
  thresholds: KpiThresholds,
): QueueTileMetrics {
  const effectiveOffered = queue.calls.total - (queue.calls.shortAbandoned ?? 0);
  const hasTraffic = effectiveOffered > 0;
  const abandonPct = hasTraffic ? Math.round((queue.calls.abandoned / effectiveOffered) * 1000) / 10 : 0;
  return {
    hasTraffic,
    longestWaitSec,
    waitTone: waitTone(longestWaitSec, thresholds),
    sla: queue.sla,
    slaTone: hasTraffic ? slaTone(queue.sla, thresholds) : 'default',
    abandonPct,
    abandonTone: abandonTone(queue.calls.abandoned, effectiveOffered, thresholds),
    asaSec: Math.round(queue.avgWait),
    ahtSec: Math.round(queue.avgTalk),
  };
}
