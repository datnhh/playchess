import { describe, expect, it } from 'vitest';
import { precacheList, precacheUrl, precacheVersion } from './serviceWorkerPlugin.ts';

describe('precache list', () => {
  it('maps index.html to / and skips maps, audio and host files', () => {
    expect(precacheUrl('index.html')).toBe('/');
    expect(precacheUrl('assets/index-abc.js')).toBe('/assets/index-abc.js');
    expect(precacheUrl('engine/stockfish.wasm')).toBe('/engine/stockfish.wasm');
    expect(precacheUrl('assets/index-abc.js.map')).toBeNull();
    expect(precacheUrl('audio/0fa67fb509d4f53c.mp3')).toBeNull();
    expect(precacheUrl('_headers')).toBeNull();
    expect(precacheUrl('sw.js')).toBeNull();
  });

  it('adds the common clips, without duplicates, sorted', () => {
    expect(
      precacheList(['index.html', 'favicon.svg', 'audio/a.mp3', 'audio/b.mp3'], ['b.mp3', 'b.mp3']),
    ).toEqual(['/', '/audio/b.mp3', '/favicon.svg']);
  });
});

describe('precacheVersion', () => {
  const entry = (url: string, text: string) => ({ url, content: Buffer.from(text) });

  it('depends on content, not on order', () => {
    const a = precacheVersion([entry('/', 'x'), entry('/a.js', 'y')]);
    expect(precacheVersion([entry('/a.js', 'y'), entry('/', 'x')])).toBe(a);
    expect(precacheVersion([entry('/', 'x'), entry('/a.js', 'z')])).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });
});
