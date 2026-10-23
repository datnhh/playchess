import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { Key } from 'chessground/types';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import './board.css';
import { isSquare } from '../chess/types.ts';
import type { Square } from '../chess/types.ts';
import {
  occupiedSquares,
  placementOf,
  squarePosition,
  toAutoShapes,
  toDests,
  toSquareClasses,
} from './boardMapping.ts';
import { StickerIcon } from './Stickers.tsx';
import type { BoardProps } from './types.ts';

/** Delay before a rejected move slides back, long enough for a child to see what happened. */
const REJECTED_MOVE_RESET_MS = 350;

/**
 * Declarative wrapper over chessground: the instance is created once and every prop change is
 * pushed with `api.set`, so position changes animate instead of re-rendering the board.
 */
export function ChessBoard(props: BoardProps) {
  const {
    position,
    orientation,
    movable,
    lastMove,
    checkSquare,
    shapes,
    stickers,
    showCoordinates = false,
    onMove,
    onSquareTap,
  } = props;
  const groundRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const coordinatesRef = useRef<boolean | null>(null);
  // Callbacks live in a ref so chessground events always call the latest props without re-config.
  const callbacksRef = useRef({ onMove, onSquareTap });
  const positionRef = useRef(position);
  useLayoutEffect(() => {
    callbacksRef.current = { onMove, onSquareTap };
    positionRef.current = position;
  });

  useEffect(() => {
    if (!groundRef.current) return;
    const api = Chessground(groundRef.current, {
      animation: { enabled: true, duration: 250 },
      draggable: { enabled: true, showGhost: true },
      selectable: { enabled: true },
      premovable: { enabled: false },
      drawable: { enabled: false, visible: true },
      highlight: { lastMove: true, check: true },
      events: {
        select: (key: Key) => {
          if (isSquare(key)) callbacksRef.current.onSquareTap?.(key);
        },
      },
    });
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    // chessground's own `check`/`lastMove`/`movable.color` options cannot express "a given square"
    // or "clear", so those three fields are written to state directly before set() renders.
    const { state } = api;
    if (checkSquare) state.check = checkSquare;
    else delete state.check;
    if (lastMove) state.lastMove = [lastMove[0], lastMove[1]];
    else delete state.lastMove;
    if (movable) state.movable.color = movable.color;
    else delete state.movable.color;
    const config: Config = {
      fen: placementOf(position),
      orientation,
      coordinates: showCoordinates,
      movable: {
        free: false,
        dests: movable ? toDests(movable.dests) : new Map(),
        showDests: true,
        events: {
          after: (from: Key, to: Key) => {
            if (!isSquare(from) || !isSquare(to)) return;
            const positionBefore = positionRef.current;
            callbacksRef.current.onMove?.(from, to);
            // chessground has already moved the piece. If the parent rejected the move (e.g. a wrong
            // answer in a lesson) the position prop stays the same, so slide the piece back.
            setTimeout(() => {
              if (positionRef.current === positionBefore) {
                apiRef.current?.set({ fen: placementOf(positionBefore) });
              }
            }, REJECTED_MOVE_RESET_MS);
          },
        },
      },
      drawable: { autoShapes: toAutoShapes(shapes) },
      highlight: { custom: toSquareClasses(shapes) },
    };
    api.set(config);
    // Coordinates are only drawn on a full redraw; doing it on every change would cancel animations.
    if (coordinatesRef.current !== showCoordinates) {
      coordinatesRef.current = showCoordinates;
      api.redrawAll();
    }
  }, [position, orientation, showCoordinates, lastMove, checkSquare, movable, shapes]);

  const occupied = useMemo(() => occupiedSquares(position), [position]);

  return (
    <div className="chess-board">
      <div ref={groundRef} className="chess-board__ground" />
      {stickers && stickers.length > 0 ? (
        <div className="chess-board__stickers" aria-hidden="true">
          {stickers.map((sticker, index) => (
            <StickerAt
              key={`${sticker.square}-${index}`}
              square={sticker.square}
              orientation={orientation}
              onPiece={occupied.has(sticker.square)}
            >
              <StickerIcon kind={sticker.kind} />
            </StickerAt>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StickerAt({
  square,
  orientation,
  onPiece,
  children,
}: {
  square: Square;
  orientation: BoardProps['orientation'];
  onPiece: boolean;
  children: ReactNode;
}) {
  const { leftPercent, topPercent } = squarePosition(square, orientation);
  return (
    <div
      className={
        onPiece ? 'chess-board__sticker chess-board__sticker--on-piece' : 'chess-board__sticker'
      }
      style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
    >
      {children}
    </div>
  );
}
