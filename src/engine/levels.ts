import type { EngineLevel, LevelConfig } from './types.ts';

/**
 * Strength ladder. Levels 1–4 are instant bots; 5–10 use Stockfish lite. Values were checked with
 * `node tools/engine/calibrate.ts` (each level should score ≥ 55 % against the one below).
 */
export const LEVEL_CONFIGS: Readonly<Record<EngineLevel, LevelConfig>> = {
  1: { level: 1, kind: 'bot', strategy: 'random', mistakeRate: 0 },
  2: { level: 2, kind: 'bot', strategy: 'greedy', mistakeRate: 0.3 },
  3: { level: 3, kind: 'bot', strategy: 'onePly', mistakeRate: 0.2 },
  4: { level: 4, kind: 'bot', strategy: 'twoPly', mistakeRate: 0.1 },
  5: { level: 5, kind: 'stockfish', skillLevel: 0, movetimeMs: 100, multiPv: 4 },
  6: { level: 6, kind: 'stockfish', skillLevel: 3, movetimeMs: 150, multiPv: 3 },
  7: { level: 7, kind: 'stockfish', skillLevel: 6, movetimeMs: 250, multiPv: 1 },
  8: { level: 8, kind: 'stockfish', skillLevel: 10, movetimeMs: 400, multiPv: 1 },
  9: { level: 9, kind: 'stockfish', skillLevel: 15, movetimeMs: 700, multiPv: 1 },
  10: { level: 10, kind: 'stockfish', skillLevel: 20, movetimeMs: 1000, multiPv: 1 },
};

/** Level used whenever Stockfish is unavailable. */
export const FALLBACK_LEVEL: EngineLevel = 4;
