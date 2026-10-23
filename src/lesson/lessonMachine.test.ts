import { describe, expect, it } from 'vitest';
import rookLesson from '../../content/lessons/sprout/rook.json';
import type { Square } from '../chess/types.ts';
import { lessonSchema, type Lesson } from '../content/schema.ts';
import {
  boardMovable,
  createLessonState,
  estimateNarrationMs,
  lessonTransition,
  starsForMistakes,
  type LessonEffect,
  type LessonEvent,
  type LessonMachineState,
} from './lessonMachine.ts';

const rook = lessonSchema.parse(rookLesson);

/** Small driver: keeps state and the effects of the last event. */
function run(lesson: Lesson) {
  let state = createLessonState(lesson);
  let effects: LessonEffect[] = [];
  const send = (event: LessonEvent) => {
    ({ state, effects } = lessonTransition(lesson, state, event));
    return effects;
  };
  return {
    get state(): LessonMachineState {
      return state;
    },
    get effects() {
      return effects;
    },
    send,
    narrationDone: () => send({ type: 'NARRATION_DONE', token: state.token }),
    timer: () => send({ type: 'TIMER', token: state.token }),
    move: (from: Square, to: Square) => send({ type: 'USER_MOVE', from, to }),
    tap: (square: Square) => send({ type: 'USER_TAP', square }),
    /** Finish narration and the auto-advance pause of a watch step. */
    watch() {
      this.narrationDone();
      this.timer();
    },
  };
}

const narrated = (effects: LessonEffect[]) =>
  effects.filter((e) => e.type === 'narrate').map((e) => e.key);

function stepIndex(id: string) {
  return rook.steps.findIndex((s) => s.id === id);
}

describe('lessonMachine on the rook lesson', () => {
  it('plays the happy path to 3 stars', () => {
    const p = run(rook);
    expect(p.state.phase).toBe('idle');
    expect(narrated(p.send({ type: 'START' }))).toEqual(['sprout-rook/meet-rook/say']);
    expect(p.state.board.shapes).toHaveLength(1);

    p.narrationDone();
    expect(p.effects).toEqual([{ type: 'schedule', ms: 600, token: p.state.token }]);
    p.timer();
    expect(p.state.stepIndex).toBe(1);
    p.watch(); // enters rook-goes-far, which moves d4-d7
    expect(p.state.board.position).toBe('8/3R4/8/8/8/8/8/8');
    p.watch();
    p.watch();
    expect(rook.steps[p.state.stepIndex]!.id).toBe('move-to-star');

    expect(boardMovable(rook, p.state)).toBeNull();
    p.narrationDone();
    expect(p.state.phase).toBe('waitingInteraction');
    expect(boardMovable(rook, p.state)?.dests.get('d4')).toContain('d8');
    expect(narrated(p.move('d4', 'd8'))).toEqual(['sprout-rook/move-to-star/praise']);
    expect(p.state.phase).toBe('feedback');
    expect(p.state.board.position).toBe('3R4/8/8/8/8/8/8/8');
    p.narrationDone();

    expect(p.state.stepIndex).toBe(stepIndex('eat-apples'));
    p.narrationDone();
    p.move('d4', 'd7');
    p.move('d7', 'a7');
    expect(p.state.board.stickers.map((s) => s.square)).toEqual(['a2']);
    expect(narrated(p.move('a7', 'a2'))).toEqual(['sprout-rook/eat-apples/praise']);
    p.narrationDone();

    expect(rook.steps[p.state.stepIndex]!.id).toBe('goodbye');
    p.narrationDone();
    const effects = p.timer();
    expect(p.state.phase).toBe('completed');
    expect(effects).toContainEqual({ type: 'complete', stars: 3 });
  });

  it('keeps the board on a wrong move and shows a hint after 2 errors', () => {
    const p = run(rook);
    p.send({ type: 'START' });
    for (let i = 0; i < stepIndex('move-to-star'); i += 1) p.send({ type: 'NEXT' });
    p.narrationDone();
    const before = p.state.board.position;

    const first = p.move('d4', 'd5');
    expect(narrated(first)).toEqual(['sprout-rook/move-to-star/retry']);
    expect(first).toContainEqual({ type: 'sfx', name: 'retry' });
    expect(p.state.board.position).toBe(before);
    expect(p.state.board.shapes).toEqual([]);
    expect(boardMovable(rook, p.state)).toBeNull(); // locked during feedback
    p.narrationDone();

    p.move('d4', 'a4');
    expect(p.state.board.shapes).toEqual([
      { kind: 'circle', square: 'd8', tone: 'good' },
      { kind: 'arrow', from: 'd4', to: 'd8', tone: 'good' },
    ]);
    expect(p.state.mistakes).toBe(2);
    p.narrationDone();
    p.move('d4', 'd8');
    p.narrationDone();
    expect(rook.steps[p.state.stepIndex]!.id).toBe('eat-apples');
  });

  it('restarts the capture game when moves run out', () => {
    const p = run(rook);
    p.send({ type: 'START' });
    for (let i = 0; i < stepIndex('eat-apples'); i += 1) p.send({ type: 'NEXT' });
    p.narrationDone();
    expect([...(boardMovable(rook, p.state)?.dests.keys() ?? [])]).toEqual(['d4']);

    p.move('d4', 'd7'); // apple
    p.move('d7', 'd1');
    p.move('d1', 'd2');
    const last = p.move('d2', 'd3');
    // No step-level retry text in the rook capture step: shared clip.
    expect(narrated(last)).toEqual(['common/retry-1']);
    expect(p.state.mistakes).toBe(1);
    p.narrationDone();

    expect(p.state.phase).toBe('playingStep');
    expect(p.state.board.position).toBe('8/8/8/8/3R4/8/8/8');
    expect(p.state.board.stickers).toHaveLength(3);
    expect(p.state.movesUsed).toBe(0);
    expect(p.state.pieceSquare).toBe('d4');
  });

  it('ignores moves of other pieces and moves before the narration ends', () => {
    const p = run(rook);
    p.send({ type: 'START' });
    for (let i = 0; i < stepIndex('eat-apples'); i += 1) p.send({ type: 'NEXT' });
    const before = p.state;
    p.move('d4', 'd7');
    expect(p.state).toBe(before);
    p.narrationDone();
    p.move('a1', 'a2');
    expect(p.state.movesUsed).toBe(0);
  });

  it('REPLAY re-narrates without touching the board; NEXT skips; stale tokens are ignored', () => {
    const p = run(rook);
    p.send({ type: 'START' });
    const staleToken = p.state.token;
    const replay = p.send({ type: 'REPLAY' });
    expect(narrated(replay)).toEqual(['sprout-rook/meet-rook/say']);
    expect(replay[0]).toEqual({ type: 'cancel' });
    p.send({ type: 'NARRATION_DONE', token: staleToken });
    expect(p.state.phase).toBe('playingStep');

    p.send({ type: 'NEXT' });
    expect(p.state.stepIndex).toBe(1);
    const stale = p.state.token;
    p.send({ type: 'NEXT' });
    p.send({ type: 'TIMER', token: stale });
    expect(p.state.stepIndex).toBe(2);
  });

  it('RESTART after completion starts over with no mistakes', () => {
    const p = run(rook);
    p.send({ type: 'START' });
    for (let i = 0; i < rook.steps.length; i += 1) p.send({ type: 'NEXT' });
    expect(p.state.phase).toBe('completed');
    p.send({ type: 'NEXT' });
    expect(p.state.phase).toBe('completed');
    p.send({ type: 'RESTART' });
    expect(p.state.phase).toBe('playingStep');
    expect(p.state.stepIndex).toBe(0);
    expect(p.state.board.position).toBe(rook.start);
  });
});

