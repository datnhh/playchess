import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import type { PieceColor, Square } from '../chess/types.ts';
import type { BoardShape, ShapeTone } from './types.ts';

/**
 * Pure helpers translating the board contract into chessground config.
 * Kept free of DOM/React so they can be unit-tested in node.
 */

/** Built-in chessground brush names (defined in its default drawable config). */
export const TONE_BRUSH: Readonly<Record<ShapeTone, string>> = {
  info: 'blue',
  good: 'green',
  warn: 'red',
};

export function toAutoShapes(shapes: readonly BoardShape[] | undefined): DrawShape[] {
  if (!shapes) return [];
  return shapes.map((shape) =>
    shape.kind === 'arrow'
      ? { orig: shape.from, dest: shape.to, brush: TONE_BRUSH[shape.tone] }
      : { orig: shape.square, brush: TONE_BRUSH[shape.tone] },
  );
}

/** Copies readonly caller data into the mutable Map chessground expects. */
export function toDests(dests: ReadonlyMap<Square, readonly Square[]>): Map<Key, Key[]> {
  const result = new Map<Key, Key[]>();
  for (const [from, list] of dests) result.set(from, [...list]);
  return result;
}

/** Top-left corner of a square in percent of the board size, as seen from `orientation`. */
export function squarePosition(
  square: Square,
  orientation: PieceColor,
): { leftPercent: number; topPercent: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const column = orientation === 'white' ? file : 7 - file;
  const row = orientation === 'white' ? 7 - rank : rank;
  return { leftPercent: column * 12.5, topPercent: row * 12.5 };
}

/** Placement field of a FEN (chessground also accepts it, but trimming keeps the input explicit). */
export function placementOf(position: string): string {
  return position.trim().split(/\s+/)[0] ?? '';
}
