/**
 * Cache Storage layout shared by the service worker (src/sw/sw.ts) and the page (offline
 * download in Settings). Only types common to the DOM and WebWorker libs are used here.
 */

export const CACHE_PREFIX = 'playchess-';
const PRECACHE_PREFIX = `${CACHE_PREFIX}precache-`;
/** Audio files are named by the hash of their text and voice, so one cache serves every version. */
export const AUDIO_CACHE = `${CACHE_PREFIX}audio-v1`;
export const AUDIO_PATH_PREFIX = '/audio/';

/** App shell, code, engine and common clips of one build. */
export function precacheName(version: string): string {
  return PRECACHE_PREFIX + version;
}

/** Our caches that the given version no longer uses (older precaches, unknown names). */
export function staleCaches(names: readonly string[], version: string): string[] {
  const keep = new Set([precacheName(version), AUDIO_CACHE]);
  return names.filter((name) => name.startsWith(CACHE_PREFIX) && !keep.has(name));
}

export function isAudioPath(pathname: string): boolean {
  return pathname.startsWith(AUDIO_PATH_PREFIX) && pathname.endsWith('.mp3');
}

export interface ByteRange {
  start: number;
  /** Inclusive. */
  end: number;
}

/**
 * Parses a single-range `Range` header against a body of `size` bytes (RFC 9110 §14.1.2).
 * Returns null when the header should be ignored (malformed or multiple ranges: the full body is
 * then a valid answer) and 'unsatisfiable' when the range lies outside the body.
 */
export function parseRange(header: string, size: number): ByteRange | 'unsatisfiable' | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, startText = '', endText = ''] = match;
  if (startText === '') {
    if (endText === '') return null;
    // Suffix range: the last N bytes.
    const length = Number(endText);
    if (length === 0 || size === 0) return 'unsatisfiable';
    return { start: Math.max(size - length, 0), end: size - 1 };
  }
  const start = Number(startText);
  const end = endText === '' ? size - 1 : Math.min(Number(endText), size - 1);
  if (start >= size || start > end) return 'unsatisfiable';
  return { start, end };
}

/**
 * Answers a `Range` request from a full cached response. Safari fetches media with Range
 * requests and refuses to play a 200 answer to them, so cached audio must be served as 206.
 */
export async function rangeResponse(full: Response, header: string): Promise<Response> {
  const body = await full.arrayBuffer();
  const size = body.byteLength;
  const type = full.headers.get('Content-Type') ?? 'application/octet-stream';
  const range = parseRange(header, size);
  if (range === null) {
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' },
    });
  }
  if (range === 'unsatisfiable') {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(body.slice(range.start, range.end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': type,
      'Content-Length': String(range.end - range.start + 1),
      'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
      'Accept-Ranges': 'bytes',
    },
  });
}

/** Only real audio is cached: Cloudflare Pages answers unknown paths with index.html and 200. */
export function isCacheableAudio(response: Response): boolean {
  return (
    response.status === 200 && (response.headers.get('Content-Type') ?? '').startsWith('audio/')
  );
}
