import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureAncestors, goToParent, matchPath, navigate } from './router.ts';

describe('matchPath', () => {
  it('matches static paths, ignoring a trailing slash', () => {
    expect(matchPath('/', '/')).toEqual({});
    expect(matchPath('/play', '/play/')).toEqual({});
    expect(matchPath('/play', '/played')).toBeNull();
  });

  it('extracts and decodes params', () => {
    expect(matchPath('/lesson/:id', '/lesson/basic-rook')).toEqual({ id: 'basic-rook' });
    expect(matchPath('/learn/:track', '/learn/n%C3%A2ng')).toEqual({ track: 'nâng' });
  });

  it('requires the same number of segments', () => {
    expect(matchPath('/lesson/:id', '/lesson')).toBeNull();
    expect(matchPath('/lesson/:id', '/lesson/a/b')).toBeNull();
  });

  it('rejects malformed escapes', () => {
    expect(matchPath('/lesson/:id', '/lesson/%E0%A4%A')).toBeNull();
  });
});

/** In-memory History API: enough of `window` for navigate / ensureParent / goToParent. */
function installFakeWindow(path: string) {
  const entries: { path: string; state: unknown }[] = [{ path, state: null }];
  let index = 0;
  const popListeners = new Set<() => void>();
  const location = {
    get pathname() {
      return entries[index]!.path;
    },
  };
  const history = {
    get state() {
      return entries[index]!.state;
    },
    pushState(state: unknown, _title: string, url: string) {
      entries.splice(index + 1, entries.length, { path: url, state });
      index += 1;
    },
    replaceState(state: unknown, _title: string, url: string) {
      entries[index] = { path: url, state };
    },
    back() {
      if (index === 0) return;
      index -= 1;
      for (const listener of popListeners) listener();
    },
  };
  vi.stubGlobal('window', {
    location,
    history,
    scrollTo: () => {},
    addEventListener: (_type: string, listener: () => void) => popListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => popListeners.delete(listener),
  });
  return { paths: () => entries.map((entry) => entry.path), current: () => location.pathname };
}

describe('history parents', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('next lesson replaces the lesson, so back and exit return to the map', () => {
    const nav = installFakeWindow('/');
    navigate('/learn/basic', { parent: '/' });
    navigate('/lesson/basic-board', { parent: '/learn/basic' });
    navigate('/lesson/basic-rook', { replace: true, parent: '/learn/basic' });
    navigate('/lesson/basic-bishop', { replace: true, parent: '/learn/basic' });
    expect(nav.paths()).toEqual(['/', '/learn/basic', '/lesson/basic-bishop']);
    goToParent('/learn/basic');
    expect(nav.current()).toBe('/learn/basic');
    goToParent('/');
    expect(nav.current()).toBe('/');
  });

  it('a lesson opened from a link gets home and its map underneath', () => {
    const nav = installFakeWindow('/lesson/basic-rook');
    ensureAncestors(['/', '/learn/basic']);
    ensureAncestors(['/', '/learn/basic']);
    expect(nav.paths()).toEqual(['/', '/learn/basic', '/lesson/basic-rook']);
    goToParent('/learn/basic');
    expect(nav.current()).toBe('/learn/basic');
    // The map finds its own parent in place and adds nothing.
    ensureAncestors(['/']);
    goToParent('/');
    expect(nav.current()).toBe('/');
    expect(nav.paths()).toEqual(['/', '/learn/basic', '/lesson/basic-rook']);
  });

  it('without a parent underneath, leaving replaces the page', () => {
    const nav = installFakeWindow('/lesson/basic-rook');
    goToParent('/learn/basic');
    expect(nav.paths()).toEqual(['/learn/basic']);
  });
});
