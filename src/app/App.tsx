import { lazy, Suspense, type ComponentType } from 'react';
import { HomePage } from '../pages/HomePage.tsx';
import { NotFoundPage } from '../pages/NotFoundPage.tsx';
import { usePathname } from './router.ts';

// Technical pages are loaded on demand so they never weigh on the children's pages.
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((module) => ({ default: module[name] })));

const SmokePage = named(() => import('../pages/SmokePage.tsx'), 'SmokePage');
const DevIndexPage = named(() => import('../pages/DevIndexPage.tsx'), 'DevIndexPage');
const BoardDemoPage = named(() => import('../board/BoardDemoPage.tsx'), 'BoardDemoPage');
const DevLessonPage = named(() => import('../pages/DevLessonPage.tsx'), 'DevLessonPage');
const EngineDemoPage = named(() => import('../engine/EngineDemoPage.tsx'), 'EngineDemoPage');
// The review page lists draft lessons: it only exists in `vite dev`, so production never ships it.
const ReviewPage = import.meta.env.DEV ? lazy(() => import('../review/ReviewPage.tsx')) : null;

const routes: Record<string, ComponentType> = {
  '/': HomePage,
  '/smoke': SmokePage,
  '/dev': DevIndexPage,
  '/dev/board': BoardDemoPage,
  '/dev/lesson': DevLessonPage,
  '/dev/engine': EngineDemoPage,
  ...(ReviewPage ? { '/review': ReviewPage } : {}),
};

export function App() {
  const pathname = usePathname();
  const Page = routes[pathname] ?? NotFoundPage;
  return (
    <Suspense fallback={<main className="page" aria-busy="true" />}>
      <Page />
    </Suspense>
  );
}
