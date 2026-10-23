import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { TTS_CONFIG } from './config.ts';
import { applyPronunciation, buildSsml } from './ssml.ts';

/**
 * TTS providers. Each returns raw audio for one text: Azure returns MP3, Piper returns WAV.
 * Secrets come from the environment and are never logged or included in error messages.
 */

export interface SynthesisResult {
  audio: Buffer;
  /** Container of `audio`; WAV always needs ffmpeg to become MP3. */
  format: 'mp3' | 'wav';
}

export interface Provider {
  name: 'azure' | 'piper';
  synthesize(text: string, workDir: string): Promise<SynthesisResult>;
}

/** Error the CLI shows as is (Vietnamese, no stack). */
export class SetupError extends Error {}

export function hasCommand(command: string, args: readonly string[] = ['-version']): boolean {
  const result = spawnSync(command, args, { stdio: 'ignore', shell: false });
  return !result.error && result.status === 0;
}

const RETRYABLE_STATUS = (status: number) => status === 429 || status >= 500;

class HttpError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | null;
  constructor(status: number, retryAfterMs: number | null) {
    super(`Azure trả về HTTP ${status}`);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retries `task` on 429/5xx, timeouts and network errors with exponential backoff and jitter. */
export async function withRetry<T>(
  task: () => Promise<T>,
  maxRetries: number = TTS_CONFIG.maxRetries,
  baseDelayMs = 1000,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      const retryable = error instanceof HttpError ? RETRYABLE_STATUS(error.status) : true;
      if (!retryable || attempt >= maxRetries) throw error;
      const backoff = baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs;
      const retryAfter = error instanceof HttpError ? error.retryAfterMs : null;
      await sleep(Math.max(backoff, retryAfter ?? 0));
    }
  }
}

export function createAzureProvider(env: NodeJS.ProcessEnv = process.env): Provider {
  const key = env.AZURE_SPEECH_KEY;
  const region = env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    throw new SetupError(
      'Thiếu AZURE_SPEECH_KEY hoặc AZURE_SPEECH_REGION. Đặt chúng trong biến môi trường hoặc file .env (xem .env.example).',
    );
  }
  if (!/^[a-z0-9]+$/.test(region)) {
    throw new SetupError('AZURE_SPEECH_REGION không hợp lệ (ví dụ: southeastasia).');
  }
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  return {
    name: 'azure',
    synthesize: (text) =>
      withRetry(async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': key,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': TTS_CONFIG.azureOutputFormat,
            'User-Agent': 'playchess-tts',
          },
          body: buildSsml(text),
          signal: AbortSignal.timeout(TTS_CONFIG.requestTimeoutMs),
        });
        if (!response.ok) {
          const retryAfter = Number(response.headers.get('retry-after'));
          throw new HttpError(
            response.status,
            Number.isFinite(retryAfter) ? retryAfter * 1000 : null,
          );
        }
        return { audio: Buffer.from(await response.arrayBuffer()), format: 'mp3' as const };
      }),
  };
}

export function createPiperProvider(env: NodeJS.ProcessEnv = process.env): Provider {
  const model = env.PIPER_MODEL;
  if (!model) throw new SetupError('Thiếu PIPER_MODEL (đường dẫn file .onnx của giọng Piper).');
  if (!hasCommand('piper', ['--help'])) {
    throw new SetupError('Không tìm thấy lệnh "piper". Cài Piper và thêm vào PATH.');
  }

  let counter = 0;
  return {
    name: 'piper',
    synthesize: async (text, workDir) => {
      counter += 1;
      const output = path.join(workDir, `piper-${counter}.wav`);
      await new Promise<void>((resolve, reject) => {
        const child = spawn('piper', ['--model', model, '--output_file', output], {
          stdio: ['pipe', 'ignore', 'pipe'],
        });
        let stderr = '';
        const timer = setTimeout(() => child.kill(), TTS_CONFIG.requestTimeoutMs);
        child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
        child.on('error', reject);
        child.on('close', (code) => {
          clearTimeout(timer);
          if (code === 0) resolve();
          else reject(new Error(`piper thoát với mã ${code}: ${stderr.slice(-300)}`));
        });
        child.stdin.end(applyPronunciation(text));
      });
      return { audio: await readFile(output), format: 'wav' };
    },
  };
}

/** Converts to MP3 mono 24 kHz 48 kbps, optionally normalising loudness with loudnorm. */
export async function encodeWithFfmpeg(
  input: string,
  output: string,
  normalize: boolean,
): Promise<void> {
  const { integrated, truePeak, range } = TTS_CONFIG.loudness;
  const args = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    input,
    ...(normalize ? ['-af', `loudnorm=I=${integrated}:TP=${truePeak}:LRA=${range}`] : []),
    '-ar',
    String(TTS_CONFIG.sampleRate),
    '-ac',
    '1',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    TTS_CONFIG.bitrate,
    output,
  ];
  await new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ffmpeg thoát với mã ${code}: ${stderr.slice(-300)}`)),
    );
  });
}
