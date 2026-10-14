import { Injectable } from '@nestjs/common';

/** Bounded LRU + single flight: simultaneous viewers never fan out an expensive read. */
@Injectable()
export class DashboardCacheService {
  private readonly entries = new Map<string, { value: unknown; expires: number; bytes: number }>();
  private readonly flights = new Map<string, Promise<unknown>>();
  private bytes = 0;
  private readonly maxEntries = 256;
  private readonly maxBytes = 16 * 1024 * 1024;

  async get<T>(key: string, ttlMs: number, loader: () => Promise<T>, stale?: (value: T, error: unknown) => T): Promise<T> {
    const cached = this.entries.get(key);
    if (cached && cached.expires > Date.now()) {
      this.entries.delete(key); this.entries.set(key, cached);
      return cached.value as T;
    }
    if (cached) this.remove(key);
    const running = this.flights.get(key);
    if (running) return running as Promise<T>;
    const promise = loader().catch((error) => {
      if (cached && stale) return stale(cached.value as T, error);
      throw error;
    }).then((value) => {
      const bytes = Buffer.byteLength(JSON.stringify(value));
      if (bytes <= this.maxBytes) {
        this.remove(key);
        this.entries.set(key, { value, bytes, expires: Date.now() + ttlMs });
        this.bytes += bytes;
        while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
          this.remove(this.entries.keys().next().value!);
        }
      }
      return value;
    }).finally(() => this.flights.delete(key));
    this.flights.set(key, promise);
    return promise;
  }
  invalidate(prefix?: string): void {
    if (!prefix) { this.entries.clear(); this.bytes = 0; return; }
    for (const key of this.entries.keys()) if (key.startsWith(prefix)) this.remove(key);
  }
  private remove(key: string): void {
    const entry = this.entries.get(key);
    if (entry) { this.bytes -= entry.bytes; this.entries.delete(key); }
  }
}
