import { useState, type ComponentType } from 'react';
import type { AudioController } from '../audio/types.ts';
import type { BoardProps } from '../board/types.ts';
import type { AudioManifest } from '../content/audio.ts';
import { lessonSchema } from '../content/schema.ts';
import rookLesson from '../../content/lessons/basic/rook.json';
import { LessonPlayer } from './LessonPlayer.tsx';
import { MockBoard } from './mocks.tsx';
import { createSilentAudioController } from './silentAudio.ts';

const lesson = lessonSchema.parse(rookLesson);
/** No clips generated yet: the player falls back to estimated durations. */
const EMPTY_MANIFEST: AudioManifest = {};

export interface LessonDemoPageProps {
  Board?: ComponentType<BoardProps>;
  audio?: AudioController;
  manifest?: AudioManifest;
}

/** Plays the hand-written rook lesson; real board/audio can be injected once they exist. */
export function LessonDemoPage({ Board = MockBoard, audio, manifest }: LessonDemoPageProps) {
  const [fallbackAudio] = useState(() => createSilentAudioController());
  const [session, setSession] = useState(0);
  return (
    <main className="page">
      <LessonPlayer
        key={session}
        lesson={lesson}
        manifest={manifest ?? EMPTY_MANIFEST}
        audio={audio ?? fallbackAudio}
        Board={Board}
        allowSkip
        onExit={() => setSession((n) => n + 1)}
      />
    </main>
  );
}
