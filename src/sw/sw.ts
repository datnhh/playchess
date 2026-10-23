/// <reference lib="webworker" />
/**
 * Service worker: the app works offline once loaded, and every clip heard is kept for later.
 * Built into dist/sw.js by tools/vite/serviceWorkerPlugin.ts, which defines the two constants
 * below. Type-checked with tsconfig.sw.json (WebWorker lib).
 *
 * - Install: precache the app shell, code, engine and common clips of this build (all or nothing:
 *   a failed download leaves the site working online, as without a worker).
 * - Update: a new worker waits until every tab of the old version is closed, so a lesson in
 *   progress never loses the chunks it still needs.
 * - Navigation: network first; offline or slower than 3 s, the cached shell.
 * - Audio: cache first, then network; clips heard are stored; Range requests get a 206.
 */
import {
  AUDIO_CACHE,
  isAudioPath,
  isCacheableAudio,
  precacheName,
  rangeResponse,
  staleCaches,
} from '../offline/cache.ts';

declare const self: ServiceWorkerGlobalScope;
declare const __SW_VERSION__: string;
declare const __SW_PRECACHE__: readonly string[];

const PRECACHE = precacheName(__SW_VERSION__);
const PRECACHED = new Set(__SW_PRECACHE__);
/** Cloudflare Pages redirects /index.html to /, so the shell is stored under '/'. */
const APP_SHELL = '/';
const NAVIGATION_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) =>
      // 'reload' skips the HTTP cache, so index.html matches the files of this build.
      cache.addAll(__SW_PRECACHE__.map((url) => new Request(url, { cache: 'reload' }))),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(staleCaches(names, __SW_VERSION__).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
  } else if (isAudioPath(url.pathname)) {
    event.respondWith(audio(request, url.pathname));
  } else if (PRECACHED.has(url.pathname)) {
    event.respondWith(cacheFirst(request, url.pathname));
  }
});

async function navigate(request: Request): Promise<Response> {
  const network = fetch(request);
  // Observed here so that a late failure, after the shell was served, is not reported as unhandled.
  network.catch(() => undefined);
  const timeout = new Promise<undefined>((resolve) => {
    setTimeout(resolve, NAVIGATION_TIMEOUT_MS, undefined);
  });
  try {
    const response = await Promise.race([network, timeout]);
    if (response) return response;
  } catch {
    // Offline: fall back to the cached shell.
  }
  const shell = await caches.match(APP_SHELL, { cacheName: PRECACHE });
  return shell ?? network;
}

async function cacheFirst(request: Request, pathname: string): Promise<Response> {
  const cached = await caches.match(pathname, { cacheName: PRECACHE });
  return cached ?? fetch(request);
}

async function audio(request: Request, pathname: string): Promise<Response> {
  const cache = await caches.open(AUDIO_CACHE);
  let response =
    (await cache.match(pathname)) ?? (await caches.match(pathname, { cacheName: PRECACHE }));
  if (!response) {
    // The whole file (no Range header): clips are small and the full copy is what gets cached.
    response = await fetch(pathname);
    if (!isCacheableAudio(response)) return response;
    await cache.put(pathname, response.clone());
  }
  const range = request.headers.get('Range');
  return range ? rangeResponse(response, range) : response;
}
