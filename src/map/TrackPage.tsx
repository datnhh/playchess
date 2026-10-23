import type { Track } from '../content/schema.ts';

export interface TrackPageProps {
  track: Track;
}

/** Placeholder: the learning map of one track (wave 2, branch 10). */
export function TrackPage({ track }: TrackPageProps) {
  return <main className="page">Lộ trình {track}: đang làm.</main>;
}
