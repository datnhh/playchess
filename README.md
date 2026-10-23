# Bé học cờ vua

Website tĩnh dạy cờ vua cho trẻ mới bắt đầu, viết bằng tiếng Việt:

- **Lộ trình Mầm (3–5 tuổi):** bàn cờ, 6 quân cờ, trò chơi nhỏ. Có giọng đọc và hoạt cảnh nên trẻ chưa biết chữ vẫn học được.
- **Lộ trình Nhí (6 tuổi trở lên):** luật đặc biệt, chiếu hết, nguyên tắc khai cuộc, tàn cuộc cơ bản.
- **Đấu với máy:** 10 cấp độ, có nút gợi ý nước đi và nút đi lại.

Không tài khoản, không quảng cáo, không theo dõi người dùng. Mọi tài nguyên đều do chính trang phục vụ.

## Chạy trên máy

Cần Node.js 24 (xem `.nvmrc`).

```bash
npm install
npm run dev
```

| Lệnh                                    | Việc                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| `npm run dev`                           | Chạy dev server (không áp CSP)                                                          |
| `npm run build`                         | Typecheck và build vào `dist/`                                                          |
| `npm run preview`                       | Phục vụ `dist/` kèm header bảo mật giống Cloudflare Pages                               |
| `npm run lint` / `npm run format:check` | ESLint / Prettier                                                                       |
| `npm test`                              | Unit test (Vitest)                                                                      |
| `npm run test:e2e`                      | E2E (Playwright, 3 kích thước màn hình). Lần đầu chạy `npx playwright install chromium` |

Trang `/smoke` là trang kiểm tra kỹ thuật: chạy thử Stockfish trong Web Worker dưới CSP thật và hiện bàn cờ. Mở trang này trên điện thoại hoặc tablet sau mỗi lần deploy.

## Triển khai lên Cloudflare Pages

Kết nối repo GitHub trong Cloudflare Pages với cấu hình:

- Build command: `npm run build`
- Build output directory: `dist`
- Phiên bản Node lấy từ `.nvmrc`

Header bảo mật và cache nằm trong `public/_headers`. GitHub Actions (`.github/workflows/ci.yml`) chạy lint, test, build và e2e cho mỗi push và pull request.

## Cấu trúc

| Thư mục                                   | Nội dung                                                            |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `content/lessons/<track>/`                | Bài học dạng JSON (`sprout` = Mầm, `junior` = Nhí)                  |
| `src/content/`                            | Schema bài học (Zod), bảng thuật ngữ cờ tiếng Việt                  |
| `src/chess/`                              | Kiểu dữ liệu và hàm kiểm thế cờ dùng chung                          |
| `src/board/`, `src/audio/`, `src/engine/` | Interface bàn cờ, âm thanh, engine (phần cài đặt làm ở các đợt sau) |
| `src/services/`                           | Lưu tiến độ và cài đặt vào `localStorage`                           |
| `scripts/`                                | Script build (chép Stockfish vào `public/engine/`)                  |
| `e2e/`                                    | Test Playwright                                                     |

## Bài học

Mỗi bài là một chuỗi bước. Mỗi bước gồm một câu lời giảng, một file audio và các hành động trên bàn cờ. Có hai chế độ bàn cờ:

- `sandbox`: chỉ ghi phần vị trí quân của FEN (ví dụ `8/8/8/8/3R4/8/8/8`), dùng cho bài có một quân đứng một mình.
- `standard`: FEN đầy đủ, có đủ hai Vua, được kiểm bằng chess.js.

Chỉ bài có `"reviewed": true` mới được đưa vào bản production.

## Giấy phép

GPL-3.0-or-later (xem `LICENSE`), vì dự án dùng [chessground](https://github.com/lichess-org/chessground) và [Stockfish](https://github.com/official-stockfish/Stockfish) (bản WASM của [stockfish.js](https://github.com/nmrugg/stockfish.js)), cả hai đều theo GPL-3.0. Quân cờ dùng bộ cburnett đi kèm chessground. Font Nunito theo giấy phép SIL OFL 1.1.
