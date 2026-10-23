import type { Rng } from './bots.ts';

/**
 * Minimal UCI client for Stockfish. The transport is abstract so the same client runs on a Web
 * Worker in the browser, on the npm package in Node (calibration) and on a fake in unit tests.
 */

export interface UciTransport {
  send(command: string): void;
  /** Registers a listener for every output line; returns an unsubscribe function. */
  onLine(listener: (line: string) => void): () => void;
  terminate(): void;
}

export type TransportFactory = () => UciTransport;

/** Timer functions, injectable so tests can drive time by hand. */
export interface Timers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const realTimers: Timers = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface SearchRequest {
  fen: string;
  skillLevel: number;
  movetimeMs: number;
  multiPv: number;
}

export interface PvLine {
  multipv: number;
  /** Centipawns from the side to move; mates are mapped to ±(MATE_CP − distance). */
  scoreCp: number;
  move: string;
}

export interface SearchResult {
  bestMove: string;
  lines: PvLine[];
}

export const MATE_CP = 100_000;

export class EngineTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineTimeoutError';
  }
}

export function abortError(): Error {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

const INFO_PATTERN = /\bmultipv (\d+)\b.*\bscore (cp|mate) (-?\d+)\b.*\bpv (\S+)/;

/** Parses an `info … multipv N … score cp X | mate Y … pv …` line, or returns null. */
export function parseInfoLine(line: string): PvLine | null {
  if (!line.startsWith('info ') || line.includes(' bound ')) return null;
  const match = INFO_PATTERN.exec(line);
  if (!match) {
    // Without MultiPV some builds omit the "multipv" token.
    const single = /\bscore (cp|mate) (-?\d+)\b.*\bpv (\S+)/.exec(line);
    if (!single) return null;
    return { multipv: 1, scoreCp: toCp(single[1], single[2]), move: single[3] ?? '' };
  }
  return { multipv: Number(match[1]), scoreCp: toCp(match[2], match[3]), move: match[4] ?? '' };
}

function toCp(kind: string | undefined, raw: string | undefined): number {
  const value = Number(raw);
  if (kind === 'mate') return value > 0 ? MATE_CP - value : -MATE_CP - value;
  return value;
}

/**
 * Weighted random choice among multipv lines: weight = exp((score − best) / temperature), so a
 * line 100 cp worse is picked about e^-1.25 ≈ 30 % as often as the best one.
 */
export function chooseWeightedLine(lines: readonly PvLine[], rng: Rng, temperature = 80): string {
  const first = lines[0];
  if (!first) throw new Error('No lines');
  const best = Math.max(...lines.map((line) => line.scoreCp));
  const weights = lines.map((line) => Math.exp(Math.max(-50, (line.scoreCp - best) / temperature)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng() * total;
  for (let index = 0; index < lines.length; index += 1) {
    roll -= weights[index] ?? 0;
    if (roll < 0) return (lines[index] as PvLine).move;
  }
  return first.move;
}

export interface StockfishClientOptions {
  createTransport: TransportFactory;
  timers?: Timers;
  /** Added to movetime before sending `stop`. */
  timeoutMarginMs: number;
  /** How long to wait for `bestmove` after `stop` before killing the engine. */
  stopGraceMs?: number;
  /** Deadline for `uciok` + `readyok` when (re)starting the engine. */
  initTimeoutMs?: number;
}

/**
 * Serialises searches on one engine. A dead engine (init failure or unanswered `stop`) is
 * terminated and recreated on the next call.
 */
export class StockfishClient {
  private transport: UciTransport | null = null;
  private ready: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly createTransport: TransportFactory;
  private readonly timers: Timers;
  private readonly timeoutMarginMs: number;
  private readonly stopGraceMs: number;
  private readonly initTimeoutMs: number;

  constructor(options: StockfishClientOptions) {
    this.createTransport = options.createTransport;
    this.timers = options.timers ?? realTimers;
    this.timeoutMarginMs = options.timeoutMarginMs;
    this.stopGraceMs = options.stopGraceMs ?? 500;
    this.initTimeoutMs = options.initTimeoutMs ?? 20_000;
  }

  /** True once the engine answered `readyok` and has not died since. */
  isReady = false;

  /** Starts (or returns) the init handshake. */
  init(): Promise<void> {
    if (this.ready) return this.ready;
    const transport = this.createTransport();
    this.transport = transport;
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = this.timers.setTimeout(() => {
        unsubscribe();
        this.kill();
        reject(new EngineTimeoutError('Stockfish did not answer uci/isready'));
      }, this.initTimeoutMs);
      const unsubscribe = transport.onLine((line) => {
        if (line === 'uciok') {
          transport.send('isready');
        } else if (line === 'readyok') {
          this.timers.clearTimeout(timer);
          unsubscribe();
          this.isReady = true;
          resolve();
        } else if (line.startsWith('error ')) {
          this.timers.clearTimeout(timer);
          unsubscribe();
          this.kill();
          reject(new Error(line));
        }
      });
      transport.send('uci');
    });
    // Avoid unhandled rejections when warmUp() starts init without awaiting it.
    this.ready.catch(() => undefined);
    return this.ready;
  }

  search(request: SearchRequest, signal?: AbortSignal): Promise<SearchResult> {
    const run = this.queue.then(() => this.runSearch(request, signal));
    this.queue = run.catch(() => undefined);
    return run.then((outcome) => {
      if (outcome.aborted) throw abortError();
      return outcome.result;
    });
  }

  dispose(): void {
    this.kill();
  }

  private kill(): void {
    this.transport?.terminate();
    this.transport = null;
    this.ready = null;
    this.isReady = false;
  }

  /**
   * Resolves only once the engine is idle again (bestmove received or engine killed), so the
   * next queued search never receives a stale bestmove. Abort is reported via `aborted`.
   */
  private async runSearch(
    request: SearchRequest,
    signal?: AbortSignal,
  ): Promise<{ aborted: true } | { aborted: false; result: SearchResult }> {
    if (signal?.aborted) return { aborted: true };
    await this.init();
    const transport = this.transport;
    if (!transport) throw new Error('Stockfish is not running');
    if (signal?.aborted) return { aborted: true };

    return new Promise((resolve, reject) => {
      const lines = new Map<number, PvLine>();
      let stopped = false;
      let aborted = false;
      let timer: unknown = null;

      const cleanup = () => {
        if (timer !== null) this.timers.clearTimeout(timer);
        unsubscribe();
        signal?.removeEventListener('abort', onAbort);
      };
      const sendStop = (reason: 'timeout' | 'abort') => {
        if (stopped) return;
        stopped = true;
        if (timer !== null) this.timers.clearTimeout(timer);
        transport.send('stop');
        timer = this.timers.setTimeout(() => {
          cleanup();
          this.kill();
          if (reason === 'abort') resolve({ aborted: true });
          else reject(new EngineTimeoutError('Stockfish ignored stop; engine terminated'));
        }, this.stopGraceMs);
      };
      const onAbort = () => {
        aborted = true;
        sendStop('abort');
      };
      const unsubscribe = transport.onLine((line) => {
        if (line.startsWith('info ')) {
          const parsed = parseInfoLine(line);
          if (parsed) lines.set(parsed.multipv, parsed);
        } else if (line.startsWith('bestmove')) {
          cleanup();
          if (aborted) {
            resolve({ aborted: true });
            return;
          }
          const bestMove = line.split(' ')[1] ?? '';
          if (!bestMove || bestMove === '(none)') {
            reject(new Error('Stockfish returned no move'));
            return;
          }
          const sorted = [...lines.values()]
            .filter((pv) => pv.multipv <= request.multiPv)
            .sort((a, b) => a.multipv - b.multipv);
          resolve({ aborted: false, result: { bestMove, lines: sorted } });
        } else if (line.startsWith('error ')) {
          cleanup();
          this.kill();
          reject(new Error(line));
        }
      });
      signal?.addEventListener('abort', onAbort);

      const skill = Math.max(0, Math.min(20, Math.round(request.skillLevel)));
      transport.send(`setoption name Skill Level value ${skill}`);
      transport.send(`setoption name MultiPV value ${Math.max(1, request.multiPv)}`);
      transport.send('ucinewgame');
      transport.send(`position fen ${request.fen}`);
      transport.send(`go movetime ${request.movetimeMs}`);
      timer = this.timers.setTimeout(
        () => sendStop('timeout'),
        request.movetimeMs + this.timeoutMarginMs,
      );
    });
  }
}
