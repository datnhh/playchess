export type TtsProviderName = 'azure' | 'piper';

/**
 * Voice settings per provider. Piper (offline) is the provider in use; the Azure settings are kept
 * so the provider can be switched back without code archaeology.
 */
export const TTS_VOICES = {
  azure: { voice: 'vi-VN-HoaiMyNeural', rate: '-10%' },
  piper: {
    /** Model id: the .onnx file must be named `<model>.onnx` (checked before synthesis). */
    model: 'vi_VN-vais1000-medium',
    /** > 1 speaks slower: 1.25 is about 25% slower, so young children can follow. */
    lengthScale: 1.25,
    /** Pause between sentences, in seconds. */
    sentenceSilence: 0.5,
  },
} as const;

/**
 * TTS settings shared by the generator (tools/tts) and the content validator (tools/content).
 * Changing provider or any voice setting changes every hash (tools/tts/hash.ts), so all clips are
 * regenerated on the next run. The validator expects clips made with `provider`.
 */
export const TTS_CONFIG = {
  provider: 'piper' as TtsProviderName,
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

/** The `voice` and `rate` parts of the audio hash for a provider. */
export function voiceSettings(provider: TtsProviderName): { voice: string; rate: string } {
  if (provider === 'azure') return { ...TTS_VOICES.azure };
  const { model, lengthScale, sentenceSilence } = TTS_VOICES.piper;
  return { voice: model, rate: `ls=${lengthScale},ss=${sentenceSilence}` };
}

export function audioFileName(hash: string): string {
  return `${hash}.mp3`;
}
