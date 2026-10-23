import type { Lesson, Track } from '../content/schema.ts';
import type { Progress } from '../services/storage.ts';

/** Lessons of one track, in order. */
export function lessonsOfTrack(lessons: readonly Lesson[], track: Track): Lesson[] {
  return lessons.filter((lesson) => lesson.track === track).sort((a, b) => a.order - b.order);
}

/** Stars earned for a lesson (0 when never completed). */
export function starsOf(progress: Progress, lessonId: string): number {
  return progress.lessons[lessonId]?.stars ?? 0;
}

/** First lesson of the (ordered) list without any star, or undefined when all have stars. */
export function recommendedLesson(
  lessons: readonly Lesson[],
  progress: Progress,
): Lesson | undefined {
  return lessons.find((lesson) => starsOf(progress, lesson.id) === 0);
}

/** The lesson after `lessonId` in the same track, or undefined when it is the last one. */
export function nextLessonAfter(lessons: readonly Lesson[], lessonId: string): Lesson | undefined {
  const current = lessons.find((lesson) => lesson.id === lessonId);
  if (!current) return undefined;
  return lessonsOfTrack(lessons, current.track).find((lesson) => lesson.order > current.order);
}

/** Records a completion, keeping the best star count; the date is the latest completion. */
export function mergeStars(
  progress: Progress,
  lessonId: string,
  stars: number,
  completedAt: string,
): Progress {
  const clamped = Math.max(0, Math.min(3, Math.round(stars)));
  const best = Math.max(starsOf(progress, lessonId), clamped);
  return { lessons: { ...progress.lessons, [lessonId]: { stars: best, completedAt } } };
}
