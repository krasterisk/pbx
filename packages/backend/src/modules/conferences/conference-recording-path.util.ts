import * as fs from 'fs';
import * as path from 'path';

export function conferenceRecordingRel(
  vpbx: number,
  roomUid: number,
  meetingUid: number,
): string {
  return `${vpbx}/conferences/${roomUid}/${meetingUid}.wav`;
}

/**
 * Resolve a conference wav under records_base_path (D-30 / T-16.2-01).
 * Same `..` / startsWith guards as voicemail; never appends .mp3.
 */
export function safeConferenceRecordingPath(base: string, rel: string): string | null {
  const cleaned = String(rel ?? '').replace(/^\/+/, '').replace(/\\/g, '/');
  if (!cleaned || cleaned.includes('..') || path.isAbsolute(cleaned) || /^[A-Za-z]:/.test(cleaned)) {
    return null;
  }
  const baseResolved = path.resolve(base);
  const fileResolved = path.resolve(baseResolved, cleaned);
  const prefix = baseResolved.endsWith(path.sep) ? baseResolved : baseResolved + path.sep;
  if (fileResolved !== baseResolved && !fileResolved.startsWith(prefix)) return null;
  return fs.existsSync(fileResolved) ? fileResolved : null;
}
