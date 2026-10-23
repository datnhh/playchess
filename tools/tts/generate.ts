import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { lessonSchema, type Lesson } from '../../src/content/schema.ts';
import {
  AUDIO_DIR,
  isMainModule,
  listAudioFiles,
  readLessonFiles,
  readManifest,
  REPO_ROOT,
  writeManifest,
} from '../content/files.ts';
import { allNarration } from '../content/narration.ts';
import { TTS_CONFIG, voiceSettings, type TtsProviderName } from './config.ts';
import { loadDotEnv } from './env.ts';
import { planGeneration, type GenerationJob } from './plan.ts';
import {
  createAzureProvider,
  createPiperProvider,
  encodeWithFfmpeg,
  hasCommand,
  resolveFfmpeg,
  SetupError,
  type Provider,
} from './providers.ts';

/**
 * TTS pipeline: synthesises every narration text whose hash has no file yet, writes
 * public/audio/<hash>.mp3 and updates content/audio/manifest.json.
 *
 *   npm run tts -- [--provider azure|piper] [--only <lessonId,...>] [--dry-run] [--skip-normalize] [--prune]
 */

const HELP = `Cách dùng: npm run tts -- [tùy chọn]
  --provider azure|piper  Nhà cung cấp giọng đọc (mặc định: ${TTS_CONFIG.provider})
  --only <id,id,...>      Chỉ tạo cho các bài này (kèm clip chung), giữ nguyên audio các bài khác
  --dry-run               Chỉ liệt kê những câu sẽ được tạo, không gọi TTS, không ghi file
  --skip-normalize        Bỏ qua chuẩn hóa âm lượng bằng ffmpeg (KHÔNG dùng cho bản phát hành)
  --prune                 Xóa file trong public/audio/ không còn được dùng`;

