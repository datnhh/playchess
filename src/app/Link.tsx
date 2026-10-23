import type { MouseEvent, ReactNode } from 'react';
import { goToParent, navigate, type NavigateOptions } from './router.ts';

interface LinkProps extends NavigateOptions {
  to: string;
  className?: string;
  /** `to` is this page's parent: go back to it rather than adding a history entry. */
  toParent?: boolean;
  /** Runs inside the tap, before the page changes (for work that needs the user gesture). */
  onNavigate?: () => void;
  children: ReactNode;
}

export function Link({
  to,
  className,
  toParent = false,
  onNavigate,
  replace,
  parent,
  children,
}: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle new-tab / modified clicks.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    onNavigate?.();
    if (toParent) goToParent(to);
    else navigate(to, { ...(replace ? { replace } : {}), ...(parent ? { parent } : {}) });
  };

  return (
    <a href={to} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
