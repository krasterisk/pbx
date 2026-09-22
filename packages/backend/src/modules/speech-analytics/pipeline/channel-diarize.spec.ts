import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  UPLOAD_CHANNEL_MAP,
  ROUTE_CHANNEL_MAP,
  resolveChannelMap,
  diarizeChannels,
  channelsAreIdentical,
  labelSegmentsByChannelEnergy,
} from './channel-diarize';

function makeStereoWav(leftSamples: number[], rightSamples: number[], sampleRate = 8000): Buffer {
  const n = Math.min(leftSamples.length, rightSamples.length);
  const dataSize = n * 4;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(leftSamples[i], 44 + i * 4);
    buf.writeInt16LE(rightSamples[i], 44 + i * 4 + 2);
  }
  return buf;
}

function makeMonoWav(samples: number[], sampleRate = 8000): Buffer {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(samples[i], 44 + i * 2);
  }
  return buf;
}

describe('channel-diarize (D-23, D-24)', () => {
  it('locks route and upload channel maps (D-24)', () => {
    expect(ROUTE_CHANNEL_MAP).toEqual({ left: 'customer', right: 'operator' });
    expect(UPLOAD_CHANNEL_MAP).toEqual({ left: 'operator', right: 'customer' });
    expect(resolveChannelMap('route', false)).toEqual(ROUTE_CHANNEL_MAP);
    expect(resolveChannelMap('upload', false)).toEqual(UPLOAD_CHANNEL_MAP);
    expect(resolveChannelMap('upload', true)).toEqual({ left: 'customer', right: 'operator' });
  });

  it('classifies identical left/right channels as not stereo', () => {
    const identical = Array.from({ length: 4000 }, () => 1200);
    const wav = makeStereoWav(identical, identical);
    expect(channelsAreIdentical(wav)).toBe(true);

    const outcome = diarizeChannels({
      segments: [{ start: 0, end: 0.5, text: 'hello' }],
      stereoWav: wav,
      channels: 2,
      stereoVerified: true,
      channelSource: 'upload',
      swapChannels: false,
    });
    expect(outcome.mode).toBe('not_stereo');
    expect(outcome.requestSecondStt).toBe(false);
    expect(outcome.segments.every((s) => s.roleSource === 'llm')).toBe(true);
  });

  it('energy failure assigns LLM roles on the same transcript without a second STT', () => {
    const outcome = diarizeChannels({
      segments: [
        { start: 0, end: 1, text: 'operator line' },
        { start: 1, end: 2, text: 'customer line' },
      ],
      stereoWav: null,
      channels: 2,
      stereoVerified: true,
      channelSource: 'route',
      swapChannels: false,
      energyFailed: true,
    });
    expect(outcome.mode).toBe('llm_roles');
    expect(outcome.requestSecondStt).toBe(false);
    expect(outcome.segments).toHaveLength(2);
    expect(outcome.segments.every((s) => s.roleSource === 'llm')).toBe(true);
  });

  it('labels segments by channel energy with the upload map', () => {
    const sr = 8000;
    const left = [
      ...Array.from({ length: sr }, () => 8000),
      ...Array.from({ length: sr }, () => 100),
    ];
    const right = [
      ...Array.from({ length: sr }, () => 100),
      ...Array.from({ length: sr }, () => 8000),
    ];
    const turns = labelSegmentsByChannelEnergy(
      [
        { start: 0.1, end: 0.9, text: 'Hello' },
        { start: 1.1, end: 1.9, text: 'Hi there' },
      ],
      makeMonoWav(left, sr),
      makeMonoWav(right, sr),
      UPLOAD_CHANNEL_MAP,
    );
    expect(turns.map((t) => t.speaker)).toEqual(['operator', 'customer']);
  });

  it('does not export a dual-stt code path', () => {
    const src = fs.readFileSync(path.join(__dirname, 'channel-diarize.ts'), 'utf8');
    expect(src).not.toMatch(/dual[-_]?stt/i);
    expect(src).not.toMatch(/\bexport\s+(async\s+)?function\s+mergeChannelTranscripts\b/);
    const mod = require('./channel-diarize') as Record<string, unknown>;
    expect(mod).not.toHaveProperty('dualStt');
    expect(mod).not.toHaveProperty('parseStereoDiarizeMode');
  });
});
