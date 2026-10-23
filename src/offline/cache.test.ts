import { describe, expect, it } from 'vitest';
import {
  AUDIO_CACHE,
  isAudioPath,
  isCacheableAudio,
  parseRange,
  precacheName,
  rangeResponse,
  staleCaches,
} from './cache.ts';

describe('cache names', () => {
  it('drops older precaches and unknown caches of ours, keeps audio and other sites', () => {
    const names = [
      precacheName('old'),
      precacheName('new'),
      AUDIO_CACHE,
      'playchess-something',
      'other-app',
    ];
    expect(staleCaches(names, 'new')).toEqual([precacheName('old'), 'playchess-something']);
  });

  it('recognises lesson audio paths', () => {
    expect(isAudioPath('/audio/0fa67fb509d4f53c.mp3')).toBe(true);
    expect(isAudioPath('/audio/')).toBe(false);
    expect(isAudioPath('/assets/index.js')).toBe(false);
  });
});

describe('parseRange', () => {
  it('reads start-end, open ends and suffixes', () => {
    expect(parseRange('bytes=0-1', 10)).toEqual({ start: 0, end: 1 });
    expect(parseRange('bytes=4-', 10)).toEqual({ start: 4, end: 9 });
    expect(parseRange('bytes=2-99', 10)).toEqual({ start: 2, end: 9 });
    expect(parseRange('bytes=-3', 10)).toEqual({ start: 7, end: 9 });
    expect(parseRange('bytes=-30', 10)).toEqual({ start: 0, end: 9 });
  });

  it('ignores malformed and multi-range headers', () => {
    expect(parseRange('bytes=0-1,4-5', 10)).toBeNull();
    expect(parseRange('items=0-1', 10)).toBeNull();
    expect(parseRange('bytes=-', 10)).toBeNull();
  });

  it('flags ranges outside the body', () => {
    expect(parseRange('bytes=10-', 10)).toBe('unsatisfiable');
    expect(parseRange('bytes=5-2', 10)).toBe('unsatisfiable');
    expect(parseRange('bytes=-0', 10)).toBe('unsatisfiable');
  });
});

describe('rangeResponse', () => {
  const full = () =>
    new Response(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), {
      headers: { 'Content-Type': 'audio/mpeg' },
    });

  it('answers a range with 206 and the matching bytes', async () => {
    const response = await rangeResponse(full(), 'bytes=0-1');
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 0-1/10');
    expect(response.headers.get('Content-Length')).toBe('2');
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([0, 1]);
  });

  it('answers an ignored range with the whole body', async () => {
    const response = await rangeResponse(full(), 'bytes=0-1,3-4');
    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBe(10);
  });

  it('answers an unsatisfiable range with 416', async () => {
    const response = await rangeResponse(full(), 'bytes=20-');
    expect(response.status).toBe(416);
    expect(response.headers.get('Content-Range')).toBe('bytes */10');
  });
});

describe('isCacheableAudio', () => {
  it('accepts audio only, not the SPA fallback page', () => {
    const audio = new Response('x', { headers: { 'Content-Type': 'audio/mpeg' } });
    const html = new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } });
    const missing = new Response('', { status: 404, headers: { 'Content-Type': 'audio/mpeg' } });
    expect(isCacheableAudio(audio)).toBe(true);
    expect(isCacheableAudio(html)).toBe(false);
    expect(isCacheableAudio(missing)).toBe(false);
  });
});
