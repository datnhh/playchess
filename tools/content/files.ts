import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { AudioManifest } from '../../src/content/audio.ts';

/** File-system access for content tools. Paths in results are repo-relative with forward slashes. */

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const LESSONS_DIR = 'content/lessons';
export const MANIFEST_FILE = 'content/audio/manifest.json';
export const AUDIO_DIR = 'public/audio';

export interface RawLessonFile {
  /** e.g. "content/lessons/basic/rook.json" */
  file: string;
  /** Parsed JSON, or undefined when the file is not valid JSON. */
  data: unknown;
  parseError?: string;
}

export const manifestSchema = z.record(
  z.string(),
  z.object({ file: z.string().min(1), hash: z.string().min(1), text: z.string() }),
);

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

export function toRepoPath(absolute: string, root = REPO_ROOT): string {
  return path.relative(root, absolute).split(path.sep).join('/');
}

export function readLessonFiles(root = REPO_ROOT): RawLessonFile[] {
  return walk(path.join(root, LESSONS_DIR))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((absolute) => {
      const file = toRepoPath(absolute, root);
      try {
        return { file, data: JSON.parse(readFileSync(absolute, 'utf8')) as unknown };
      } catch (error) {
        return { file, data: undefined, parseError: (error as Error).message };
      }
    });
}

export function readManifest(root = REPO_ROOT): AudioManifest {
  const absolute = path.join(root, MANIFEST_FILE);
  if (!existsSync(absolute)) return {};
  return manifestSchema.parse(JSON.parse(readFileSync(absolute, 'utf8')));
}

/** Writes the manifest with sorted keys so diffs stay small. */
export function writeManifest(manifest: AudioManifest, root = REPO_ROOT): void {
  const sorted = Object.fromEntries(
    Object.keys(manifest)
      .sort()
      .map((key) => [key, manifest[key]]),
  );
  writeFileSync(path.join(root, MANIFEST_FILE), `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
}

/** File names (not paths) of the MP3 files in public/audio/. */
export function listAudioFiles(root = REPO_ROOT): Set<string> {
  const dir = path.join(root, AUDIO_DIR);
  if (!existsSync(dir)) return new Set();
  return new Set(readdirSync(dir).filter((name) => name.endsWith('.mp3')));
}

/** True when the module at `metaUrl` is the script node was started with. */
export function isMainModule(metaUrl: string): boolean {
  const entry = process.argv[1];
  return entry !== undefined && path.resolve(entry) === fileURLToPath(metaUrl);
}
