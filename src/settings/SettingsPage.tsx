import { useEffect, useRef, useState } from 'react';
import audioManifest from 'virtual:audio-manifest';
import { Link } from '../app/Link.tsx';
import { getAudioController } from '../audio/useAudio.ts';
import {
  audioUrls,
  clearAudio,
  downloadAudio,
  offlineStatus,
  type DownloadResult,
} from '../offline/download.ts';
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

      {typeof caches !== 'undefined' && <OfflineSection />}

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

const AUDIO_URLS = audioUrls(audioManifest);

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function resultMessage(result: DownloadResult): string {
  if (result.aborted) return 'Đã dừng tải. Bấm tải lại để tải tiếp.';
  if (result.failed > 0) {
    return `Còn ${String(result.failed)} câu chưa tải được. Hãy thử lại khi có mạng.`;
  }
  return 'Đã tải xong. Bé có thể học khi không có mạng.';
}

/** Cached clip count and storage usage; null when storage is blocked (private mode). */
async function readOfflineInfo() {
  try {
    const status = await offlineStatus(caches, AUDIO_URLS);
    const estimate = await navigator.storage?.estimate?.();
    return { status, usage: estimate?.usage ?? null };
  } catch {
    return null;
  }
}

/** Downloads every lesson clip into the audio cache that the service worker serves offline. */
function OfflineSection() {
  const [status, setStatus] = useState<{ cached: number; total: number } | null>(null);
  const [usage, setUsage] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const controller = useRef<AbortController | null>(null);

  const refresh = () =>
    readOfflineInfo().then((info) => {
      if (!info) return;
      setStatus(info.status);
      setUsage(info.usage);
    });

  useEffect(() => {
    void refresh();
    return () => controller.current?.abort();
  }, []);

  const download = async () => {
    setMessage(null);
    setConfirming(false);
    try {
      await navigator.storage?.persist?.();
    } catch {
      // Persistence is a best-effort request.
    }
    const abort = new AbortController();
    controller.current = abort;
    setProgress({ done: 0, total: AUDIO_URLS.length });
    try {
      const result = await downloadAudio(caches, (url, init) => fetch(url, init), AUDIO_URLS, {
        onProgress: (done, total) => setProgress({ done, total }),
        signal: abort.signal,
      });
      setMessage(resultMessage(result));
    } catch {
      setMessage('Không tải được. Hãy thử lại khi có mạng.');
    } finally {
      controller.current = null;
      setProgress(null);
      void refresh();
    }
  };

  const clear = async () => {
    setConfirming(false);
    try {
      await clearAudio(caches);
      setMessage('Đã xoá dữ liệu đã tải.');
    } catch {
      setMessage('Không xoá được dữ liệu.');
    }
    void refresh();
  };

  return (
    <section className="settings-offline" aria-labelledby="offline-title">
      <h2 id="offline-title" className="settings-heading">
        Học không cần mạng
      </h2>
      {status && (
        <p className="settings-note">
          Đã tải {status.cached}/{status.total} câu đọc
          {usage !== null && ` · Đang dùng khoảng ${formatMegabytes(usage)}`}
        </p>
      )}
      {progress ? (
        <div className="settings-row">
          <progress className="settings-progress" value={progress.done} max={progress.total} />
          <button
            type="button"
            className="button button--secondary"
            onClick={() => controller.current?.abort()}
          >
            Dừng tải
          </button>
        </div>
      ) : confirming ? (
        <div className="settings-row">
          <span>Xoá các câu đọc đã tải? Khi có mạng có thể tải lại.</span>
          <button type="button" className="button button--danger" onClick={() => void clear()}>
            Xoá hẳn
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setConfirming(false)}
          >
            Huỷ
          </button>
        </div>
      ) : (
        <div className="settings-row">
          <button type="button" className="button" onClick={() => void download()}>
            Tải để học không cần mạng
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              setMessage(null);
              setConfirming(true);
            }}
          >
            Xoá dữ liệu đã tải
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
