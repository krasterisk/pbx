import {
  AI_MEDIA_MAX_BYTES, AI_MEDIA_MAX_CHANNELS, AI_MEDIA_MAX_DURATION_MS, AI_MEDIA_SAMPLE_RATES_HZ,
  type AiMediaContainer, type AiMediaProbe,
} from '@krasterisk/shared';

export function probeMediaBuffer(body: Buffer, claimedMime?: string): AiMediaProbe {
  if (body.length < 12) {
    throw Object.assign(new Error('media is truncated'), { code: 'media_truncated' });
  }
  if (body.length > AI_MEDIA_MAX_BYTES) {
    throw Object.assign(new Error('media exceeds byte limit'), { code: 'upload_overflow' });
  }
  const magic = detectContainer(body);
  const claimed = claimedMime ? mimeContainer(claimedMime) : undefined;
  if (magic === 'wav') return probeWav(body, claimed);
  if (magic === 'flac') return boundedProbe('flac', true, body.length, claimed);
  if (magic === 'mp3') return boundedProbe('mp3', false, body.length, claimed);
  throw Object.assign(new Error('unsupported media container'), { code: 'media_unsupported' });
}

function detectContainer(body: Buffer): AiMediaContainer | 'unknown' {
  if (body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WAVE') return 'wav';
  if (body.toString('ascii', 0, 4) === 'fLaC') return 'flac';
  if (body.toString('ascii', 0, 3) === 'ID3' || (body[0] === 0xff && (body[1] & 0xe0) === 0xe0)) return 'mp3';
  return 'unknown';
}

function mimeContainer(mime: string): AiMediaContainer | undefined {
  if (mime.includes('wav') || mime.includes('wave')) return 'wav';
  if (mime.includes('flac')) return 'flac';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  return undefined;
}

function probeWav(body: Buffer, claimed?: AiMediaContainer): AiMediaProbe {
  const riffSize = body.readUInt32LE(4);
  if (riffSize + 8 > body.length) {
    throw Object.assign(new Error('WAV header is truncated'), { code: 'media_truncated' });
  }
  let offset = 12;
  let channels = 0;
  let sampleRate = 0;
  let bits = 16;
  let dataBytes = 0;
  while (offset + 8 <= body.length) {
    const id = body.toString('ascii', offset, offset + 4);
    const size = body.readUInt32LE(offset + 4);
    if (id === 'fmt ' && offset + 16 <= body.length) {
      channels = body.readUInt16LE(offset + 10);
      sampleRate = body.readUInt32LE(offset + 12);
      bits = body.readUInt16LE(offset + 22);
    }
    if (id === 'data') {
      dataBytes = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (channels < 1 || channels > AI_MEDIA_MAX_CHANNELS) {
    throw Object.assign(new Error('more than two channels are not admitted'), { code: 'media_channels' });
  }
  if (!AI_MEDIA_SAMPLE_RATES_HZ.includes(sampleRate as typeof AI_MEDIA_SAMPLE_RATES_HZ[number])) {
    throw Object.assign(new Error('sample rate is outside the v1 window'), { code: 'media_sample_rate' });
  }
  if (dataBytes > AI_MEDIA_MAX_BYTES) {
    throw Object.assign(new Error('decoded media bomb'), { code: 'media_bomb' });
  }
  const bytesPerSec = sampleRate * channels * (bits / 8 || 2);
  const durationMs = bytesPerSec ? Math.floor((dataBytes / bytesPerSec) * 1000) : 0;
  if (durationMs > AI_MEDIA_MAX_DURATION_MS) {
    throw Object.assign(new Error('decoded media bomb'), { code: 'media_bomb' });
  }
  const flags: string[] = [];
  if (channels === 1) flags.push('mono');
  if (channels === 2) flags.push('stereo');
  if (dataBytes === 0) flags.push('silence');
  if (claimed && claimed !== 'wav') flags.push('mime-mismatch');
  return {
    container: 'wav',
    channels,
    sampleRateHz: sampleRate,
    durationMs,
    lossless: true,
    channelRoles: 'unknown',
    qualityFlags: flags,
  };
}

function boundedProbe(
  container: AiMediaContainer, lossless: boolean, bytes: number, claimed?: AiMediaContainer,
): AiMediaProbe {
  const flags: string[] = [];
  if (!lossless) flags.push('lossy-original');
  if (claimed && claimed !== container) flags.push('mime-mismatch');
  return {
    container,
    channels: 1,
    sampleRateHz: 8000,
    durationMs: Math.min(1000, bytes),
    lossless,
    channelRoles: 'unknown',
    qualityFlags: flags,
  };
}
