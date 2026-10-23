import { useEffect, useMemo } from 'react';
import { Link } from '../app/Link.tsx';
import { ensureAncestors } from '../app/router.ts';
import { unlockAudio } from '../audio/useAudio.ts';
import { getLessons } from '../content/lessons.ts';
import type { Track } from '../content/schema.ts';
import { loadProgress } from '../services/storage.ts';
import { lessonPicture } from './icons.ts';
import { Stars } from './Stars.tsx';
import { TRACK_COLORS, TRACK_TITLES } from './tracks.ts';
import { lessonsOfTrack, recommendedLesson, starsOf } from './progress.ts';
import './map.css';

export interface TrackPageProps {
  track: Track;
}

/** Learning map of one track: every lesson is open; the next suggested one bounces. */
export function TrackPage({ track }: TrackPageProps) {
  const lessons = useMemo(() => lessonsOfTrack(getLessons(), track), [track]);
  const progress = useMemo(() => loadProgress(), []);
  const next = recommendedLesson(lessons, progress);
  const mapPath = `/learn/${track}`;

  // Back from the map always leads home, even when the map was opened from a link.
  useEffect(() => ensureAncestors(['/']), []);

  return (
    <main className="page" style={{ ['--map-color' as string]: TRACK_COLORS[track] }}>
      <header className="map-header">
        <Link to="/" toParent className="icon-button">
          <span aria-hidden="true">🏠</span>
          <span className="visually-hidden">Về trang chủ</span>
        </Link>
        <h1 className="page-title">{TRACK_TITLES[track]}</h1>
      </header>

      {lessons.length === 0 ? (
        <div className="map-empty">
          <div className="map-empty-picture" aria-hidden="true">
            🐣
          </div>
          <p>Bài học đang được chuẩn bị</p>
        </div>
      ) : (
        <ol className="map-path">
          {lessons.map((lesson) => {
            const isNext = lesson.id === next?.id;
            return (
              <li key={lesson.id}>
                <Link
                  to={`/lesson/${encodeURIComponent(lesson.id)}`}
                  className={isNext ? 'map-node map-node--next' : 'map-node'}
                  parent={mapPath}
                  onNavigate={unlockAudio}
                >
                  <span className="map-node-circle" aria-hidden="true">
                    {lessonPicture(lesson.icon)}
                  </span>
                  <span className="map-node-title">{lesson.title}</span>
                  <Stars count={starsOf(progress, lesson.id)} />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
