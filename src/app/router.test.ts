import { describe, expect, it } from 'vitest';
import { matchPath } from './router.ts';

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
