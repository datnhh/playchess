import {
  FILES,
  RANKS,
  type PieceColor,
  type PieceRole,
  type PromotionRole,
  type Square,
} from './types.ts';

/**
 * Move geometry for sandbox boards (placement-only FEN, kings optional).
 * Pieces move by their normal pattern, are blocked by other pieces and may capture the other colour.
 * There is no check, castling, en passant or turn order: sprout lessons only teach how pieces move.
 * Shared by the lesson player (legal destinations) and the content validator (BFS, assertions).
 */

export interface PlacedPiece {
  color: PieceColor;
  role: PieceRole;
}

export type Placement = Map<Square, PlacedPiece>;

const ROLE_BY_LETTER: Readonly<Record<string, PieceRole>> = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
};

const LETTER_BY_ROLE: Readonly<Record<PieceRole, string>> = {
  king: 'k',
  queen: 'q',
  rook: 'r',
  bishop: 'b',
  knight: 'n',
  pawn: 'p',
};

function toSquare(fileIndex: number, rankIndex: number): Square | null {
  const file = FILES[fileIndex];
  const rank = RANKS[rankIndex];
  return file && rank ? `${file}${rank}` : null;
}

function coordinates(square: Square): [number, number] {
  return [FILES.indexOf(square[0] as (typeof FILES)[number]), Number(square[1]) - 1];
}

/** Parses a placement string already validated by checkPlacement(). */
export function parsePlacement(placement: string): Placement {
  const pieces: Placement = new Map();
  const ranks = placement.split(' ')[0]!.split('/');
  ranks.forEach((rankText, rowIndex) => {
    const rankIndex = 7 - rowIndex;
    let fileIndex = 0;
    for (const char of rankText) {
      if (/\d/.test(char)) {
        fileIndex += Number(char);
        continue;
      }
      const square = toSquare(fileIndex, rankIndex);
      const role = ROLE_BY_LETTER[char.toLowerCase()];
      if (square && role) {
        pieces.set(square, { color: char === char.toUpperCase() ? 'white' : 'black', role });
      }
      fileIndex += 1;
    }
  });
  return pieces;
}

export function serializePlacement(pieces: Placement): string {
  const rows: string[] = [];
  for (let rankIndex = 7; rankIndex >= 0; rankIndex -= 1) {
    let row = '';
    let empty = 0;
    for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
      const piece = pieces.get(toSquare(fileIndex, rankIndex)!);
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty > 0) row += String(empty);
      empty = 0;
      const letter = LETTER_BY_ROLE[piece.role];
      row += piece.color === 'white' ? letter.toUpperCase() : letter;
    }
    if (empty > 0) row += String(empty);
    rows.push(row);
  }
  return rows.join('/');
}

const ROOK_DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const BISHOP_DIRECTIONS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;
const KNIGHT_JUMPS = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
] as const;

/** Squares the piece on `from` can move to. Empty when there is no piece. */
export function sandboxDestinations(pieces: Placement, from: Square): Square[] {
  const piece = pieces.get(from);
  if (!piece) return [];
  const [fileIndex, rankIndex] = coordinates(from);
  const result: Square[] = [];

  const tryStep = (df: number, dr: number, mode: 'move-or-capture' | 'move' | 'capture') => {
    const target = toSquare(fileIndex + df, rankIndex + dr);
    if (!target) return false;
    const occupant = pieces.get(target);
    if (!occupant) {
      if (mode !== 'capture') result.push(target);
      return true;
    }
    if (occupant.color !== piece.color && mode !== 'move') result.push(target);
    return false;
  };

  const slide = (directions: readonly (readonly [number, number])[]) => {
    for (const [df, dr] of directions) {
      for (let distance = 1; distance < 8; distance += 1) {
        if (!tryStep(df * distance, dr * distance, 'move-or-capture')) break;
      }
    }
  };

  switch (piece.role) {
    case 'rook':
      slide(ROOK_DIRECTIONS);
      break;
    case 'bishop':
      slide(BISHOP_DIRECTIONS);
      break;
    case 'queen':
      slide([...ROOK_DIRECTIONS, ...BISHOP_DIRECTIONS]);
      break;
    case 'king':
      for (const [df, dr] of [...ROOK_DIRECTIONS, ...BISHOP_DIRECTIONS]) {
        tryStep(df, dr, 'move-or-capture');
      }
      break;
    case 'knight':
      for (const [df, dr] of KNIGHT_JUMPS) tryStep(df, dr, 'move-or-capture');
      break;
    case 'pawn': {
      const forward = piece.color === 'white' ? 1 : -1;
      const startRank = piece.color === 'white' ? 1 : 6;
      if (tryStep(0, forward, 'move') && rankIndex === startRank) {
        tryStep(0, 2 * forward, 'move');
      }
      tryStep(-1, forward, 'capture');
      tryStep(1, forward, 'capture');
      break;
    }
  }
  return result;
}

export function sandboxDests(
  pieces: Placement,
  color: PieceColor | 'both' = 'both',
): Map<Square, Square[]> {
  const dests = new Map<Square, Square[]>();
  for (const [square, piece] of pieces) {
    if (color !== 'both' && piece.color !== color) continue;
    const targets = sandboxDestinations(pieces, square);
    if (targets.length > 0) dests.set(square, targets);
  }
  return dests;
}

/** Returns the new placement, or null when the move is not allowed. Pawns on the last rank promote. */
export function applySandboxMove(
  pieces: Placement,
  from: Square,
  to: Square,
  promotion: PromotionRole = 'queen',
): Placement | null {
  const piece = pieces.get(from);
  if (!piece || !sandboxDestinations(pieces, from).includes(to)) return null;
  const next: Placement = new Map(pieces);
  next.delete(from);
  const lastRank = piece.color === 'white' ? '8' : '1';
  next.set(
    to,
    piece.role === 'pawn' && to[1] === lastRank ? { color: piece.color, role: promotion } : piece,
  );
  return next;
}

/**
 * Fewest moves for the piece on `from` to visit every target square, other pieces staying put
 * (captured pieces disappear). Returns null when it cannot be done within `maxMoves`.
 */
export function minMovesToCollect(
  pieces: Placement,
  from: Square,
  targets: readonly Square[],
  maxMoves: number,
): number | null {
  if (!pieces.has(from)) return null;
  const allCollected = (1 << targets.length) - 1;
  const maskAt = (square: Square, mask: number) => {
    const index = targets.indexOf(square);
    return index >= 0 ? mask | (1 << index) : mask;
  };

  let frontier: { pieces: Placement; square: Square; mask: number }[] = [
    { pieces, square: from, mask: maskAt(from, 0) },
  ];
  if (frontier[0]!.mask === allCollected) return 0;
  const seen = new Set([`${serializePlacement(pieces)}|${frontier[0]!.mask}`]);

  for (let depth = 1; depth <= maxMoves; depth += 1) {
    const next: typeof frontier = [];
    for (const state of frontier) {
      for (const target of sandboxDestinations(state.pieces, state.square)) {
        const moved = applySandboxMove(state.pieces, state.square, target);
        if (!moved) continue;
        const mask = maskAt(target, state.mask);
        if (mask === allCollected) return depth;
        const key = `${serializePlacement(moved)}|${mask}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ pieces: moved, square: target, mask });
      }
    }
    frontier = next;
  }
  return null;
}
