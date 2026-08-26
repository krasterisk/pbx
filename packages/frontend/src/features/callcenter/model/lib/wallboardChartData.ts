/** Timestamp + cumulative calls.total across all queues at sample time. */
export type CallSample = { t: number; total: number };

/**
 * Append a sample and trim to maxSamples (oldest first).
 * Pure - returns a new array.
 */
export function pushSample(
  samples: CallSample[],
  sample: CallSample,
  maxSamples = 240,
): CallSample[] {
  const next = [...samples, sample];
  if (next.length <= maxSamples) return next;
  return next.slice(next.length - maxSamples);
}

/**
 * Bucket cumulative-counter samples into 24 hourly deltas (calls/hour).
 * Negative deltas (midnight counter reset) are treated as 0.
 * Always returns exactly 24 buckets { hour: 0..23, calls }.
 * Pure - does not call Date.now().
 */
export function bucketHourlyDeltas(
  samples: CallSample[],
): { hour: number; calls: number }[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, calls: 0 }));

  if (samples.length < 2) return buckets;

  const sorted = [...samples].sort((a, b) => a.t - b.t);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const rawDelta = curr.total - prev.total;
    const delta = rawDelta < 0 ? 0 : rawDelta;
    if (delta === 0) continue;
    const hour = new Date(curr.t).getHours();
    buckets[hour].calls += delta;
  }

  return buckets;
}
