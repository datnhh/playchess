import { getAudioController } from '../audio/useAudio.ts';
import { ChessBoard } from '../board/ChessBoard.tsx';
import { getAudioManifest } from '../content/lessons.ts';
import { LessonDemoPage } from '../lesson/LessonDemoPage.tsx';

/** Sample lesson played with the real chessground board and audio controller. */
export function DevLessonPage() {
  return (
    <LessonDemoPage Board={ChessBoard} audio={getAudioController()} manifest={getAudioManifest()} />
  );
}
