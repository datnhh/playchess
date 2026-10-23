import type { BoardMovable, BoardShape } from '../board/types.ts';
import type { SfxName } from '../audio/types.ts';
import { legalDests } from '../chess/dests.ts';
import type { Square } from '../chess/types.ts';
import {
  COMMON_CLIPS,
  commonAudioKey,
  lessonAudioKey,
  type CommonClipId,
} from '../content/audio.ts';
import {
  applyActions,
  applyMove,
  createBoardState,
  type LessonBoardState,
} from '../content/boardState.ts';
import type { Lesson, LessonStep } from '../content/schema.ts';

/**
 * Pure lesson state machine. The React player feeds it events and executes the returned effects,
 * so every rule (feedback, hints, retries, stars) is unit-testable without a DOM or audio.
 *
 * Async completions (narration end, auto-advance timer) carry the `token` of the effect that
 * started them; a stale token (step changed, replay pressed) is ignored, which makes cancelling
 * timers in the component an optimisation rather than a correctness requirement.
 */

export type LessonPhase = 'idle' | 'playingStep' | 'waitingInteraction' | 'feedback' | 'completed';

/** What happens once the feedback clip finishes. */
export type FeedbackThen = 'advance' | 'wait' | 'restartStep';

export interface LessonMachineState {
  phase: LessonPhase;
  stepIndex: number;
  board: LessonBoardState;
  /** Board before the current step's actions, used to replay a failed mini-game from its start. */
  stepStartBoard: LessonBoardState;
  /** Wrong attempts in the current step (drives hints). */
  wrongAttempts: number;
  /** Wrong attempts in the whole lesson (drives stars). */
  mistakes: number;
  /** captureTargets: moves used, current square of the piece and targets collected so far. */
  movesUsed: number;
  pieceSquare: Square | null;
  collected: Square[];
  feedbackThen: FeedbackThen | null;
  /** Rotation counters for the shared praise/retry clips (deterministic, no Math.random). */
  praiseCount: number;
  retryCount: number;
  /** Increments for every async effect; completions must echo it back. */
  token: number;
  stars: number | null;
  /** Last action error (content bug); the lesson keeps going with the previous board. */
  error: string | null;
}

export type LessonEvent =
  | { type: 'START' }
  | { type: 'NARRATION_DONE'; token: number }
  | { type: 'TIMER'; token: number }
  | { type: 'USER_MOVE'; from: Square; to: Square }
  | { type: 'USER_TAP'; square: Square }
  /** The child's ▶ button: only skips the wait of a watch step, and only the step it was pressed on. */
  | { type: 'NEXT'; stepIndex: number }
  /** Unconditional skip, also over interactive steps (dev/review tools and tests). */
  | { type: 'SKIP' }
  | { type: 'REPLAY' }
  | { type: 'RESTART' };

export type LessonEffect =
  /** Play a clip; `text` lets the player estimate a duration when the audio is missing. */
  | { type: 'narrate'; key: string; text: string; token: number }
  | { type: 'sfx'; name: SfxName }
  /** Dispatch TIMER with this token after `ms`. */
  | { type: 'schedule'; ms: number; token: number }
  /** Drop pending narration and timers (step change, exit). */
  | { type: 'cancel' }
  | { type: 'complete'; stars: number };

export interface Transition {
  state: LessonMachineState;
  effects: LessonEffect[];
}

/** Pause after a watch step's narration before moving on, so the child can look at the board. */
export const WATCH_ADVANCE_DELAY_MS = 1500;
/** Wrong tries in a step before the hint appears. */
export const HINT_AFTER_WRONG = 2;

const PRAISE_CLIPS: readonly CommonClipId[] = ['praise-1', 'praise-2', 'praise-3'];
const RETRY_CLIPS: readonly CommonClipId[] = ['retry-1', 'retry-2'];

export function createLessonState(lesson: Lesson): LessonMachineState {
  const board = createBoardState(lesson.start);
  return {
    phase: 'idle',
    stepIndex: 0,
    board,
    stepStartBoard: board,
    wrongAttempts: 0,
    mistakes: 0,
    movesUsed: 0,
    pieceSquare: null,
    collected: [],
    feedbackThen: null,
    praiseCount: 0,
    retryCount: 0,
    token: 0,
    stars: null,
    error: null,
  };
}

/** Stand-in duration when a clip is missing or fails, so the lesson still flows on visuals. */
export function estimateNarrationMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1500, words * 400);
}

export function starsForMistakes(mistakes: number): number {
  if (mistakes === 0) return 3;
  return mistakes <= 2 ? 2 : 1;
}

/**
 * Whether taps and moves count right now. Interactive steps accept them while the instruction is
 * still being read (young children tap as soon as they understand) and while a retry clip plays;
 * the answer then cuts the sentence short. Praise and mini-game restarts are never interrupted.
 */
export function acceptsInput(step: LessonStep | undefined, state: LessonMachineState): boolean {
  if (!step || step.kind === 'watch') return false;
  return (
    state.phase === 'waitingInteraction' ||
    state.phase === 'playingStep' ||
    (state.phase === 'feedback' && state.feedbackThen === 'wait')
  );
}

