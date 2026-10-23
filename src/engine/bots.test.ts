import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { chooseBotMove, engineMoveToUci, mulberry32 } from './bots.ts';
import type { BotStrategy } from './types.ts';

const STRATEGIES: BotStrategy[] = ['random', 'greedy', 'onePly', 'twoPly'];
const MIDDLEGAME = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';

describe('bots', () => {
  it.each(STRATEGIES)('%s plays legal, seed-deterministic moves', (strategy) => {
    const first = chooseBotMove(MIDDLEGAME, { strategy, rng: mulberry32(7) });
    const again = chooseBotMove(MIDDLEGAME, { strategy, rng: mulberry32(7) });
    expect(again).toEqual(first);
    expect(first.source).toBe('bot');
    expect(() => new Chess(MIDDLEGAME).move(engineMoveToUci(first))).not.toThrow();
  });

  it('plays a whole game with legal moves only', () => {
    const chess = new Chess();
    const rng = mulberry32(1);
    for (let ply = 0; ply < 60 && !chess.isGameOver(); ply += 1) {
      const move = chooseBotMove(chess.fen(), { strategy: 'random', mistakeRate: 0.5, rng });
      chess.move(engineMoveToUci(move));
    }
    expect(chess.history().length).toBeGreaterThan(10);
  });

  it('greedy captures the queen rather than a pawn', () => {
    // White knight on e4 can take the queen on d6 or the pawn on f6.
    const fen = '4k3/8/3q1p2/8/4N3/8/8/4K3 w - - 0 1';
    for (let seed = 0; seed < 5; seed += 1) {
      const move = chooseBotMove(fen, { strategy: 'greedy', rng: mulberry32(seed) });
      expect(engineMoveToUci(move)).toBe('e4d6');
    }
  });

  it('onePly always takes a mate in one', () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
    for (let seed = 0; seed < 5; seed += 1) {
      const move = chooseBotMove(fen, { strategy: 'onePly', rng: mulberry32(seed) });
      expect(engineMoveToUci(move)).toBe('a1a8');
    }
  });

  it('twoPly does not leave its queen en prise', () => {
    // The black pawn on e5 attacks the white queen on d4.
    const fen = '4k3/8/8/4p3/3Q4/8/8/4K3 w - - 0 1';
    for (let seed = 0; seed < 5; seed += 1) {
      const move = chooseBotMove(fen, { strategy: 'twoPly', rng: mulberry32(seed) });
      const chess = new Chess(fen);
      chess.move(engineMoveToUci(move));
      const queen = chess.findPiece({ type: 'q', color: 'w' })[0];
      expect(queen).toBeDefined();
      if (queen) expect(chess.isAttacked(queen, 'b')).toBe(false);
    }
  });

  it('reports promotions with a promotion role', () => {
    const fen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1';
    const move = chooseBotMove(fen, { strategy: 'twoPly', rng: mulberry32(3) });
    expect(move).toMatchObject({ from: 'a7', to: 'a8', promotion: 'queen' });
  });
});
