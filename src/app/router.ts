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

export interface NavigateOptions {
  /** Replace the current history entry instead of adding one (lesson to next lesson). */
  replace?: boolean;
  /** Page under this one in history, so back and ✕ lead there (see goToParent). */
  parent?: string;
}

interface HistoryState {
  parent?: string;
}

export function navigate(to: string, { replace = false, parent }: NavigateOptions = {}): void {
  if (to === window.location.pathname && !replace) return;
  const state: HistoryState | null = parent ? { parent } : null;
  if (replace) window.history.replaceState(state, '', to);
  else window.history.pushState(state, '', to);
  for (const listener of listeners) listener();
  window.scrollTo(0, 0);
}

/** Parent recorded for the current history entry, if any. */
function currentParent(): string | undefined {
  const state = window.history.state as HistoryState | null;
  return typeof state?.parent === 'string' ? state.parent : undefined;
}

/**
 * Puts the page's ancestors (outermost first, e.g. ['/', '/learn/basic']) under it in history, so
 * the system back button walks up to them. Needed when the page was opened from a link or a
 * reload; a no-op when its parent is already in place. The whole chain is built at once: Chrome
 * skips, on back, entries added later by a page the user has not touched.
 */
export function ensureAncestors(ancestors: readonly string[]): void {
  const parent = ancestors.at(-1);
  if (!parent || currentParent() === parent) return;
  const here = window.location.pathname;
  window.history.replaceState(null, '', ancestors[0]);
  ancestors.forEach((path, index) => {
    if (index > 0) window.history.pushState({ parent: ancestors[index - 1] }, '', path);
  });
  window.history.pushState({ parent } satisfies HistoryState, '', here);
}

/** Leaves for the parent page: one step back when it is under this page, else a replace. */
export function goToParent(parent: string): void {
  if (currentParent() === parent) window.history.back();
  else navigate(parent, { replace: true });
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
