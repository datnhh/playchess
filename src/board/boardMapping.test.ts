import { describe, expect, it } from 'vitest';
import { placementOf, squarePosition, toAutoShapes, toDests } from './boardMapping.ts';

describe('boardMapping', () => {
  it('maps tones to brushes', () => {
    expect(
      toAutoShapes([
        { kind: 'arrow', from: 'e2', to: 'e4', tone: 'good' },
        { kind: 'circle', square: 'd5', tone: 'warn' },
        { kind: 'circle', square: 'a1', tone: 'info' },
      ]),
    ).toEqual([
      { orig: 'e2', dest: 'e4', brush: 'green' },
      { orig: 'd5', brush: 'red' },
      { orig: 'a1', brush: 'blue' },
    ]);
    expect(toAutoShapes(undefined)).toEqual([]);
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
