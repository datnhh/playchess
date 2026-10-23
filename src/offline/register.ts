/** Registers the service worker (src/sw/sw.ts) in production builds; the dev server has none. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      // The site still works online without the worker.
      console.warn('Không đăng ký được service worker', error);
    });
  });
}
