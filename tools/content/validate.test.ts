import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AudioManifest } from '../../src/content/audio.ts';
import { audioFileName } from '../tts/config.ts';
import { audioHash } from '../tts/hash.ts';
import { readLessonFiles, readManifest, listAudioFiles } from './files.ts';
import { validateLessons, type ValidationInput } from './validate.ts';

const FILE = 'content/lessons/basic/test.json';

function baseLesson(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: 'basic-test',
    track: 'basic',
    order: 1,
    title: 'Bài thử',
    boardMode: 'sandbox',
    start: '8/8/8/8/3R4/8/8/8',
    reviewed: false,
    steps: [
      {
        kind: 'watch',
        id: 'lines',
        say: 'Xe đi thẳng.',
        actions: [
          {
            type: 'highlight',
            squares: ['d1', 'd2', 'd3', 'd5', 'd6', 'd7', 'd8', 'a4', 'b4', 'c4', 'e4', 'f4', 'g4'],
          },
          { type: 'highlight', squares: ['h4'] },
        ],
        assert: [{ type: 'highlightIsLegalMoves', square: 'd4' }],
      },
      {
        kind: 'interactMove',
        id: 'go',
        say: 'Bé đưa Xe lên ô ngôi sao.',
        actions: [{ type: 'clear', target: 'all' }],
        accept: [{ from: 'd4', to: 'd8' }],
      },
      {
        kind: 'captureTargets',
        id: 'apples',
        say: 'Bé giúp Xe ăn táo nhé.',
        actions: [
          {
            type: 'stickers',
            items: [
              { square: 'a8', kind: 'apple' },
              { square: 'a1', kind: 'apple' },
            ],
          },
        ],
        piece: 'd8',
        targets: ['a8', 'a1'],
        maxMoves: 2,
      },
      {
        kind: 'watch',
        id: 'after',
        say: 'Xe đứng đây.',
        actions: [{ type: 'setPosition', position: '8/8/8/8/3R4/8/8/8' }],
        assert: [{ type: 'pieceAt', square: 'd4', piece: 'wR' }],
      },
    ],
  };
}

type Lesson = ReturnType<typeof baseLesson>;
const steps = (lesson: Lesson) => lesson.steps as Record<string, unknown>[];

function run(lesson: Lesson, extra: Partial<ValidationInput> = {}) {
  return validateLessons({
    files: [{ file: FILE, data: lesson }],
    manifest: {},
    audioFiles: new Set(),
    ...extra,
  });
}

const errors = (lesson: Lesson, extra?: Partial<ValidationInput>) =>
  run(lesson, extra).issues.filter((issue) => issue.severity === 'error');

