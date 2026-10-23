import { createHash } from 'node:crypto';
import { TTS_CONFIG, type TtsProviderName } from './config.ts';
import { applyPronunciation } from './ssml.ts';

/**
 * Contract hash (src/content/audio.ts): first 16 hex chars of
 * sha256(`${provider}|${voice}|${rate}|${spoken text}`), where the spoken text has the glossary
 * pronunciation overrides applied. Switching provider, voice or rate, or changing how a term is
 * pronounced, therefore produces new file names and the clips are regenerated.
 */
export function audioHash(
  text: string,
  provider: TtsProviderName = TTS_CONFIG.provider,
  voice: string = TTS_CONFIG.voice,
  rate: string = TTS_CONFIG.rate,
): string {
  return createHash('sha256')
    .update(`${provider}|${voice}|${rate}|${applyPronunciation(text)}`, 'utf8')
    .digest('hex')
    .slice(0, 16);
}
