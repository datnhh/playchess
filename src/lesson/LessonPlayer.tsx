import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import type { AudioController } from '../audio/types.ts';
import type { BoardProps } from '../board/types.ts';
import { audioUrl, type AudioManifest } from '../content/audio.ts';
import type { Lesson } from '../content/schema.ts';
import {
  boardMovable,
  createLessonState,
  estimateNarrationMs,
  lessonTransition,
  type LessonEffect,
  type LessonEvent,
  type LessonMachineState,
} from './lessonMachine.ts';
import './lesson.css';

export interface LessonResult {
  lessonId: string;
  stars: number;
}

export interface LessonPlayerProps {
  lesson: Lesson;
  manifest: AudioManifest;
  audio: AudioController;
  /** Injected so the chessground board (or a mock) can be plugged in. */
  Board: ComponentType<BoardProps>;
  onComplete?: (result: LessonResult) => void;
  onExit?: () => void;
}

export function LessonPlayer({
  lesson,
  manifest,
  audio,
  Board,
  onComplete,
  onExit,
}: LessonPlayerProps) {
  const [state, setState] = useState<LessonMachineState>(() => createLessonState(lesson));
  // Source of truth for dispatch: effects run synchronously, before React re-renders.
  const stateRef = useRef(state);
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const mountedRef = useRef(true);
  const dispatchRef = useRef<(event: LessonEvent) => void>(() => {});
  const propsRef = useRef({ lesson, manifest, audio, onComplete });

  useEffect(() => {
    propsRef.current = { lesson, manifest, audio, onComplete };
  });

  const later = useCallback((ms: number, event: LessonEvent) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      if (mountedRef.current) dispatchRef.current(event);
    }, ms);
    timersRef.current.add(timer);
  }, []);

  const runEffect = useCallback(
    (effect: LessonEffect) => {
      const { lesson: current, manifest: clips, audio: player } = propsRef.current;
      switch (effect.type) {
        case 'cancel':
          for (const timer of timersRef.current) clearTimeout(timer);
          timersRef.current.clear();
          player.stopNarration();
          return;
        case 'sfx':
          player.playSfx(effect.name);
          return;
        case 'schedule':
          later(effect.ms, { type: 'TIMER', token: effect.token });
          return;
        case 'complete':
          propsRef.current.onComplete?.({ lessonId: current.id, stars: effect.stars });
          return;
        case 'narrate': {
          const done: LessonEvent = { type: 'NARRATION_DONE', token: effect.token };
          const fallbackMs = estimateNarrationMs(effect.text);
          const url = audioUrl(clips, effect.key);
          if (!url) {
            later(fallbackMs, done);
            return;
          }
          void player.playNarration(url).then((result) => {
            if (!mountedRef.current || result === 'interrupted') return;
            if (result === 'error') later(fallbackMs, done);
            else dispatchRef.current(done);
          });
          return;
        }
      }
    },
    [later],
  );

  const dispatch = useCallback(
    (event: LessonEvent) => {
      const { state: next, effects } = lessonTransition(
        propsRef.current.lesson,
        stateRef.current,
        event,
      );
      if (next === stateRef.current && effects.length === 0) return;
      stateRef.current = next;
      setState(next);
      effects.forEach(runEffect);
    },
    [runEffect],
  );

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  useEffect(() => {
    mountedRef.current = true;
    const timers = timersRef.current;
    return () => {
      mountedRef.current = false;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      propsRef.current.audio.stopNarration();
    };
  }, []);

  const handleStart = () => {
    // unlock() must be called synchronously inside the tap, before any await (iOS rule).
    void audio.unlock();
    dispatch({ type: 'START' });
  };

  const handleExit = () => {
    runEffect({ type: 'cancel' });
    onExit?.();
  };

  if (state.phase === 'idle') {
    return (
      <div className="lesson-player lesson-center">
        <button type="button" className="lesson-start" onClick={handleStart}>
          ▶ Bắt đầu
        </button>
        {onExit && (
          <button
            type="button"
            className="lesson-icon-button"
            aria-label="Thoát"
            onClick={handleExit}
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  if (state.phase === 'completed') {
    const stars = state.stars ?? 1;
    return (
      <div className="lesson-player lesson-center">
        <div className="lesson-stars" aria-label={`${stars} sao`}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={n <= stars ? 'lesson-star-on' : 'lesson-star-off'}>
              ★
            </span>
          ))}
        </div>
        <div className="lesson-controls">
          <button
            type="button"
            className="lesson-icon-button"
            aria-label="Học lại"
            onClick={() => dispatch({ type: 'RESTART' })}
          >
            🔁
          </button>
          {onExit && (
            <button
              type="button"
              className="lesson-icon-button"
              aria-label="Thoát"
              onClick={handleExit}
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }

  const movable = boardMovable(lesson, state);
  const { board } = state;

  return (
    <div className="lesson-player">
      <div className="lesson-topbar">
        <button
          type="button"
          className="lesson-icon-button"
          aria-label="Thoát"
          onClick={handleExit}
        >
          ✕
        </button>
        <ol
          className="lesson-dots"
          aria-label={`Bước ${state.stepIndex + 1}/${lesson.steps.length}`}
        >
          {lesson.steps.map((step, index) => (
            <li
              key={step.id}
              className={
                index < state.stepIndex
                  ? 'lesson-dot-done'
                  : index === state.stepIndex
                    ? 'lesson-dot-current'
                    : ''
              }
            />
          ))}
        </ol>
      </div>
      <div className="lesson-board">
        <Board
          position={board.position}
          orientation={lesson.orientation}
          movable={movable}
          shapes={board.shapes}
          stickers={board.stickers}
          {...(board.lastMove ? { lastMove: board.lastMove } : {})}
          onMove={(from, to) => dispatch({ type: 'USER_MOVE', from, to })}
          onSquareTap={(square) => dispatch({ type: 'USER_TAP', square })}
        />
      </div>
      <div className="lesson-controls">
        <button
          type="button"
          className="lesson-icon-button"
          aria-label="Nghe lại"
          onClick={() => dispatch({ type: 'REPLAY' })}
        >
          🔊
        </button>
        <button
          type="button"
          className="lesson-icon-button lesson-next"
          aria-label="Tiếp"
          onClick={() => dispatch({ type: 'NEXT' })}
        >
          ▶
        </button>
      </div>
    </div>
  );
}
