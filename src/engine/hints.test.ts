import { describe, expect, it } from 'vitest';
import { classifyHint } from './hints.ts';

describe('classifyHint', () => {
  it('escapeCheck when the side to move is in check', () => {
    expect(classifyHint('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1', { from: 'e1', to: 'e2' })).toBe(
      'escapeCheck',
    );
  });

  it('deliverCheckmate for a mating move', () => {
    expect(classifyHint('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', { from: 'a1', to: 'a8' })).toBe(
      'deliverCheckmate',
    );
  });

  it('captureFreePiece only when the captured piece was undefended', () => {
    expect(classifyHint('4k3/8/8/3n4/8/8/8/3RK3 w - - 0 20', { from: 'd1', to: 'd5' })).toBe(
      'captureFreePiece',
    );
    expect(classifyHint('4k3/8/4p3/3n4/8/8/8/3RK3 w - - 0 20', { from: 'd1', to: 'd5' })).toBe(
      'bestMove',
    );
  });

  it('developPiece for minor pieces and castling in the opening only', () => {
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    expect(classifyHint(afterE4, { from: 'g8', to: 'f6' })).toBe('developPiece');
    const italian = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 6 5';
    expect(classifyHint(italian, { from: 'e1', to: 'g1' })).toBe('developPiece');
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(classifyHint(start, { from: 'e2', to: 'e4' })).toBe('bestMove');
    expect(classifyHint('4k3/8/8/8/8/8/8/1N2K3 w - - 0 30', { from: 'b1', to: 'c3' })).toBe(
      'bestMove',
    );
  });
});
