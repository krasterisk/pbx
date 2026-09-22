/**
 * Channel energy diarize — one STT pass + L/R energy roles (D-23, D-24).
 * Independent per-channel recognition is intentionally not offered.
 */

import { randomUUID } from 'node:crypto';

export type DiarizationSpeaker = 'operator' | 'customer';
export type StereoChannelMap = { left: DiarizationSpeaker; right: DiarizationSpeaker };
export type StereoSide = 'left' | 'right';

export type SttSegment = { start: number; end: number; text: string };

export type DiarizedTurn = {
  speaker: DiarizationSpeaker;
  text: string;
  start?: number;
  end?: number;
};

export type DiarizedSegment = {
  id: string;
  ordinal: number;
  startMs: number;
  endMs: number;
  channel: number;
  speakerRole: 'operator' | 'customer' | 'unknown';
  roleSource: 'channel_energy' | 'llm' | 'unknown';
  text: string;
};

export type DiarizeChannelsInput = {
  segments: SttSegment[];
  stereoWav: Buffer | null;
  channels: 1 | 2;
  stereoVerified: boolean;
  channelSource: 'route' | 'upload';
  swapChannels: boolean;
  /** Test / probe hook: force energy path failure → LLM roles on same transcript. */
  energyFailed?: boolean;
};

export type DiarizeChannelsResult = {
  mode: 'energy' | 'llm_roles' | 'not_stereo';
  segments: DiarizedSegment[];
  requestSecondStt: boolean;
};

/** MixMonitor `D` on routes: left = customer, right = operator (D-24). */
export const ROUTE_CHANNEL_MAP: StereoChannelMap = { left: 'customer', right: 'operator' };

/** Upload / API default: left = operator, right = customer (D-24, aiPBX DEFAULT_MAP). */
export const UPLOAD_CHANNEL_MAP: StereoChannelMap = { left: 'operator', right: 'customer' };

const FAKE_STEREO_CORRELATION = 0.95;
const DEFAULT_COALESCE_GAP_SEC = 0.75;

export function resolveChannelMap(
  source: 'route' | 'upload',
  swap: boolean,
): StereoChannelMap {
  if (source === 'route') {
    return { ...ROUTE_CHANNEL_MAP };
  }
  if (swap) {
    return { left: UPLOAD_CHANNEL_MAP.right, right: UPLOAD_CHANNEL_MAP.left };
  }
  return { ...UPLOAD_CHANNEL_MAP };
}

type WavHeader = {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataOffset: number;
  dataSize: number;
};

function looksLikeWav(buffer: Buffer): boolean {
  return buffer.length >= 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WAVE';
}

export function probeWavHeader(buffer: Buffer): WavHeader | null {
  if (buffer.length < 44 || !looksLikeWav(buffer)) return null;
  const channels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);
  if (!channels || !sampleRate || !bitsPerSample) return null;

  let dataOffset = 44;
  let dataSize = 0;
  for (let i = 12; i < Math.min(buffer.length - 8, 512);) {
    const chunkId = buffer.toString('ascii', i, i + 4);
    const chunkSize = buffer.readUInt32LE(i + 4);
    if (chunkId === 'data') {
      dataOffset = i + 8;
      dataSize = chunkSize;
      break;
    }
    i += 8 + chunkSize + (chunkSize % 2);
  }
  if (!dataSize) dataSize = Math.max(0, buffer.length - dataOffset);
  return { channels, sampleRate, bitsPerSample, dataOffset, dataSize };
}

/**
 * Near-identical L/R PCM → not real stereo (D-23).
 * Correlation ≥ 0.95 or both near-silent → identical.
 */
