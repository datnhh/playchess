import { placementOf } from '../chess/position.ts';
import { FILES } from '../chess/types.ts';
import type { Square } from '../chess/types.ts';

/** Placement-to-grid conversion for the review page's static board preview. */

const GLYPHS: Readonly<Record<string, string>> = {
  K: '♔',
  Q: '♕',
  R: '♖',
  B: '♗',
  N: '♘',
  P: '♙',
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

export interface GridCell {
  square: Square;
  /** Unicode piece, or '' for an empty square. */
  glyph: string;
  dark: boolean;
}

/** Rows from rank 8 down to rank 1 (white at the bottom), flipped for black orientation. */
export function placementToGrid(position: string, orientation: 'white' | 'black'): GridCell[][] {
  const rows: GridCell[][] = placementOf(position)
    .split('/')
    .map((rankText, rowIndex) => {
      const rank = 8 - rowIndex;
      const cells: GridCell[] = [];
      for (const char of rankText) {
        const count = /\d/.test(char) ? Number(char) : 1;
        for (let i = 0; i < count; i += 1) {
          const fileIndex = cells.length;
          cells.push({
            square: `${FILES[fileIndex] ?? 'a'}${rank}` as Square,
            glyph: /\d/.test(char) ? '' : (GLYPHS[char] ?? '?'),
            dark: (fileIndex + rank) % 2 === 1,
          });
        }
      }
      return cells;
    });
  return orientation === 'white' ? rows : rows.reverse().map((row) => [...row].reverse());
}
