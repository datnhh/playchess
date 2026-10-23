import { GLOSSARY, type GlossaryEntry } from '../../src/content/glossary.ts';
import { wholeWordPattern } from '../content/text.ts';
import { TTS_CONFIG } from './config.ts';

/** SSML for Azure and plain text for Piper, both with glossary pronunciation overrides (`say`). */

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

type Override = Required<Pick<GlossaryEntry, 'term' | 'say'>>;

function overridesOf(glossary: readonly GlossaryEntry[]): Override[] {
  return (
    glossary
      .filter((entry): entry is GlossaryEntry & { say: string } => entry.say !== undefined)
      .map(({ term, say }) => ({ term, say }))
      // Longer terms first so "chiếu hết" wins over "chiếu".
      .sort((a, b) => b.term.length - a.term.length)
  );
}

/** Splits text into plain and overridden segments. */
function segments(text: string, overrides: readonly Override[]) {
  let parts: ({ text: string } | { text: string; say: string })[] = [
    { text: text.normalize('NFC') },
  ];
  for (const override of overrides) {
    parts = parts.flatMap((part) => {
      if ('say' in part) return [part];
      const result: typeof parts = [];
      let last = 0;
      for (const match of part.text.matchAll(wholeWordPattern(override.term))) {
        const index = match.index;
        if (index > last) result.push({ text: part.text.slice(last, index) });
        result.push({ text: match[0], say: override.say });
        last = index + match[0].length;
      }
      if (last < part.text.length) result.push({ text: part.text.slice(last) });
      return result;
    });
  }
  return parts;
}

export function buildSsml(
  text: string,
  glossary: readonly GlossaryEntry[] = GLOSSARY,
  voice: string = TTS_CONFIG.voice,
  rate: string = TTS_CONFIG.rate,
): string {
  const body = segments(text, overridesOf(glossary))
    .map((part) =>
      'say' in part
        ? `<sub alias="${escapeXml(part.say)}">${escapeXml(part.text)}</sub>`
        : escapeXml(part.text),
    )
    .join('');
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${TTS_CONFIG.language}">` +
    `<voice name="${escapeXml(voice)}"><prosody rate="${escapeXml(rate)}">${body}</prosody></voice></speak>`
  );
}

/** Plain text with overrides applied, for engines without SSML (Piper). */
export function applyPronunciation(
  text: string,
  glossary: readonly GlossaryEntry[] = GLOSSARY,
): string {
  return segments(text, overridesOf(glossary))
    .map((part) => ('say' in part ? part.say : part.text))
    .join('');
}
