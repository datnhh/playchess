import { describe, expect, it } from 'vitest';
import { lessonSchema, type LessonInput } from './schema.ts';
import rookLesson from '../../content/lessons/basic/rook.json';

const lessonFiles = import.meta.glob<unknown>('../../content/lessons/**/*.json', {
  eager: true,
  import: 'default',
});

function cloneSample(): LessonInput {
  return structuredClone(rookLesson) as LessonInput;
}

function issueMessages(input: unknown): string[] {
  const result = lessonSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('lesson files', () => {
  it('finds at least one lesson', () => {
    expect(Object.keys(lessonFiles).length).toBeGreaterThan(0);
  });

  for (const [path, content] of Object.entries(lessonFiles)) {
    it(`${path} matches the schema`, () => {
      const result = lessonSchema.safeParse(content);
      expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
    });

    it(`${path} id matches its file name and track folder`, () => {
      const lesson = lessonSchema.parse(content);
      const [, track, fileName] = path.match(/lessons\/([^/]+)\/([^/]+)\.json$/) ?? [];
      expect(lesson.track).toBe(track);
      expect(lesson.id).toBe(`${track}-${fileName}`);
    });
  }
});

describe('lessonSchema', () => {
  it('applies defaults', () => {
    const lesson = lessonSchema.parse(cloneSample());
    expect(lesson.orientation).toBe('white');
    expect(lesson.steps[0]?.assert).toEqual([]);
  });

  it('rejects duplicate step ids', () => {
    const input = cloneSample();
    input.steps[1]!.id = input.steps[0]!.id;
    expect(issueMessages(input).some((message) => message.includes('Trùng id bước'))).toBe(true);
  });

  it('rejects a malformed sandbox placement', () => {
    const input = cloneSample();
    input.start = '8/8/8/8/3R5/8/8/8';
    expect(issueMessages(input).some((message) => message.includes('hàng 4 có 9 ô'))).toBe(true);
  });

  it('rejects a standard FEN without kings', () => {
    const input = cloneSample();
    input.boardMode = 'standard';
    input.start = '8/8/8/8/3R4/8/8/8 w - - 0 1';
    input.steps = input.steps.filter((step) => step.kind !== 'watch' || !step.actions?.length);
    expect(issueMessages(input).some((message) => message.includes('chế độ standard'))).toBe(true);
  });

  it('accepts a legal standard FEN', () => {
    const input = cloneSample();
    input.boardMode = 'standard';
    input.start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    input.steps = [{ kind: 'watch', id: 'intro', say: 'Đây là bàn cờ.' }];
    expect(issueMessages(input)).toEqual([]);
  });

  it('rejects checkmate assertions in sandbox lessons', () => {
    const input = cloneSample();
    input.steps[0]!.assert = [{ type: 'checkmate' }];
    expect(
      issueMessages(input).some((message) => message.includes('chỉ dùng cho bài standard')),
    ).toBe(true);
  });

  it('rejects invalid squares and ids', () => {
    const input = cloneSample();
    input.id = 'Quân Xe';
    input.steps[0]!.actions = [{ type: 'highlight', squares: ['z9' as 'a1'] }];
    expect(lessonSchema.safeParse(input).success).toBe(false);
  });
});