describe('validateLessons', () => {
  it('accepts a good lesson (only audio warnings)', () => {
    expect(errors(baseLesson())).toEqual([]);
  });

  it('flags an illegal accepted move', () => {
    const lesson = baseLesson();
    steps(lesson)[1]!.accept = [{ from: 'd4', to: 'e5' }];
    expect(
      errors(lesson)
        .map((issue) => issue.message)
        .join(),
    ).toMatch(/d4-e5 không hợp lệ/);
  });

  it('flags unreachable targets', () => {
    const lesson = baseLesson();
    steps(lesson)[2]!.maxMoves = 1;
    expect(errors(lesson)[0]?.message).toMatch(/Không thể ăn hết/);
  });

  it('flags targets without stickers and captureTargets outside sandbox position', () => {
    const lesson = baseLesson();
    steps(lesson)[2]!.actions = [];
    expect(errors(lesson)[0]?.message).toMatch(/chưa có hình dán: a8, a1/);
  });

  it('flags a wrong highlight', () => {
    const lesson = baseLesson();
    (steps(lesson)[0]!.actions as unknown[]).pop();
    expect(errors(lesson)[0]?.message).toMatch(/thiếu h4/);
  });

  it('flags a wrong pieceAt assertion', () => {
    const lesson = baseLesson();
    steps(lesson)[3]!.assert = [{ type: 'pieceAt', square: 'd4', piece: 'bR' }];
    expect(errors(lesson)[0]?.message).toMatch(/không có quân bR/);
  });

  it('requires setPosition after captureTargets', () => {
    const lesson = baseLesson();
    steps(lesson)[3]!.actions = [];
    expect(errors(lesson)[0]?.message).toMatch(/setPosition/);
  });

  it('checks check/checkmate assertions in standard lessons', () => {
    const lesson = baseLesson();
    lesson.boardMode = 'standard';
    lesson.start = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';
    lesson.steps = [
      {
        kind: 'watch',
        id: 'mate',
        say: 'Chiếu hết.',
        actions: [{ type: 'move', from: 'a1', to: 'a8' }],
        assert: [{ type: 'checkmate' }],
      },
      { kind: 'watch', id: 'not', say: 'Không chiếu.', assert: [{ type: 'stalemate' }] },
    ];
    const found = errors(lesson);
    expect(found).toHaveLength(1);
    expect(found[0]?.step).toBe('not');
  });

  it('flags a long sentence and banned or non-glossary words', () => {
    const lesson = baseLesson();
    steps(lesson)[0]!.say =
      'Một hai ba bốn năm sáu bảy tám chín mười mười một mười hai mười ba mười bốn';
    steps(lesson)[1]!.say = 'Con NGỰA nhảy.';
    steps(lesson)[3]!.say = 'Đừng GIẾT quân.';
    const messages = errors(lesson).map((issue) => issue.message);
    expect(messages.some((message) => /dài 18 từ, tối đa 15/.test(message))).toBe(true);
    expect(messages.some((message) => /Ngựa/.test(message))).toBe(true);
    expect(messages.some((message) => /giết/.test(message))).toBe(true);
  });

  it('matches whole words only', () => {
    const lesson = baseLesson();
    steps(lesson)[1]!.say = 'Bé chơi ngoan nhé.'; // "ngoan" contains "ngu" but is a different word
    expect(errors(lesson)).toEqual([]);
  });

  it('flags path, id and order mismatches', () => {
    const a = baseLesson();
    const b = { ...baseLesson(), id: 'advanced-test' };
    const result = validateLessons({
      files: [
        { file: FILE, data: a },
        { file: 'content/lessons/advanced/test.json', data: b },
      ],
      manifest: {},
      audioFiles: new Set(),
    });
    const messages = result.issues.filter((i) => i.severity === 'error').map((i) => i.message);
    expect(messages.some((m) => /Thư mục "advanced" không khớp track "basic"/.test(m))).toBe(true);
    expect(messages.some((m) => /Trùng order 1/.test(m))).toBe(true);
  });

  it('treats stale audio as an error only for reviewed lessons', () => {
    const lesson = baseLesson();
    const manifest: Record<string, { file: string; hash: string; text: string }> = {};
    const audioFiles = new Set<string>();
    for (const step of steps(lesson)) {
      const text = step.say as string;
      const hash = audioHash(text);
      manifest[`basic-test/${step.id as string}/say`] = { file: audioFileName(hash), hash, text };
      audioFiles.add(audioFileName(hash));
    }
    lesson.reviewed = true;
    expect(errors(lesson, { manifest, audioFiles })).toEqual([]);

    steps(lesson)[0]!.say = 'Xe đi thẳng mãi.';
    const stale = errors(lesson, { manifest: manifest as AudioManifest, audioFiles });
    expect(stale).toHaveLength(1);
    expect(stale[0]?.message).toMatch(/audio cũ/);

    lesson.reviewed = false;
    expect(errors(lesson, { manifest, audioFiles })).toEqual([]);
  });

  it('warns about orphan files and unused manifest entries', () => {
    const result = run(baseLesson(), {
      manifest: { 'old/key/say': { file: 'aaaa.mp3', hash: 'aaaa', text: 'x' } },
      audioFiles: new Set(['aaaa.mp3', 'bbbb.mp3']),
    });
    const warnings = result.issues.filter((issue) => issue.severity === 'warning');
    expect(warnings.some((w) => /old\/key\/say/.test(w.message))).toBe(true);
    expect(warnings.some((w) => w.file === 'public/audio/bbbb.mp3')).toBe(true);
  });

  it('passes the real lessons in the repo without errors', () => {
    const result = validateLessons({
      files: readLessonFiles(),
      manifest: readManifest(),
      audioFiles: listAudioFiles(),
    });
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(readFileSync(new URL('./validate.ts', import.meta.url), 'utf8')).toContain('export');
  });
});
