import { describe, expect, it } from 'vitest';
import {
  occupiedSquares,
  placementOf,
  squarePosition,
  toAutoShapes,
  toDests,
  toSquareClasses,
} from './boardMapping.ts';

describe('boardMapping', () => {
  it('draws arrows with tone brushes and turns circles into square fills', () => {
    const shapes = [
      { kind: 'arrow', from: 'e2', to: 'e4', tone: 'good' },
      { kind: 'circle', square: 'd5', tone: 'warn' },
      { kind: 'circle', square: 'a1', tone: 'info' },
      { kind: 'circle', square: 'd5', tone: 'good' },
    ] as const;
    expect(toAutoShapes(shapes)).toEqual([{ orig: 'e2', dest: 'e4', brush: 'green' }]);
    expect(toAutoShapes(undefined)).toEqual([]);
    expect([...toSquareClasses(shapes)]).toEqual([
      ['d5', 'board-hl board-hl--good'],
      ['a1', 'board-hl board-hl--info'],
    ]);
    expect(toSquareClasses(undefined).size).toBe(0);
  });

  it('lists occupied squares from a FEN', () => {
    expect([...occupiedSquares('8/3R4/8/8/8/8/8/k6K w - - 0 1')].sort()).toEqual([
      'a1',
      'd7',
      'h1',
    ]);
  });

  it('places squares for both orientations', () => {
    expect(squarePosition('a1', 'white')).toEqual({ leftPercent: 0, topPercent: 87.5 });
    expect(squarePosition('h8', 'white')).toEqual({ leftPercent: 87.5, topPercent: 0 });
    expect(squarePosition('a1', 'black')).toEqual({ leftPercent: 87.5, topPercent: 0 });
    expect(squarePosition('d4', 'black')).toEqual({ leftPercent: 50, topPercent: 37.5 });
  });

  it('maps check and dests', () => {
    const src = new Map([['d4', ['d5', 'e4']]] as const);
    const out = toDests(src);
    expect(out.get('d4')).toEqual(['d5', 'e4']);
    expect(out.get('d4')).not.toBe(src.get('d4'));
  });

  it('extracts the placement field', () => {
    expect(placementOf('8/8/8/8/3R4/8/8/8 w - - 0 1')).toBe('8/8/8/8/3R4/8/8/8');
    expect(placementOf('8/8/8/8/3R4/8/8/8')).toBe('8/8/8/8/3R4/8/8/8');
  });
});
