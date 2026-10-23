import { useState } from 'react';
import type { BoardProps, BoardShape } from '../board/types.ts';
import { parsePlacement } from '../chess/sandbox.ts';
import { FILES, RANKS, type Square } from '../chess/types.ts';
import './lesson.css';

/**
 * Minimal BoardProps implementation (8×8 grid of buttons) so the lesson player can be built and
 * tried before the chessground board exists. Tap-tap moves only, no animation or drag.
 */

const GLYPHS: Readonly<Record<string, string>> = {
  'white-king': '♔',
  'white-queen': '♕',
  'white-rook': '♖',
  'white-bishop': '♗',
  'white-knight': '♘',
  'white-pawn': '♙',
  'black-king': '♚',
  'black-queen': '♛',
  'black-rook': '♜',
  'black-bishop': '♝',
  'black-knight': '♞',
  'black-pawn': '♟',
};

const STICKER_EMOJI = { star: '⭐', apple: '🍎', flower: '🌸', heart: '❤️' } as const;

function shapeClass(shapes: readonly BoardShape[], square: Square): string {
  const classes: string[] = [];
  for (const shape of shapes) {
    if (shape.kind === 'circle' && shape.square === square)
      classes.push(`mock-circle-${shape.tone}`);
    if (shape.kind === 'arrow' && shape.from === square)
      classes.push(`mock-arrow-from-${shape.tone}`);
    if (shape.kind === 'arrow' && shape.to === square) classes.push(`mock-arrow-to-${shape.tone}`);
  }
  return classes.join(' ');
}

export function MockBoard(props: BoardProps) {
  const {
    position,
    orientation,
    movable,
    lastMove,
    checkSquare,
    shapes = [],
    stickers = [],
  } = props;
  const [selected, setSelected] = useState<Square | null>(null);
  const pieces = parsePlacement(position);
  const ranks = orientation === 'white' ? [...RANKS].reverse() : [...RANKS];
  const files = orientation === 'white' ? [...FILES] : [...FILES].reverse();
  // A selection only makes sense while the board is movable.
  const activeSelection = movable && selected && movable.dests.has(selected) ? selected : null;
  const targets = activeSelection ? (movable?.dests.get(activeSelection) ?? []) : [];

  const handleTap = (square: Square) => {
    props.onSquareTap?.(square);
    if (activeSelection && targets.includes(square)) {
      setSelected(null);
      props.onMove?.(activeSelection, square);
      return;
    }
    setSelected(movable?.dests.has(square) ? square : null);
  };

  return (
    <div className="mock-board" role="grid" aria-label="Bàn cờ">
      {ranks.map((rank) =>
        files.map((file) => {
          const square: Square = `${file}${rank}`;
          const piece = pieces.get(square);
          const sticker = stickers.find((s) => s.square === square);
          const dark = (FILES.indexOf(file) + Number(rank)) % 2 === 1;
          const className = [
            'mock-square',
            dark ? 'mock-dark' : 'mock-light',
            lastMove?.includes(square) ? 'mock-last' : '',
            square === activeSelection ? 'mock-selected' : '',
            targets.includes(square) ? 'mock-target' : '',
            square === checkSquare ? 'mock-check' : '',
            shapeClass(shapes, square),
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={square}
              type="button"
              className={className}
              aria-label={square}
              onClick={() => handleTap(square)}
            >
              {sticker && <span className="mock-sticker">{STICKER_EMOJI[sticker.kind]}</span>}
              {piece && (
                <span className="mock-piece">{GLYPHS[`${piece.color}-${piece.role}`]}</span>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
