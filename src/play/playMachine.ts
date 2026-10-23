import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type { MoveIntent, PieceColor, PromotionRole, Square } from '../chess/types.ts';
import type { EngineLevel, Hint } from '../engine/types.ts';
import type { GameOutcome } from '../services/storage.ts';

/**
 * Pure game state for "play against the computer". Every transition rebuilds positions from the FEN
 * history with chess.js, so the reducer stays testable without React and undo is trivial.
 */

export type GameOverReason =
  'checkmate' | 'stalemate' | 'insufficientMaterial' | 'threefoldRepetition' | 'fiftyMoveRule';

export interface GameResult {
  /** From the child's point of view. */
  outcome: GameOutcome;
  reason: GameOverReason;
}

export type PlayStatus = 'childTurn' | 'engineTurn' | 'awaitingPromotion' | 'over';

export interface PlayedMove {
  from: Square;
  to: Square;
  san: string;
  captured: boolean;
  /** True when this move gave check. */
  check: boolean;
  /** Who played it, to know how many plies undo must remove. */
  by: 'child' | 'engine';
}

export interface PlayState {
  level: EngineLevel;
  childColor: PieceColor;
  fen: string;
  /** FEN before each move in `moves` (same length): undo restores from here. */
  fenHistory: readonly string[];
  moves: readonly PlayedMove[];
  status: PlayStatus;
  pendingPromotion: { from: Square; to: Square } | null;
  hint: Hint | null;
  result: GameResult | null;
  /** Bumped whenever a pending engine move must be discarded (undo, new game). */
  engineRequestId: number;
}

export type PlayAction =
  | { type: 'start'; level: EngineLevel; childColor: PieceColor }
  | { type: 'childMove'; from: Square; to: Square }
  | { type: 'pickPromotion'; role: PromotionRole }
  | { type: 'cancelPromotion' }
  | { type: 'engineMove'; move: MoveIntent; requestId: number }
  | { type: 'undo' }
  | { type: 'showHint'; hint: Hint; fen: string };

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const ROLE_TO_PIECE: Readonly<Record<PromotionRole, 'q' | 'r' | 'b' | 'n'>> = {
  queen: 'q',
  rook: 'r',
  bishop: 'b',
  knight: 'n',
};

