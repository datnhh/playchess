import { describe, expect, it } from 'vitest';
import type { Lesson } from '../content/schema.ts';
import { lessonsOfTrack, mergeStars, nextLessonAfter, recommendedLesson } from './progress.ts';

const lesson = (id: string, track: Lesson['track'], order: number) =>
  ({ id, track, order }) as Lesson;
const all = [lesson('b2', 'basic', 2), lesson('a1', 'advanced', 1), lesson('b1', 'basic', 1)];

describe('map progress helpers', () => {
  it('orders lessons of a track', () => {
    expect(lessonsOfTrack(all, 'basic').map((l) => l.id)).toEqual(['b1', 'b2']);
  });

  it('recommends the first lesson without stars', () => {
    const basic = lessonsOfTrack(all, 'basic');
    expect(recommendedLesson(basic, { lessons: {} })?.id).toBe('b1');
    const done = { lessons: { b1: { stars: 1, completedAt: 'x' } } };
    expect(recommendedLesson(basic, done)?.id).toBe('b2');
    const allDone = { lessons: { ...done.lessons, b2: { stars: 3, completedAt: 'x' } } };
    expect(recommendedLesson(basic, allDone)).toBeUndefined();
  });

  it('finds the next lesson in the same track only', () => {
    expect(nextLessonAfter(all, 'b1')?.id).toBe('b2');
    expect(nextLessonAfter(all, 'b2')).toBeUndefined();
    expect(nextLessonAfter(all, 'a1')).toBeUndefined();
    expect(nextLessonAfter(all, 'nope')).toBeUndefined();
  });

  it('keeps the best star count and the latest date', () => {
    const first = mergeStars({ lessons: {} }, 'b1', 3, 'd1');
    expect(first.lessons['b1']).toEqual({ stars: 3, completedAt: 'd1' });
    expect(mergeStars(first, 'b1', 1, 'd2').lessons['b1']).toEqual({ stars: 3, completedAt: 'd2' });
    expect(mergeStars(first, 'b2', 9, 'd3').lessons['b2']?.stars).toBe(3);
  });
});
