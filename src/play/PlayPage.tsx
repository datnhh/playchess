import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link } from '../app/Link.tsx';
import { getAudioController } from '../audio/useAudio.ts';
import { ChessBoard } from '../board/ChessBoard.tsx';
import { PromotionPicker } from '../board/PromotionPicker.tsx';
import type { BoardShape } from '../board/types.ts';
import { legalDests } from '../chess/dests.ts';
import type { PieceColor, Square } from '../chess/types.ts';
import { audioUrl, commonAudioKey, type CommonClipId } from '../content/audio.ts';
import { getAudioManifest } from '../content/lessons.ts';
import { LEVEL_CHARACTERS } from '../content/levelCharacters.ts';
import { createChessEngine } from '../engine/service.ts';
import type { ChessEngine, EngineLevel } from '../engine/types.ts';
import { loadPlayStats, recordGameResult, type PlayStats } from '../services/storage.ts';
import {
  canUndo,
  checkSquareOf,
  lastMoveOf,
  playReducer,
  startGame,
  type PlayState,
} from './playMachine.ts';
import './play.css';

/** Plays a common clip; resolves at once when the clip has not been generated yet. */
function playClip(clipId: CommonClipId): Promise<unknown> {
  const url = audioUrl(getAudioManifest(), commonAudioKey(clipId));
  return url ? getAudioController().playNarration(url) : Promise.resolve();
}

const END_CLIP = { win: 'play-you-win', draw: 'play-draw', loss: 'play-computer-wins' } as const;
const END_EMOJI = { win: '🏆', draw: '🤝', loss: '🌟' } as const;
const END_LABEL = {
  win: 'Bé thắng rồi!',
  draw: 'Hòa rồi!',
  loss: 'Ván cờ rất hay! Chơi lại nhé!',
} as const;

