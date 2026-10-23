import { BANNED_WORDS, GLOSSARY } from '../../src/content/glossary.ts';

/** Text helpers for Vietnamese narration: word counting and whole-word matching. */

/** Letters (with combining marks, for decomposed Vietnamese) and digits. */
const WORD_CHAR = String.raw`[\p{L}\p{M}\p{N}]`;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/** Regex matching `term` as a whole word (or phrase), case-insensitive, Unicode-aware. */
export function wholeWordPattern(term: string, flags = 'giu'): RegExp {
  const body = term
    .normalize('NFC')
    .trim()
    .split(/\s+/)
    .map(escapeRegExp)
    .join(String.raw`\s+`);
  return new RegExp(`(?<!${WORD_CHAR})${body}(?!${WORD_CHAR})`, flags);
}

export function containsWholeWord(text: string, term: string): boolean {
  return wholeWordPattern(term).test(text.normalize('NFC'));
}

/** Number of spoken words (tokens containing a letter or digit). */
export function countWords(text: string): number {
  return text
    .normalize('NFC')
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

export interface ForbiddenTerm {
  term: string;
  reason: string;
}

export const FORBIDDEN_TERMS: readonly ForbiddenTerm[] = [
  ...BANNED_WORDS.map((term) => ({ term, reason: 'từ cấm dùng với trẻ em' })),
  ...GLOSSARY.flatMap((entry) =>
    (entry.avoid ?? []).map((term) => ({ term, reason: `dùng thuật ngữ chuẩn "${entry.term}"` })),
  ),
];

export function findForbiddenTerms(text: string): ForbiddenTerm[] {
  return FORBIDDEN_TERMS.filter(({ term }) => containsWholeWord(text, term));
}
