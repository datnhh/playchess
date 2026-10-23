import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';
import { isMainModule } from '../content/files.ts';
import { TTS_VOICES } from './config.ts';
import {
  DEFAULT_FFMPEG_BIN,
  DEFAULT_PIPER_BIN,
  DEFAULT_PIPER_MODEL,
  FFMPEG_FOLDER,
  FFMPEG_VERSION,
  hasCommand,
  TOOLS_DIR,
} from './providers.ts';

/**
 * Downloads the offline TTS tools into .tools/ (gitignored): Piper, the Vietnamese voice and a
 * static ffmpeg. Every file is pinned by URL and size, and by sha256 where the source publishes one;
 * a mismatch aborts before anything is extracted. The user's PATH and system are not touched.
 *
 *   npm run tts:setup
 */

interface Download {
  file: string;
  url: string;
  size: number;
  /** From the source (Hugging Face LFS oid, GitHub asset digest) or pinned at the first download. */
  sha256: string | null;
}

const MODEL = TTS_VOICES.piper.model;
const VOICE_BASE = `https://huggingface.co/rhasspy/piper-voices/resolve/main/vi/vi_VN/vais1000/medium`;

export const DOWNLOADS: readonly Download[] = [
  {
    // rhasspy/piper is archived; 2023.11.14-2 is its last release. GitHub shows no digest for it.
    file: 'piper_windows_amd64.zip',
    url: 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip',
    size: 22_477_236,
    // GitHub publishes no digest for this release: pinned from the first download (2026-10-23).
    sha256: 'f3c58906402b24f3a96d92145f58acba6d86c9b5db896d207f78dc80811efcea',
  },
  {
    file: `${MODEL}.onnx`,
    url: `${VOICE_BASE}/${MODEL}.onnx`,
    size: 63_201_294,
    sha256: 'ec7c89e2c85f4d1edc24b6120c18aaf1bda614f06b511567eb9c7c0de15e2dab',
  },
  {
    file: `${MODEL}.onnx.json`,
    url: `${VOICE_BASE}/${MODEL}.onnx.json`,
    size: 4_860,
    // Small non-LFS file: pinned from the first download (2026-10-23).
    sha256: 'fafb9da1354ed4b77c31af228ed41fb41cd825c14cffa105454b25e6ae751ee0',
  },
  {
    file: `${FFMPEG_FOLDER}.zip`,
    url: `https://github.com/GyanD/codexffmpeg/releases/download/${FFMPEG_VERSION}/${FFMPEG_FOLDER}.zip`,
    size: 114_768_076,
    sha256: '60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba',
  },
];

const DOWNLOAD_DIR = path.join(TOOLS_DIR, 'downloads');

function sha256Of(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** Throws when the file on disk does not match the pinned size/hash. */
export function verify(item: Download, actualSize: number, actualSha256: string): void {
  if (actualSize !== item.size) {
    throw new Error(`${item.file}: dung lượng ${actualSize} byte, mong đợi ${item.size} byte.`);
  }
  if (item.sha256 && actualSha256 !== item.sha256) {
    throw new Error(`${item.file}: sha256 ${actualSha256} khác giá trị ghim ${item.sha256}.`);
  }
}

async function download(item: Download): Promise<string> {
  const target = path.join(DOWNLOAD_DIR, item.file);
  if (existsSync(target) && statSync(target).size === item.size) {
    verify(item, item.size, sha256Of(target));
    console.log(`  ✓ ${item.file} (đã có)`);
    return target;
  }
  console.log(
    `  ↓ ${item.file} (${(item.size / 1_048_576).toFixed(1)} MiB) từ ${new URL(item.url).host}`,
  );
  const response = await fetch(item.url, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`${item.file}: HTTP ${response.status}`);
  const partial = `${target}.part`;
  await pipeline(Readable.fromWeb(response.body as ReadableStream), createWriteStream(partial));
  try {
    verify(item, statSync(partial).size, sha256Of(partial));
  } catch (error) {
    rmSync(partial, { force: true });
    throw error;
  }
  renameSync(partial, target);
  console.log(`  ✓ ${item.file} sha256 ${sha256Of(target)}`);
  return target;
}

/** Windows' own bsdtar reads zip files; the tar of Git Bash (GNU) does not. */
function unzip(archive: string, destination: string): void {
  const tar =
    process.platform === 'win32'
      ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
      : 'tar';
  const result = spawnSync(tar, ['-xf', archive, '-C', destination], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Giải nén ${path.basename(archive)} thất bại.`);
}

async function main(): Promise<number> {
  if (process.platform !== 'win32') {
    console.error(
      'Script này tải bản Windows của Piper; trên máy khác hãy tự cài và đặt PIPER_BIN.',
    );
    return 1;
  }
  mkdirSync(DOWNLOAD_DIR, { recursive: true });
  console.log(`Tải công cụ TTS vào ${TOOLS_DIR}`);
  const [piperZip, model, modelConfig, ffmpegZip] = await Promise.all(DOWNLOADS.map(download));

  // Piper: the zip contains a piper/ folder (piper.exe, DLLs, espeak-ng-data).
  rmSync(path.join(TOOLS_DIR, 'piper'), { recursive: true, force: true });
  unzip(piperZip!, TOOLS_DIR);

  const voicesDir = path.dirname(DEFAULT_PIPER_MODEL);
  mkdirSync(voicesDir, { recursive: true });
  for (const file of [model!, modelConfig!]) {
    const target = path.join(voicesDir, path.basename(file));
    rmSync(target, { force: true });
    // Copy (not move) so the verified download stays cached for the next run.
    copyFileSync(file, target);
  }

  // ffmpeg: the zip holds a versioned folder, used in place (renaming folders on Windows fails while
  // a file watcher or antivirus holds them).
  rmSync(path.join(TOOLS_DIR, FFMPEG_FOLDER), { recursive: true, force: true });
  unzip(ffmpegZip!, TOOLS_DIR);

  const piperOk = hasCommand(DEFAULT_PIPER_BIN, ['--help']);
  const ffmpegOk = hasCommand(DEFAULT_FFMPEG_BIN, ['-version']);
  console.log(`Piper: ${piperOk ? 'chạy được' : 'LỖI'} (${DEFAULT_PIPER_BIN})`);
  console.log(`ffmpeg: ${ffmpegOk ? 'chạy được' : 'LỖI'} (${DEFAULT_FFMPEG_BIN})`);
  return piperOk && ffmpegOk ? 0 : 1;
}

if (isMainModule(import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(`\n${(error as Error).message}`);
      process.exitCode = 1;
    },
  );
}
