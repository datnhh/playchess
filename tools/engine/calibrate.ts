/**
 * Self-play calibration of the 10 levels: level k+1 must score at least 55 % against level k.
 *
 *   node tools/engine/calibrate.ts [--games=N] [--movetime-scale=X] [--max-plies=N]
 *                                  [--from=K] [--to=K] [--seed=N]
 *
 * Bots are called directly; Stockfish runs through the `stockfish` npm package (lite-single).
 * Exits 1 when the ladder is out of order.
 */
import { createRequire } from 'node:module';
import { Chess } from 'chess.js';
import {
  chooseBotMove,
  engineMoveToUci,
  mulberry32,
  uciToEngineMove,
} from '../../src/engine/bots.ts';
import { LEVEL_CONFIGS } from '../../src/engine/levels.ts';
import {
  ENGINE_TIMEOUT_MARGIN_MS,
  type EngineLevel,
  type EngineMove,
} from '../../src/engine/types.ts';
import { chooseWeightedLine, StockfishClient, type UciTransport } from '../../src/engine/uci.ts';

interface NodeEngine {
  listener?: (line: string) => void;
  processCommand(command: string): void;
  terminate(): void;
}

const require = createRequire(import.meta.url);
const loadStockfish = require('stockfish') as (flavor: string) => NodeEngine;

function createNodeTransport(): UciTransport {
  const engine = loadStockfish('lite-single');
  const listeners = new Set<(line: string) => void>();
  engine.listener = (output: string) => {
    for (const line of String(output).split('\n')) {
      if (line) listeners.forEach((listener) => listener(line));
    }
  };
  return {
    // The engine is not re-entrant: never call processCommand from inside its listener.
    send: (command) => void setTimeout(() => engine.processCommand(command), 0),
    onLine: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    terminate: () => engine.terminate(),
  };
}

function readOption(name: string, fallback: number): number {
  const arg = process.argv.find((value) => value.startsWith(`--${name}=`));
  const parsed = arg ? Number(arg.split('=')[1]) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

const games = readOption('games', 10);
const movetimeScale = readOption('movetime-scale', 1);
const maxPlies = readOption('max-plies', 200);
const fromLevel = readOption('from', 1);
const toLevel = readOption('to', 10);
const rng = mulberry32(readOption('seed', 2026));

const client = new StockfishClient({
  createTransport: createNodeTransport,
  timeoutMarginMs: ENGINE_TIMEOUT_MARGIN_MS,
});

async function chooseMove(fen: string, level: EngineLevel): Promise<EngineMove> {
  const config = LEVEL_CONFIGS[level];
  if (config.kind === 'bot') {
    return chooseBotMove(fen, { strategy: config.strategy, mistakeRate: config.mistakeRate, rng });
  }
  const result = await client.search({
    fen,
    skillLevel: config.skillLevel,
    movetimeMs: Math.max(10, Math.round(config.movetimeMs * movetimeScale)),
    multiPv: config.multiPv,
  });
  const uci =
    config.multiPv > 1 && result.lines.length > 1
      ? chooseWeightedLine(result.lines, rng)
      : result.bestMove;
  return uciToEngineMove(uci, 'stockfish');
}

/** Returns the score (1, 0.5, 0) of the white player. */
async function playGame(white: EngineLevel, black: EngineLevel): Promise<number> {
  const chess = new Chess();
  while (!chess.isGameOver() && chess.history().length < maxPlies) {
    const level = chess.turn() === 'w' ? white : black;
    chess.move(engineMoveToUci(await chooseMove(chess.fen(), level)));
  }
  if (chess.isCheckmate()) return chess.turn() === 'w' ? 0 : 1;
  if (chess.isGameOver()) return 0.5;
  return adjudicateByMaterial(chess);
}

const PIECE_VALUES: Readonly<Record<string, number>> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * Ply cap reached: weak bots rarely mate, so counting every capped game as a draw hid real
 * differences between levels. A lead of at least 3 pawns' worth is scored as a win.
 */
function adjudicateByMaterial(chess: Chess): number {
  let balance = 0;
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell) balance += (cell.color === 'w' ? 1 : -1) * (PIECE_VALUES[cell.type] ?? 0);
    }
  }
  if (balance >= 3) return 1;
  if (balance <= -3) return 0;
  return 0.5;
}

interface PairResult {
  lower: EngineLevel;
  upper: EngineLevel;
  wins: number;
  draws: number;
  losses: number;
  score: number;
}

async function main() {
  const results: PairResult[] = [];
  const startedAt = Date.now();
  for (let lower = Math.max(1, fromLevel); lower < Math.min(10, toLevel); lower += 1) {
    const low = lower as EngineLevel;
    const high = (lower + 1) as EngineLevel;
    const pair: PairResult = { lower: low, upper: high, wins: 0, draws: 0, losses: 0, score: 0 };
    for (let game = 0; game < games; game += 1) {
      // The stronger level alternates colours.
      const upperIsWhite = game % 2 === 0;
      const whiteScore = upperIsWhite ? await playGame(high, low) : await playGame(low, high);
      const upperScore = upperIsWhite ? whiteScore : 1 - whiteScore;
      if (upperScore === 1) pair.wins += 1;
      else if (upperScore === 0) pair.losses += 1;
      else pair.draws += 1;
    }
    pair.score = (pair.wins + pair.draws / 2) / games;
    results.push(pair);
    console.log(
      `${low} vs ${high}: +${pair.wins} =${pair.draws} -${pair.losses} → ${(pair.score * 100).toFixed(0)} % ` +
        `(${Math.round((Date.now() - startedAt) / 1000)} s)`,
    );
  }
  client.dispose();

  console.log(`\ngames=${games} movetime-scale=${movetimeScale} max-plies=${maxPlies}`);
  console.table(
    results.map((pair) => ({
      pair: `${pair.upper} vs ${pair.lower}`,
      'thắng/hoà/thua': `${pair.wins}/${pair.draws}/${pair.losses}`,
      'điểm cấp trên': `${(pair.score * 100).toFixed(0)} %`,
      ok: pair.score >= 0.55,
    })),
  );
  const failed = results.filter((pair) => pair.score < 0.55);
  if (failed.length > 0) {
    console.error(
      `Thứ tự cấp độ chưa đúng: ${failed.map((p) => `${p.upper}>${p.lower}`).join(', ')}`,
    );
    process.exit(1);
  }
  process.exit(0);
}

void main().catch((error: unknown) => {
  console.error(error);
  client.dispose();
  process.exit(1);
});