export function channelsAreIdentical(buffer: Buffer): boolean {
  const header = probeWavHeader(buffer);
  if (!header || header.channels !== 2 || header.bitsPerSample !== 16) return false;

  const bytesPerFrame = 4;
  const totalFrames = Math.floor(header.dataSize / bytesPerFrame);
  if (totalFrames < 100) return false;

  const step = Math.max(1, Math.floor(totalFrames / 4000));
  let n = 0;
  let sumL = 0;
  let sumR = 0;
  let sumLL = 0;
  let sumRR = 0;
  let sumLR = 0;

  for (let frame = 0; frame < totalFrames; frame += step) {
    const off = header.dataOffset + frame * bytesPerFrame;
    if (off + 4 > buffer.length) break;
    const l = buffer.readInt16LE(off);
    const r = buffer.readInt16LE(off + 2);
    sumL += l;
    sumR += r;
    sumLL += l * l;
    sumRR += r * r;
    sumLR += l * r;
    n += 1;
  }
  if (n < 50) return false;

  const meanL = sumL / n;
  const meanR = sumR / n;
  const varL = sumLL / n - meanL * meanL;
  const varR = sumRR / n - meanR * meanR;
  const cov = sumLR / n - meanL * meanR;
  const denom = Math.sqrt(Math.max(varL, 0) * Math.max(varR, 0));
  if (denom < 1e-6) return true;
  return cov / denom >= FAKE_STEREO_CORRELATION;
}

