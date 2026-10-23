import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { build, type Plugin, type ResolvedConfig } from 'vite';
import { readManifest, REPO_ROOT } from '../content/files.ts';

/**
 * Builds dist/sw.js from src/sw/sw.ts after the app build, with the list of files to precache
 * and a version derived from their contents (a new build with identical files keeps the version,
 * so returning visitors download nothing).
 */

const SW_ENTRY = 'src/sw/sw.ts';
const SW_FILE = 'sw.js';

/**
 * URL to precache for a file of dist/ (relative, forward slashes), or null to skip it.
 * Lesson audio is cached when heard or downloaded from Settings, not at install.
 */
export function precacheUrl(file: string): string | null {
  if (file === 'index.html') return '/';
  if (file.endsWith('.map') || file.startsWith('audio/')) return null;
  if (file === SW_FILE || file === '_headers' || file === '_redirects') return null;
  return `/${file}`;
}

/** Precache URLs: the app files plus the common clips (prompts used on every page). */
export function precacheList(
  files: readonly string[],
  commonAudioFiles: readonly string[],
): string[] {
  const urls = files.map(precacheUrl).filter((url): url is string => url !== null);
  return [...new Set([...urls, ...commonAudioFiles.map((file) => `/audio/${file}`)])].sort();
}

/** Short hash of every precached URL and the content of its file. */
export function precacheVersion(entries: readonly { url: string; content: Buffer }[]): string {
  const hash = createHash('sha256');
  for (const { url, content } of [...entries].sort((a, b) => a.url.localeCompare(b.url))) {
    hash
      .update(url)
      .update('\0')
      .update(createHash('sha256').update(content).digest())
      .update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

function listFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  );
}

/** dist/ path of a precache URL ('/' is index.html). */
function fileOf(outDir: string, url: string): string {
  return path.join(outDir, url === '/' ? 'index.html' : url.slice(1));
}

export function serviceWorkerPlugin(root: string = REPO_ROOT): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'playchess-service-worker',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    closeBundle: {
      // After playchess-lessons has removed the audio of unshipped lessons.
      order: 'post',
      sequential: true,
      async handler() {
        const outDir = path.resolve(config.root, config.build.outDir);
        const commonAudio = Object.entries(readManifest(root))
          .filter(([key]) => key.startsWith('common/'))
          .map(([, entry]) => entry.file)
          .filter((file) => existsSync(path.join(outDir, 'audio', file)));
        const urls = precacheList(listFiles(outDir), commonAudio);
        const entries = urls.map((url) => ({ url, content: readFileSync(fileOf(outDir, url)) }));
        const version = precacheVersion(entries);
        await build({
          configFile: false,
          root: config.root,
          publicDir: false,
          logLevel: 'warn',
          define: {
            __SW_VERSION__: JSON.stringify(version),
            __SW_PRECACHE__: JSON.stringify(urls),
          },
          build: {
            outDir,
            emptyOutDir: false,
            copyPublicDir: false,
            sourcemap: false,
            target: 'es2022',
            lib: {
              entry: path.resolve(root, SW_ENTRY),
              formats: ['iife'],
              name: 'playchessServiceWorker',
              fileName: () => SW_FILE,
            },
          },
        });
        const bytes = entries.reduce((sum, entry) => sum + entry.content.length, 0);
        config.logger.info(
          `playchess-service-worker: ${SW_FILE} phiên bản ${version}, cache sẵn ${urls.length} file (${(bytes / 1_048_576).toFixed(1)} MB)`,
        );
      },
    },
  };
}
