import type { AudioController, AudioState, NarrationResult } from '../audio/types.ts';

/**
 * Stand-in AudioController for demos and tests until the real one (src/audio) is plugged in.
 * Narration "plays" for a fixed delay and resolves 'ended'; SFX are ignored.
 * Kept out of mocks.tsx so that file only exports components (React Fast Refresh rule).
 */
export function createSilentAudioController(narrationMs = 800): AudioController {
  let state: AudioState = { unlocked: false, muted: false, speaking: false };
  const listeners = new Set<() => void>();
  let pending: {
    timer: ReturnType<typeof setTimeout>;
    resolve: (r: NarrationResult) => void;
  } | null = null;

  const setState = (patch: Partial<AudioState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };

  const stopNarration = () => {
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.resolve('interrupted');
    pending = null;
    setState({ speaking: false });
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    unlock() {
      setState({ unlocked: true });
      return Promise.resolve(true);
    },
    preload: () => Promise.resolve(),
    playNarration() {
      stopNarration();
      setState({ speaking: true });
      return new Promise<NarrationResult>((resolve) => {
        const timer = setTimeout(() => {
          pending = null;
          setState({ speaking: false });
          resolve('ended');
        }, narrationMs);
        pending = { timer, resolve };
      });
    },
    stopNarration,
    playSfx() {},
    setMuted(muted) {
      setState({ muted });
    },
  };
}
