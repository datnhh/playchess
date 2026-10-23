/**
 * Parent-triggered download of every lesson clip into the audio cache, so lessons play offline.
 * Cache Storage and fetch are passed in so the logic runs under node in tests.
 */
import { AUDIO_CACHE, AUDIO_PATH_PREFIX, isCacheableAudio } from './cache.ts';

/** The subset of Cache used here; the real Cache satisfies it. */
export interface AudioCache {
  keys(): Promise<readonly { url: string }[]>;
  put(url: string, response: Response): Promise<void>;
  delete(url: string): Promise<boolean>;
}

/** The subset of CacheStorage used here; the real `caches` satisfies it. */
export interface AudioCacheStorage {
  open(name: string): Promise<AudioCache>;
  delete(name: string): Promise<boolean>;
}

export type FetchFn = (url: string, init: { signal?: AbortSignal }) => Promise<Response>;

export interface DownloadOptions {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export interface DownloadResult {
  downloaded: number;
  skipped: number;
  failed: number;
  aborted: boolean;
}

const CONCURRENCY = 4;

/** Unique, sorted `/audio/<file>` paths of a manifest. */
export function audioUrls(manifest: Readonly<Record<string, { file: string }>>): string[] {
  const urls = new Set(Object.values(manifest).map((entry) => AUDIO_PATH_PREFIX + entry.file));
  return [...urls].sort();
}

/** Cache keys are absolute URLs; the service worker matches on pathname. */
function keyPath(url: string): string {
  return new URL(url, 'http://localhost').pathname;
}

async function cachedPaths(cache: AudioCache): Promise<Set<string>> {
  const keys = await cache.keys();
  return new Set(keys.map((key) => keyPath(key.url)));
}

export async function offlineStatus(
  storage: AudioCacheStorage,
  urls: readonly string[],
): Promise<{ cached: number; total: number }> {
  const have = await cachedPaths(await storage.open(AUDIO_CACHE));
  return { cached: urls.filter((url) => have.has(url)).length, total: urls.length };
}

/**
 * Fetches the missing clips, at most CONCURRENCY at a time. A failing file is counted, never
 * thrown. After a run that was not aborted, entries no longer in `urls` (clips of changed
 * sentences) are removed.
 */
export async function downloadAudio(
  storage: AudioCacheStorage,
  fetchFn: FetchFn,
  urls: readonly string[],
  { onProgress, signal }: DownloadOptions = {},
): Promise<DownloadResult> {
  const cache = await storage.open(AUDIO_CACHE);
  const have = await cachedPaths(cache);
  const wanted = new Set(urls);
  const missing = [...wanted].filter((url) => !have.has(url));
  const result: DownloadResult = {
    downloaded: 0,
    skipped: wanted.size - missing.length,
    failed: 0,
    aborted: false,
  };
  const total = wanted.size;
  let done = result.skipped;
  onProgress?.(done, total);

  let next = 0;
  const worker = async () => {
    while (next < missing.length && !signal?.aborted) {
      const url = missing[next++];
      if (url === undefined) break;
      try {
        const response = await fetchFn(url, signal ? { signal } : {});
        if (!isCacheableAudio(response)) throw new Error(`Not audio: ${url}`);
        await cache.put(url, response);
        result.downloaded++;
      } catch {
        if (signal?.aborted) break;
        result.failed++;
      }
      done++;
      onProgress?.(done, total);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, missing.length) }, worker));

  if (signal?.aborted) {
    result.aborted = true;
    return result;
  }
  const keys = await cache.keys();
  await Promise.all(
    keys.filter((key) => !wanted.has(keyPath(key.url))).map((key) => cache.delete(key.url)),
  );
  return result;
}

export async function clearAudio(storage: AudioCacheStorage): Promise<void> {
  await storage.delete(AUDIO_CACHE);
}
