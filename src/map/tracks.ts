import type { Track } from '../content/schema.ts';

export const TRACK_TITLES: Record<Track, string> = {
  basic: 'Học cơ bản',
  advanced: 'Học nâng cao',
};

export const TRACK_COLORS: Record<Track, string> = {
  basic: 'var(--color-basic)',
  advanced: 'var(--color-advanced)',
};
