import { lazy, Suspense, type ComponentType, type ReactElement } from 'react';
import type { Track } from '../content/schema.ts';
import { HomePage } from '../pages/HomePage.tsx';
import { NotFoundPage } from '../pages/NotFoundPage.tsx';
import { matchPath, usePathname, type RouteParams } from './router.ts';

// Pages other than the home page are loaded on demand to keep the first load small.
const named = <K extends string, P extends object>(
  load: () => Promise<Record<K, ComponentType<P>>>,
  name: K,
) => lazy(() => load().then((module) => ({ default: module[name] })));

const TrackPage = named(() => import('../map/TrackPage.tsx'), 'TrackPage');
const LessonPage = named(() => import('../map/LessonPage.tsx'), 'LessonPage');
const PlayPage = named(() => import('../play/PlayPage.tsx'), 'PlayPage');
const SettingsPage = named(() => import('../settings/SettingsPage.tsx'), 'SettingsPage');
const CreditsPage = named(() => import('../settings/CreditsPage.tsx'), 'CreditsPage');
const SmokePage = named(() => import('../pages/SmokePage.tsx'), 'SmokePage');
const DevIndexPage = named(() => import('../pages/DevIndexPage.tsx'), 'DevIndexPage');
const BoardDemoPage = named(() => import('../board/BoardDemoPage.tsx'), 'BoardDemoPage');
const DevLessonPage = named(() => import('../pages/DevLessonPage.tsx'), 'DevLessonPage');
const EngineDemoPage = named(() => import('../engine/EngineDemoPage.tsx'), 'EngineDemoPage');
// The review page lists draft lessons: it only exists in `vite dev`, so production never ships it.
const ReviewPage = import.meta.env.DEV ? lazy(() => import('../review/ReviewPage.tsx')) : null;

// Plain check instead of trackSchema: importing the schema here would pull zod and chess.js into the
// first page load. Keep in sync with trackSchema (src/content/schema.ts).
const isTrack = (value: string | undefined): value is Track =>
  value === 'basic' || value === 'advanced';

interface Route {
  pattern: string;
  /** Returns null when the params are invalid, which renders the not-found page. */
  render: (params: RouteParams) => ReactElement | null;
}

const ROUTES: readonly Route[] = [
  { pattern: '/', render: () => <HomePage /> },
  {
    pattern: '/learn/:track',
    render: ({ track }) => (isTrack(track) ? <TrackPage track={track} /> : null),
  },
  { pattern: '/lesson/:id', render: ({ id }) => (id ? <LessonPage lessonId={id} /> : null) },
  { pattern: '/play', render: () => <PlayPage /> },
  { pattern: '/settings', render: () => <SettingsPage /> },
  { pattern: '/credits', render: () => <CreditsPage /> },
  { pattern: '/smoke', render: () => <SmokePage /> },
  { pattern: '/dev', render: () => <DevIndexPage /> },
  { pattern: '/dev/board', render: () => <BoardDemoPage /> },
  { pattern: '/dev/lesson', render: () => <DevLessonPage /> },
  { pattern: '/dev/engine', render: () => <EngineDemoPage /> },
  ...(ReviewPage ? [{ pattern: '/review', render: () => <ReviewPage /> }] : []),
];

function renderRoute(pathname: string): ReactElement {
  for (const route of ROUTES) {
    const params = matchPath(route.pattern, pathname);
    if (params) return route.render(params) ?? <NotFoundPage />;
  }
  return <NotFoundPage />;
}

export function App() {
  const pathname = usePathname();
  return (
    <Suspense fallback={<main className="page" aria-busy="true" />}>
      {/* key: remount pages when the path changes (e.g. lesson to lesson) so state never leaks. */}
      <div key={pathname}>{renderRoute(pathname)}</div>
    </Suspense>
  );
}
