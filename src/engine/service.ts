import { chooseBotMove, mulberry32, uciToEngineMove, type Rng } from './bots.ts';
import { classifyHint } from './hints.ts';
import { FALLBACK_LEVEL, LEVEL_CONFIGS } from './levels.ts';
import { STOCKFISH_WORKER_URL } from './assets.ts';
import { createWorkerTransport } from './workerTransport.ts';
import {
  abortError,
  chooseWeightedLine,
  realTimers,
  StockfishClient,
  type Timers,
  type TransportFactory,
} from './uci.ts';
import {
  ENGINE_MIN_THINK_MS,
  ENGINE_TIMEOUT_MARGIN_MS,
  type ChessEngine,
  type EngineLevel,
  type EngineMove,
  type Hint,
} from './types.ts';

/** Short full-strength search used for hints. */
export const HINT_MOVETIME_MS = 300;

export interface ChessEngineOptions {
  createTransport?: TransportFactory;
  timers?: Timers;
  now?: () => number;
  rng?: Rng;
  minThinkMs?: number;
  timeoutMarginMs?: number;
  stopGraceMs?: number;
  initTimeoutMs?: number;
  /** Receives fallback warnings (default console.warn). */
  warn?: (message: string, error: unknown) => void;
}

function delay(ms: number, timers: Timers, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return signal?.aborted ? Promise.reject(abortError()) : Promise.resolve();
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      timers.clearTimeout(handle);
      reject(abortError());
    };
    const handle = timers.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function createChessEngine(options: ChessEngineOptions = {}): ChessEngine {
  const timers = options.timers ?? realTimers;
  const now = options.now ?? (() => Date.now());
  const rng = options.rng ?? mulberry32((Math.random() * 2 ** 32) >>> 0);
  const minThinkMs = options.minThinkMs ?? ENGINE_MIN_THINK_MS;
  const warn = options.warn ?? ((message, error) => console.warn(message, error));
  const clientOptions = {
    createTransport: options.createTransport ?? (() => createWorkerTransport(STOCKFISH_WORKER_URL)),
    timers,
    timeoutMarginMs: options.timeoutMarginMs ?? ENGINE_TIMEOUT_MARGIN_MS,
    ...(options.stopGraceMs === undefined ? {} : { stopGraceMs: options.stopGraceMs }),
    ...(options.initTimeoutMs === undefined ? {} : { initTimeoutMs: options.initTimeoutMs }),
  };
  let client: StockfishClient | null = null;
  const getClient = () => (client ??= new StockfishClient(clientOptions));

  function fallbackMove(fen: string): EngineMove {
    const config = LEVEL_CONFIGS[FALLBACK_LEVEL];
    if (config.kind !== 'bot') throw new Error('Fallback level must be a bot');
    return chooseBotMove(fen, { strategy: config.strategy, mistakeRate: config.mistakeRate, rng });
  }

  async function computeMove(fen: string, level: EngineLevel, signal?: AbortSignal) {
    const config = LEVEL_CONFIGS[level];
    if (config.kind === 'bot') {
      return chooseBotMove(fen, {
        strategy: config.strategy,
        mistakeRate: config.mistakeRate,
        rng,
      });
    }
    try {
      const result = await getClient().search(
        {
          fen,
          skillLevel: config.skillLevel,
          movetimeMs: config.movetimeMs,
          multiPv: config.multiPv,
        },
        signal,
      );
      const uci =
        config.multiPv > 1 && result.lines.length > 1
          ? chooseWeightedLine(result.lines, rng)
          : result.bestMove;
      return uciToEngineMove(uci, 'stockfish');
    } catch (error) {
      if (isAbort(error)) throw error;
      warn('Stockfish failed, falling back to the level-4 bot', error);
      return fallbackMove(fen);
    }
  }

  return {
    warmUp() {
      void getClient()
        .init()
        .catch((error: unknown) => warn('Stockfish warm-up failed', error));
    },

    async chooseMove(fen, level, signal) {
      const startedAt = now();
      const move = await computeMove(fen, level, signal);
      await delay(minThinkMs - (now() - startedAt), timers, signal);
      return move;
    },

    async hint(fen, signal): Promise<Hint> {
      if (signal?.aborted) throw abortError();
      let move: EngineMove | null = null;
      if (client?.isReady) {
        try {
          const result = await client.search(
            { fen, skillLevel: 20, movetimeMs: HINT_MOVETIME_MS, multiPv: 1 },
            signal,
          );
          move = uciToEngineMove(result.bestMove, 'stockfish');
        } catch (error) {
          if (isAbort(error)) throw error;
          warn('Stockfish hint failed, using the bot', error);
        }
      }
      move ??= chooseBotMove(fen, { strategy: 'twoPly', rng });
      return { move, reason: classifyHint(fen, move) };
    },

    dispose() {
      client?.dispose();
      client = null;
    },
  };
}
