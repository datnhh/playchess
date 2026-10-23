/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { lessonsPlugin } from './tools/vite/lessonsPlugin.ts';

/**
 * Reads the global ("/*") block of public/_headers so that `vite preview`
 * serves the same security headers as Cloudflare Pages. Keeps one source of truth.
 * Not applied to `vite dev`: the dev server injects inline scripts that a strict CSP would block.
 */
function readGlobalHeaders(): Record<string, string> {
  const file = fileURLToPath(new URL('./public/_headers', import.meta.url));
  const headers: Record<string, string> = {};
  let inGlobalBlock = false;
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (rawLine.trim() === '' || rawLine.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(rawLine)) {
      inGlobalBlock = rawLine.trim() === '/*';
      continue;
    }
    if (!inGlobalBlock) continue;
    const separator = rawLine.indexOf(':');
    if (separator > 0) {
      headers[rawLine.slice(0, separator).trim()] = rawLine.slice(separator + 1).trim();
    }
  }
  return headers;
}

export default defineConfig({
  plugins: [react(), lessonsPlugin()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  preview: {
    headers: readGlobalHeaders(),
  },
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
    environment: 'node',
  },
});
