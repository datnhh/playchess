import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import type { AudioManifest } from '../../src/content/audio.ts';
import {
  LESSONS_DIR,
  MANIFEST_FILE,
  readLessonFiles,
  readManifest,
  REPO_ROOT,
} from '../content/files.ts';

/**
 * Provides `virtual:lessons` (array of lesson JSON) and `virtual:audio-manifest`.
 * Production builds ship only reviewed lessons (PLAYCHESS_INCLUDE_DRAFTS=1 adds drafts for preview
 * deployments) and only the audio those lessons use; the dev server serves everything.
 */

const LESSONS_ID = 'virtual:lessons';
const MANIFEST_ID = 'virtual:audio-manifest';
const RESOLVED = (id: string) => `\0${id}`;

export interface FilteredContent {
  lessons: unknown[];
  manifest: Record<string, AudioManifest[string]>;
}

/**
 * Keeps reviewed lessons (or all when `includeDrafts`) and the manifest entries they use plus
 * the common clips. Lessons are raw JSON: anything not explicitly `reviewed: true` is a draft.
 */
export function filterContent(
  lessons: readonly unknown[],
  manifest: AudioManifest,
  includeDrafts: boolean,
): FilteredContent {
  const kept = lessons.filter(
    (lesson) =>
      includeDrafts ||
      (typeof lesson === 'object' &&
        lesson !== null &&
        'reviewed' in lesson &&
        lesson.reviewed === true),
  );
  const prefixes = [
    'common/',
    ...kept.flatMap((lesson) =>
      typeof lesson === 'object' &&
      lesson !== null &&
      'id' in lesson &&
      typeof lesson.id === 'string'
        ? [`${lesson.id}/`]
        : [],
    ),
  ];
  const filtered: Record<string, AudioManifest[string]> = {};
  for (const [key, entry] of Object.entries(manifest)) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) filtered[key] = entry;
  }
  return { lessons: kept, manifest: filtered };
}

export function lessonsPlugin(root: string = REPO_ROOT): Plugin {
  let config: ResolvedConfig;

  const load = (): FilteredContent => {
    const includeDrafts =
      config.command === 'serve' || process.env.PLAYCHESS_INCLUDE_DRAFTS === '1';
    const files = readLessonFiles(root).filter((file) => file.data !== undefined);
    return filterContent(
      files.map((file) => file.data),
      readManifest(root),
      includeDrafts,
    );
  };

  return {
    name: 'playchess-lessons',
    configResolved(resolved) {
      config = resolved;
    },
    resolveId(id) {
      return id === LESSONS_ID || id === MANIFEST_ID ? RESOLVED(id) : null;
    },
    load(id) {
      if (id !== RESOLVED(LESSONS_ID) && id !== RESOLVED(MANIFEST_ID)) return null;
      const content = load();
      if (config.command === 'build') {
        this.info(
          `${content.lessons.length} bài học, ${Object.keys(content.manifest).length} clip audio`,
        );
      }
      const value = id === RESOLVED(LESSONS_ID) ? content.lessons : content.manifest;
      return `export default ${JSON.stringify(value)};`;
    },
    configureServer(server) {
      const lessonsDir = path.join(root, LESSONS_DIR);
      const manifestFile = path.join(root, MANIFEST_FILE);
      server.watcher.add([lessonsDir, manifestFile]);
      const onChange = (file: string) => {
        const normalized = path.resolve(file);
        if (
          !normalized.startsWith(path.resolve(lessonsDir)) &&
          normalized !== path.resolve(manifestFile)
        ) {
          return;
        }
        for (const id of [LESSONS_ID, MANIFEST_ID]) {
          const module = server.moduleGraph.getModuleById(RESOLVED(id));
          if (module) server.moduleGraph.invalidateModule(module);
        }
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', onChange);
      server.watcher.on('change', onChange);
      server.watcher.on('unlink', onChange);
    },
    closeBundle() {
      // public/audio is copied wholesale into dist/audio; drop clips of lessons not shipped.
      if (config.command !== 'build') return;
      const audioDir = path.resolve(config.root, config.build.outDir, 'audio');
      if (!existsSync(audioDir)) return;
      const keep = new Set(Object.values(load().manifest).map((entry) => entry.file));
      let removed = 0;
      for (const name of readdirSync(audioDir)) {
        if (keep.has(name)) continue;
        unlinkSync(path.join(audioDir, name));
        removed += 1;
      }
      if (removed > 0)
        config.logger.info(
          `playchess-lessons: đã xóa ${removed} file audio không dùng khỏi dist/audio`,
        );
    },
  };
}
