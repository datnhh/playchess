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

/** Arrows are drawn by chessground's SVG layer; circles are rendered as square fills instead. */
export function toAutoShapes(shapes: readonly BoardShape[] | undefined): DrawShape[] {
  if (!shapes) return [];
  return shapes.flatMap((shape) =>
    shape.kind === 'arrow'
      ? [{ orig: shape.from, dest: shape.to, brush: TONE_BRUSH[shape.tone] }]
      : [],
  );
}

/**
 * Highlighted squares as chessground custom square classes (styled in board.css). A thin SVG circle
 * was too faint for "the lit squares" in the narration, so the whole square glows instead.
 * When a square is highlighted twice, the latest tone wins.
 */
export function toSquareClasses(shapes: readonly BoardShape[] | undefined): Map<Key, string> {
  const classes = new Map<Key, string>();
  for (const shape of shapes ?? []) {
    if (shape.kind === 'circle') classes.set(shape.square, `board-hl board-hl--${shape.tone}`);
  }
  return classes;
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

/** Squares holding a piece (stickers on them shrink to a corner so the piece stays visible). */
export function occupiedSquares(position: string): Set<Square> {
  const occupied = new Set<Square>();
  placementOf(position)
    .split('/')
    .forEach((rankText, row) => {
      let file = 0;
      for (const char of rankText) {
        if (char >= '1' && char <= '8') file += Number(char);
        else {
          if (file < 8 && row < 8) occupied.add(`${'abcdefgh'[file]}${8 - row}` as Square);
          file += 1;
        }
      }
    });
  return occupied;
}

/** Placement field of a FEN (chessground also accepts it, but trimming keeps the input explicit). */
export function placementOf(position: string): string {
  return position.trim().split(/\s+/)[0] ?? '';
}
