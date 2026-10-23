import { Link } from '../app/Link.tsx';

export function NotFoundPage() {
  return (
    <main className="page">
      <h1 className="page-title">Không tìm thấy trang</h1>
      <p style={{ textAlign: 'center' }}>
        <Link to="/" className="button">
          Về trang chủ
        </Link>
      </p>
    </main>
  );
}
