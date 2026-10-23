import { Link } from '../app/Link.tsx';

/** Unlinked index of technical demo pages, used to test components on real phones and tablets. */
export function DevIndexPage() {
  return (
    <main className="page">
      <h1 className="page-title">Trang thử nghiệm</h1>
      <div className="tile-grid">
        <Link to="/dev/board" className="tile tile--play">
          Bàn cờ và âm thanh
        </Link>
        <Link to="/dev/lesson" className="tile tile--basic">
          Bài học mẫu (quân Xe)
        </Link>
        <Link to="/dev/engine" className="tile tile--advanced">
          Máy đánh cờ 10 cấp
        </Link>
        <Link to="/smoke" className="tile tile--play">
          Kiểm tra kỹ thuật
        </Link>
        {import.meta.env.DEV ? (
          <Link to="/review" className="tile tile--basic">
            Duyệt bài học (chỉ bản dev)
          </Link>
        ) : null}
      </div>
    </main>
  );
}
