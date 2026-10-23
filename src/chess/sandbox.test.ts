import { describe, expect, it } from 'vitest';
import {
  applySandboxMove,
  minMovesToCollect,
  parsePlacement,
  sandboxDestinations,
  serializePlacement,
} from './sandbox.ts';
import { legalDests } from './dests.ts';

const sorted = (values: string[]) => [...values].sort();

describe('placement parsing', () => {
  it('round-trips', () => {
    for (const placement of ['8/8/8/8/3R4/8/8/8', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR']) {
      expect(serializePlacement(parsePlacement(placement))).toBe(placement);
    }
  });
});

describe('sandboxDestinations', () => {
  it('rook moves along rank and file', () => {
    const pieces = parsePlacement('8/8/8/8/3R4/8/8/8');
    expect(sorted(sandboxDestinations(pieces, 'd4'))).toEqual(
      sorted(['d1', 'd2', 'd3', 'd5', 'd6', 'd7', 'd8', 'a4', 'b4', 'c4', 'e4', 'f4', 'g4', 'h4']),
    );
  });

  it('sliders stop at blockers and capture only the other colour', () => {
    // White rook d4, white pawn d6, black pawn f4.
    const pieces = parsePlacement('8/8/3P4/8/3R1p2/8/8/8');
    const dests = sandboxDestinations(pieces, 'd4');
    expect(dests).toContain('d5');
    expect(dests).not.toContain('d6');
    expect(dests).toContain('f4');
    expect(dests).not.toContain('g4');
  });

  it('knight jumps', () => {
    expect(sorted(sandboxDestinations(parsePlacement('8/8/8/8/8/8/8/N7'), 'a1'))).toEqual([
      'b3',
      'c2',
    ]);
  });

  it('pawn moves forward, double-steps from the start rank, captures diagonally', () => {
    const pieces = parsePlacement('8/8/8/8/8/2p5/3P4/8');
    expect(sorted(sandboxDestinations(pieces, 'd2'))).toEqual(['c3', 'd3', 'd4']);
  });

  it('king steps one square', () => {
    expect(sandboxDestinations(parsePlacement('8/8/8/8/8/8/8/K7'), 'a1')).toHaveLength(3);
  });
});

describe('applySandboxMove', () => {
  it('moves, captures and promotes', () => {
    const pieces = parsePlacement('3p4/4P3/8/8/8/8/8/8');
    const next = applySandboxMove(pieces, 'e7', 'd8');
    expect(next && serializePlacement(next)).toBe('3Q4/8/8/8/8/8/8/8');
  });

  it('rejects illegal moves', () => {
    expect(applySandboxMove(parsePlacement('8/8/8/8/3R4/8/8/8'), 'd4', 'e5')).toBeNull();
  });
});

describe('minMovesToCollect', () => {
  it('finds the shortest route through all targets', () => {
    const pieces = parsePlacement('8/8/8/8/3R4/8/8/8');
    expect(minMovesToCollect(pieces, 'd4', ['d7', 'a7', 'a2'], 4)).toBe(3);
  });

  it('returns null when the move budget is too small or a target is unreachable', () => {
    const rook = parsePlacement('8/8/8/8/3R4/8/8/8');
    expect(minMovesToCollect(rook, 'd4', ['d7', 'a7', 'a2'], 2)).toBeNull();
    const bishop = parsePlacement('8/8/8/8/3B4/8/8/8');
    expect(minMovesToCollect(bishop, 'd4', ['d5'], 10)).toBeNull();
  });
});

describe('legalDests', () => {
  it('uses chess.js in standard mode (side to move only)', () => {
    const dests = legalDests(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'standard',
    );
    expect(dests.get('g1')?.sort()).toEqual(['f3', 'h3']);
    expect(dests.has('g8')).toBe(false);
  });

  it('filters by colour in sandbox mode', () => {
    const dests = legalDests('8/8/8/3r4/3R4/8/8/8', 'sandbox', 'white');
    expect([...dests.keys()]).toEqual(['d4']);
  });
});
