import { useMemo, useState } from 'react';
import { useAudioState, getAudioController } from '../audio/useAudio.ts';
import type { SfxName } from '../audio/types.ts';
import { legalDests } from '../chess/dests.ts';
import type { PieceColor, PromotionRole, Square } from '../chess/types.ts';
import { applyMove, createBoardState } from '../content/boardState.ts';
import { ChessBoard } from './ChessBoard.tsx';
import { PromotionPicker } from './PromotionPicker.tsx';
import type { BoardMovable, BoardShape, BoardSticker } from './types.ts';
import './board.css';

/** Developer demo for the board and audio (route wired by the app, not linked from the UI). */

const SAMPLE_SHAPES: readonly BoardShape[] = [
  { kind: 'arrow', from: 'd4', to: 'd7', tone: 'good' },
  { kind: 'arrow', from: 'd4', to: 'a4', tone: 'info' },
  { kind: 'circle', square: 'h4', tone: 'warn' },
];

const SAMPLE_STICKERS: readonly BoardSticker[] = [
  { square: 'd7', kind: 'star' },
  { square: 'a4', kind: 'apple' },
  { square: 'g1', kind: 'flower' },
  { square: 'h8', kind: 'heart' },
];

const SFX_NAMES: readonly SfxName[] = [
  'tap',
  'move',
  'capture',
  'check',
  'success',
  'retry',
  'star',
  'win',
];

export function BoardDemoPage() {
  const [board, setBoard] = useState(() => createBoardState('8/8/8/8/3R4/8/8/8'));
  const [orientation, setOrientation] = useState<PieceColor>('white');
  const [coordinates, setCoordinates] = useState(true);
  const [decorations, setDecorations] = useState(false);
  const [promotion, setPromotion] = useState(false);
  const [lastTap, setLastTap] = useState<Square | null>(null);
  const [picked, setPicked] = useState<PromotionRole | null>(null);
  const audio = getAudioController();
  const audioState = useAudioState(audio);

  const movable = useMemo<BoardMovable>(
    () => ({ color: 'both', dests: legalDests(board.position, 'sandbox') }),
    [board.position],
  );

  const onMove = (from: Square, to: Square) => {
    const result = applyMove(board, { from, to }, 'sandbox');
    if (result.ok) {
      setBoard(result.state);
      audio.playSfx('move');
    } else {
      audio.playSfx('retry');
    }
  };

  return (
    <main className="page board-demo">
      <h1 className="page-title">Thử bàn cờ</h1>

      <ChessBoard
        position={board.position}
        orientation={orientation}
        movable={movable}
        {...(board.lastMove ? { lastMove: board.lastMove } : {})}
        {...(decorations ? { shapes: SAMPLE_SHAPES, stickers: SAMPLE_STICKERS } : {})}
        showCoordinates={coordinates}
        onMove={onMove}
        onSquareTap={setLastTap}
      />
      <p>Ô vừa chạm: {lastTap ?? '—'}</p>

      <div className="board-demo__row">
        <button
          type="button"
          className="button"
          onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
        >
          Xoay bàn cờ
        </button>
        <button type="button" className="button" onClick={() => setCoordinates((c) => !c)}>
          {coordinates ? 'Ẩn toạ độ' : 'Hiện toạ độ'}
        </button>
        <button type="button" className="button" onClick={() => setDecorations((d) => !d)}>
          {decorations ? 'Ẩn mũi tên, hình dán' : 'Hiện mũi tên, hình dán'}
        </button>
        <button type="button" className="button" onClick={() => setPromotion(true)}>
          Chọn quân phong cấp
        </button>
      </div>

      {promotion ? (
        <PromotionPicker
          color={orientation}
          onPick={(role) => {
            setPicked(role);
            setPromotion(false);
          }}
          onCancel={() => setPromotion(false)}
        />
      ) : null}
      {picked ? <p>Đã chọn: {picked}</p> : null}

      <section className="panel">
        <h2>Âm thanh</h2>
        <p>
          Đã bật: {audioState.unlocked ? 'có' : 'chưa'} · Tắt tiếng:{' '}
          {audioState.muted ? 'có' : 'không'}
        </p>
        <div className="board-demo__row">
          <button type="button" className="button" onClick={() => void audio.unlock()}>
            ▶ Bật âm thanh
          </button>
          <button
            type="button"
            className="button"
            onClick={() => audio.setMuted(!audioState.muted)}
          >
            {audioState.muted ? 'Mở tiếng' : 'Tắt tiếng'}
          </button>
        </div>
        <div className="board-demo__row">
          {SFX_NAMES.map((name) => (
            <button key={name} type="button" className="button" onClick={() => audio.playSfx(name)}>
              {name}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
