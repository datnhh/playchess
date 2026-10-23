import { describe, expect, it } from 'vitest';
import { applyActions, applyMove, createBoardState } from './boardState.ts';
import { lessonSchema } from './schema.ts';
import rookLesson from '../../content/lessons/sprout/rook.json';

describe('applyActions', () => {
  it('replays every step of the sample lesson without errors', () => {
    const lesson = lessonSchema.parse(rookLesson);
    let state = createBoardState(lesson.start);
    for (const step of lesson.steps) {
      const result = applyActions(state, step.actions, lesson.boardMode);
      expect(result.ok, result.ok ? '' : result.error).toBe(true);
      if (result.ok) state = result.state;
    }
  });

  it('builds shapes and stickers, and clears them selectively', () => {
    const start = createBoardState('8/8/8/8/3R4/8/8/8');
    const result = applyActions(
      start,
      [
        { type: 'highlight', squares: ['d5', 'd6'], tone: 'info' },
        { type: 'arrow', from: 'd4', to: 'd8', tone: 'good' },
        { type: 'stickers', items: [{ square: 'd8', kind: 'star' }] },
        { type: 'clear', target: 'shapes' },
      ],
      'sandbox',
    );
    expect(result.ok && result.state.shapes).toEqual([]);
    expect(result.ok && result.state.stickers).toEqual([{ square: 'd8', kind: 'star' }]);
  });

  it('reports the failing action index', () => {
    const result = applyActions(
      createBoardState('8/8/8/8/3R4/8/8/8'),
      [{ type: 'move', from: 'd4', to: 'e5' }],
      'sandbox',
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('Hành động 1');
  });
});

describe('applyMove (standard)', () => {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('plays legal moves with chess.js', () => {
    const result = applyMove(createBoardState(start), { from: 'e2', to: 'e4' }, 'standard');
    // chess.js only records an en-passant square when a capture is actually possible.
    expect(result.ok && result.state.position).toMatch(
      /^rnbqkbnr\/pppppppp\/8\/8\/4P3\/8\/PPPP1PPP\/RNBQKBNR b KQkq /,
    );
    expect(result.ok && result.state.lastMove).toEqual(['e2', 'e4']);
  });

  it('rejects illegal moves without throwing', () => {
    expect(applyMove(createBoardState(start), { from: 'e2', to: 'e5' }, 'standard').ok).toBe(false);
  });
});
