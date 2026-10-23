import { SFX_NOTES } from './sfx.ts';
import type { AudioController, AudioState, NarrationResult, SfxName } from './types.ts';

/**
 * Minimal structural views of the DOM audio APIs actually used, so node tests can pass fakes.
 * The real HTMLAudioElement / AudioContext satisfy them (nodes are connected via `as never`).
 */
export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
  setTargetAtTime(value: number, time: number, timeConstant: number): unknown;
  cancelScheduledValues(time: number): unknown;
}

export interface AudioNodeLike {
  connect(destination: never): unknown;
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export interface OscillatorNodeLike extends AudioNodeLike {
  type: OscillatorType;
  readonly frequency: AudioParamLike;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface BufferSourceLike extends AudioNodeLike {
  buffer: AudioBuffer | null;
  start(when?: number): void;
}

export interface AudioContextLike {
  readonly state: string;
  readonly currentTime: number;
  readonly destination: unknown;
  readonly sampleRate: number;
  resume(): Promise<void>;
  createGain(): GainNodeLike;
  createOscillator(): OscillatorNodeLike;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer;
  createBufferSource(): BufferSourceLike;
}

export interface AudioElementLike {
  src: string;
  muted: boolean;
  preload: string;
  readonly duration: number;
  onended: ((event: Event) => unknown) | null;
  onerror: ((event: Event | string) => unknown) | null;
  onloadedmetadata: ((event: Event) => unknown) | null;
  play(): Promise<void>;
  pause(): void;
  load(): void;
}

export interface AudioControllerDeps {
  createAudioElement?: () => AudioElementLike;
  /** Returns null when Web Audio is unavailable (SFX then become no-ops). */
  createAudioContext?: () => AudioContextLike | null;
  fetchUrl?: (url: string) => Promise<unknown>;
}

/** 0.1 s of silence (public/media/silence.wav), played on unlock. Not under /audio/, which the build prunes. */
export const UNLOCK_CLIP_URL = '/media/silence.wav';

/** Narration timeout before metadata arrives, and slack added once the clip duration is known. */
export const NARRATION_FALLBACK_TIMEOUT_MS = 30_000;
export const NARRATION_SLACK_MS = 2_000;
/** SFX bus level while narration plays, so the voice stays clear. */
export const DUCKED_SFX_GAIN = 0.3;
export const SFX_GAIN = 0.8;

function defaultAudioContext(): AudioContextLike | null {
  const Ctor =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor() as unknown as AudioContextLike;
  } catch {
    return null;
  }
}

export function createAudioController(deps: AudioControllerDeps = {}): AudioController {
  const createElement = deps.createAudioElement ?? (() => new Audio());
  const createContext = deps.createAudioContext ?? defaultAudioContext;
  const fetchUrl = deps.fetchUrl ?? ((url: string) => fetch(url).then((r) => r.blob()));

  let state: AudioState = { unlocked: false, muted: false, speaking: false };
  const listeners = new Set<() => void>();
  let element: AudioElementLike | null = null;
  let context: AudioContextLike | null | undefined;
  let master: GainNodeLike | null = null;
  let sfxBus: GainNodeLike | null = null;
  /** Finishes the current narration; null when nothing is playing. */
  let finishCurrent: ((result: NarrationResult) => void) | null = null;

  const setState = (patch: Partial<AudioState>) => {
    const next = { ...state, ...patch };
    if (
      next.unlocked === state.unlocked &&
      next.muted === state.muted &&
      next.speaking === state.speaking
    ) {
      return;
    }
    state = next;
    for (const listener of listeners) listener();
  };

  const getElement = () => {
    if (!element) {
      element = createElement();
      element.preload = 'auto';
      element.muted = state.muted;
    }
    return element;
  };

  /** Created lazily: browsers warn (and Safari may refuse) when a context starts outside a gesture. */
  const getContext = () => {
    if (context !== undefined) return context;
    context = createContext();
    if (context) {
      master = context.createGain();
      master.gain.value = state.muted ? 0 : 1;
      master.connect(context.destination as never);
      sfxBus = context.createGain();
      sfxBus.gain.value = SFX_GAIN;
      sfxBus.connect(master as never);
    }
    return context;
  };

  const applyGains = () => {
    if (!context) return;
    const now = context.currentTime;
    if (master) {
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(state.muted ? 0 : 1, now);
    }
    if (sfxBus) {
      sfxBus.gain.cancelScheduledValues(now);
      sfxBus.gain.setTargetAtTime(state.speaking ? DUCKED_SFX_GAIN : SFX_GAIN, now, 0.05);
    }
  };

  const stopNarration = () => {
    finishCurrent?.('interrupted');
  };

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async unlock() {
      // Play a short silent clip on the shared element inside the gesture: iOS Safari then lets the
      // same element play narration later without a gesture. The CSP forbids data: media, so the
      // clip is a same-origin file.
      try {
        const element = getElement();
        element.src = UNLOCK_CLIP_URL;
        void element.play().then(
          // Narration may already have taken over the element; only stop the silent clip.
          () => {
            if (element.src.endsWith(UNLOCK_CLIP_URL)) element.pause();
          },
          () => undefined,
        );
      } catch {
        // Ignore: narration reports 'error' if it is really blocked.
      }
      const ctx = getContext();
      if (!ctx) {
        setState({ unlocked: true });
        return true;
      }
      try {
        // Start the silent buffer before awaiting, while still inside the gesture call stack.
        const source = ctx.createBufferSource();
        source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        source.connect(ctx.destination as never);
        source.start(0);
        if (ctx.state !== 'running') await ctx.resume();
      } catch {
        // Fall through to the state check.
      }
      const unlocked = ctx.state === 'running';
      setState({ unlocked });
      return unlocked;
    },

    async preload(urls) {
      await Promise.all(urls.map((url) => fetchUrl(url).catch(() => undefined)));
    },

    playNarration(url) {
      stopNarration();
      if (state.muted) return Promise.resolve('ended');
      if (!state.unlocked) return Promise.resolve('error');

      return new Promise<NarrationResult>((resolve) => {
        const audio = getElement();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const finish = (result: NarrationResult) => {
          if (finishCurrent !== finish) return;
          finishCurrent = null;
          clearTimeout(timer);
          audio.onended = null;
          audio.onerror = null;
          audio.onloadedmetadata = null;
          if (result !== 'ended') audio.pause();
          setState({ speaking: false });
          applyGains();
          resolve(result);
        };
        // Safety net: some mobile browsers never fire `ended` after a network hiccup.
        const arm = (ms: number) => {
          clearTimeout(timer);
          timer = setTimeout(() => finish('ended'), ms);
        };
        finishCurrent = finish;

        audio.onended = () => finish('ended');
        audio.onerror = () => finish('error');
        audio.onloadedmetadata = () => {
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            arm(audio.duration * 1000 + NARRATION_SLACK_MS);
          }
        };
        arm(NARRATION_FALLBACK_TIMEOUT_MS);
        audio.src = url;
        setState({ speaking: true });
        applyGains();
        try {
          audio.play().catch(() => finish('error'));
        } catch {
          finish('error');
        }
      });
    },

    stopNarration,

    playSfx(name: SfxName) {
      if (state.muted || !state.unlocked) return;
      const ctx = getContext();
      if (!ctx || !sfxBus || ctx.state !== 'running') return;
      const start = ctx.currentTime + 0.01;
      for (const note of SFX_NOTES[name]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t0 = start + note.at;
        const t1 = t0 + note.duration;
        osc.type = note.type;
        osc.frequency.setValueAtTime(note.frequency, t0);
        if (note.glideTo) osc.frequency.exponentialRampToValueAtTime(note.glideTo, t1);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(note.peak, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t1);
        osc.connect(gain as never);
        gain.connect(sfxBus as never);
        osc.start(t0);
        osc.stop(t1 + 0.02);
      }
    },

    setMuted(muted) {
      if (element) element.muted = muted;
      setState({ muted });
      applyGains();
    },
  };
}
