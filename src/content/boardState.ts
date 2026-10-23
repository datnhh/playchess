import { Chess } from 'chess.js';
import type { BoardShape, BoardSticker } from '../board/types.ts';
import type { BoardMode } from '../chess/dests.ts';
import { applySandboxMove, parsePlacement, serializePlacement } from '../chess/sandbox.ts';
import type { MoveIntent, PromotionRole, Square } from '../chess/types.ts';
import type { LessonAction } from './schema.ts';

/**
 * What the board shows during a lesson, and how lesson actions change it.
 * Pure functions: the lesson player renders the result, the content validator replays the same
 * actions to check assertions, so both always agree on the position after each step.
 */

export interface LessonBoardState {
  position: string;
  shapes: BoardShape[];
  stickers: BoardSticker[];
  lastMove: readonly [Square, Square] | null;
}

export type ApplyResult = { ok: true; state: LessonBoardState } | { ok: false; error: string };

const PROMOTION_LETTER: Readonly<Record<PromotionRole, string>> = {
  queen: 'q',
  rook: 'r',
  bishop: 'b',
  knight: 'n',
};

export function createBoardState(position: string): LessonBoardState {
  return { position, shapes: [], stickers: [], lastMove: null };
}

export function applyMove(state: LessonBoardState, move: MoveIntent, mode: BoardMode): ApplyResult {
  const label = `${move.from}-${move.to}`;
  if (mode === 'sandbox') {
    const next = applySandboxMove(
      parsePlacement(state.position),
      move.from,
      move.to,
      move.promotion,
    );
    if (!next) return { ok: false, error: `Nước ${label} không hợp lệ` };
    return {
      ok: true,
      state: { ...state, position: serializePlacement(next), lastMove: [move.from, move.to] },
    };
  }

  try {
    const chess = new Chess(state.position);
    chess.move({
      from: move.from,
      to: move.to,
      ...(move.promotion ? { promotion: PROMOTION_LETTER[move.promotion] } : {}),
    });
    return { ok: true, state: { ...state, position: chess.fen(), lastMove: [move.from, move.to] } };
  } catch {
    return { ok: false, error: `Nước ${label} không hợp lệ` };
  }
}

export function applyAction(
  state: LessonBoardState,
  action: LessonAction,
  mode: BoardMode,
): ApplyResult {
  switch (action.type) {
    case 'setPosition':
      return { ok: true, state: { ...state, position: action.position, lastMove: null } };
    case 'move':
      return applyMove(
        state,
        {
          from: action.from,
          to: action.to,
          ...(action.promotion ? { promotion: action.promotion } : {}),
        },
        mode,
      );
    case 'highlight':
      return {
        ok: true,
        state: {
          ...state,
          shapes: [
            ...state.shapes,
            ...action.squares.map((square) => ({
              kind: 'circle' as const,
              square,
              tone: action.tone,
            })),
          ],
        },
      };
    case 'arrow':
      return {
        ok: true,
        state: {
          ...state,
          shapes: [
            ...state.shapes,
            { kind: 'arrow', from: action.from, to: action.to, tone: action.tone },
          ],
        },
      };
    case 'stickers':
      return { ok: true, state: { ...state, stickers: [...action.items] } };
    case 'clear':
      return {
        ok: true,
        state: {
          ...state,
          shapes: action.target === 'stickers' ? state.shapes : [],
          stickers: action.target === 'shapes' ? state.stickers : [],
        },
      };
  }
}

export function applyActions(
  state: LessonBoardState,
  actions: readonly LessonAction[],
  mode: BoardMode,
): ApplyResult {
  let current = state;
  for (const [index, action] of actions.entries()) {
    const result = applyAction(current, action, mode);
    if (!result.ok) return { ok: false, error: `Hành động ${index + 1}: ${result.error}` };
    current = result.state;
  }
  return { ok: true, state: current };
}
