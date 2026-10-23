import type { AudioManifest, AudioManifestEntry } from '../../src/content/audio.ts';
import type { NarrationItem } from '../content/narration.ts';
import { audioFileName, TTS_CONFIG, type TtsProviderName } from './config.ts';
import { audioHash } from './hash.ts';

/**
 * Decides which clips must be synthesised. Pure: the generator feeds it the narration, the current
 * manifest and the files on disk. Identical texts share one file (same hash).
 */

export interface GenerationJob {
  hash: string;
  file: string;
  text: string;
  keys: string[];
}

export interface GenerationPlan {
  /** Files to synthesise, one per distinct hash. */
  jobs: GenerationJob[];
  /** Manifest after all jobs succeed (only current keys, sorted). */
  manifest: Record<string, AudioManifestEntry>;
  /** Number of keys already up to date. */
  upToDate: number;
  /** Manifest keys that are no longer used. */
  removedKeys: string[];
  /** Files in public/audio/ not referenced by the new manifest. */
  orphanFiles: string[];
}

/**
 * `partial`: `items` is only a subset (`npm run tts -- --only ...`). Entries of other keys are kept
 * as they are and nothing is reported as removed or orphaned, so a trial run never drops the audio
 * of lessons it did not touch.
 */
export function planGeneration(
  items: readonly Pick<NarrationItem, 'key' | 'text'>[],
  manifest: AudioManifest,
  audioFiles: ReadonlySet<string>,
  provider: TtsProviderName = TTS_CONFIG.provider,
  { partial = false }: { partial?: boolean } = {},
): GenerationPlan {
  const jobs = new Map<string, GenerationJob>();
  const next: Record<string, AudioManifestEntry> = {};
  let upToDate = 0;

  for (const item of [...items].sort((a, b) => a.key.localeCompare(b.key))) {
    const hash = audioHash(item.text, provider);
    const file = audioFileName(hash);
    next[item.key] = { file, hash, text: item.text };
    // The file name is the hash of provider, voice, rate and spoken text, so an existing file is always current
    // (possibly produced earlier for another key with the same text).
    if (audioFiles.has(file)) {
      upToDate += 1;
      continue;
    }
    const job = jobs.get(hash);
    if (job) job.keys.push(item.key);
    else jobs.set(hash, { hash, file, text: item.text, keys: [item.key] });
  }

  if (partial) {
    return {
      jobs: [...jobs.values()],
      manifest: { ...manifest, ...next },
      upToDate,
      removedKeys: [],
      orphanFiles: [],
    };
  }

  const referenced = new Set(Object.values(next).map((entry) => entry.file));
  return {
    jobs: [...jobs.values()],
    manifest: next,
    upToDate,
    removedKeys: Object.keys(manifest)
      .filter((key) => !(key in next))
      .sort(),
    orphanFiles: [...audioFiles].filter((file) => !referenced.has(file)).sort(),
  };
}
