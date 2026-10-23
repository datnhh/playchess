import { describe, expect, it } from 'vitest';
import { FALLBACK_LEVEL, LEVEL_CONFIGS } from './levels.ts';
import { ENGINE_LEVELS, type LevelConfig } from './types.ts';

describe('LEVEL_CONFIGS', () => {
  it('has one well-formed entry per level', () => {
    for (const level of ENGINE_LEVELS) {
      const config = LEVEL_CONFIGS[level];
      expect(config.level).toBe(level);
      if (config.kind === 'bot') {
        expect(level).toBeLessThanOrEqual(4);
        expect(config.mistakeRate).toBeGreaterThanOrEqual(0);
        expect(config.mistakeRate).toBeLessThan(1);
      } else {
        expect(level).toBeGreaterThanOrEqual(5);
        expect(config.skillLevel).toBeGreaterThanOrEqual(0);
        expect(config.skillLevel).toBeLessThanOrEqual(20);
        expect(config.movetimeMs).toBeGreaterThan(0);
        expect(config.multiPv).toBeGreaterThanOrEqual(1);
      }
    }
    expect(LEVEL_CONFIGS[FALLBACK_LEVEL].kind).toBe('bot');
  });

  it('Stockfish strength never decreases with the level', () => {
    const stockfish = ENGINE_LEVELS.map((level) => LEVEL_CONFIGS[level]).filter(
      (config): config is Extract<LevelConfig, { kind: 'stockfish' }> =>
        config.kind === 'stockfish',
    );
    for (let index = 1; index < stockfish.length; index += 1) {
      const previous = stockfish[index - 1];
      const current = stockfish[index];
      if (!previous || !current) continue;
      expect(current.skillLevel).toBeGreaterThanOrEqual(previous.skillLevel);
      expect(current.movetimeMs).toBeGreaterThanOrEqual(previous.movetimeMs);
      expect(current.multiPv).toBeLessThanOrEqual(previous.multiPv);
    }
  });
});
