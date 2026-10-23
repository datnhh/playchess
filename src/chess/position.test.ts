import { describe, expect, it } from 'vitest';
import { checkPlacement, checkStandardFen, placementOf } from './position.ts';

describe('checkPlacement', () => {
  it('accepts an empty board and a lone piece', () => {
    expect(checkPlacement('8/8/8/8/8/8/8/8')).toBeNull();
    expect(checkPlacement('8/8/8/8/3R4/8/8/8')).toBeNull();
  });

  it('rejects wrong rank count, width and characters', () => {
    expect(checkPlacement('8/8/8')).toContain('cần 8 hàng');
    expect(checkPlacement('8/8/8/8/3R3/8/8/8')).toContain('7 ô');
    expect(checkPlacement('8/8/8/8/3X4/8/8/8')).toContain('ký tự không hợp lệ');
  });
});

describe('checkStandardFen', () => {
  it('accepts the starting position', () => {
    expect(checkStandardFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBeNull();
  });

  it('rejects a position without kings', () => {
    expect(checkStandardFen('8/8/8/8/3R4/8/8/8 w - - 0 1')).not.toBeNull();
  });
});

describe('placementOf', () => {
  it('returns the first FEN field', () => {
    expect(placementOf('8/8/8/8/3R4/8/8/8 w - - 0 1')).toBe('8/8/8/8/3R4/8/8/8');
    expect(placementOf('8/8/8/8/3R4/8/8/8')).toBe('8/8/8/8/3R4/8/8/8');
  });
});
