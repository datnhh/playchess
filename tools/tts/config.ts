export type TtsProviderName = 'azure' | 'piper';

/**
 * TTS settings shared by the generator (tools/tts) and the content validator (tools/content).
 * Changing provider, voice or rate changes every hash (tools/tts/hash.ts), so all clips are
 * regenerated on the next run. The validator expects clips made with `provider`.
 */
export const TTS_CONFIG = {
  provider: 'azure' as TtsProviderName,
  voice: 'vi-VN-HoaiMyNeural',
  rate: '-10%',
  language: 'vi-VN',
  /** Azure output format: MP3, mono, 24 kHz, 48 kbps. */
  azureOutputFormat: 'audio-24khz-48kbitrate-mono-mp3',
  sampleRate: 24000,
  bitrate: '48k',
  /** EBU R128 loudness target applied by ffmpeg loudnorm. */
  loudness: { integrated: -16, truePeak: -1, range: 11 },
  concurrency: 2,
  requestTimeoutMs: 30_000,
  maxRetries: 4,
} as const;

export function audioFileName(hash: string): string {
  return `${hash}.mp3`;
}
