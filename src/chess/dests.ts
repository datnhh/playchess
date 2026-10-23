import { Chess } from 'chess.js';
import { parsePlacement, sandboxDests } from './sandbox.ts';
import type { PieceColor, Square } from './types.ts';

export type BoardMode = 'sandbox' | 'standard';

/**
 * Legal destinations per origin square, in the shape the board component expects.
 * Standard: chess.js rules for the side to move (`color` is ignored). Sandbox: piece geometry.
 */
export function legalDests(
  position: string,
  mode: BoardMode,
  color: PieceColor | 'both' = 'both',
): Map<Square, Square[]> {
  if (mode === 'sandbox') return sandboxDests(parsePlacement(position), color);

  const dests = new Map<Square, Square[]>();
  for (const move of new Chess(position).moves({ verbose: true })) {
    const from = move.from as Square;
    const list = dests.get(from);
    const to = move.to as Square;
    if (!list) dests.set(from, [to]);
    else if (!list.includes(to)) list.push(to);
  }
  return dests;
}
