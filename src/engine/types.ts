import type { MoveIntent } from '../chess/types.ts';

/**
 * Contract for the computer opponent and hints (wave 1 branch C).
 *
 * Levels 1–4: TypeScript bots on chess.js (instant, no download, deliberately weak).
 * Levels 5–10: Stockfish lite single-threaded in a Web Worker, loaded in the background.
 * Timeouts: a Stockfish search gets `movetimeMs + ENGINE_TIMEOUT_MARGIN_MS`; on expiry the service
 * sends UCI `stop` and uses the returned bestmove; if none arrives, it terminates and restarts the
 * worker and answers with the level-4 bot so the game never freezes.
 */

export type EngineLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const ENGINE_LEVELS: readonly EngineLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const ENGINE_TIMEOUT_MARGIN_MS = 2000;

/** Minimum delay before the computer moves, so children can follow what happened. */
export const ENGINE_MIN_THINK_MS = 500;

export type BotStrategy = 'random' | 'greedy' | 'onePly' | 'twoPly';

export type LevelConfig =
  | {
      level: EngineLevel;
      kind: 'bot';
      strategy: BotStrategy;
      /** Probability (0–1) of playing a random legal move instead of the strategy's choice. */
      mistakeRate: number;
    }
  | {
      level: EngineLevel;
      kind: 'stockfish';
      skillLevel: number;
      movetimeMs: number;
      /** When > 1, pick among the top N lines with weights, for more human-like mistakes. */
      multiPv: number;
    };

export interface EngineMove extends MoveIntent {
  source: 'bot' | 'stockfish';
}

export type HintReason =
  'escapeCheck' | 'deliverCheckmate' | 'captureFreePiece' | 'developPiece' | 'bestMove';

export interface Hint {
  move: EngineMove;
  /** Selects the spoken explanation clip shown with the arrow. */
  reason: HintReason;
}

export interface ChessEngine {
  /** Start loading Stockfish in the background (called when the play page opens). */
  warmUp(): void;
  chooseMove(fen: string, level: EngineLevel, signal?: AbortSignal): Promise<EngineMove>;
  /** Uses the strongest engine already available; falls back to the internal bot. */
  hint(fen: string, signal?: AbortSignal): Promise<Hint>;
  dispose(): void;
}
