import { useSyncExternalStore } from 'react';

/**
 * Minimal History API router. The app has only a handful of routes,
 * so a dependency-free router keeps the bundle small and the behaviour predictable.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

function getPathname(): string {
  return window.location.pathname;
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, getPathname);
}

export function navigate(to: string): void {
  if (to === window.location.pathname) return;
  window.history.pushState(null, '', to);
  for (const listener of listeners) listener();
  window.scrollTo(0, 0);
}

export type RouteParams = Readonly<Record<string, string>>;

/**
 * Matches "/lesson/:id" style patterns. Returns the decoded params, or null when the path does not
 * match. A trailing slash is ignored; segments never match across "/".
 */
export function matchPath(pattern: string, pathname: string): RouteParams | null {
  const split = (path: string) => path.replace(/\/+$/, '').split('/').filter(Boolean);
  const patternParts = split(pattern);
  const pathParts = split(pathname);
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (const [index, part] of patternParts.entries()) {
    const actual = pathParts[index]!;
    if (part.startsWith(':')) {
      try {
        params[part.slice(1)] = decodeURIComponent(actual);
      } catch {
        return null;
      }
    } else if (part !== actual) {
      return null;
    }
  }
  return params;
}