export function colorToMove(fen: string): PieceColor {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

function promotionOf(san: string): PromotionRole | undefined {
  const match = /=([QRBN])/.exec(san);
  if (!match) return undefined;
  const map = { Q: 'queen', R: 'rook', B: 'bishop', N: 'knight' } as const;
  return map[match[1] as 'Q' | 'R' | 'B' | 'N'];
}

/** Replays the moves from the first position so chess.js can detect threefold repetition. */
function rebuild(state: Pick<PlayState, 'fenHistory' | 'moves'>): Chess {
  const chess = new Chess(state.fenHistory[0] ?? START_FEN);
  for (const move of state.moves) {
    const promotion = promotionOf(move.san);
    chess.move({
      from: move.from,
      to: move.to,
      ...(promotion ? { promotion: ROLE_TO_PIECE[promotion] } : {}),
    });
  }
  return chess;
}

export function detectResult(chess: Chess, childColor: PieceColor): GameResult | null {
  if (chess.isCheckmate()) {
    const loser = chess.turn() === 'w' ? 'white' : 'black';
    return { outcome: loser === childColor ? 'loss' : 'win', reason: 'checkmate' };
  }
  if (chess.isStalemate()) return { outcome: 'draw', reason: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { outcome: 'draw', reason: 'insufficientMaterial' };
  if (chess.isThreefoldRepetition()) return { outcome: 'draw', reason: 'threefoldRepetition' };
  if (chess.isDrawByFiftyMoves()) return { outcome: 'draw', reason: 'fiftyMoveRule' };
  return null;
}

function statusFor(fen: string, childColor: PieceColor, result: GameResult | null): PlayStatus {
  if (result) return 'over';
  return colorToMove(fen) === childColor ? 'childTurn' : 'engineTurn';
}

export function startGame(
  level: EngineLevel,
  childColor: PieceColor,
  fen: string = START_FEN,
  engineRequestId = 0,
): PlayState {
  const result = detectResult(new Chess(fen), childColor);
  return {
    level,
    childColor,
    fen,
    fenHistory: [],
    moves: [],
    status: statusFor(fen, childColor, result),
    pendingPromotion: null,
    hint: null,
    result,
    engineRequestId,
  };
}

function applyMove(state: PlayState, intent: MoveIntent, by: 'child' | 'engine'): PlayState {
  const chess = state.moves.length === 0 ? new Chess(state.fen) : rebuild(state);
  let move: Move;
  try {
    move = chess.move({
      from: intent.from,
      to: intent.to,
      ...(intent.promotion ? { promotion: ROLE_TO_PIECE[intent.promotion] } : {}),
    });
  } catch {
    return state;
  }
  const played: PlayedMove = {
    from: intent.from,
    to: intent.to,
    san: move.san,
    captured: move.isCapture() || move.isEnPassant(),
    check: chess.inCheck(),
    by,
  };
  const fen = chess.fen();
  const result = detectResult(chess, state.childColor);
  return {
    ...state,
    fen,
    fenHistory: [...state.fenHistory, state.fen],
    moves: [...state.moves, played],
    status: statusFor(fen, state.childColor, result),
    pendingPromotion: null,
    hint: null,
    result,
  };
}

function needsPromotion(fen: string, from: Square, to: Square): boolean {
  return new Chess(fen)
    .moves({ square: from, verbose: true })
    .some((move) => move.to === to && move.promotion !== undefined);
}

function isLegal(fen: string, from: Square, to: Square): boolean {
  return new Chess(fen).moves({ square: from, verbose: true }).some((move) => move.to === to);
}

export function playReducer(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case 'start':
      return startGame(action.level, action.childColor, START_FEN, state.engineRequestId + 1);
    case 'childMove': {
      if (state.status !== 'childTurn' || !isLegal(state.fen, action.from, action.to)) return state;
      if (needsPromotion(state.fen, action.from, action.to)) {
        return {
          ...state,
          status: 'awaitingPromotion',
          pendingPromotion: { from: action.from, to: action.to },
        };
      }
      return applyMove(state, { from: action.from, to: action.to }, 'child');
    }
    case 'pickPromotion': {
      if (state.status !== 'awaitingPromotion' || !state.pendingPromotion) return state;
      const { from, to } = state.pendingPromotion;
      return applyMove(
        { ...state, status: 'childTurn' },
        { from, to, promotion: action.role },
        'child',
      );
    }
    case 'cancelPromotion':
      if (state.status !== 'awaitingPromotion') return state;
      return { ...state, status: 'childTurn', pendingPromotion: null };
    case 'engineMove':
      if (state.status !== 'engineTurn' || action.requestId !== state.engineRequestId) return state;
      return applyMove(state, action.move, 'engine');
    case 'undo':
      return undo(state);
    case 'showHint':
      // A hint computed for an older position is stale.
      if (state.status !== 'childTurn' || action.fen !== state.fen) return state;
      return { ...state, hint: action.hint };
  }
}

/** Goes back to just before the child's last move (2 plies, or 1 if the engine had not answered). */
function undo(state: PlayState): PlayState {
  let index = -1;
  for (let i = state.moves.length - 1; i >= 0; i -= 1) {
    if (state.moves[i]?.by === 'child') {
      index = i;
      break;
    }
  }
  if (index < 0) {
    if (state.status !== 'awaitingPromotion') return state;
    return { ...state, status: 'childTurn', pendingPromotion: null };
  }
  const fen = state.fenHistory[index] ?? START_FEN;
  return {
    ...state,
    fen,
    fenHistory: state.fenHistory.slice(0, index),
    moves: state.moves.slice(0, index),
    status: statusFor(fen, state.childColor, null),
    pendingPromotion: null,
    hint: null,
    result: null,
    engineRequestId: state.engineRequestId + 1,
  };
}

export function canUndo(state: PlayState): boolean {
  return state.moves.some((move) => move.by === 'child');
}

export function lastMoveOf(state: PlayState): readonly [Square, Square] | undefined {
  const last = state.moves[state.moves.length - 1];
  return last ? [last.from, last.to] : undefined;
}

/** King square of the side to move when it is in check (for the red highlight). */
export function checkSquareOf(fen: string): Square | undefined {
  const chess = new Chess(fen);
  if (!chess.inCheck()) return undefined;
  const color = chess.turn();
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell && cell.type === 'k' && cell.color === color) return cell.square as Square;
    }
  }
  return undefined;
}
