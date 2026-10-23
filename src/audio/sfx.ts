import type { SfxName } from './types.ts';

/**
 * Synthesised sound effects: no audio files to download, cache or license.
 * Each effect is a few soft notes (sine/triangle) with a quick attack and gentle decay,
 * kept quiet and in a major key so repeated taps never sound harsh to young children.
 */
export interface SfxNote {
  /** Frequency in Hz. */
  frequency: number;
  /** Optional glide target in Hz. */
  glideTo?: number;
  /** Start offset in seconds from the effect start. */
  at: number;
  duration: number;
  type: 'sine' | 'triangle';
  /** Peak gain 0..1 before the SFX bus gain. */
  peak: number;
}

const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;

export const SFX_NOTES: Readonly<Record<SfxName, readonly SfxNote[]>> = {
  tap: [{ frequency: 880, at: 0, duration: 0.06, type: 'sine', peak: 0.25 }],
  move: [{ frequency: 330, glideTo: 440, at: 0, duration: 0.12, type: 'triangle', peak: 0.35 }],
  capture: [
    { frequency: 392, at: 0, duration: 0.1, type: 'triangle', peak: 0.35 },
    { frequency: 262, at: 0.07, duration: 0.14, type: 'triangle', peak: 0.3 },
  ],
  check: [
    { frequency: A5, at: 0, duration: 0.12, type: 'sine', peak: 0.3 },
    { frequency: A5, at: 0.16, duration: 0.12, type: 'sine', peak: 0.3 },
  ],
  success: [
    { frequency: C5, at: 0, duration: 0.12, type: 'sine', peak: 0.3 },
    { frequency: E5, at: 0.1, duration: 0.12, type: 'sine', peak: 0.3 },
    { frequency: G5, at: 0.2, duration: 0.25, type: 'sine', peak: 0.3 },
  ],
  retry: [{ frequency: 392, glideTo: 330, at: 0, duration: 0.25, type: 'sine', peak: 0.25 }],
  star: [
    { frequency: G5, at: 0, duration: 0.1, type: 'sine', peak: 0.25 },
    { frequency: C6, at: 0.08, duration: 0.3, type: 'sine', peak: 0.25 },
  ],
  win: [
    { frequency: C5, at: 0, duration: 0.14, type: 'triangle', peak: 0.3 },
    { frequency: E5, at: 0.14, duration: 0.14, type: 'triangle', peak: 0.3 },
    { frequency: G5, at: 0.28, duration: 0.14, type: 'triangle', peak: 0.3 },
    { frequency: D5, at: 0.42, duration: 0.1, type: 'triangle', peak: 0.25 },
    { frequency: C6, at: 0.52, duration: 0.45, type: 'sine', peak: 0.3 },
  ],
};
