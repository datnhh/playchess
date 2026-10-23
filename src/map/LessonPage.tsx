import { useCallback, useState } from 'react';
import { getAudioController, canStartWithSound, unlockAudio } from '../audio/useAudio.ts';
import { ChessBoard } from '../board/ChessBoard.tsx';
import { Link } from '../app/Link.tsx';
import { navigate } from '../app/router.ts';
import { getAudioManifest, getLesson, getLessons } from '../content/lessons.ts';
import { LessonPlayer, type LessonResult } from '../lesson/LessonPlayer.tsx';
import { loadProgress, saveProgress } from '../services/storage.ts';
import { mergeStars, nextLessonAfter } from './progress.ts';
import './map.css';

export interface LessonPageProps {
  lessonId: string;
}

/** Plays one lesson, saves the best stars, then offers the next lesson of the track. */
export function LessonPage({ lessonId }: LessonPageProps) {
  const lesson = getLesson(lessonId);
  const [completed, setCompleted] = useState(false);
  // Opened from the map or "Bài tiếp": the tap already unlocked sound, so skip the ▶ screen.
  const [autoStart] = useState(canStartWithSound);

  const handleComplete = useCallback((result: LessonResult) => {
    saveProgress(
      mergeStars(loadProgress(), result.lessonId, result.stars, new Date().toISOString()),
    );
    setCompleted(true);
  }, []);

  if (!lesson) {
    return (
      <main className="page map-empty">
        <div className="map-empty-picture" aria-hidden="true">
          🔍
        </div>
        <p>Không tìm thấy bài học này</p>
        <Link to="/" className="icon-button">
          <span aria-hidden="true">🏠</span>
          <span className="visually-hidden">Về trang chủ</span>
        </Link>
      </main>
    );
  }

  const next = completed ? nextLessonAfter(getLessons(), lesson.id) : undefined;

  return (
    <main className="page lesson-layout">
      <LessonPlayer
        lesson={lesson}
        manifest={getAudioManifest()}
        audio={getAudioController()}
        Board={ChessBoard}
        onComplete={handleComplete}
        onExit={() => navigate(`/learn/${lesson.track}`)}
        autoStart={autoStart}
      />
      {next && (
        <Link
          to={`/lesson/${encodeURIComponent(next.id)}`}
          className="button lesson-next"
          onNavigate={unlockAudio}
        >
          Bài tiếp ▶
        </Link>
      )}
    </main>
  );
}
