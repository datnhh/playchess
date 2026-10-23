import { Link } from '../app/Link.tsx';
import '../map/map.css';

/** Home screen: three big pictures to learn or play, and a discreet parents' button. */
export function HomePage() {
  return (
    <main className="page">
      <Link to="/settings" className="home-parents">
        <span aria-hidden="true">⚙</span>
        <span className="visually-hidden">Dành cho phụ huynh</span>
      </Link>
      <h1 className="page-title">Bé học cờ vua</h1>
      <div className="tile-grid">
        <Link to="/learn/basic" className="tile tile--basic">
          <span className="tile-icon" aria-hidden="true">
            🌱
          </span>
          <span>Học cơ bản</span>
        </Link>
        <Link to="/learn/advanced" className="tile tile--advanced">
          <span className="tile-icon" aria-hidden="true">
            ⭐
          </span>
          <span>Học nâng cao</span>
        </Link>
        <Link to="/play" className="tile tile--play">
          <span className="tile-icon" aria-hidden="true">
            ♞
          </span>
          <span>Đấu với máy</span>
        </Link>
      </div>
    </main>
  );
}