/** Play against the computer: level picker, then the game screen with an end-of-game overlay. */
export function PlayPage() {
  const [screen, setScreen] = useState<'pick' | 'game'>('pick');
  const [childColor, setChildColor] = useState<PieceColor>('white');
  const [stats, setStats] = useState<PlayStats>(() => loadPlayStats());
  const [state, dispatch] = useReducer(playReducer, undefined, () => startGame(1, 'white'));
  const [gameId, setGameId] = useState(0);
  const engineRef = useRef<ChessEngine | null>(null);
  // The level clip must finish before "your turn" so the two do not cut each other off.
  const introRef = useRef<Promise<unknown>>(Promise.resolve());
  const yourTurnPendingRef = useRef(false);
  const recordedGameRef = useRef(-1);
  const playedPliesRef = useRef(0);
  const gameIdRef = useRef(0);

  useEffect(() => {
    const engine = createChessEngine();
    engineRef.current = engine;
    engine.warmUp();
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const begin = useCallback((level: EngineLevel, color: PieceColor) => {
    playedPliesRef.current = 0;
    yourTurnPendingRef.current = true;
    gameIdRef.current += 1;
    setGameId((id) => id + 1);
    dispatch({ type: 'start', level, childColor: color });
    setScreen('game');
  }, []);

  const handlePickLevel = (level: EngineLevel) => {
    const audio = getAudioController();
    // unlock() must run synchronously inside the tap, before any await (iOS rule).
    void audio.unlock();
    introRef.current = playClip(`level-${level}`);
    begin(level, childColor);
  };

  const handleNewGame = () => {
    introRef.current = Promise.resolve();
    begin(state.level, state.childColor);
  };

  // Computer's move: cancelled by undo, a new game or leaving the page.
  useEffect(() => {
    if (screen !== 'game' || state.status !== 'engineTurn') return;
    const engine = engineRef.current;
    if (!engine) return;
    const controller = new AbortController();
    const requestId = state.engineRequestId;
    engine
      .chooseMove(state.fen, state.level, controller.signal)
      .then((move) => {
        if (!controller.signal.aborted) dispatch({ type: 'engineMove', move, requestId });
      })
      .catch(() => {
        // Aborted or failed: the reducer state stays consistent; nothing to do.
      });
    return () => controller.abort();
  }, [screen, state.status, state.fen, state.level, state.engineRequestId]);

  // Sound for each new move (not for undo).
  useEffect(() => {
    const plies = state.moves.length;
    const previous = playedPliesRef.current;
    playedPliesRef.current = plies;
    if (screen !== 'game' || plies <= previous) return;
    const last = state.moves[plies - 1];
    if (!last) return;
    const audio = getAudioController();
    audio.playSfx(last.check ? 'check' : last.captured ? 'capture' : 'move');
    if (last.check && last.by === 'engine' && !state.result) void playClip('play-check');
  }, [screen, state.moves, state.result]);

  // "Your turn" once, at the first moment it is the child's turn.
  useEffect(() => {
    if (screen !== 'game' || state.status !== 'childTurn' || !yourTurnPendingRef.current) return;
    yourTurnPendingRef.current = false;
    const current = gameIdRef.current;
    void introRef.current.then(() => {
      if (current === gameIdRef.current) void playClip('play-your-turn');
    });
  }, [screen, state.status]);

  // End of game: record once, celebrate, speak the friendly ending.
  useEffect(() => {
    if (screen !== 'game' || !state.result || recordedGameRef.current === gameId) return;
    recordedGameRef.current = gameId;
    setStats(recordGameResult(state.level, state.result.outcome));
    getAudioController().playSfx('win');
    void playClip(END_CLIP[state.result.outcome]);
  }, [screen, state.result, state.level, gameId]);

  // Hint request: dropped when the position changes before it arrives.
  const hintAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => hintAbortRef.current?.abort(), [state.fen]);
  const handleHint = () => {
    const engine = engineRef.current;
    if (!engine || state.status !== 'childTurn') return;
    hintAbortRef.current?.abort();
    const controller = new AbortController();
    hintAbortRef.current = controller;
    const fen = state.fen;
    engine
      .hint(fen, controller.signal)
      .then((hint) => {
        if (controller.signal.aborted) return;
        dispatch({ type: 'showHint', hint, fen });
        void playClip(`hint-${hint.reason}`);
      })
      .catch(() => {});
  };

  if (screen === 'pick') {
    return (
      <LevelPicker
        stats={stats}
        childColor={childColor}
        onToggleColor={() => setChildColor((c) => (c === 'white' ? 'black' : 'white'))}
        onPick={handlePickLevel}
      />
    );
  }

  return (
    <GameScreen
      state={state}
      onMove={(from, to) => dispatch({ type: 'childMove', from, to })}
      onPromote={(role) => dispatch({ type: 'pickPromotion', role })}
      onCancelPromotion={() => dispatch({ type: 'cancelPromotion' })}
      onHint={handleHint}
      onUndo={() => dispatch({ type: 'undo' })}
      onNewGame={handleNewGame}
      onBack={() => setScreen('pick')}
    />
  );
}

interface LevelPickerProps {
  stats: PlayStats;
  childColor: PieceColor;
  onToggleColor: () => void;
  onPick: (level: EngineLevel) => void;
}

function LevelPicker({ stats, childColor, onToggleColor, onPick }: LevelPickerProps) {
  return (
    <main className="page play-page">
      <div className="play-topbar">
        <Link to="/" className="play-icon-button">
          <span aria-hidden="true">🏠</span>
          <span className="play-sr-only">Về trang chủ</span>
        </Link>
        <button
          type="button"
          className="play-color-toggle"
          aria-label={childColor === 'white' ? 'Bé cầm quân trắng' : 'Bé cầm quân đen'}
          aria-pressed={childColor === 'black'}
          onClick={onToggleColor}
        >
          <span className={`play-color-dot play-color-dot--${childColor}`} aria-hidden="true">
            {childColor === 'white' ? '♔' : '♚'}
          </span>
        </button>
      </div>
      <div className="play-level-grid">
        {LEVEL_CHARACTERS.map((character) => {
          const wins = stats.levels[String(character.level)]?.wins ?? 0;
          return (
            <button
              key={character.level}
              type="button"
              className="play-level-card"
              aria-label={`Cấp ${character.level}: ${character.name}${wins ? `, ${wins} cúp` : ''}`}
              onClick={() => onPick(character.level)}
            >
              <span className="play-level-number" aria-hidden="true">
                {character.level}
              </span>
              <span className="play-level-emoji" aria-hidden="true">
                {character.emoji}
              </span>
              <span className="play-level-name" aria-hidden="true">
                {character.name}
              </span>
              {wins > 0 && (
                <span className="play-level-trophies" aria-hidden="true">
                  🏆 {wins}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </main>
  );
}

interface GameScreenProps {
  state: PlayState;
  onMove: (from: Square, to: Square) => void;
  onPromote: (role: 'queen' | 'rook' | 'bishop' | 'knight') => void;
  onCancelPromotion: () => void;
  onHint: () => void;
  onUndo: () => void;
  onNewGame: () => void;
  onBack: () => void;
}

function GameScreen(props: GameScreenProps) {
  const { state, onMove, onPromote, onCancelPromotion, onHint, onUndo, onNewGame, onBack } = props;
  const character = LEVEL_CHARACTERS.find((c) => c.level === state.level);
  const childTurn = state.status === 'childTurn';
  const movable = useMemo(
    () =>
      childTurn ? { color: state.childColor, dests: legalDests(state.fen, 'standard') } : null,
    [childTurn, state.childColor, state.fen],
  );
  const shapes = useMemo<BoardShape[]>(
    () =>
      state.hint
        ? [{ kind: 'arrow', from: state.hint.move.from, to: state.hint.move.to, tone: 'good' }]
        : [],
    [state.hint],
  );
  const lastMove = lastMoveOf(state);
  const checkSquare = checkSquareOf(state.fen);

  return (
    <main className="page play-page play-game">
      <div className="play-topbar">
        <Link to="/" className="play-icon-button">
          <span aria-hidden="true">🏠</span>
          <span className="play-sr-only">Về trang chủ</span>
        </Link>
        <div
          className="play-opponent"
          aria-label={character ? `Cấp ${state.level}: ${character.name}` : undefined}
        >
          <span className="play-opponent-emoji" aria-hidden="true">
            {character?.emoji}
          </span>
          {state.status === 'engineTurn' && (
            <span className="play-thinking" role="status">
              <span className="play-sr-only">đang nghĩ…</span>
              <span className="play-thinking-dot" aria-hidden="true" />
              <span className="play-thinking-dot" aria-hidden="true" />
              <span className="play-thinking-dot" aria-hidden="true" />
            </span>
          )}
        </div>
        <button
          type="button"
          className="play-icon-button"
          aria-label="Chọn cấp khác"
          onClick={onBack}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <div className="play-layout">
        <div className="play-board">
          <ChessBoard
            position={state.fen}
            orientation={state.childColor}
            movable={movable}
            shapes={shapes}
            onMove={onMove}
            {...(lastMove ? { lastMove } : {})}
            {...(checkSquare ? { checkSquare } : {})}
          />
          {state.status === 'awaitingPromotion' && (
            <div className="play-overlay">
              <PromotionPicker
                color={state.childColor}
                onPick={onPromote}
                onCancel={onCancelPromotion}
              />
            </div>
          )}
          {state.result && (
            <div className="play-overlay">
              <div className="play-end" role="dialog" aria-label={END_LABEL[state.result.outcome]}>
                <span className="play-end-emoji" aria-hidden="true">
                  {END_EMOJI[state.result.outcome]}
                </span>
                <div className="play-end-actions">
                  <button
                    type="button"
                    className="play-icon-button play-icon-button--big"
                    aria-label="Chơi lại"
                    onClick={onNewGame}
                  >
                    <span aria-hidden="true">🔄</span>
                  </button>
                  <button
                    type="button"
                    className="play-icon-button play-icon-button--big"
                    aria-label="Chọn cấp khác"
                    onClick={onBack}
                  >
                    <span aria-hidden="true">🐾</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="play-controls">
          <button
            type="button"
            className="play-icon-button play-icon-button--hint"
            aria-label="Gợi ý"
            disabled={!childTurn}
            onClick={onHint}
          >
            <span aria-hidden="true">💡</span>
          </button>
          <button
            type="button"
            className="play-icon-button"
            aria-label="Đi lại"
            disabled={!canUndo(state) || state.result !== null}
            onClick={onUndo}
          >
            <span aria-hidden="true">↩</span>
          </button>
          <button
            type="button"
            className="play-icon-button"
            aria-label="Ván mới"
            onClick={onNewGame}
          >
            <span aria-hidden="true">🔄</span>
          </button>
        </div>
      </div>
    </main>
  );
}
