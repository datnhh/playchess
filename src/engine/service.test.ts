import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mulberry32 } from './bots.ts';
import { createChessEngine } from './service.ts';
import { chooseWeightedLine, parseInfoLine, type UciTransport } from './uci.ts';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** How the fake engine reacts to `go`: answer at once, only after `stop`, or never. */
type GoBehaviour = 'answer' | 'answerAfterStop' | 'silent';

interface FakeTransport extends UciTransport {
  sent: string[];
  terminated: boolean;
}

function createFakeTransport(
  behaviour: GoBehaviour,
  infoLines: string[] = [],
  bestMove = 'e2e4',
): FakeTransport {
  const listeners = new Set<(line: string) => void>();
  const emit = (line: string) =>
    queueMicrotask(() => listeners.forEach((listener) => listener(line)));
  const fake: FakeTransport = {
    sent: [],
    terminated: false,
    send(command) {
      fake.sent.push(command);
      if (command === 'uci') emit('uciok');
      else if (command === 'isready') emit('readyok');
      else if (command.startsWith('go') && behaviour === 'answer') {
        infoLines.forEach(emit);
        emit(`bestmove ${bestMove}`);
      } else if (command === 'stop' && behaviour === 'answerAfterStop') {
        emit(`bestmove ${bestMove}`);
      }
    },
    onLine(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    terminate() {
      fake.terminated = true;
    },
  };
  return fake;
}

function setup(behaviours: GoBehaviour[], infoLines: string[] = [], bestMove = 'e2e4') {
  const transports: FakeTransport[] = [];
  const warn = vi.fn();
  const engine = createChessEngine({
    createTransport: () => {
      const fake = createFakeTransport(
        behaviours[transports.length] ?? 'answer',
        infoLines,
        bestMove,
      );
      transports.push(fake);
      return fake;
    },
    minThinkMs: 0,
    rng: mulberry32(1),
    stopGraceMs: 500,
    warn,
  });
  return { engine, transports, warn };
}

describe('uci parsing', () => {
  it('parses multipv lines with cp and mate scores', () => {
    expect(
      parseInfoLine('info depth 10 seldepth 12 multipv 2 score cp -35 nodes 1000 pv d2d4 d7d5'),
    ).toEqual({ multipv: 2, scoreCp: -35, move: 'd2d4' });
    expect(parseInfoLine('info depth 5 multipv 1 score mate 3 pv a1a8')?.scoreCp).toBe(99_997);
    expect(parseInfoLine('info depth 5 multipv 1 score mate -2 pv a1a8')?.scoreCp).toBe(-99_998);
    expect(parseInfoLine('info depth 5 multipv 1 score cp 10 lowerbound pv a1a8')).not.toBeNull();
    expect(parseInfoLine('info string NNUE loaded')).toBeNull();
  });

  it('weighted choice favours better lines but is seed-deterministic', () => {
    const lines = [
      { multipv: 1, scoreCp: 50, move: 'e2e4' },
      { multipv: 2, scoreCp: -400, move: 'g1h3' },
    ];
    const picks = Array.from({ length: 50 }, (_, index) =>
      chooseWeightedLine(lines, mulberry32(index)),
    );
    expect(picks.filter((move) => move === 'e2e4').length).toBeGreaterThan(45);
    expect(chooseWeightedLine(lines, mulberry32(9))).toBe(chooseWeightedLine(lines, mulberry32(9)));
  });
});

describe('createChessEngine', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('uses bots for levels 1–4 without starting Stockfish', async () => {
    const { engine, transports } = setup([]);
    const move = await engine.chooseMove(START, 3);
    expect(move.source).toBe('bot');
    expect(transports).toHaveLength(0);
  });

  it('sends the UCI handshake and search options for Stockfish levels', async () => {
    const { engine, transports } = setup(['answer'], [], 'd2d4');
    const move = await engine.chooseMove(START, 10);
    expect(move).toEqual({ from: 'd2', to: 'd4', source: 'stockfish' });
    const sent = transports[0]?.sent ?? [];
    expect(sent.slice(0, 2)).toEqual(['uci', 'isready']);
    expect(sent).toContain('setoption name Skill Level value 20');
    expect(sent).toContain(`position fen ${START}`);
    expect(sent).toContain('go movetime 1000');
  });

  it('chooses among multipv lines on low Stockfish levels', async () => {
    const info = [
      'info depth 8 multipv 1 score cp 30 pv e2e4 e7e5',
      'info depth 8 multipv 2 score cp 25 pv d2d4 d7d5',
      'info depth 8 multipv 3 score cp 20 pv g1f3 g8f6',
    ];
    const { engine, transports } = setup(['answer'], info, 'e2e4');
    const seen = new Set<string>();
    for (let index = 0; index < 12; index += 1) {
      const move = await engine.chooseMove(START, 5);
      seen.add(`${move.from}${move.to}`);
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(transports[0]?.sent).toContain('setoption name MultiPV value 4');
  });

  it('on timeout sends stop and uses the bestmove that follows', async () => {
    const { engine, transports, warn } = setup(['answerAfterStop'], [], 'g1f3');
    const pending = engine.chooseMove(START, 10);
    await vi.advanceTimersByTimeAsync(1000 + 2000);
    const move = await pending;
    expect(transports[0]?.sent).toContain('stop');
    expect(transports[0]?.terminated).toBe(false);
    expect(move).toEqual({ from: 'g1', to: 'f3', source: 'stockfish' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('terminates a silent engine, falls back to the bot and restarts next time', async () => {
    const { engine, transports, warn } = setup(['silent', 'answer'], [], 'e2e4');
    const pending = engine.chooseMove(START, 10);
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 500);
    const move = await pending;
    expect(transports[0]?.sent).toContain('stop');
    expect(transports[0]?.terminated).toBe(true);
    expect(move.source).toBe('bot');
    expect(warn).toHaveBeenCalledOnce();

    const next = await engine.chooseMove(START, 10);
    expect(transports).toHaveLength(2);
    expect(next.source).toBe('stockfish');
  });

  it('enforces the minimum thinking time and honours abort', async () => {
    const engine = createChessEngine({ minThinkMs: 500, rng: mulberry32(2) });
    let settled = false;
    const pending = engine.chooseMove(START, 1).then((move) => {
      settled = true;
      return move;
    });
    await vi.advanceTimersByTimeAsync(400);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect((await pending).source).toBe('bot');

    const controller = new AbortController();
    const aborted = engine.chooseMove(START, 1, controller.signal);
    controller.abort();
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('hint uses the bot before Stockfish is loaded, then Stockfish', async () => {
    const { engine, transports } = setup(['answer'], [], 'g1f3');
    const early = await engine.hint(START);
    expect(early.move.source).toBe('bot');
    expect(transports).toHaveLength(0);

    engine.warmUp();
    await vi.advanceTimersByTimeAsync(0);
    const late = await engine.hint(START);
    expect(late).toEqual({
      move: { from: 'g1', to: 'f3', source: 'stockfish' },
      reason: 'developPiece',
    });
    expect(transports[0]?.sent).toContain('go movetime 300');
  });
});