/** Whether the child's ▶ button is offered: watch steps only, so exercises cannot be skipped. */
export function canSkipStep(lesson: Lesson, state: LessonMachineState): boolean {
  const step = lesson.steps[state.stepIndex];
  return (
    step?.kind === 'watch' &&
    (state.phase === 'playingStep' || state.phase === 'waitingInteraction')
  );
}

/** Destinations the child may use right now; null = board is view only. */
export function boardMovable(lesson: Lesson, state: LessonMachineState): BoardMovable | null {
  const step = lesson.steps[state.stepIndex];
  if (!acceptsInput(step, state) || !step) return null;
  if (step.kind === 'interactMove') {
    return { color: 'both', dests: legalDests(state.board.position, lesson.boardMode) };
  }
  if (step.kind === 'captureTargets' && state.pieceSquare) {
    const dests = legalDests(state.board.position, lesson.boardMode).get(state.pieceSquare);
    return { color: 'both', dests: new Map(dests ? [[state.pieceSquare, dests]] : []) };
  }
  return null;
}

function narration(lesson: Lesson, step: LessonStep, token: number): LessonEffect {
  return {
    type: 'narrate',
    key: lessonAudioKey(lesson.id, step.id, 'say'),
    text: step.say,
    token,
  };
}

/** Applies a step's actions to `from` and starts its narration. */
function enterStep(
  lesson: Lesson,
  state: LessonMachineState,
  stepIndex: number,
  from: LessonBoardState,
): Transition {
  const step = lesson.steps[stepIndex];
  if (!step) return complete(state);
  const result = applyActions(from, step.actions, lesson.boardMode);
  const token = state.token + 1;
  const next: LessonMachineState = {
    ...state,
    phase: 'playingStep',
    stepIndex,
    board: result.ok ? result.state : from,
    stepStartBoard: from,
    wrongAttempts: 0,
    movesUsed: 0,
    pieceSquare: step.kind === 'captureTargets' ? step.piece : null,
    collected: [],
    feedbackThen: null,
    token,
    error: result.ok ? null : `Bước "${step.id}": ${result.error}`,
  };
  return { state: next, effects: [{ type: 'cancel' }, narration(lesson, step, token)] };
}

function complete(state: LessonMachineState): Transition {
  const stars = starsForMistakes(state.mistakes);
  return {
    state: { ...state, phase: 'completed', stars, feedbackThen: null, token: state.token + 1 },
    effects: [{ type: 'cancel' }, { type: 'sfx', name: 'win' }, { type: 'complete', stars }],
  };
}

function advance(lesson: Lesson, state: LessonMachineState): Transition {
  const nextIndex = state.stepIndex + 1;
  if (nextIndex >= lesson.steps.length) return complete(state);
  return enterStep(lesson, state, nextIndex, state.board);
}

function feedbackClip(
  lesson: Lesson,
  step: LessonStep,
  state: LessonMachineState,
  kind: 'praise' | 'retry',
): { key: string; text: string; state: LessonMachineState } {
  const ownText = step.kind === 'watch' ? undefined : step[kind];
  if (ownText) return { key: lessonAudioKey(lesson.id, step.id, kind), text: ownText, state };
  const clips = kind === 'praise' ? PRAISE_CLIPS : RETRY_CLIPS;
  const count = kind === 'praise' ? state.praiseCount : state.retryCount;
  const clip = clips[count % clips.length]!;
  return {
    key: commonAudioKey(clip),
    text: COMMON_CLIPS[clip],
    state:
      kind === 'praise'
        ? { ...state, praiseCount: count + 1 }
        : { ...state, retryCount: count + 1 },
  };
}

function giveFeedback(
  lesson: Lesson,
  step: LessonStep,
  state: LessonMachineState,
  kind: 'praise' | 'retry',
  then: FeedbackThen,
  extraEffects: LessonEffect[] = [],
): Transition {
  const clip = feedbackClip(lesson, step, state, kind);
  const token = state.token + 1;
  return {
    state: { ...clip.state, phase: 'feedback', feedbackThen: then, token },
    effects: [
      { type: 'cancel' },
      ...extraEffects,
      { type: 'sfx', name: kind === 'praise' ? 'success' : 'retry' },
      { type: 'narrate', key: clip.key, text: clip.text, token },
    ],
  };
}

/** Records a wrong try and adds the hint shapes once the child has failed often enough. */
function wrongTry(
  lesson: Lesson,
  step: LessonStep,
  state: LessonMachineState,
  hint: BoardShape[],
): Transition {
  const wrongAttempts = state.wrongAttempts + 1;
  const showHint = wrongAttempts === HINT_AFTER_WRONG;
  const board = showHint
    ? { ...state.board, shapes: [...state.board.shapes, ...hint] }
    : state.board;
  return giveFeedback(
    lesson,
    step,
    { ...state, wrongAttempts, mistakes: state.mistakes + 1, board },
    'retry',
    'wait',
  );
}