describe('tapSquare and shared feedback clips', () => {
  const tapLesson = lessonSchema.parse({
    schemaVersion: 1,
    id: 'tap-demo',
    track: 'sprout',
    order: 1,
    title: 'Chạm',
    boardMode: 'sandbox',
    start: '8/8/8/8/3N4/8/8/8',
    reviewed: false,
    steps: [{ kind: 'tapSquare', id: 'find-knight', say: 'Chạm vào quân Mã.', answers: ['d4'] }],
  });

  it('rotates retry clips, hints after 2 wrong taps, then praises', () => {
    const p = run(tapLesson);
    p.send({ type: 'START' });
    p.tap('a1'); // ignored while narrating
    expect(p.state.mistakes).toBe(0);
    p.narrationDone();

    expect(narrated(p.tap('a1'))).toEqual(['common/retry-1']);
    p.narrationDone();
    expect(narrated(p.tap('b2'))).toEqual(['common/retry-2']);
    expect(p.state.board.shapes).toEqual([{ kind: 'circle', square: 'd4', tone: 'good' }]);
    p.narrationDone();
    expect(narrated(p.tap('c3'))).toEqual(['common/retry-1']);
    expect(p.state.board.shapes).toHaveLength(1);
    p.narrationDone();

    expect(narrated(p.tap('d4'))).toEqual(['common/praise-1']);
    expect(p.narrationDone()).toContainEqual({ type: 'complete', stars: 1 });
  });
});

describe('helpers', () => {
  it('computes stars from mistakes', () => {
    expect(starsForMistakes(0)).toBe(3);
    expect(starsForMistakes(1)).toBe(2);
    expect(starsForMistakes(2)).toBe(2);
    expect(starsForMistakes(3)).toBe(1);
  });

  it('estimates narration length with a floor', () => {
    expect(estimateNarrationMs('Giỏi quá!')).toBe(1500);
    expect(estimateNarrationMs('một hai ba bốn năm sáu')).toBe(2400);
  });
});
