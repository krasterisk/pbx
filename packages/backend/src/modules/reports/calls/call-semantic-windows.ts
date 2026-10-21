import { createHash } from 'node:crypto';
import { callTranscriptSpeaker } from './call-transcript-speaker';
import { chunkText } from '../../knowledge/knowledge-engine';

export interface SemanticSegment {
  id: string;
  ordinal: number | string;
  start_ms: number | string;
  end_ms: number | string;
  speaker_role: string;
  text: string;
  transcript_id: string;
}
export interface SemanticWindow {
  callId: string;
  nodeId: string;
  runId: string;
  transcriptId: string;
  segmentId: string;
  startMs: number;
  endMs: number;
  speaker: 'client' | 'employee' | 'unknown';
  text: string;
  contentHash: string;
  truncated?: boolean;
}
export function semanticWindows(
  callId: string,
  nodeId: string,
  runId: string,
  transcriptId: string,
  segments: SemanticSegment[],
): SemanticWindow[] {
  type Word = { text: string; segment: SemanticSegment };
  const buckets = new Map<number, Word[]>();
  for (const segment of segments) {
    const key = Math.floor(Number(segment.start_ms) / 45000);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(
      ...segment.text
        .slice(0, 5000)
        .split(/\s+/u)
        .filter(Boolean)
        .map((text) => ({ text, segment })),
    );
  }
  const windows: SemanticWindow[] = [];
  let overlap: Word[] = [];
  for (const [, value] of [...buckets].sort(([a], [b]) => a - b)) {
    const firstAt = Number(value[0]?.segment.start_ms || 0);
    const words = [
      ...overlap.filter(
        (word) => firstAt - Number(word.segment.start_ms) <= 15000,
      ),
      ...value,
    ];
    for (const piece of chunkText(
      words.map((word) => word.text).join(' '),
      180,
      24,
    )) {
      const selected = words.slice(
          piece.ordinal * 156,
          piece.ordinal * 156 + 180,
        ),
        first = selected[0]?.segment,
        last = selected.at(-1)?.segment;
      if (!first || !last) continue;
      const text = piece.text.slice(0, 4000);
      const contentHash = createHash('sha256')
        .update(
          JSON.stringify([
            'cdr-window-v1',
            selected.map((w) => [
              w.segment.id,
              w.segment.ordinal,
              w.segment.start_ms,
              w.segment.end_ms,
              w.segment.speaker_role,
              w.text,
            ]),
          ]),
        )
        .digest('hex');
      windows.push({
        callId,
        nodeId,
        runId,
        transcriptId,
        segmentId: first.id,
        startMs: Number(first.start_ms),
        endMs: Number(last.end_ms),
        speaker: callTranscriptSpeaker(first.speaker_role),
        text,
        contentHash,
        truncated: piece.text.length > 4000,
      });
    }
    overlap = value.slice(-24);
  }
  return [
    ...new Map(windows.map((window) => [window.contentHash, window])).values(),
  ];
}
