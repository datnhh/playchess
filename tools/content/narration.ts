import {
  COMMON_CLIPS,
  commonAudioKey,
  lessonAudioKey,
  type CommonClipId,
  type NarrationField,
} from '../../src/content/audio.ts';
import type { Lesson } from '../../src/content/schema.ts';

/** Every spoken text with its audio key. Shared by the validator, the TTS pipeline and the review page. */
export interface NarrationItem {
  key: string;
  text: string;
  /** null for common clips. */
  lessonId: string | null;
  stepId: string | null;
  field: NarrationField | null;
  reviewed: boolean;
}

const FIELDS: readonly NarrationField[] = ['say', 'praise', 'retry'];

export function lessonNarration(lesson: Lesson): NarrationItem[] {
  const items: NarrationItem[] = [];
  for (const step of lesson.steps) {
    for (const field of FIELDS) {
      const text = (step as Partial<Record<NarrationField, string>>)[field];
      if (text === undefined) continue;
      items.push({
        key: lessonAudioKey(lesson.id, step.id, field),
        text,
        lessonId: lesson.id,
        stepId: step.id,
        field,
        reviewed: lesson.reviewed,
      });
    }
  }
  return items;
}

export function commonNarration(): NarrationItem[] {
  return (Object.keys(COMMON_CLIPS) as CommonClipId[]).map((clipId) => ({
    key: commonAudioKey(clipId),
    text: COMMON_CLIPS[clipId],
    lessonId: null,
    stepId: null,
    field: null,
    reviewed: true,
  }));
}

export function allNarration(lessons: readonly Lesson[]): NarrationItem[] {
  return [...lessons.flatMap(lessonNarration), ...commonNarration()];
}
