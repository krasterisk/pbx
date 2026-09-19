/**
 * MixMonitor / ffmpeg helpers for route call recording.
 *
 * Stereo uses Asterisk MixMonitor option `D` (interleaved RX/TX channels).
 * Requires `.raw` extension — other extensions produce corrupted stereo output.
 */

export interface RouteRecordingOptions {
  record_all?: boolean;
  record_stereo?: boolean;
}

/** MixMonitor flags: `b` = record only when bridged; `D` = stereo interleaved. */
export function buildMixMonitorFlags(opts: RouteRecordingOptions): string {
  let flags = '';
  if (opts.record_all !== true) flags += 'b';
  if (opts.record_stereo === true) flags += 'D';
  return flags;
}

const UUID_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function durableCaptureFileBase(recordingUid: string): string {
  if (!UUID_FILE.test(recordingUid)) {
    throw new Error('durable capture filename must be a server UUID');
  }
  return recordingUid;
}

export function buildStopMixMonitor(recorderId: string): string {
  return `StopMixMonitor(${recorderId})`;
}

export function mixMonitorWithRecorderId(
  file: string, flags: string, recorderId: string, postprocess?: string,
): string {
  return `MixMonitor(${file},${flags},${postprocess ?? ''},${recorderId})`;
}

export function shouldRunLegacyFfmpegHangup(durableCapture: boolean): boolean {
  return !durableCapture;
}

export function getRecordingSourceExtension(stereo: boolean): 'wav' | 'raw' {
  return stereo ? 'raw' : 'wav';
}

/** ffmpeg command for MixMonitor postprocess (mono WAV → MP3). */
export function buildMonoFfmpegPostprocess(basePath: string): string {
  return `nice -n 10 /usr/bin/ffmpeg -y -i ${basePath}.wav -codec:a libmp3lame -b:a 32k -ar 8000 -ac 1 ${basePath}.mp3 -loglevel quiet && rm -f ${basePath}.wav`;
}

/** ffmpeg command for MixMonitor postprocess (stereo RAW → stereo MP3). */
export function buildStereoFfmpegPostprocess(basePath: string): string {
  return `nice -n 10 /usr/bin/ffmpeg -y -f s16le -ar 8000 -ac 2 -i ${basePath}.raw -codec:a libmp3lame -b:a 64k -ar 8000 -ac 2 ${basePath}.mp3 -loglevel quiet && rm -f ${basePath}.raw`;
}

export function buildFfmpegPostprocess(basePath: string, stereo: boolean): string {
  return stereo ? buildStereoFfmpegPostprocess(basePath) : buildMonoFfmpegPostprocess(basePath);
}
