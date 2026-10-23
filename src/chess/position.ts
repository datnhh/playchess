import { validateFen } from 'chess.js';

/**
 * Two position formats, matching the lesson `boardMode`:
 * - standard: a full 6-field FEN that chess.js accepts (both kings present, legal side to move…).
 * - sandbox: only the piece-placement field (e.g. "8/8/8/3R4/8/8/8/8"). Used by basic lessons that
 *   show a single piece on an empty board, which chess.js would reject for missing kings.
 */

const PLACEMENT_RANK = /^[pnbrqkPNBRQK1-8]+$/;

export function checkPlacement(placement: string): string | null {
  const ranks = placement.split('/');
  if (ranks.length !== 8) return `cần 8 hàng, có ${ranks.length}`;
  for (const [index, rank] of ranks.entries()) {
    if (!PLACEMENT_RANK.test(rank)) return `hàng ${8 - index} có ký tự không hợp lệ`;
    let width = 0;
    for (const char of rank) width += /\d/.test(char) ? Number(char) : 1;
    if (width !== 8) return `hàng ${8 - index} có ${width} ô thay vì 8`;
  }
  return null;
}

export function checkStandardFen(fen: string): string | null {
  const result = validateFen(fen);
  return result.ok ? null : (result.error ?? 'FEN không hợp lệ');
}

/** Piece-placement part of any FEN (works for both formats). */
export function placementOf(position: string): string {
  return position.split(' ')[0] ?? '';
}
