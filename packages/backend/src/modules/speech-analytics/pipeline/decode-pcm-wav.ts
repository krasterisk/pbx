import { execFile } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function isPcmWav(buffer: Buffer): boolean {
  return buffer.length >= 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WAVE';
}

/** Stereo PCM WAV for energy diarization. MP3/OGG/M4A are decoded with ffmpeg when it is installed. */
export async function decodeToPcmWav(filePath: string): Promise<Buffer | null> {
  const out = `${filePath}.diarize.wav`;
  try {
    await execFileAsync(
      'ffmpeg',
      ['-y', '-i', filePath, '-ac', '2', '-ar', '16000', '-f', 'wav', out],
      { timeout: 60_000, windowsHide: true },
    );
    return await readFile(out);
  } catch {
    return null;
  } finally {
    await unlink(out).catch(() => undefined);
  }
}
