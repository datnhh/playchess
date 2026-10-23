import type { PieceRole } from '../chess/types.ts';

/**
 * Canonical Vietnamese chess vocabulary. AI-written lessons must use these terms (the content validator
 * flags synonyms listed in `avoid`), so children always hear the same word for the same thing.
 * `say` overrides how TTS pronounces a term when the written form reads badly; none needed yet.
 */
export interface GlossaryEntry {
  term: string;
  meaning: string;
  avoid?: readonly string[];
  say?: string;
}

export const PIECE_NAMES: Readonly<Record<PieceRole, string>> = {
  king: 'Vua',
  queen: 'Hậu',
  rook: 'Xe',
  bishop: 'Tượng',
  knight: 'Mã',
  pawn: 'Tốt',
};

export const GLOSSARY: readonly GlossaryEntry[] = [
  { term: 'Vua', meaning: 'king' },
  { term: 'Hậu', meaning: 'queen', avoid: ['Hoàng hậu', 'Nữ hoàng'] },
  { term: 'Xe', meaning: 'rook', avoid: ['Thành', 'Tháp'] },
  { term: 'Tượng', meaning: 'bishop', avoid: ['Giám mục'] },
  { term: 'Mã', meaning: 'knight', avoid: ['Ngựa', 'Hiệp sĩ'] },
  { term: 'Tốt', meaning: 'pawn', avoid: ['Chốt', 'Lính'] },
  { term: 'bàn cờ', meaning: 'chessboard' },
  { term: 'ô', meaning: 'square' },
  { term: 'hàng ngang', meaning: 'rank' },
  { term: 'cột dọc', meaning: 'file' },
  { term: 'đường chéo', meaning: 'diagonal' },
  { term: 'quân trắng', meaning: 'white pieces' },
  { term: 'quân đen', meaning: 'black pieces' },
  { term: 'ăn quân', meaning: 'capture' },
  { term: 'chiếu', meaning: 'check', avoid: ['chiếu tướng'] },
  { term: 'chiếu hết', meaning: 'checkmate', avoid: ['chiếu bí'] },
  { term: 'hòa pat', meaning: 'stalemate', avoid: ['hết nước đi'] },
  { term: 'nhập thành', meaning: 'castling' },
  { term: 'phong cấp', meaning: 'promotion', avoid: ['phong hậu'] },
  { term: 'bắt tốt qua đường', meaning: 'en passant' },
  { term: 'khai cuộc', meaning: 'opening' },
  { term: 'tàn cuộc', meaning: 'endgame', avoid: ['tàng cuộc'] },
];

/** Words that must not appear in child-facing narration. Matched case-insensitively as whole words. */
export const BANNED_WORDS: readonly string[] = ['giết', 'chết', 'máu', 'đánh nhau', 'ngu', 'dốt'];
