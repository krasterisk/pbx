export function pcmWav(options: {
  channels: 1 | 2;
  sampleRate: number;
  samples: number;
  amplitude?: number;
}): Buffer {
  const { channels, sampleRate, samples } = options;
  const amplitude = options.amplitude ?? 0;
  const dataBytes = samples * channels * 2;
  const body = Buffer.alloc(44 + dataBytes);
  body.write('RIFF', 0);
  body.writeUInt32LE(36 + dataBytes, 4);
  body.write('WAVE', 8);
  body.write('fmt ', 12);
  body.writeUInt32LE(16, 16);
  body.writeUInt16LE(1, 20);
  body.writeUInt16LE(channels, 22);
  body.writeUInt32LE(sampleRate, 24);
  body.writeUInt32LE(sampleRate * channels * 2, 28);
  body.writeUInt16LE(channels * 2, 32);
  body.writeUInt16LE(16, 34);
  body.write('data', 36);
  body.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples * channels; i += 1) {
    body.writeInt16LE(amplitude, 44 + i * 2);
  }
  return body;
}

export function truncatedWav(): Buffer {
  const full = pcmWav({ channels: 1, sampleRate: 8000, samples: 8000, amplitude: 100 });
  full.writeUInt32LE(50_000_000, 4);
  return full.subarray(0, 60);
}

export function threeChannelWav(): Buffer {
  const body = pcmWav({ channels: 2, sampleRate: 8000, samples: 40, amplitude: 1 });
  body.writeUInt16LE(3, 22);
  return body;
}

export function silenceWav(): Buffer {
  return pcmWav({ channels: 1, sampleRate: 8000, samples: 0, amplitude: 0 });
}
