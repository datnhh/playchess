/**
 * Contract for audio playback (wave 1 branch A1). One shared controller for the whole app session:
 * iOS/Android only allow sound after a user gesture, and the unlocked state must survive page changes.
 * All files are pre-generated, loudness-normalised MP3 served from this site.
 */

export type NarrationResult = 'ended' | 'interrupted' | 'error';

export type SfxName = 'tap' | 'move' | 'capture' | 'check' | 'success' | 'retry' | 'star' | 'win';

export interface AudioState {
  unlocked: boolean;
  muted: boolean;
  /** True while a narration clip is playing (SFX are ducked meanwhile). */
  speaking: boolean;
}

export interface AudioController {
  getState(): AudioState;
  /** Subscribe to state changes (for React via useSyncExternalStore). Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Must be called from a user gesture (the big "▶ Bắt đầu" button). Resolves false if sound stays blocked. */
  unlock(): Promise<boolean>;
  /** Warm the cache for the clips of the current lesson. Never rejects. */
  preload(urls: readonly string[]): Promise<void>;
  /**
   * Play one narration clip, stopping any previous one. Resolves when it ends, is interrupted or fails;
   * never rejects, so the lesson can continue with visual cues when sound is unavailable.
   */
  playNarration(url: string): Promise<NarrationResult>;
  stopNarration(): void;
  playSfx(name: SfxName): void;
  setMuted(muted: boolean): void;
}
