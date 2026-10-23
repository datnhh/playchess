import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAudioController,
  NARRATION_FALLBACK_TIMEOUT_MS,
  UNLOCK_CLIP_URL,
  type AudioContextLike,
  type AudioElementLike,
  type AudioParamLike,
} from './audioController.ts';

function fakeParam(): AudioParamLike & { calls: string[] } {
  const calls: string[] = [];
  const record = (name: string) => (value: number) => {
    calls.push(`${name}:${value}`);
  };
  return {
    value: 0,
    calls,
    setValueAtTime: record('set'),
    linearRampToValueAtTime: record('linear'),
    exponentialRampToValueAtTime: record('exp'),
    setTargetAtTime: record('target'),
    cancelScheduledValues: () => undefined,
  };
}

function fakeContext(startState = 'suspended', resumes = true) {
  const gains: ReturnType<typeof fakeParam>[] = [];
  let oscillators = 0;
  const ctx = {
    state: startState,
    currentTime: 0,
    destination: {},
    sampleRate: 44_100,
    resume: vi.fn(async () => {
      if (resumes) ctx.state = 'running';
    }),
    createGain: () => {
      const gain = fakeParam();
      gains.push(gain);
      return { gain, connect: () => undefined };
    },
    createOscillator: () => {
      oscillators += 1;
      return {
        type: 'sine' as OscillatorType,
        frequency: fakeParam(),
        connect: () => undefined,
        start: () => undefined,
        stop: () => undefined,
      };
    },
    createBuffer: () => ({}) as AudioBuffer,
    createBufferSource: () => ({
      buffer: null,
      connect: () => undefined,
      start: () => undefined,
    }),
  };
  return {
    ctx: ctx as AudioContextLike & { state: string },
    gains,
    oscillatorCount: () => oscillators,
  };
}

function fakeElement(playResult: () => Promise<void> = () => Promise.resolve()) {
  const element: AudioElementLike = {
    src: '',
    muted: false,
    preload: '',
    duration: Number.NaN,
    onended: null,
    onerror: null,
    onloadedmetadata: null,
    play: vi.fn(playResult),
    pause: vi.fn(),
    load: vi.fn(),
  };
  return element;
}

async function setup(options: { play?: () => Promise<void>; resumes?: boolean } = {}) {
  const element = fakeElement(options.play);
  const context = fakeContext('suspended', options.resumes ?? true);
  const fetchUrl = vi.fn(async (url: string) => {
    if (url.includes('bad')) throw new Error('404');
    return url;
  });
  const controller = createAudioController({
    createAudioElement: () => element,
    createAudioContext: () => context.ctx,
    fetchUrl,
  });
  return { controller, element, context, fetchUrl };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createAudioController', () => {
  it('unlocks by resuming the context', async () => {
    const { controller, element } = await setup();
    const listener = vi.fn();
    controller.subscribe(listener);
    expect(await controller.unlock()).toBe(true);
    expect(controller.getState().unlocked).toBe(true);
    expect(element.src).toBe(UNLOCK_CLIP_URL);
    expect(element.play).toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reports false when sound stays blocked', async () => {
    const { controller } = await setup({ resumes: false });
    expect(await controller.unlock()).toBe(false);
    expect(controller.getState().unlocked).toBe(false);
  });

  it('returns error for narration before unlock', async () => {
    const { controller, element } = await setup();
    expect(await controller.playNarration('/a.mp3')).toBe('error');
    expect(element.play).not.toHaveBeenCalled();
  });

  it('plays narration to the end and toggles speaking', async () => {
    const { controller, element } = await setup();
    await controller.unlock();
    const result = controller.playNarration('/a.mp3');
    expect(element.src).toBe('/a.mp3');
    expect(controller.getState().speaking).toBe(true);
    element.onended?.(new Event('ended'));
    expect(await result).toBe('ended');
    expect(controller.getState().speaking).toBe(false);
  });

  it('interrupts the previous clip when a new one starts or on stop', async () => {
    const { controller, element } = await setup();
    await controller.unlock();
    const first = controller.playNarration('/a.mp3');
    const second = controller.playNarration('/b.mp3');
    expect(await first).toBe('interrupted');
    controller.stopNarration();
    expect(await second).toBe('interrupted');
    expect(element.pause).toHaveBeenCalled();
    expect(controller.getState().speaking).toBe(false);
  });

  it('resolves error when play() rejects', async () => {
    const { controller } = await setup({ play: () => Promise.reject(new Error('blocked')) });
    await controller.unlock();
    expect(await controller.playNarration('/a.mp3')).toBe('error');
  });

  it('times out when ended never fires', async () => {
    const { controller, element } = await setup();
    await controller.unlock();
    const result = controller.playNarration('/a.mp3');
    Object.defineProperty(element, 'duration', { value: 3 });
    element.onloadedmetadata?.(new Event('loadedmetadata'));
    await vi.advanceTimersByTimeAsync(4_999);
    expect(controller.getState().speaking).toBe(true);
    await vi.advanceTimersByTimeAsync(2);
    expect(await result).toBe('ended');
  });

  it('falls back to the long timeout without metadata', async () => {
    const { controller } = await setup();
    await controller.unlock();
    const result = controller.playNarration('/a.mp3');
    await vi.advanceTimersByTimeAsync(NARRATION_FALLBACK_TIMEOUT_MS + 1);
    expect(await result).toBe('ended');
  });

  it('muted: narration ends immediately and SFX are silent', async () => {
    const { controller, element, context } = await setup();
    await controller.unlock();
    vi.mocked(element.play).mockClear(); // unlock itself plays the silent clip
    controller.setMuted(true);
    expect(element.muted).toBe(true);
    expect(await controller.playNarration('/a.mp3')).toBe('ended');
    expect(element.play).not.toHaveBeenCalled();
    controller.playSfx('win');
    expect(context.oscillatorCount()).toBe(0);
  });

  it('synthesises SFX and ducks them while speaking', async () => {
    const { controller, element, context } = await setup();
    await controller.unlock();
    controller.playSfx('success');
    expect(context.oscillatorCount()).toBe(3);
    const sfxBus = context.gains[1];
    const result = controller.playNarration('/a.mp3');
    expect(sfxBus?.calls).toContain('target:0.3');
    element.onended?.(new Event('ended'));
    await result;
    expect(sfxBus?.calls.at(-1)).toBe('target:0.8');
  });

  it('preload never rejects', async () => {
    const { controller, fetchUrl } = await setup();
    await expect(controller.preload(['/ok.mp3', '/bad.mp3'])).resolves.toBeUndefined();
    expect(fetchUrl).toHaveBeenCalledTimes(2);
  });
});
