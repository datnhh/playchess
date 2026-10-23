import { useCallback, useEffect, useRef, useState } from 'react';
import { Chessground } from 'chessground';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import { STOCKFISH_WORKER_URL } from '../engine/assets.ts';

/**
 * Diagnostic page (/smoke, not linked from the UI). Opened on real phones/tablets after a deploy
 * to confirm that the CSP in public/_headers allows the Stockfish Web Worker + WASM and the board assets.
 */

const ENGINE_TIMEOUT_MS = 20_000;

type SmokeStatus = 'running' | 'ok' | 'fail';

function runEngineSmoke(log: (line: string) => void, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const elapsed = () => Math.round(performance.now() - startedAt);
    let worker: Worker;
    try {
      worker = new Worker(STOCKFISH_WORKER_URL);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    const finish = (error: Error | null, bestMove?: string) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      worker.terminate();
      if (error) reject(error);
      else resolve(bestMove ?? '');
    };
    const onAbort = () => finish(new Error('Đã huỷ'));
    const timer = setTimeout(
      () => finish(new Error(`Hết thời gian chờ engine (${ENGINE_TIMEOUT_MS / 1000} giây)`)),
      ENGINE_TIMEOUT_MS,
    );
    signal.addEventListener('abort', onAbort);

    worker.onerror = (event) => {
      event.preventDefault();
      finish(new Error(`Worker lỗi: ${event.message || 'không rõ nguyên nhân'}`));
    };
    worker.onmessage = (event: MessageEvent<unknown>) => {
      const line = String(event.data);
      if (line.startsWith('id name')) {
        log(`${line.slice('id name '.length)} (${elapsed()} ms)`);
      } else if (line === 'uciok') {
        log(`uciok sau ${elapsed()} ms`);
        worker.postMessage('isready');
      } else if (line === 'readyok') {
        log(`readyok sau ${elapsed()} ms, bắt đầu tính 1 giây`);
        worker.postMessage('position startpos');
        worker.postMessage('go movetime 1000');
      } else if (line.startsWith('bestmove')) {
        log(`${line} sau ${elapsed()} ms`);
        finish(null, line.split(' ')[1]);
      }
    };
    worker.postMessage('uci');
  });
}

export function SmokePage() {
  const [status, setStatus] = useState<SmokeStatus>('running');
  const [lines, setLines] = useState<string[]>([]);
  const [cspViolations, setCspViolations] = useState<string[]>([]);
  const [runId, setRunId] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onViolation = (event: SecurityPolicyViolationEvent) => {
      setCspViolations((previous) => [
        ...previous,
        `${event.effectiveDirective}: ${event.blockedURI || '(inline)'}`,
      ]);
    };
    document.addEventListener('securitypolicyviolation', onViolation);
    return () => document.removeEventListener('securitypolicyviolation', onViolation);
  }, []);

  useEffect(() => {
    if (!boardRef.current) return;
    const board = Chessground(boardRef.current, {});
    return () => board.destroy();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    runEngineSmoke((line) => setLines((previous) => [...previous, line]), controller.signal).then(
      () => setStatus('ok'),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setStatus('fail');
        setLines((previous) => [
          ...previous,
          error instanceof Error ? error.message : String(error),
        ]);
      },
    );
    return () => controller.abort();
  }, [runId]);

  const rerun = useCallback(() => {
    setStatus('running');
    setLines([]);
    setRunId((id) => id + 1);
  }, []);

  return (
    <main className="page">
      <h1 className="page-title">Kiểm tra kỹ thuật</h1>

      <section className="panel">
        <h2>Engine Stockfish (Web Worker + WASM)</h2>
        <p>
          Trạng thái:{' '}
          <span
            data-testid="engine-status"
            className={
              status === 'fail' ? 'status-fail' : status === 'ok' ? 'status-ok' : undefined
            }
          >
            {status === 'running' ? 'đang chạy…' : status === 'ok' ? 'ok' : 'lỗi'}
          </span>
        </p>
        <ul data-testid="engine-log">
          {lines.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
        <button type="button" className="button" onClick={rerun} disabled={status === 'running'}>
          Chạy lại
        </button>
      </section>

      <section className="panel">
        <h2>Môi trường</h2>
        <ul>
          <li>WebAssembly: {typeof WebAssembly === 'object' ? 'có' : 'không'}</li>
          <li>crossOriginIsolated: {String(window.crossOriginIsolated)} (không bắt buộc)</li>
          <li>
            Vi phạm CSP:{' '}
            <span data-testid="csp-violations">
              {cspViolations.length === 0 ? 'không có' : cspViolations.join('; ')}
            </span>
          </li>
          <li>Trình duyệt: {navigator.userAgent}</li>
        </ul>
      </section>

      <section className="panel">
        <h2>Bàn cờ (chessground)</h2>
        <div ref={boardRef} className="smoke-board" data-testid="smoke-board" />
      </section>
    </main>
  );
}
