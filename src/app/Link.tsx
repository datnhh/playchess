import type { MouseEvent, ReactNode } from 'react';
import { navigate } from './router.ts';

interface LinkProps {
  to: string;
  className?: string;
  /** Runs inside the tap, before the page changes (for work that needs the user gesture). */
  onNavigate?: () => void;
  children: ReactNode;
}

export function Link({ to, className, onNavigate, children }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle new-tab / modified clicks.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    onNavigate?.();
    navigate(to);
  };

  return (
    <a href={to} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
