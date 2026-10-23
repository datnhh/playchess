/** Shared chess vocabulary used by board, lesson, engine and content modules. */

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export type File = (typeof FILES)[number];
export type Rank = (typeof RANKS)[number];
export type Square = `${File}${Rank}`;

export type PieceColor = 'white' | 'black';
export type PieceRole = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type PromotionRole = 'queen' | 'rook' | 'bishop' | 'knight';

export interface MoveIntent {
  from: Square;
  to: Square;
  promotion?: PromotionRole;
}

export const SQUARE_PATTERN = /^[a-h][1-8]$/;

export function isSquare(value: string): value is Square {
  return SQUARE_PATTERN.test(value);
}
