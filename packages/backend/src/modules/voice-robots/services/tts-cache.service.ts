import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * TTS Audio Cache Service.
 *
 * Caches synthesized audio files on disk as G.711 A-law (8kHz) to avoid
 * redundant API calls for repeated phrases. Cache key is MD5 of the
 * composite string: text + voice + speed + engineType.
 *
 * Cache eviction: files older than `maxAgeDays` are removed.
 * If maxAgeDays === 0, files are kept indefinitely (unlimited mode).
 *
 * File naming: `<md5hash>.alaw`
 * Atomic writes: write to `.tmp` → rename (prevents torn reads)
 */
@Injectable()
export class TtsCacheService implements OnModuleInit {
  private readonly logger = new Logger(TtsCacheService.name);
  private readonly cacheDir: string;

  constructor() {
    // Place cache inside project's data directory
    this.cacheDir = path.join(process.cwd(), 'data', 'tts-cache');
  }

  async onModuleInit(): Promise<void> {
    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      this.logger.log(`Cache directory created: ${this.cacheDir}`);
    }

    const stats = this.getCacheStats();
    this.logger.log(
      `TTS cache initialized: ${stats.files} files, ${stats.totalSizeMB.toFixed(1)} MB`,
    );
  }

  /**
   * Generate an MD5-based cache key from synthesis parameters.
   * Deterministic: same text + voice + speed + engine always produces the same key.
   */
  getCacheKey(
    text: string,
    voice: string,
    speed: number,
    engineType: string,
  ): string {
    const composite = `${text}|${voice}|${speed}|${engineType}`;
    return crypto.createHash('md5').update(composite, 'utf8').digest('hex');
  }

  /**
   * Check if a cached file exists for the given key.
   */
  has(key: string): boolean {
    return fs.existsSync(this.getFilePath(key));
  }

  /**
   * Read cached A-law audio buffer from disk.
   * @throws if file does not exist (always check `has()` first)
   */
  get(key: string): Buffer {
    return fs.readFileSync(this.getFilePath(key));
  }

  /**
   * Store an A-law audio buffer in the cache.
   * Uses atomic write pattern: write to .tmp file → rename.
   * This prevents torn reads if another session is reading concurrently.
   */
  put(key: string, alawBuffer: Buffer): void {
    const filePath = this.getFilePath(key);
    const tmpPath = `${filePath}.tmp`;

    try {
      fs.writeFileSync(tmpPath, alawBuffer);
      fs.renameSync(tmpPath, filePath);
    } catch (err: any) {
      this.logger.error(`Failed to write cache file ${key}: ${err.message}`);
      // Cleanup temp file on failure
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch { /* ignore cleanup errors */ }
    }
  }

  /**
   * Remove cached files older than `maxAgeDays`.
   * If maxAgeDays === 0, no files are removed (unlimited retention).
   *
   * @returns number of files removed
   */
  evict(maxAgeDays: number): number {
    if (maxAgeDays <= 0) return 0; // 0 = unlimited, keep everything

    const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let removed = 0;

    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (!file.endsWith('.alaw')) continue;
        const filePath = path.join(this.cacheDir, file);

        try {
          const stat = fs.statSync(filePath);
          if (stat.mtimeMs < cutoffMs) {
            fs.unlinkSync(filePath);
            removed++;
          }
        } catch { /* ignore individual file errors */ }
      }
    } catch (err: any) {
      this.logger.error(`Cache eviction error: ${err.message}`);
    }

    if (removed > 0) {
      this.logger.log(`Cache eviction: removed ${removed} files older than ${maxAgeDays} days`);
    }

    return removed;
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): { files: number; totalSizeMB: number } {
    try {
      const files = fs.readdirSync(this.cacheDir).filter((f) => f.endsWith('.alaw'));
      let totalBytes = 0;

      for (const file of files) {
        try {
          const stat = fs.statSync(path.join(this.cacheDir, file));
          totalBytes += stat.size;
        } catch { /* ignore */ }
      }

      return { files: files.length, totalSizeMB: totalBytes / (1024 * 1024) };
    } catch {
      return { files: 0, totalSizeMB: 0 };
    }
  }

  /**
   * Resolve full file path for a cache key.
   */
  private getFilePath(key: string): string {
    return path.join(this.cacheDir, `${key}.alaw`);
  }
}
