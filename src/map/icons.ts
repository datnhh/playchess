import type { LessonIcon } from '../content/schema.ts';

/** Picture for each lesson icon: chess glyphs for pieces, simple symbols for the rest. */
const ICONS: Record<LessonIcon, string> = {
  board: '🏁',
  king: '♚',
  queen: '♛',
  rook: '♜',
  bishop: '♝',
  knight: '♞',
  pawn: '♟',
  capture: '🍎',
  setup: '🧩',
  check: '⚠️',
  checkmate: '👑',
  stalemate: '🤝',
  castling: '🏰',
  promotion: '✨',
  enPassant: '↗️',
  opening: '🚪',
  endgame: '🎯',
  trophy: '🏆',
};

/** Shown when a lesson has no icon. */
export const FALLBACK_ICON = '⭐';

export function lessonPicture(icon: LessonIcon | undefined): string {
  return icon ? ICONS[icon] : FALLBACK_ICON;
}
