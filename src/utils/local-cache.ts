import { CacheEntry } from '../types.js';

export class LocalCache {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly cacheTTL = 60000;

  public getCached<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  public setCached<T>(key: string, data: T, ttl: number = this.cacheTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }
}
