import { useState } from 'react';
import { Link } from '../app/Link.tsx';
import { getAudioController } from '../audio/useAudio.ts';
import { clearPlayStats, clearProgress, loadSettings, saveSettings } from '../services/storage.ts';
import { ParentalGate } from './ParentalGate.tsx';
import { SOURCE_URL } from './links.ts';
import './settings.css';

/** Parent-only settings: sound, reset progress, credits and source code. */
export function SettingsPage() {
  return (
    <ParentalGate>
      <SettingsContent />
    </ParentalGate>
  );
}

function SettingsContent() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState(false);

  const toggleMute = () => {
    const next = { ...settings, muted: !settings.muted };
    setSettings(next);
    saveSettings(next);
    getAudioController().setMuted(next.muted);
  };

  const clearAll = () => {
    clearProgress();
    clearPlayStats();
    setConfirming(false);
    setCleared(true);
  };

  return (
    <main className="page settings">
      <header className="map-header">
        <Link to="/" className="icon-button">
          <span aria-hidden="true">🏠</span>
          <span className="visually-hidden">Về trang chủ</span>
        </Link>
        <h1 className="page-title">Cài đặt</h1>
      </header>

      <section className="settings-row">
        <button type="button" className="button" aria-pressed={settings.muted} onClick={toggleMute}>
          {settings.muted ? '🔇 Đang tắt tiếng: bấm để bật' : '🔊 Đang bật tiếng: bấm để tắt'}
        </button>
      </section>

      <section className="settings-row">
        {confirming ? (
          <>
            <span>Xoá toàn bộ sao bài học và kết quả đấu với máy? Không thể hoàn tác.</span>
            <button type="button" className="button button--danger" onClick={clearAll}>
              Xoá hẳn
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setConfirming(false)}
            >
              Huỷ
            </button>
          </>
        ) : (
          <button
            type="button"
            className="button button--danger"
            onClick={() => {
              setCleared(false);
              setConfirming(true);
            }}
          >
            Xoá tiến độ học
          </button>
        )}
        {cleared && <span role="status">Đã xoá tiến độ.</span>}
      </section>

      <section className="settings-row">
        <Link to="/credits" className="button button--secondary">
          Giấy phép và ghi công
        </Link>
        <a
          className="button button--secondary"
          href={SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Mã nguồn
        </a>
      </section>
    </main>
  );
}