function handleMove(
  lesson: Lesson,
  state: LessonMachineState,
  step: LessonStep,
  from: Square,
  to: Square,
): Transition {
  if (step.kind === 'interactMove') {
    const accepted = step.accept.find((move) => move.from === from && move.to === to);
    if (accepted) {
      const result = applyMove(
        state.board,
        {
          from: accepted.from,
          to: accepted.to,
          ...(accepted.promotion ? { promotion: accepted.promotion } : {}),
        },
        lesson.boardMode,
      );
      if (result.ok) {
        return giveFeedback(lesson, step, { ...state, board: result.state }, 'praise', 'advance', [
          { type: 'sfx', name: 'move' },
        ]);
      }
    }
    const first = step.accept[0]!;
    return wrongTry(lesson, step, state, [
      { kind: 'circle', square: first.to, tone: 'good' },
      { kind: 'arrow', from: first.from, to: first.to, tone: 'good' },
    ]);
  }

  if (step.kind === 'captureTargets') {
    if (from !== state.pieceSquare) return { state, effects: [] };
    const result = applyMove(state.board, { from, to }, lesson.boardMode);
    if (!result.ok) return { state, effects: [] };
    const hit = step.targets.includes(to) && !state.collected.includes(to);
    const collected = hit ? [...state.collected, to] : state.collected;
    const board: LessonBoardState = hit
      ? { ...result.state, stickers: result.state.stickers.filter((s) => s.square !== to) }
      : result.state;
    const moved: LessonMachineState = {
      ...state,
      board,
      collected,
      pieceSquare: to,
      movesUsed: state.movesUsed + 1,
    };
    const sound: LessonEffect = { type: 'sfx', name: hit ? 'capture' : 'move' };
    if (collected.length === step.targets.length) {
      return giveFeedback(lesson, step, moved, 'praise', 'advance', [sound]);
    }
    // Out of moves: the remaining targets cannot be reached any more, start the game over.
    if (moved.movesUsed >= step.maxMoves) {
      return giveFeedback(
        lesson,
        step,
        { ...moved, mistakes: moved.mistakes + 1 },
        'retry',
        'restartStep',
        [sound],
      );
    }
    return { state: moved, effects: [sound] };
  }

  return { state, effects: [] };
}

export function lessonTransition(
  lesson: Lesson,
  state: LessonMachineState,
  event: LessonEvent,
): Transition {
  const step = lesson.steps[state.stepIndex];
  const none: Transition = { state, effects: [] };

  switch (event.type) {
    case 'START':
      return state.phase === 'idle' ? enterStep(lesson, state, 0, state.board) : none;

    case 'RESTART':
      return enterStep(lesson, createLessonState(lesson), 0, createBoardState(lesson.start));

    case 'NEXT':
      // stepIndex guards against a press that lands just after the step auto-advanced.
      if (event.stepIndex !== state.stepIndex || !canSkipStep(lesson, state)) return none;
      return advance(lesson, state);

    case 'SKIP':
      if (state.phase === 'idle' || state.phase === 'completed') return none;
      return advance(lesson, state);

    case 'REPLAY': {
      if (!step || state.phase === 'idle' || state.phase === 'completed') return none;
      // Keep the board (including the child's progress); only the sentence is heard again.
      const token = state.token + 1;
      return {
        state: { ...state, phase: 'playingStep', feedbackThen: null, token },
        effects: [{ type: 'cancel' }, narration(lesson, step, token)],
      };
    }

    case 'NARRATION_DONE': {
      if (event.token !== state.token || !step) return none;
      if (state.phase === 'playingStep') {
        if (step.kind === 'watch') {
          const token = state.token + 1;
          return {
            state: { ...state, phase: 'waitingInteraction', token },
            effects: [{ type: 'schedule', ms: WATCH_ADVANCE_DELAY_MS, token }],
          };
        }
        return { state: { ...state, phase: 'waitingInteraction' }, effects: [] };
      }
      if (state.phase === 'feedback') {
        if (state.feedbackThen === 'advance') return advance(lesson, state);
        if (state.feedbackThen === 'restartStep') {
          return enterStep(lesson, state, state.stepIndex, state.stepStartBoard);
        }
        return {
          state: { ...state, phase: 'waitingInteraction', feedbackThen: null },
          effects: [],
        };
      }
      return none;
    }

    case 'TIMER':
      if (event.token !== state.token || state.phase !== 'waitingInteraction') return none;
      return step?.kind === 'watch' ? advance(lesson, state) : none;

    case 'USER_MOVE':
      if (!acceptsInput(step, state) || !step) return none;
      return handleMove(lesson, state, step, event.from, event.to);

    case 'USER_TAP': {
      if (!acceptsInput(step, state) || step?.kind !== 'tapSquare') return none;
      if (step.answers.includes(event.square)) {
        return giveFeedback(lesson, step, state, 'praise', 'advance', [
          { type: 'sfx', name: 'tap' },
        ]);
      }
      return wrongTry(
        lesson,
        step,
        state,
        step.answers.map((square) => ({ kind: 'circle', square, tone: 'good' })),
      );
    }
  }
}
