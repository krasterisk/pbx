// Source: 13-RESEARCH.md (locked by D-71). Official RIFF allows extra chunks.
export function parseWavPcm16(buf: Buffer): { pcm: Buffer; sampleRate: number; channels: number } {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file');
  }
  let offset = 12, sampleRate = 0, channels = 0, bits = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === 'data') {
      if (bits !== 16) throw new Error(`Expected 16-bit PCM, got ${bits}`);
      return { pcm: buf.subarray(body, Math.min(body + size, buf.length)), sampleRate, channels };
    }
    offset = body + size + (size % 2);
  }
  throw new Error('No data chunk');
}
