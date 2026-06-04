import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { pcm16ToWav } from './ivr-pcm-wav.util';

@Injectable()
export class IvrTtsCustomProvider {
  private readonly logger = new Logger(IvrTtsCustomProvider.name);

  async synthesize(
    url: string,
    text: string,
    token: string | null | undefined,
    authMode: string | null | undefined,
    customHeaders: Record<string, string> | null | undefined,
    settings: Record<string, any>,
  ): Promise<Buffer> {
    if (!url?.trim()) {
      throw new Error('Custom TTS URL is not configured');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'audio/*,application/octet-stream',
      ...(customHeaders || {}),
    };

    if (token) {
      if (authMode === 'bearer') {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const response = await axios.post(
      url,
      { text, settings: settings || {} },
      {
        headers,
        timeout: settings?.timeout_ms || 30000,
        responseType: 'arraybuffer',
        validateStatus: (s) => s >= 200 && s < 300,
      },
    );

    let audio = Buffer.from(response.data);
    const contentType = String(response.headers['content-type'] || '');

    if (contentType.includes('wav') || audio.slice(0, 4).toString() === 'RIFF') {
      return audio;
    }

    // Raw PCM16 8kHz mono
    if (contentType.includes('pcm') || settings?.format === 'pcm16') {
      return pcm16ToWav(audio, 8000, 1);
    }

    // MP3 or unknown — return as-is (preview may still work in browser)
    return audio;
  }
}
