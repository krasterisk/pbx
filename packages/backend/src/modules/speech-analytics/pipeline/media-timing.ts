import { createHash } from 'node:crypto';
import type { SttSegment } from './run-analysis';

export function boundSttToMedia(
  source: SttSegment[],
  mediaDurationMs?: number,
) {
  if (
    !source.length ||
    source.some(
      (s) =>
        !Number.isFinite(s.start) ||
        !Number.isFinite(s.end) ||
        s.start < 0 ||
        s.end < s.start ||
        typeof s.text !== 'string',
    )
  )
    throw new Error('invalid_stt_timing');
  const verified =
    typeof mediaDurationMs === 'number' &&
    Number.isFinite(mediaDurationMs) &&
    mediaDurationMs > 0;
  if (!verified) return { segments: source, evidence: [] };
  const changes: Array<{
    ordinal: number;
    originalStartSec: number;
    originalEndSec: number;
    startSec: number | null;
    endSec: number | null;
    excludedText?: string;
  }> = [];
  const duration = mediaDurationMs / 1000;
  const segments = source.flatMap((s, ordinal) => {
    if (s.start >= duration) {
      changes.push({
        ordinal,
        originalStartSec: s.start,
        originalEndSec: s.end,
        startSec: null,
        endSec: null,
        excludedText: s.text,
      });
      return [];
    }
    if (s.end > duration) {
      changes.push({
        ordinal,
        originalStartSec: s.start,
        originalEndSec: s.end,
        startSec: s.start,
        endSec: duration,
      });
      return [{ ...s, end: duration }];
    }
    return [s];
  });
  if (!segments.length) throw new Error('stt_outside_media');
  return {
    segments,
    evidence: changes.length
      ? [
          {
            kind: 'media_bounds',
            mediaDurationMs,
            sourceDigest: createHash('sha256')
              .update(JSON.stringify(source))
              .digest('hex'),
            changes,
          },
        ]
      : [],
  };
}
