import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  loadProgress,
  loadSettings,
  saveProgress,
  saveSettings,
  clearProgress,
} from './storage.ts';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

function installStorage(storage: unknown) {
  vi.stubGlobal('window', { localStorage: storage });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('storage service', () => {
  it('round-trips progress and settings', () => {
    installStorage(new MemoryStorage());
    const progress = { lessons: { 'basic-rook': { stars: 3, completedAt: '2026-10-23' } } };
    expect(saveProgress(progress)).toBe(true);
    expect(loadProgress()).toEqual(progress);
    expect(saveSettings({ muted: true, volume: 0.5 })).toBe(true);
    expect(loadSettings()).toEqual({ muted: true, volume: 0.5 });
    expect(clearProgress()).toBe(true);
    expect(loadProgress()).toEqual({ lessons: {} });
  });

  it('falls back to defaults when there is no window (SSR / tests)', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(DEFAULT_SETTINGS)).toBe(false);
  });

  it('falls back to defaults when accessing localStorage throws', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('SecurityError');
      },
    });
    expect(loadProgress()).toEqual({ lessons: {} });
    expect(saveProgress({ lessons: {} })).toBe(false);
  });

  it('ignores corrupted JSON and data with the wrong shape', () => {
    const storage = new MemoryStorage();
    installStorage(storage);
    storage.setItem('playchess:v1:progress', '{not json');
    expect(loadProgress()).toEqual({ lessons: {} });
    storage.setItem('playchess:v1:settings', JSON.stringify({ muted: 'yes', volume: 5 }));
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('reports failure when the quota is exceeded', () => {
    const storage = new MemoryStorage();
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    installStorage(storage);
    expect(saveSettings(DEFAULT_SETTINGS)).toBe(false);
  });

  it('refuses to write invalid values', () => {
    installStorage(new MemoryStorage());
    expect(saveSettings({ muted: false, volume: 2 })).toBe(false);
  });
});
