import type { UciTransport } from './uci.ts';

// Kept apart from uci.ts so Node tools can import the client without DOM types.

/** Classic Web Worker speaking UCI via postMessage (the lite single-threaded build). */
export function createWorkerTransport(url: string): UciTransport {
  const worker = new Worker(url);
  const listeners = new Set<(line: string) => void>();
  worker.onmessage = (event: MessageEvent<unknown>) => {
    // The engine sometimes batches several lines into one message.
    for (const line of String(event.data).split('\n')) {
      if (line) listeners.forEach((listener) => listener(line));
    }
  };
  worker.onerror = (event) => {
    event.preventDefault();
    listeners.forEach((listener) => listener(`error ${event.message || 'worker error'}`));
  };
  return {
    send: (command) => worker.postMessage(command),
    onLine: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    terminate: () => worker.terminate(),
  };
}
