import type { EngineLevel } from '../engine/types.ts';

/**
 * Each computer level is presented as an animal, weakest to strongest, so children who cannot read
 * pick an opponent by picture. The spoken clip `level-<n>` (src/content/audio.ts) uses `name`.
 */
export interface LevelCharacter {
  level: EngineLevel;
  name: string;
  emoji: string;
}

export const LEVEL_CHARACTERS: readonly LevelCharacter[] = [
  { level: 1, name: 'Gà con', emoji: '🐣' },
  { level: 2, name: 'Thỏ trắng', emoji: '🐰' },
  { level: 3, name: 'Mèo mướp', emoji: '🐱' },
  { level: 4, name: 'Cún con', emoji: '🐶' },
  { level: 5, name: 'Cáo nhỏ', emoji: '🦊' },
  { level: 6, name: 'Gấu trúc', emoji: '🐼' },
  { level: 7, name: 'Sói xám', emoji: '🐺' },
  { level: 8, name: 'Gấu nâu', emoji: '🐻' },
  { level: 9, name: 'Hổ vằn', emoji: '🐯' },
  { level: 10, name: 'Rồng', emoji: '🐲' },
];
