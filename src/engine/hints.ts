import { Chess, type Square as ChessSquare } from 'chess.js';
import type { MoveIntent } from '../chess/types.ts';
import { engineMoveToUci } from './bots.ts';
import type { HintReason } from './types.ts';

/** Fullmove number up to which developing moves get the `developPiece` explanation. */
const OPENING_LAST_MOVE = 10;

/**
 * Picks the spoken explanation for a suggested move. Order matters: being in check dominates,
 * then mate, then a free capture, then opening development.
 */
export function classifyHint(fen: string, move: MoveIntent): HintReason {
  const chess = new Chess(fen);
  if (chess.inCheck()) return 'escapeCheck';

  const color = chess.turn();
  const played = chess.move(engineMoveToUci(move));
  if (chess.isCheckmate()) return 'deliverCheckmate';

  if (played.captured) {
    // After the capture it is the opponent's turn: can they recapture on that square?
    const defended = chess.isAttacked(played.to as ChessSquare, color === 'w' ? 'b' : 'w');
    if (!defended) return 'captureFreePiece';
  }

  if (chess.moveNumber() - (color === 'b' ? 1 : 0) <= OPENING_LAST_MOVE) {
    const backRank = color === 'w' ? '1' : '8';
    if (played.isKingsideCastle() || played.isQueensideCastle()) return 'developPiece';
    if ((played.piece === 'n' || played.piece === 'b') && played.from[1] === backRank) {
      return 'developPiece';
    }
  }
  return 'bestMove';
}