async function runPool<T>(items: readonly T[], limit: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next]!;
      next += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function loadLessons(): Lesson[] {
  const lessons: Lesson[] = [];
  for (const raw of readLessonFiles()) {
    const parsed = lessonSchema.safeParse(raw.data);
    if (parsed.success) lessons.push(parsed.data);
    else console.warn(`Bỏ qua ${raw.file}: không qua được schema (chạy npm run validate).`);
  }
  return lessons;
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      provider: { type: 'string', default: TTS_CONFIG.provider },
      only: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'skip-normalize': { type: 'boolean', default: false },
      prune: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(HELP);
    return 0;
  }
  if (values.provider !== 'azure' && values.provider !== 'piper') {
    console.error(`Nhà cung cấp không hợp lệ: ${values.provider}\n\n${HELP}`);
    return 1;
  }

  const providerName: TtsProviderName = values.provider;
  const only = values.only
    ? new Set(
        values.only
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      )
    : null;
  if (only && values.prune) {
    console.error(
      'Không dùng --only cùng --prune: --prune sẽ xóa audio của các bài không được chọn.',
    );
    return 1;
  }

  if (values.provider !== TTS_CONFIG.provider) {
    console.warn(
      `⚠ Đang dùng ${values.provider} nhưng TTS_CONFIG.provider là ${TTS_CONFIG.provider}: ` +
        'npm run validate sẽ coi các file này là cũ. Đổi TTS_CONFIG.provider nếu muốn chuyển hẳn.',
    );
  }
  const lessons = loadLessons();
  if (only) {
    const unknown = [...only].filter((id) => !lessons.some((lesson) => lesson.id === id));
    if (unknown.length > 0) {
      console.error(`Không có bài: ${unknown.join(', ')}`);
      return 1;
    }
  }
  const items = allNarration(lessons).filter(
    (item) => !only || item.lessonId === null || only.has(item.lessonId),
  );
  const plan = planGeneration(items, readManifest(), listAudioFiles(), providerName, {
    partial: only !== null,
  });
  const { voice, rate } = voiceSettings(providerName);
  console.log(
    `Giọng ${voice}, tốc độ ${rate}. ${items.length} câu: ` +
      `${plan.upToDate} đã có audio, ${plan.jobs.length} file cần tạo.`,
  );

  if (values['dry-run']) {
    for (const job of plan.jobs)
      console.log(`  + ${job.file}  ${job.keys.join(', ')}  "${job.text}"`);
    if (plan.removedKeys.length > 0) {
      console.log(
        `Sẽ bỏ ${plan.removedKeys.length} mục manifest không dùng: ${plan.removedKeys.join(', ')}`,
      );
    }
    if (plan.orphanFiles.length > 0) {
      const verb = values.prune ? 'Sẽ xóa' : 'Có (dùng --prune để xóa)';
      console.log(`${verb} ${plan.orphanFiles.length} file thừa: ${plan.orphanFiles.join(', ')}`);
    }
    console.log('Chạy thử (--dry-run): không gọi TTS, không ghi file.');
    return 0;
  }

  loadDotEnv(REPO_ROOT);
  const provider: Provider | null =
    plan.jobs.length === 0
      ? null
      : values.provider === 'azure'
        ? createAzureProvider()
        : createPiperProvider();

  const ffmpeg = resolveFfmpeg();
  const needsFfmpeg = !values['skip-normalize'] || values.provider === 'piper';
  if (plan.jobs.length > 0) {
    if (needsFfmpeg && !hasCommand(ffmpeg)) {
      throw new SetupError(
        'Không tìm thấy ffmpeg (cần để chuẩn hóa âm lượng và chuyển sang MP3). ' +
          'Chạy npm run tts:setup hoặc đặt FFMPEG_BIN trong .env' +
          (values.provider === 'azure' ? ', hoặc tạm dùng --skip-normalize.' : '.'),
      );
    }
    if (values['skip-normalize']) {
      console.warn(
        '\n!!! CẢNH BÁO: --skip-normalize — audio KHÔNG được chuẩn hóa âm lượng (-16 LUFS). ' +
          'Các câu có thể to nhỏ khác nhau. Không dùng cho bản phát hành. !!!\n',
      );
    }
  }

  const audioDir = path.join(REPO_ROOT, AUDIO_DIR);
  mkdirSync(audioDir, { recursive: true });
  const workDir = mkdtempSync(path.join(tmpdir(), 'playchess-tts-'));
  const failed = new Set<string>();
  let done = 0;

  try {
    await runPool(plan.jobs, TTS_CONFIG.concurrency, async (job: GenerationJob) => {
      try {
        const result = await provider!.synthesize(job.text, workDir);
        const target = path.join(audioDir, job.file);
        if (result.format === 'mp3' && values['skip-normalize']) {
          writeFileSync(target, result.audio);
        } else {
          const input = path.join(workDir, `${job.hash}.${result.format}`);
          writeFileSync(input, result.audio);
          await encodeWithFfmpeg(input, target, !values['skip-normalize'], ffmpeg);
        }
        done += 1;
        console.log(`  [${done}/${plan.jobs.length}] ${job.file}  "${job.text}"`);
      } catch (error) {
        failed.add(job.hash);
        console.error(`  LỖI ${job.keys.join(', ')}: ${(error as Error).message}`);
      }
    });
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  // Failed clips keep their previous entry (still stale, so the validator keeps reporting them).
  const previous = readManifest();
  const manifest = { ...plan.manifest };
  for (const job of plan.jobs) {
    if (!failed.has(job.hash)) continue;
    for (const key of job.keys) {
      const old = previous[key];
      if (old) manifest[key] = old;
      else delete manifest[key];
    }
  }
  writeManifest(manifest);
  console.log(`Đã cập nhật content/audio/manifest.json (${Object.keys(manifest).length} mục).`);

  if (values.prune) {
    const referenced = new Set(Object.values(manifest).map((entry) => entry.file));
    const orphans = [...listAudioFiles()].filter((file) => !referenced.has(file));
    for (const file of orphans) unlinkSync(path.join(audioDir, file));
    console.log(`Đã xóa ${orphans.length} file thừa.`);
  } else if (plan.orphanFiles.length > 0) {
    console.log(`Có ${plan.orphanFiles.length} file thừa; chạy với --prune để xóa.`);
  }

  if (failed.size > 0) {
    console.error(`${failed.size} file tạo thất bại.`);
    return 1;
  }
  return 0;
}

if (isMainModule(import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      if (error instanceof SetupError) console.error(`\n${error.message}`);
      else console.error(error);
      process.exitCode = 1;
    },
  );
}