function wrapPcm16MonoWav(pcm: Buffer, sampleRate: number): Buffer {
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

/** Interleaved PCM16 stereo WAV → two mono WAV buffers. */
export function splitWavPcmStereo(buffer: Buffer): { left: Buffer; right: Buffer } | null {
  const header = probeWavHeader(buffer);
  if (!header || header.channels !== 2 || header.bitsPerSample !== 16) return null;

  const frameCount = Math.floor(header.dataSize / 4);
  const leftPcm = Buffer.alloc(frameCount * 2);
  const rightPcm = Buffer.alloc(frameCount * 2);
  for (let i = 0; i < frameCount; i++) {
    const off = header.dataOffset + i * 4;
    leftPcm.writeInt16LE(buffer.readInt16LE(off), i * 2);
    rightPcm.writeInt16LE(buffer.readInt16LE(off + 2), i * 2);
  }
  return {
    left: wrapPcm16MonoWav(leftPcm, header.sampleRate),
    right: wrapPcm16MonoWav(rightPcm, header.sampleRate),
  };
}

export function pcm16MonoRms(wav: Buffer, startSec: number, endSec: number): number {
  const header = probeWavHeader(wav);
  if (!header || header.channels !== 1 || header.bitsPerSample !== 16) return 0;
  if (!header.sampleRate || header.dataSize < 2) return 0;

  const startSample = Math.max(0, Math.floor(startSec * header.sampleRate));
  const endSample = Math.min(
    Math.floor(header.dataSize / 2),
    Math.ceil(Math.max(endSec, startSec + 0.02) * header.sampleRate),
  );
  if (endSample <= startSample) return 0;

  let sumSq = 0;
  let n = 0;
  const step = Math.max(1, Math.floor((endSample - startSample) / 8000));
  for (let i = startSample; i < endSample; i += step) {
    const sample = wav.readInt16LE(header.dataOffset + i * 2);
    sumSq += sample * sample;
    n += 1;
  }
  return n > 0 ? Math.sqrt(sumSq / n) : 0;
}

export function coalesceAdjacentTurns(
  turns: DiarizedTurn[],
  gapSec: number = DEFAULT_COALESCE_GAP_SEC,
): DiarizedTurn[] {
  const out: DiarizedTurn[] = [];
  for (const turn of turns) {
    const text = turn.text.trim();
    if (!text) continue;
    const prev = out[out.length - 1];
    const gap = prev?.end != null && turn.start != null ? turn.start - prev.end : 0;
    const canMerge = Boolean(prev && prev.speaker === turn.speaker && gap <= gapSec);
    if (canMerge && prev) {
      prev.text = `${prev.text} ${text}`.replace(/\s+/g, ' ').trim();
      if (turn.end != null) prev.end = turn.end;
    } else {
      out.push({ speaker: turn.speaker, text, start: turn.start, end: turn.end });
    }
  }
  return out;
}

/**
 * Label mono-STT segments by which stereo channel is louder in each window.
 * Keeps chronology; speakers come from L/R energy (D-23).
 */
export function labelSegmentsByChannelEnergy(
  segments: SttSegment[],
  leftWav: Buffer,
  rightWav: Buffer,
  channelMap: StereoChannelMap = UPLOAD_CHANNEL_MAP,
  options?: { minRatio?: number },
): DiarizedTurn[] {
  const minRatio = options?.minRatio ?? 1.15;
  const turns: DiarizedTurn[] = [];

  for (const seg of segments) {
    const text = String(seg.text || '').trim();
    if (!text) continue;
    const start = Number(seg.start) || 0;
    const end = Math.max(Number(seg.end) || start + 0.05, start + 0.05);
    const leftRms = pcm16MonoRms(leftWav, start, end);
    const rightRms = pcm16MonoRms(rightWav, start, end);

    let side: StereoSide;
    if (leftRms <= 0 && rightRms <= 0) {
      side = 'left';
    } else if (leftRms >= rightRms * minRatio) {
      side = 'left';
    } else if (rightRms >= leftRms * minRatio) {
      side = 'right';
    } else {
      side = leftRms >= rightRms ? 'left' : 'right';
    }

    turns.push({
      speaker: channelMap[side],
      text,
      start,
      end,
    });
  }

  return coalesceAdjacentTurns(turns);
}

function turnsToSegments(
  turns: DiarizedTurn[],
  roleSource: DiarizedSegment['roleSource'],
  channelMap: StereoChannelMap,
): DiarizedSegment[] {
  return turns.map((t, i) => ({
    id: randomUUID(),
    ordinal: i,
    startMs: Math.round((t.start ?? 0) * 1000),
    endMs: Math.round((t.end ?? t.start ?? 0) * 1000),
    channel: t.speaker === channelMap.left ? 0 : 1,
    speakerRole: t.speaker,
    roleSource,
    text: t.text,
  }));
}

function llmRoleSegments(segments: SttSegment[]): DiarizedSegment[] {
  return segments.map((s, i) => ({
    id: randomUUID(),
    ordinal: i,
    startMs: Math.round((s.start || 0) * 1000),
    endMs: Math.round((s.end || 0) * 1000),
    channel: 0,
    speakerRole: 'unknown' as const,
    roleSource: 'llm' as const,
    text: s.text,
  }));
}

/**
 * Stereo: energy roles on the existing transcript. Identical L/R → not stereo → LLM roles.
 * Energy failure → LLM roles on the same transcript. Never requests a second STT (D-23).
 */
export function diarizeChannels(input: DiarizeChannelsInput): DiarizeChannelsResult {
  const map = resolveChannelMap(input.channelSource, input.swapChannels);
  const noSecond: DiarizeChannelsResult = {
    mode: 'llm_roles',
    segments: llmRoleSegments(input.segments),
    requestSecondStt: false,
  };

  if (input.channels !== 2 || !input.stereoVerified) {
    return noSecond;
  }

  if (input.energyFailed || !input.stereoWav) {
    return noSecond;
  }

  if (channelsAreIdentical(input.stereoWav)) {
    return {
      mode: 'not_stereo',
      segments: llmRoleSegments(input.segments),
      requestSecondStt: false,
    };
  }

  const split = splitWavPcmStereo(input.stereoWav);
  if (!split || input.segments.length === 0) {
    return noSecond;
  }

  const turns = labelSegmentsByChannelEnergy(
    input.segments,
    split.left,
    split.right,
    map,
  );
  if (turns.length === 0) {
    return noSecond;
  }

  return {
    mode: 'energy',
    segments: turnsToSegments(turns, 'channel_energy', map),
    requestSecondStt: false,
  };
}
