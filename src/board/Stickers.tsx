import type { ReactElement } from 'react';
import type { StickerKind } from '../content/schema.ts';

/** Inline SVG stickers (no emoji: rendering differs across devices and some show tofu boxes). */
const STICKER_SVG: Readonly<Record<StickerKind, ReactElement>> = {
  star: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z"
        fill="#ffcc33"
        stroke="#c98a00"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 7c-1-2-2.5-3.5-4-4" stroke="#6b4423" strokeWidth="1.6" fill="none" />
      <path d="M12.5 6.5c1-2.2 3-3 5-2.6-.6 2-2.4 3-5 2.6z" fill="#4caf50" />
      <path
        d="M12 8c-2-1.5-7-1.5-7.5 4 0 4.5 3 9 5 9 1 0 1.5-.5 2.5-.5s1.5.5 2.5.5c2 0 5-4.5 5-9-.5-5.5-5.5-5.5-7.5-4z"
        fill="#e53935"
        stroke="#a52622"
        strokeWidth="1"
      />
    </svg>
  ),
  flower: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="12"
          cy="6.5"
          rx="3.6"
          ry="4.6"
          fill="#f48fb1"
          stroke="#c2185b"
          strokeWidth="0.8"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="3.2" fill="#ffd54f" stroke="#c98a00" strokeWidth="0.8" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 21s-8.5-5.3-8.5-11A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 8.5 3c0 5.7-8.5 11-8.5 11z"
        fill="#ff5c7a"
        stroke="#b3203d"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

export function StickerIcon({ kind }: { kind: StickerKind }) {
  return STICKER_SVG[kind];
}
