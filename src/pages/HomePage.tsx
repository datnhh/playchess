/**
 * Placeholder home screen. The real learning map (sprout / junior tracks)
 * and the play page arrive in later waves; tiles are disabled until then.
 */
export function HomePage() {
  return (
    <main className="page">
      <h1 className="page-title">Bé học cờ vua</h1>
      <div className="tile-grid">
        <div className="tile tile--sprout" aria-disabled="true">
          <span className="tile-icon" aria-hidden="true">
            🌱
          </span>
          <span>Mầm (3–5 tuổi)</span>
          <span className="tile-note">Sắp có</span>
        </div>
        <div className="tile tile--junior" aria-disabled="true">
          <span className="tile-icon" aria-hidden="true">
            ⭐
          </span>
          <span>Nhí (6 tuổi trở lên)</span>
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
