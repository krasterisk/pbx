import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TtsCacheService } from './tts-cache.service';

/**
 * Unit tests for TtsCacheService.
 *
 * Uses a temporary directory for isolation — each test gets a fresh cache dir.
 */
describe('TtsCacheService', () => {
  let service: TtsCacheService;
  let tempDir: string;

  beforeEach(() => {
    // Create an isolated temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-cache-test-'));

    service = new TtsCacheService();
    // Override the private cacheDir to use our temp directory
    (service as any).cacheDir = tempDir;
  });

  afterEach(() => {
    // Cleanup temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  // ─── Cache Key Generation ────────────────────────────────

  describe('getCacheKey', () => {
    it('should generate deterministic MD5 key', () => {
      const key1 = service.getCacheKey('hello', 'filipp', 1.0, 'yandex');
      const key2 = service.getCacheKey('hello', 'filipp', 1.0, 'yandex');
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should generate different keys for different text', () => {
      const key1 = service.getCacheKey('hello', 'filipp', 1.0, 'yandex');
      const key2 = service.getCacheKey('goodbye', 'filipp', 1.0, 'yandex');
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different voice', () => {
      const key1 = service.getCacheKey('hello', 'filipp', 1.0, 'yandex');
      const key2 = service.getCacheKey('hello', 'alena', 1.0, 'yandex');
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different speed', () => {
      const key1 = service.getCacheKey('hello', 'filipp', 1.0, 'yandex');
      const key2 = service.getCacheKey('hello', 'filipp', 1.5, 'yandex');
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different engine types', () => {
      const key1 = service.getCacheKey('hello', 'filipp', 1.0, 'yandex');
      const key2 = service.getCacheKey('hello', 'filipp', 1.0, 'google');
      expect(key1).not.toBe(key2);
    });
  });

  // ─── Put / Has / Get ─────────────────────────────────────

  describe('put / has / get', () => {
    it('should store and retrieve a buffer', () => {
      const key = 'test_key_001';
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);

      service.put(key, buffer);

      expect(service.has(key)).toBe(true);
      const retrieved = service.get(key);
      expect(retrieved).toEqual(buffer);
    });

    it('should return false for non-existent key', () => {
      expect(service.has('nonexistent_key')).toBe(false);
    });

    it('should overwrite existing key', () => {
      const key = 'overwrite_key';
      const buffer1 = Buffer.from([0x01, 0x02]);
      const buffer2 = Buffer.from([0x03, 0x04, 0x05]);

      service.put(key, buffer1);
      service.put(key, buffer2);

      const retrieved = service.get(key);
      expect(retrieved).toEqual(buffer2);
    });

    it('should handle empty buffer', () => {
      const key = 'empty_buffer';
      const buffer = Buffer.alloc(0);

      service.put(key, buffer);
      expect(service.has(key)).toBe(true);
      expect(service.get(key).length).toBe(0);
    });

    it('should store as .alaw file', () => {
      const key = 'format_check';
      service.put(key, Buffer.from([0xFF]));

      const filePath = path.join(tempDir, `${key}.alaw`);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should use atomic write (no .tmp left behind)', () => {
      const key = 'atomic_check';
      service.put(key, Buffer.from([0x01]));

      const tmpPath = path.join(tempDir, `${key}.alaw.tmp`);
      expect(fs.existsSync(tmpPath)).toBe(false);
    });
  });

  // ─── Eviction ────────────────────────────────────────────

  describe('evict', () => {
    it('should remove files older than maxAgeDays', () => {
      const key = 'old_file';
      service.put(key, Buffer.from([0x01]));

      // Backdate the file to 10 days ago
      const filePath = path.join(tempDir, `${key}.alaw`);
      const oldTime = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      fs.utimesSync(filePath, oldTime, oldTime);

      const removed = service.evict(7); // Remove files older than 7 days
      expect(removed).toBe(1);
      expect(service.has(key)).toBe(false);
    });

    it('should keep files younger than maxAgeDays', () => {
      const key = 'fresh_file';
      service.put(key, Buffer.from([0x01]));

      const removed = service.evict(7);
      expect(removed).toBe(0);
      expect(service.has(key)).toBe(true);
    });

    it('should return 0 and delete nothing when maxAgeDays = 0 (unlimited)', () => {
      const key = 'unlimited_file';
      service.put(key, Buffer.from([0x01]));

      // Backdate the file to 365 days ago
      const filePath = path.join(tempDir, `${key}.alaw`);
      const oldTime = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      fs.utimesSync(filePath, oldTime, oldTime);

      const removed = service.evict(0); // Unlimited = don't delete anything
      expect(removed).toBe(0);
      expect(service.has(key)).toBe(true);
    });

    it('should only remove .alaw files', () => {
      // Create a non-alaw file
      const otherPath = path.join(tempDir, 'readme.txt');
      fs.writeFileSync(otherPath, 'test');
      const oldTime = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      fs.utimesSync(otherPath, oldTime, oldTime);

      const removed = service.evict(1);
      expect(removed).toBe(0);
      expect(fs.existsSync(otherPath)).toBe(true);
    });

    it('should handle mixed old and new files', () => {
      // Create 3 files: 2 old, 1 new
      for (const name of ['old1', 'old2', 'new1']) {
        service.put(name, Buffer.from([0x01]));
      }

      const oldTime = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      fs.utimesSync(path.join(tempDir, 'old1.alaw'), oldTime, oldTime);
      fs.utimesSync(path.join(tempDir, 'old2.alaw'), oldTime, oldTime);

      const removed = service.evict(30);
      expect(removed).toBe(2);
      expect(service.has('old1')).toBe(false);
      expect(service.has('old2')).toBe(false);
      expect(service.has('new1')).toBe(true);
    });
  });

  // ─── Cache Stats ─────────────────────────────────────────

  describe('getCacheStats', () => {
    it('should return correct file count and size', () => {
      service.put('file1', Buffer.alloc(1000));
      service.put('file2', Buffer.alloc(2000));

      const stats = service.getCacheStats();
      expect(stats.files).toBe(2);
      expect(stats.totalSizeMB).toBeCloseTo(3000 / (1024 * 1024), 3);
    });

    it('should return zeros for empty cache', () => {
      const stats = service.getCacheStats();
      expect(stats.files).toBe(0);
      expect(stats.totalSizeMB).toBe(0);
    });
  });
});
