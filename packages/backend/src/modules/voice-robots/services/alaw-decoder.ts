// Alaw to PCM16 Decodation Table
// Standard implementation based on ITU-T G.711

const alawToLinearTable = new Int16Array(256);

for (let i = 0; i < 256; i++) {
  let val = i ^ 0x55;
  let t = (val & 0x0f) << 4;
  const seg = (val & 0x70) >> 4;
  switch (seg) {
    case 0:
      t += 8;
      break;
    case 1:
      t += 0x108;
      break;
    default:
      t += 0x108;
      t <<= (seg - 1);
      break;
  }
  alawToLinearTable[i] = (val & 0x80) ? t : -t;
}

/**
 * Decodes G.711 A-law Buffer to a raw 16-bit PCM Buffer.
 */
export function decodeAlawToPcm16(alawBuffer: Buffer): Buffer {
  const pcmBuffer = Buffer.alloc(alawBuffer.length * 2);
  for (let i = 0; i < alawBuffer.length; i++) {
    const pcmSample = alawToLinearTable[alawBuffer[i]];
    pcmBuffer.writeInt16LE(pcmSample, i * 2);
  }
  return pcmBuffer;
}

/**
 * Decodes G.711 A-law Buffer directly into a Float32Array
 * with samples normalized between -1.0 and 1.0 (Required for ONNX/VAD).
 */
export function decodeAlawToFloat32Array(alawBuffer: Buffer): Float32Array {
  const floatArray = new Float32Array(alawBuffer.length);
  for (let i = 0; i < alawBuffer.length; i++) {
    const pcmSample = alawToLinearTable[alawBuffer[i]];
    floatArray[i] = pcmSample / 32768.0;
  }
  return floatArray;
}
