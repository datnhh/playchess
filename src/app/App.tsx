import { HomePage } from '../pages/HomePage.tsx';
import { NotFoundPage } from '../pages/NotFoundPage.tsx';
import { SmokePage } from '../pages/SmokePage.tsx';
import { usePathname } from './router.ts';

export function App() {
  const pathname = usePathname();

  switch (pathname) {
    case '/':
      return <HomePage />;
    case '/smoke':
      return <SmokePage />;
    default:
      return <NotFoundPage />;
  }
}
