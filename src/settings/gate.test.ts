import { describe, expect, it } from 'vitest';
import { checkGateAnswer, createGateQuestion } from './gate.ts';

describe('parental gate', () => {
  it('keeps factors between 3 and 9', () => {
    expect(createGateQuestion(() => 0)).toEqual({ a: 3, b: 3 });
    expect(createGateQuestion(() => 0.999999)).toEqual({ a: 9, b: 9 });
    for (let i = 0; i < 200; i++) {
      const { a, b } = createGateQuestion();
      expect(a).toBeGreaterThanOrEqual(3);
      expect(b).toBeLessThanOrEqual(9);
      expect(Number.isInteger(a) && Number.isInteger(b)).toBe(true);
    }
  });

  it('checks the product', () => {
    const q = { a: 7, b: 8 };
    expect(checkGateAnswer(q, '56')).toBe(true);
    expect(checkGateAnswer(q, '54')).toBe(false);
    expect(checkGateAnswer(q, '')).toBe(false);
    expect(checkGateAnswer(q, '5x')).toBe(false);
  });
});
