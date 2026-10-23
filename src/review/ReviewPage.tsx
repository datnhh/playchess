import { useMemo, useState } from 'react';
import { audioUrl, lessonAudioKey, type NarrationField } from '../content/audio.ts';
import {
  applyActions,
  applyMove,
  createBoardState,
  type LessonBoardState,
} from '../content/boardState.ts';
import { getAudioManifest, getLessons } from '../content/lessons.ts';
import type { Lesson, StickerKind } from '../content/schema.ts';
import { placementToGrid } from './miniBoard.ts';

/**
 * Dev-only page for reviewing lessons (drafts included). Load it only through a dynamic import
 * behind import.meta.env.DEV so it never reaches production bundles.
 */

const FIELDS: readonly NarrationField[] = ['say', 'praise', 'retry'];
const FIELD_LABEL: Readonly<Record<NarrationField, string>> = {
  say: 'Lời dẫn',
  praise: 'Khen',
  retry: 'Thử lại',
};
const STICKER_GLYPH: Readonly<Record<StickerKind, string>> = {
  star: '⭐',
  apple: '🍎',
  flower: '🌸',
  heart: '❤️',
};

/** Board state after each step's actions, using the same carry-over rules as the player. */
function replay(lesson: Lesson): (LessonBoardState | string)[] {
  let state = createBoardState(lesson.start);
  return lesson.steps.map((step) => {
    const result = applyActions(state, step.actions, lesson.boardMode);
    if (!result.ok) return result.error;
    state = result.state;
    const shown = state;
    if (step.kind === 'interactMove' && step.accept.length === 1) {
      const { from, to, promotion } = step.accept[0]!;
      const next = applyMove(
        state,
        { from, to, ...(promotion ? { promotion } : {}) },
        lesson.boardMode,
      );
      if (next.ok) state = next.state;
    }
    return shown;
  });
}

function MiniBoard({
  state,
  orientation,
}: {
  state: LessonBoardState;
  orientation: Lesson['orientation'];
}) {
  const circles = new Set(state.shapes.flatMap((s) => (s.kind === 'circle' ? [s.square] : [])));
  const stickers = new Map(state.stickers.map((s) => [s.square, STICKER_GLYPH[s.kind]]));
  return (
    <div
      role="img"
      aria-label={state.position}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 22px)', border: '1px solid #555' }}
    >
      {placementToGrid(state.position, orientation).flatMap((row) =>
        row.map((cell) => (
          <div
            key={cell.square}
            title={cell.square}
            style={{
              width: 22,
              height: 22,
              lineHeight: '22px',
              textAlign: 'center',
              fontSize: 17,
              background: cell.dark ? '#b58863' : '#f0d9b5',
              boxShadow: circles.has(cell.square) ? 'inset 0 0 0 3px #2e7d32' : undefined,
            }}
          >
            {cell.glyph || stickers.get(cell.square) || ''}
          </div>
        )),
      )}
    </div>
  );
}

function LessonReview({ lesson }: { lesson: Lesson }) {
  const manifest = getAudioManifest();
  const states = useMemo(() => replay(lesson), [lesson]);
  const [open, setOpen] = useState(false);
  return (
    <section style={{ borderTop: '1px solid #ccc', padding: '12px 0' }}>
      <h2 style={{ fontSize: 18, margin: 0 }}>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? '▾' : '▸'}
        </button>{' '}
        {lesson.title} <code>{lesson.id}</code>{' '}
        <span style={{ color: lesson.reviewed ? '#2e7d32' : '#c62828' }}>
          {lesson.reviewed ? '✔ đã duyệt' : '✘ bản nháp'}
        </span>
      </h2>
      {open && (
        <ol>
          {lesson.steps.map((step, index) => {
            const state = states[index];
            return (
              <li key={step.id} style={{ display: 'flex', gap: 16, margin: '12px 0' }}>
                {typeof state === 'string' || state === undefined ? (
                  <p style={{ color: '#c62828' }}>Lỗi thế cờ: {state}</p>
                ) : (
                  <MiniBoard state={state} orientation={lesson.orientation} />
                )}
                <div>
                  <div>
                    <code>{step.id}</code> · {step.kind}
                  </div>
                  {FIELDS.map((field) => {
                    const text = (step as Partial<Record<NarrationField, string>>)[field];
                    if (text === undefined) return null;
                    const url = audioUrl(manifest, lessonAudioKey(lesson.id, step.id, field));
                    return (
                      <p key={field} style={{ margin: '4px 0' }}>
                        <strong>{FIELD_LABEL[field]}:</strong> {text}{' '}
                        {url ? (
                          <audio controls preload="none" src={url} style={{ height: 28 }} />
                        ) : (
                          <em style={{ color: '#888' }}>(chưa có audio)</em>
                        )}
                      </p>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default function ReviewPage() {
  const lessons = getLessons();
  return (
    <main style={{ padding: 16, fontFamily: 'sans-serif', maxWidth: 960 }}>
      <h1>Duyệt bài học (chỉ có khi chạy dev)</h1>
      <p>
        Nghe từng câu, xem thế cờ sau mỗi bước. Khi bài đã đúng, mở file{' '}
        <code>content/lessons/&lt;track&gt;/&lt;tên&gt;.json</code> và đặt{' '}
        <code>"reviewed": true</code>, rồi chạy <code>npm run validate</code> (bài đã duyệt bắt buộc
        có đủ audio: chạy <code>npm run tts</code> trước). Chỉ bài đã duyệt mới có trong bản phát
        hành.
      </p>
      <p>
        {lessons.length} bài, {lessons.filter((lesson) => lesson.reviewed).length} đã duyệt.
      </p>
      {lessons.map((lesson) => (
        <LessonReview key={lesson.id} lesson={lesson} />
      ))}
    </main>
  );
}
