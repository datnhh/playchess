import type { PieceColor, Square } from '../chess/types.ts';
import type { StickerKind } from '../content/schema.ts';

/**
 * Contract for the board component (wave 1 branch A1, built on chessground).
 * Declarative: the parent owns the state and passes it down; the board animates the difference
 * whenever `position` changes. Used by both the lesson player and the play page.
 */

export type ShapeTone = 'info' | 'good' | 'warn';

export type BoardShape =
  | { kind: 'arrow'; from: Square; to: Square; tone: ShapeTone }
  | { kind: 'circle'; square: Square; tone: ShapeTone };

export interface BoardSticker {
  square: Square;
  kind: StickerKind;
}

export interface BoardMovable {
  /** Which side the user may move. */
  color: PieceColor | 'both';
  /** Legal destinations per origin square, computed by the caller (chess.js or sandbox geometry). */
  dests: ReadonlyMap<Square, readonly Square[]>;
}

export interface BoardProps {
  /** Full FEN (standard) or placement-only FEN (sandbox). */
  position: string;
  orientation: PieceColor;
  /** null or omitted = view only (e.g. while an animation is playing). */
  movable?: BoardMovable | null;
  lastMove?: readonly [Square, Square];
  /** Square of a king currently in check, highlighted in red. */
  checkSquare?: Square;
  shapes?: readonly BoardShape[];
  stickers?: readonly BoardSticker[];
  showCoordinates?: boolean;
  /** Called after the user completes a move by tap-tap or drag-and-drop. */
  onMove?: (from: Square, to: Square) => void;
  /** Called when the user taps any square (used by tapSquare steps). */
  onSquareTap?: (square: Square) => void;
}
