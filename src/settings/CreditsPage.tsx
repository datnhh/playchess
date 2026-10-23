import { Link } from '../app/Link.tsx';
import { ParentalGate } from './ParentalGate.tsx';
import { SOURCE_URL } from './links.ts';
import './settings.css';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** Parent-only licences and credits. */
export function CreditsPage() {
  return (
    <ParentalGate>
      <main className="page settings">
        <header className="map-header">
          <Link to="/settings" className="icon-button">
            <span aria-hidden="true">⬅</span>
            <span className="visually-hidden">Về cài đặt</span>
          </Link>
          <h1 className="page-title">Giấy phép và ghi công</h1>
        </header>
        <p>
          Trang web này là phần mềm tự do theo giấy phép GPL-3.0-or-later. Mã nguồn:{' '}
          <a href={SOURCE_URL} {...external}>
            {SOURCE_URL}
          </a>
        </p>
        <ul>
          <li>
            Bàn cờ: chessground (GPL-3.0) của{' '}
            <a href="https://lichess.org" {...external}>
              lichess.org
            </a>
            .
          </li>
          <li>
            Máy chơi cờ: Stockfish (GPL-3.0), dùng qua stockfish.js.{' '}
            <a href="/engine/STOCKFISH-COPYING.txt" {...external}>
              Xem giấy phép Stockfish
            </a>
            .
          </li>
          <li>Hình quân cờ: bộ cburnett.</li>
          <li>Phông chữ: Nunito (SIL Open Font License 1.1).</li>
          <li>Giọng đọc: Azure Speech, giọng vi-VN-HoaiMyNeural (âm thanh được tạo tự động).</li>
        </ul>
      </main>
    </ParentalGate>
  );
}
