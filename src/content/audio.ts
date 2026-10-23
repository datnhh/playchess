import type { EngineLevel } from '../engine/types.ts';
import { LEVEL_CHARACTERS } from './levelCharacters.ts';

/**
 * Audio file contract between the TTS pipeline (tools/tts, writes) and the app (reads).
 *
 * - Every spoken text has a key: `<lessonId>/<stepId>/<field>` for lesson narration,
 *   `common/<clipId>` for clips shared across lessons and the play page.
 * - The pipeline writes MP3 files to public/audio/<hash>.mp3, where
 *   hash = first 16 hex chars of sha256(`${provider}|${voice}|${rate}|${spoken text}`) (spoken text =
 *   text with glossary pronunciation overrides; see tools/tts/hash.ts), and records them in
 *   content/audio/manifest.json. CI fails when an entry is missing or its hash no longer
 *   matches the current text (stale audio).
 * - The app only looks keys up in the manifest; it never hashes text itself.
 */

export type NarrationField = 'say' | 'praise' | 'retry';

export interface AudioManifestEntry {
  /** File name inside public/audio/, e.g. "3f2a9c0d1e4b5a67.mp3". */
  file: string;
  hash: string;
  /** The text that was synthesised, kept for review and stale checks. */
  text: string;
}

export type AudioManifest = Readonly<Record<string, AudioManifestEntry>>;

export const AUDIO_BASE_URL = '/audio/';

export function lessonAudioKey(lessonId: string, stepId: string, field: NarrationField): string {
  return `${lessonId}/${stepId}/${field}`;
}

type LevelClipId = `level-${EngineLevel}`;

/** "Cấp 3: Mèo mướp", read when a child taps a level card on the play page. */
const LEVEL_CLIPS = Object.fromEntries(
  LEVEL_CHARACTERS.map((character) => [
    `level-${character.level}`,
    `Cấp ${character.level}: ${character.name}.`,
  ]),
) as Record<LevelClipId, string>;

/** Short clips used everywhere. Text lives here so the pipeline and the app share one source. */
export const COMMON_CLIPS = {
  ...LEVEL_CLIPS,
  'play-your-turn': 'Đến lượt bé đi.',
  'play-you-win': 'Bé thắng rồi! Giỏi quá!',
  'play-draw': 'Hòa rồi! Ván cờ rất hay.',
  'play-computer-wins': 'Máy thắng ván này. Mình chơi lại nhé!',
  'play-check': 'Vua đang bị chiếu!',
  'praise-1': 'Giỏi quá!',
  'praise-2': 'Bé làm đúng rồi!',
  'praise-3': 'Tuyệt vời!',
  'retry-1': 'Chưa đúng rồi, bé thử lại nhé.',
  'retry-2': 'Gần đúng rồi, thử lại nào!',
  'tap-to-start': 'Bé chạm vào nút to để bắt đầu nhé.',
  'lesson-complete': 'Bé đã học xong bài này. Giỏi lắm!',
  'hint-escapeCheck': 'Vua đang bị chiếu. Bé hãy cứu Vua nhé!',
  'hint-deliverCheckmate': 'Có nước chiếu hết đấy! Bé thử tìm xem.',
  'hint-captureFreePiece': 'Có một quân không ai bảo vệ. Bé ăn nó đi!',
  'hint-developPiece': 'Bé hãy đưa thêm quân ra giữa bàn cờ nhé.',
  'hint-bestMove': 'Đây là một nước đi tốt. Bé thử xem!',
} as const;

export type CommonClipId = keyof typeof COMMON_CLIPS;

export function commonAudioKey(clipId: CommonClipId): string {
  return `common/${clipId}`;
}

/** URL of the clip for `key`, or null when it has not been generated yet (play visuals only). */
export function audioUrl(manifest: AudioManifest, key: string): string | null {
  const entry = manifest[key];
  return entry ? AUDIO_BASE_URL + entry.file : null;
}
