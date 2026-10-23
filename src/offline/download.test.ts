import { describe, expect, it } from 'vitest';
import { AUDIO_CACHE } from './cache.ts';
import {
  audioUrls,
  clearAudio,
  downloadAudio,
  offlineStatus,
  type AudioCache,
  type AudioCacheStorage,
  type FetchFn,
} from './download.ts';

/** Stores by pathname and returns absolute keys, like the real Cache. */
class MemoryCache implements AudioCache {
  readonly entries = new Map<string, Response>();
  keys() {
    return Promise.resolve(
      [...this.entries.keys()].map((url) => ({ url: `https://x.test${url}` })),
    );
  }
  put(url: string, response: Response) {
    this.entries.set(new URL(url, 'https://x.test').pathname, response);
    return Promise.resolve();
  }
  delete(url: string) {
    return Promise.resolve(this.entries.delete(new URL(url, 'https://x.test').pathname));
  }
}

class MemoryStorage implements AudioCacheStorage {
  readonly caches = new Map<string, MemoryCache>();
  open(name: string) {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new MemoryCache();
      this.caches.set(name, cache);
    }
    return Promise.resolve(cache);
  }
  delete(name: string) {
    return Promise.resolve(this.caches.delete(name));
  }
}

const mp3 = () => new Response('x', { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
const html = () =>
  new Response('<html>', { status: 200, headers: { 'Content-Type': 'text/html' } });

async function setup(existing: string[] = []) {
  const storage = new MemoryStorage();
  const cache = await storage.open(AUDIO_CACHE);
  for (const url of existing) await cache.put(url, mp3());
  return { storage, cache };
}

describe('audioUrls', () => {
  it('dedupes and sorts', () => {
    const manifest = { a: { file: 'b.mp3' }, b: { file: 'a.mp3' }, c: { file: 'b.mp3' } };
    expect(audioUrls(manifest)).toEqual(['/audio/a.mp3', '/audio/b.mp3']);
  });
});

describe('downloadAudio', () => {
  it('skips cached files and reports progress', async () => {
    const { storage, cache } = await setup(['/audio/a.mp3']);
    const fetched: string[] = [];
    const fetchFn: FetchFn = (url) => {
      fetched.push(url);
      return Promise.resolve(mp3());
    };
    const progress: number[] = [];
    const urls = ['/audio/a.mp3', '/audio/b.mp3'];
    const result = await downloadAudio(storage, fetchFn, urls, {
      onProgress: (done) => progress.push(done),
    });
    expect(result).toEqual({ downloaded: 1, skipped: 1, failed: 0, aborted: false });
    expect(fetched).toEqual(['/audio/b.mp3']);
    expect(progress).toEqual([1, 2]);
    expect(await offlineStatus(storage, urls)).toEqual({ cached: 2, total: 2 });
    expect(cache.entries.size).toBe(2);
  });

  it('does not store HTML and counts network errors without throwing', async () => {
    const { storage, cache } = await setup();
    const fetchFn: FetchFn = (url) =>
      url === '/audio/err.mp3'
        ? Promise.reject(new TypeError('offline'))
        : Promise.resolve(url === '/audio/html.mp3' ? html() : mp3());
    const result = await downloadAudio(storage, fetchFn, [
      '/audio/err.mp3',
      '/audio/html.mp3',
      '/audio/ok.mp3',
    ]);
    expect(result).toEqual({ downloaded: 1, skipped: 0, failed: 2, aborted: false });
    expect([...cache.entries.keys()]).toEqual(['/audio/ok.mp3']);
  });

  it('stops on abort and keeps other entries', async () => {
    const { storage, cache } = await setup(['/audio/old.mp3']);
    const controller = new AbortController();
    let calls = 0;
    const fetchFn: FetchFn = () => {
      calls++;
      if (calls === 2) controller.abort();
      return Promise.resolve(mp3());
    };
    const urls = Array.from({ length: 20 }, (_, i) => `/audio/${String(i)}.mp3`);
    const result = await downloadAudio(storage, fetchFn, urls, { signal: controller.signal });
    expect(result.aborted).toBe(true);
    expect(calls).toBeLessThan(20);
    expect(cache.entries.has('/audio/old.mp3')).toBe(true);
  });

  it('removes entries no longer in the manifest', async () => {
    const { storage, cache } = await setup(['/audio/old.mp3', '/audio/keep.mp3']);
    await downloadAudio(storage, () => Promise.resolve(mp3()), ['/audio/keep.mp3']);
    expect([...cache.entries.keys()]).toEqual(['/audio/keep.mp3']);
  });
});

describe('clearAudio', () => {
  it('deletes the audio cache', async () => {
    const { storage } = await setup(['/audio/a.mp3']);
    await clearAudio(storage);
    expect(storage.caches.has(AUDIO_CACHE)).toBe(false);
  });
});
