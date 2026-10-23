// Copies the single-threaded "lite" Stockfish build from node_modules into public/engine/.
// Single-threaded = no SharedArrayBuffer, so no COOP/COEP isolation is needed on Cloudflare Pages.
// The GPL licence text travels with the binaries.
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'node_modules', 'stockfish');
const targetDir = join(root, 'public', 'engine');

const files = [
  ['bin/stockfish-19-lite-single.js', 'stockfish-19-lite-single.js'],
  ['bin/stockfish-19-lite-single.wasm', 'stockfish-19-lite-single.wasm'],
  ['Copying.txt', 'STOCKFISH-COPYING.txt'],
];

// Cloudflare Pages rejects single files above 25 MiB; fail early instead of at deploy time.
const MAX_FILE_BYTES = 25 * 1024 * 1024;

mkdirSync(targetDir, { recursive: true });
for (const [from, to] of files) {
  const source = join(sourceDir, from);
  const { size } = statSync(source);
  if (size > MAX_FILE_BYTES) {
    throw new Error(`${from} is ${size} bytes, above the Cloudflare Pages 25 MiB file limit`);
  }
  copyFileSync(source, join(targetDir, to));
}
console.log(`Copied ${files.length} engine files to public/engine/`);
