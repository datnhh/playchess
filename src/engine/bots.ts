import { Chess, type Move, type PieceSymbol } from 'chess.js';
import type { PromotionRole, Square } from '../chess/types.ts';
import type { BotStrategy, EngineMove } from './types.ts';

/**
 * Weak TypeScript opponents for levels 1–4. Every source of randomness comes from an injected
 * RNG so that tests (and the calibration script) are deterministic for a given seed.
 */

export type Rng = () => number;

/** Small, fast seedable PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

const MATE_SCORE = 100_000;

const PROMOTION_ROLES: Record<string, PromotionRole> = {
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
};

const PROMOTION_SYMBOLS: Record<PromotionRole, PieceSymbol> = {
  queen: 'q',
  rook: 'r',
  bishop: 'b',
  knight: 'n',
};

export function toEngineMove(move: Move, source: EngineMove['source']): EngineMove {
  const result: EngineMove = { from: move.from as Square, to: move.to as Square, source };
  const role = move.promotion ? PROMOTION_ROLES[move.promotion] : undefined;
  if (role) result.promotion = role;
  return result;
}

/** Converts a UCI move such as `e7e8q` into an EngineMove. */
export function uciToEngineMove(uci: string, source: EngineMove['source']): EngineMove {
  const result: EngineMove = {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    source,
  };
  const role = PROMOTION_ROLES[uci.slice(4, 5)];
  if (role) result.promotion = role;
  return result;
}

export function engineMoveToUci(move: { from: string; to: string; promotion?: PromotionRole }) {
  return `${move.from}${move.to}${move.promotion ? PROMOTION_SYMBOLS[move.promotion] : ''}`;
}

function pick<T>(items: readonly T[], rng: Rng): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('pick() on an empty list');
  return item;
}

/** Picks one of the best-scoring items at random, so equal moves do not always repeat. */
function pickBest<T>(items: readonly T[], score: (item: T) => number, rng: Rng): T {
  let best = -Infinity;
  let candidates: T[] = [];
  for (const item of items) {
    const value = score(item);
    if (value > best) {
      best = value;
      candidates = [item];
    } else if (value === best) {
      candidates.push(item);
    }
  }
  return pick(candidates, rng);
}

function rankOf(square: string): number {
  return Number(square[1]);
}

/** Random move with a slight preference (weight 2 vs 1) for moves that advance toward the enemy. */
function randomMove(moves: Move[], rng: Rng): Move {
  const weights = moves.map((move) => {
    const forward =
      move.color === 'w'
        ? rankOf(move.to) - rankOf(move.from)
        : rankOf(move.from) - rankOf(move.to);
    return forward > 0 ? 2 : 1;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng() * total;
  for (let index = 0; index < moves.length; index += 1) {
    roll -= weights[index] ?? 0;
    if (roll < 0) return moves[index] as Move;
  }
  return moves[moves.length - 1] as Move;
}

function greedyMove(moves: Move[], rng: Rng): Move {
  const captures = moves.filter((move) => move.captured);
  if (captures.length === 0) return randomMove(moves, rng);
  return pickBest(captures, (move) => PIECE_VALUES[move.captured ?? 'p'], rng);
}

const CENTER = new Set(['d4', 'd5', 'e4', 'e5']);
const WIDE_CENTER = new Set([
  'c3',
  'c4',
  'c5',
  'c6',
  'd3',
  'd6',
  'e3',
  'e6',
  'f3',
  'f4',
  'f5',
  'f6',
]);

/** Material plus a small centre bonus, from the point of view of `color`. */
function simpleEval(chess: Chess, color: 'w' | 'b'): number {
  let score = 0;
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell) continue;
      let value = PIECE_VALUES[cell.type];
      if (cell.type !== 'k') {
        if (CENTER.has(cell.square)) value += 20;
        else if (WIDE_CENTER.has(cell.square)) value += 8;
      }
      score += cell.color === color ? value : -value;
    }
  }
  return score;
}

function onePlyMove(chess: Chess, moves: Move[], rng: Rng): Move {
  const color = chess.turn();
  return pickBest(
    moves,
    (move) => {
      chess.move(move);
      let score: number;
      if (chess.isCheckmate()) score = MATE_SCORE;
      else if (chess.isDraw()) score = 0;
      else score = simpleEval(chess, color);
      chess.undo();
      return score;
    },
    rng,
  );
}

// Piece-square tables (white's view, index 0 = a8 … 63 = h1), simplified from classic values.
const PST: Record<PieceSymbol, readonly number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5,
    10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20,
    -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10,
    0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10,
    5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0,
    -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10,
    -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0,
    0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0,
    5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0,
    0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40,
    -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30,
    -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0,
    10, 30, 20,
  ],
};

/** Material + piece-square tables, from the point of view of `color`. */
export function pstEval(chess: Chess, color: 'w' | 'b'): number {
  let score = 0;
  const board = chess.board();
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const cell = board[row]?.[col];
      if (!cell) continue;
      const index = cell.color === 'w' ? row * 8 + col : (7 - row) * 8 + col;
      const value = PIECE_VALUES[cell.type] + (PST[cell.type][index] ?? 0);
      score += cell.color === color ? value : -value;
    }
  }
  return score;
}

/** Negamax with alpha-beta; returns the score for the side to move. */
function negamax(chess: Chess, depth: number, alpha: number, beta: number, ply: number): number {
  if (chess.isCheckmate()) return -MATE_SCORE + ply;
  if (chess.isDraw()) return 0;
  if (depth === 0) return pstEval(chess, chess.turn());
  let best = -Infinity;
  // Captures first improves pruning.
  const moves = chess
    .moves({ verbose: true })
    .sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));
  for (const move of moves) {
    chess.move(move);
    const score = -negamax(chess, depth - 1, -beta, -alpha, ply + 1);
    chess.undo();
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

function twoPlyMove(chess: Chess, moves: Move[], rng: Rng): Move {
  // Full-window search per root move so ties are exact and can be broken by the RNG.
  return pickBest(
    moves,
    (move) => {
      chess.move(move);
      const score = -negamax(chess, 1, -Infinity, Infinity, 1);
      chess.undo();
      return score;
    },
    rng,
  );
}

export interface BotOptions {
  strategy: BotStrategy;
  mistakeRate?: number;
  rng: Rng;
}

/** Chooses a legal move for the side to move. Throws if the game is already over. */
export function chooseBotMove(
  fen: string,
  { strategy, mistakeRate = 0, rng }: BotOptions,
): EngineMove {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) throw new Error('No legal moves');
  let move: Move;
  if (mistakeRate > 0 && rng() < mistakeRate) {
    move = pick(moves, rng);
  } else {
    switch (strategy) {
      case 'random':
        move = randomMove(moves, rng);
        break;
      case 'greedy':
        move = greedyMove(moves, rng);
        break;
      case 'onePly':
        move = onePlyMove(chess, moves, rng);
        break;
      case 'twoPly':
        move = twoPlyMove(chess, moves, rng);
        break;
    }
  }
  return toEngineMove(move, 'bot');
}
