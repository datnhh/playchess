import rawLessons from 'virtual:lessons';
import rawManifest from 'virtual:audio-manifest';
import type { AudioManifest } from './audio.ts';
import { lessonSchema, trackSchema, type Lesson } from './schema.ts';

/**
 * Lesson catalogue for the app. Content is injected at build time by tools/vite/lessonsPlugin.ts
 * (reviewed lessons only in production). Invalid lessons are skipped with a console error; the
 * content validator in CI is what keeps them out in the first place.
 */

const TRACK_ORDER = trackSchema.options;

let cache: readonly Lesson[] | null = null;

export function getLessons(): readonly Lesson[] {
  if (cache) return cache;
  const lessons: Lesson[] = [];
  for (const raw of rawLessons) {
    const parsed = lessonSchema.safeParse(raw);
    if (parsed.success) lessons.push(parsed.data);
    else console.error('Bài học không hợp lệ, đã bỏ qua', parsed.error.issues);
  }
  lessons.sort(
    (a, b) => TRACK_ORDER.indexOf(a.track) - TRACK_ORDER.indexOf(b.track) || a.order - b.order,
  );
  cache = lessons;
  return cache;
}

export function getLesson(id: string): Lesson | undefined {
  return getLessons().find((lesson) => lesson.id === id);
}

export function getAudioManifest(): AudioManifest {
  return rawManifest;
}
