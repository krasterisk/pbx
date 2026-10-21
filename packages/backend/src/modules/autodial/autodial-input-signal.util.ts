/** Managed PCM signal: gives Read a real prompt on PBX versions whose empty
 * prompt path returns before waiting for digits. Never used as a TTS fallback. */
export const AUTODIAL_INPUT_SIGNAL = 'krsk_ac_input_signal_v1';
export function autodialInputSignalWav(): Buffer {
  const samples = 1280, wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index++) {
    const envelope = Math.min(1, index / 80, (samples - index - 1) / 80);
    wav.writeInt16LE(Math.round(3000 * envelope * Math.sin(2 * Math.PI * 880 * index / 8000)), 44 + index * 2);
  }
  return wav;
}
