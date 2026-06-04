import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class IvrTtsCacheService {
  private readonly logger = new Logger(IvrTtsCacheService.name);
  private readonly cacheDir: string;

  constructor(private readonly config: ConfigService) {
    this.cacheDir =
      this.config.get<string>('IVR_TTS_CACHE_DIR')
      || path.join(process.env.TMPDIR || '/tmp', 'krasterisk-ivr-tts');
  }

  /**
   * Writes WAV bytes and returns path suitable for Asterisk Background().
   * Path is absolute under cache dir; deployment must mount cache for Asterisk.
   */
  writeWav(
    vpbxUserUid: number,
    cacheKey: string,
    wavBuffer: Buffer,
  ): string {
    const dir = path.join(this.cacheDir, String(vpbxUserUid));
    fs.mkdirSync(dir, { recursive: true });

    const hash = crypto.createHash('sha256').update(cacheKey).digest('hex').slice(0, 24);
    const filePath = path.join(dir, `${hash}.wav`);
    fs.writeFileSync(filePath, wavBuffer);

    return filePath;
  }

  static buildCacheKey(parts: Record<string, unknown>): string {
    return JSON.stringify(parts);
  }
}
