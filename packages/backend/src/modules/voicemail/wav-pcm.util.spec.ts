import { parseWavPcm16 } from './wav-pcm.util';

function buildWav(opts: {
  sampleRate?: number;
  channels?: number;
  bits?: number;
  pcm?: Buffer;
  extraChunksBeforeData?: { id: string; body: Buffer }[];
  riffId?: string;
  waveId?: string;
  omitData?: boolean;
  dataSizeOverride?: number;
}): Buffer {
  const sampleRate = opts.sampleRate ?? 8000;
  const channels = opts.channels ?? 1;
  const bits = opts.bits ?? 16;
  const pcm = opts.pcm ?? Buffer.from([0x00, 0x00, 0x01, 0x00]);
  const fmtBody = Buffer.alloc(16);
  fmtBody.writeUInt16LE(1, 0);
  fmtBody.writeUInt16LE(channels, 2);
  fmtBody.writeUInt32LE(sampleRate, 4);
  fmtBody.writeUInt32LE(sampleRate * channels * (bits / 8), 8);
  fmtBody.writeUInt16LE(channels * (bits / 8), 12);
  fmtBody.writeUInt16LE(bits, 14);

  const chunks: Buffer[] = [];
  const pushChunk = (id: string, body: Buffer) => {
    const hdr = Buffer.alloc(8);
    hdr.write(id.padEnd(4, ' ').slice(0, 4), 0, 4, 'ascii');
    hdr.writeUInt32LE(body.length, 4);
    const pad = body.length % 2 ? Buffer.from([0]) : Buffer.alloc(0);
    chunks.push(hdr, body, pad);
  };

  pushChunk('fmt ', fmtBody);
  for (const extra of opts.extraChunksBeforeData ?? []) {
    pushChunk(extra.id, extra.body);
  }
  if (!opts.omitData) {
    const hdr = Buffer.alloc(8);
    hdr.write('data', 0, 4, 'ascii');
    hdr.writeUInt32LE(opts.dataSizeOverride ?? pcm.length, 4);
    chunks.push(hdr, pcm);
  }

  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write((opts.riffId ?? 'RIFF').slice(0, 4).padEnd(4, ' '), 0, 4, 'ascii');
  header.writeUInt32LE(body.length + 4, 4);
  header.write((opts.waveId ?? 'WAVE').slice(0, 4).padEnd(4, ' '), 8, 4, 'ascii');
  return Buffer.concat([header, body]);
}

describe('parseWavPcm16 (D-71)', () => {
  it('returns pcm, sampleRate, and channels for a minimal 16-bit mono 8 kHz RIFF', () => {
    const pcm = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]);
    const parsed = parseWavPcm16(buildWav({ pcm, sampleRate: 8000, channels: 1, bits: 16 }));
    expect(parsed.sampleRate).toBe(8000);
    expect(parsed.channels).toBe(1);
    expect(Buffer.from(parsed.pcm)).toEqual(pcm);
  });

  it('walks RIFF chunks so a LIST chunk before data still returns the PCM payload', () => {
    const pcm = Buffer.from([0x11, 0x22, 0x33, 0x44]);
    const listBody = Buffer.alloc(24, 0x7f);
    const buf = buildWav({
      pcm,
      extraChunksBeforeData: [{ id: 'LIST', body: listBody }],
    });
    const parsed = parseWavPcm16(buf);
    expect(Buffer.from(parsed.pcm)).toEqual(pcm);
    expect(parsed.pcm.equals(listBody.subarray(0, 4))).toBe(false);
  });

  it('returns the fmt sampleRate instead of assuming 8000', () => {
    const parsed = parseWavPcm16(buildWav({ sampleRate: 16000, bits: 16 }));
    expect(parsed.sampleRate).toBe(16000);
  });

  it('throws when bits is not 16', () => {
    expect(() => parseWavPcm16(buildWav({ bits: 8 }))).toThrow(/16-bit PCM/);
  });

  it('throws when the data chunk is missing', () => {
    expect(() => parseWavPcm16(buildWav({ omitData: true }))).toThrow(/No data chunk/);
  });

  it('clamps a truncated data size to the buffer length', () => {
    const pcm = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const parsed = parseWavPcm16(buildWav({ pcm, dataSizeOverride: 100 }));
    expect(parsed.pcm.length).toBe(pcm.length);
    expect(Buffer.from(parsed.pcm)).toEqual(pcm);
  });

  it('throws for non-RIFF and non-WAVE buffers', () => {
    expect(() => parseWavPcm16(buildWav({ riffId: 'XXXX' }))).toThrow(/Not a RIFF\/WAVE/);
    expect(() => parseWavPcm16(buildWav({ waveId: 'XXXX' }))).toThrow(/Not a RIFF\/WAVE/);
    expect(() => parseWavPcm16(Buffer.from('short'))).toThrow(/Not a RIFF\/WAVE/);
  });
});
