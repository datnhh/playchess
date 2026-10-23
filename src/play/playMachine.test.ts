import { describe, expect, it } from 'vitest';
import type { Hint } from '../engine/types.ts';
import {
  canUndo,
  checkSquareOf,
  lastMoveOf,
  playReducer,
  startGame,
  START_FEN,
} from './playMachine.ts';
import type { PlayAction, PlayState } from './playMachine.ts';

function run(state: PlayState, ...actions: PlayAction[]): PlayState {
  return actions.reduce(playReducer, state);
}

const engine = (state: PlayState, from: string, to: string): PlayAction => ({
  type: 'engineMove',
  move: { from: from as 'e7', to: to as 'e5' },
  requestId: state.engineRequestId,
});

const hint: Hint = { move: { from: 'e2', to: 'e4', source: 'bot' }, reason: 'bestMove' };

describe('playReducer', () => {
  it('starts as white with the child to move', () => {
    const state = startGame(1, 'white');
    expect(state.fen).toBe(START_FEN);
    expect(state.status).toBe('childTurn');
  });

  it('starts as black with the engine to move', () => {
    const state = playReducer(startGame(1, 'white'), {
      type: 'start',
      level: 3,
      childColor: 'black',
    });
    expect(state.status).toBe('engineTurn');
    expect(state.level).toBe(3);
    const after = playReducer(state, engine(state, 'e2', 'e4'));
    expect(after.status).toBe('childTurn');
    expect(lastMoveOf(after)).toEqual(['e2', 'e4']);
  });

  it('applies a legal child move and ignores an illegal one', () => {
    const start = startGame(1, 'white');
    expect(playReducer(start, { type: 'childMove', from: 'e2', to: 'e5' })).toBe(start);
    const moved = playReducer(start, { type: 'childMove', from: 'e2', to: 'e4' });
    expect(moved.status).toBe('engineTurn');
    expect(moved.moves[0]?.san).toBe('e4');
    // Not the child's turn any more.
    expect(playReducer(moved, { type: 'childMove', from: 'd2', to: 'd4' })).toBe(moved);
  });

  it('applies the engine move and drops a stale one', () => {
    const moved = playReducer(startGame(1, 'white'), { type: 'childMove', from: 'e2', to: 'e4' });
    const stale = { ...engine(moved, 'e7', 'e5'), requestId: moved.engineRequestId - 1 };
    expect(playReducer(moved, stale)).toBe(moved);
    const answered = playReducer(moved, engine(moved, 'e7', 'e5'));
    expect(answered.status).toBe('childTurn');
    expect(answered.moves).toHaveLength(2);
  });

  it('undoes two plies after the engine answered', () => {
    let state = run(startGame(1, 'white'), { type: 'childMove', from: 'e2', to: 'e4' });
    state = run(state, engine(state, 'e7', 'e5'));
    const undone = playReducer(state, { type: 'undo' });
    expect(undone.fen).toBe(START_FEN);
    expect(undone.status).toBe('childTurn');
    expect(canUndo(undone)).toBe(false);
  });

  it('undoes one ply and cancels the pending engine move', () => {
    const moved = playReducer(startGame(1, 'white'), { type: 'childMove', from: 'e2', to: 'e4' });
    const pending = engine(moved, 'e7', 'e5');
    const undone = playReducer(moved, { type: 'undo' });
    expect(undone.fen).toBe(START_FEN);
    expect(undone.moves).toHaveLength(0);
    expect(playReducer(undone, pending)).toBe(undone);
  });

  it('waits for a promotion choice', () => {
    const state = startGame(1, 'white', '8/P6k/8/8/8/8/8/K7 w - - 0 1');
    const waiting = playReducer(state, { type: 'childMove', from: 'a7', to: 'a8' });
    expect(waiting.status).toBe('awaitingPromotion');
    expect(playReducer(waiting, { type: 'cancelPromotion' }).status).toBe('childTurn');
    const promoted = playReducer(waiting, { type: 'pickPromotion', role: 'rook' });
    expect(promoted.fen.startsWith('R7/')).toBe(true);
    expect(promoted.status).toBe('engineTurn');
  });

  it('detects checkmate as a win for the child', () => {
    const state = startGame(1, 'white', '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    const mated = playReducer(state, { type: 'childMove', from: 'a1', to: 'a8' });
    expect(mated.result).toEqual({ outcome: 'win', reason: 'checkmate' });
    expect(mated.status).toBe('over');
    expect(checkSquareOf(mated.fen)).toBe('g8');
  });

  it('detects checkmate by the engine as a loss', () => {
    let state = run(startGame(1, 'white'), { type: 'childMove', from: 'f2', to: 'f3' });
    state = run(state, engine(state, 'e7', 'e5'), { type: 'childMove', from: 'g2', to: 'g4' });
    state = run(state, engine(state, 'd8', 'h4'));
    expect(state.result).toEqual({ outcome: 'loss', reason: 'checkmate' });
  });

  it('detects stalemate', () => {
    const state = startGame(1, 'white', 'k7/8/1Q6/8/8/8/8/7K w - - 0 1');
    const after = playReducer(state, { type: 'childMove', from: 'b6', to: 'c7' });
    expect(after.result).toEqual({ outcome: 'draw', reason: 'stalemate' });
  });

  it('detects insufficient material', () => {
    const state = startGame(1, 'white', 'k7/8/8/8/8/8/1r6/K7 w - - 0 1');
    const after = playReducer(state, { type: 'childMove', from: 'a1', to: 'b2' });
    expect(after.result).toEqual({ outcome: 'draw', reason: 'insufficientMaterial' });
  });

  it('detects threefold repetition', () => {
    let state = startGame(1, 'white');
    for (let i = 0; i < 2; i += 1) {
      state = run(state, { type: 'childMove', from: 'g1', to: 'f3' });
      state = run(state, engine(state, 'g8', 'f6'), { type: 'childMove', from: 'f3', to: 'g1' });
      state = run(state, engine(state, 'f6', 'g8'));
    }
    expect(state.result).toEqual({ outcome: 'draw', reason: 'threefoldRepetition' });
  });

  it('detects the 50-move rule', () => {
    const state = startGame(1, 'white', 'k7/8/8/8/8/7r/R7/K7 w - - 99 80');
    const after = playReducer(state, { type: 'childMove', from: 'a2', to: 'b2' });
    expect(after.result).toEqual({ outcome: 'draw', reason: 'fiftyMoveRule' });
  });

  it('clears the hint after a move and ignores stale hints', () => {
    const start = startGame(1, 'white');
    const hinted = playReducer(start, { type: 'showHint', hint, fen: start.fen });
    expect(hinted.hint).toBe(hint);
    const moved = playReducer(hinted, { type: 'childMove', from: 'e2', to: 'e4' });
    expect(moved.hint).toBeNull();
    expect(playReducer(moved, { type: 'showHint', hint, fen: START_FEN })).toBe(moved);
  });
});
