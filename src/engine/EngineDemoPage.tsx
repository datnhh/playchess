import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { engineMoveToUci } from './bots.ts';
import { createChessEngine } from './service.ts';
import { ENGINE_LEVELS, type EngineLevel, type EngineMove, type HintReason } from './types.ts';

/**
 * Developer demo for the engine (no board): pick a level, let the computer move, ask for hints.
 * The route is wired by the app shell.
 */

const SOURCE_LABELS: Record<EngineMove['source'], string> = {
  bot: 'bot',
  stockfish: 'Stockfish',
};

export function EngineDemoPage() {
  const engine = useMemo(() => createChessEngine(), []);
  const chessRef = useRef(new Chess());
  const [level, setLevel] = useState<EngineLevel>(1);
  const [history, setHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<EngineMove | null>(null);
  const [hint, setHint] = useState<{ move: EngineMove; reason: HintReason } | null>(null);
  const [busy, setBusy] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    engine.warmUp();
    return () => {
      abortRef.current?.abort();
      engine.dispose();
    };
  }, [engine]);

  const run = async (task: (signal: AbortSignal) => Promise<void>) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    try {
      await task(controller.signal);
    } catch (caught) {
      if (!(caught instanceof Error && caught.name === 'AbortError')) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    } finally {
      if (abortRef.current === controller) setBusy(false);
    }
  };

  const playEngineMove = () =>
    run(async (signal) => {
      const chess = chessRef.current;
      const move = await engine.chooseMove(chess.fen(), level, signal);
      chess.move(engineMoveToUci(move));
      setHistory(chess.history());
      setLastMove(move);
      setGameOver(chess.isGameOver());
      setHint(null);
    });

  const askHint = () =>
    run(async (signal) => {
      setHint(await engine.hint(chessRef.current.fen(), signal));
    });

  const newGame = () => {
    abortRef.current?.abort();
    chessRef.current = new Chess();
    setHistory([]);
    setLastMove(null);
    setGameOver(false);
    setHint(null);
    setError(null);
    setBusy(false);
  };

  return (
    <main style={{ padding: 16, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>Thử máy chơi cờ</h1>
      <label>
        Cấp độ:{' '}
        <select
          value={level}
          onChange={(event) => setLevel(Number(event.target.value) as EngineLevel)}
        >
          {ENGINE_LEVELS.map((value) => (
            <option key={value} value={value}>
              Cấp {value}
            </option>
          ))}
        </select>
      </label>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <button type="button" onClick={() => void playEngineMove()} disabled={busy || gameOver}>
          Máy đi
        </button>
        <button type="button" onClick={() => void askHint()} disabled={busy || gameOver}>
          Gợi ý
        </button>
        <button type="button" onClick={newGame}>
          Ván mới
        </button>
      </div>
      {busy && <p>Máy đang nghĩ…</p>}
      {error && <p role="alert">Lỗi: {error}</p>}
      {gameOver && <p>Ván cờ đã kết thúc.</p>}
      <p>
        Nước máy vừa đi:{' '}
        {lastMove ? `${engineMoveToUci(lastMove)} (${SOURCE_LABELS[lastMove.source]})` : '—'}
      </p>
      <p>
        Gợi ý:{' '}
        {hint
          ? `${engineMoveToUci(hint.move)} (${SOURCE_LABELS[hint.move.source]}), lý do: ${hint.reason}`
          : '—'}
      </p>
      <h2>Các nước đã đi</h2>
      <ol>
        {history
          .reduce<string[]>((rows, san, index) => {
            if (index % 2 === 0) rows.push(san);
            else rows[rows.length - 1] += ` ${san}`;
            return rows;
          }, [])
          .map((row, index) => (
            <li key={index}>{row}</li>
          ))}
      </ol>
    </main>
  );
}
