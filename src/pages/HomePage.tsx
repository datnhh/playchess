/**
 * Placeholder home screen. The real learning map (basic / advanced tracks)
 * and the play page arrive in later waves; tiles are disabled until then.
 */
export function HomePage() {
  return (
    <main className="page">
      <h1 className="page-title">Bé học cờ vua</h1>
      <div className="tile-grid">
        <div className="tile tile--basic" aria-disabled="true">
          <span className="tile-icon" aria-hidden="true">
            🌱
          </span>
          <span>Học cơ bản</span>
          <span className="tile-note">Sắp có</span>
        </div>
        <div className="tile tile--advanced" aria-disabled="true">
          <span className="tile-icon" aria-hidden="true">
            ⭐
          </span>
          <span>Học nâng cao</span>
          <span className="tile-note">Sắp có</span>
        </div>
        <div className="tile tile--play" aria-disabled="true">
          <span className="tile-icon" aria-hidden="true">
            ♞
          </span>
          <span>Đấu với máy</span>
          <span className="tile-note">Sắp có</span>
        </div>
      </div>
    </main>
  );
}
