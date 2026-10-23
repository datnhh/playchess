# Bé học cờ vua

Website tĩnh dạy cờ vua cho trẻ mới bắt đầu, viết bằng tiếng Việt:

- **Học cơ bản:** đủ luật để chơi một ván: bàn cờ, 6 quân cờ (kèm trò chơi nhỏ), ăn quân, chiếu và thoát chiếu, chiếu hết, hòa pat, nhập thành, phong cấp, bắt tốt qua đường.
- **Học nâng cao:** nguyên tắc khai cuộc, khai cuộc mẫu, tàn cuộc cơ bản.
- **Đấu với máy:** 10 cấp độ, có nút gợi ý nước đi và nút đi lại.

Mọi bài đều có giọng đọc và hoạt cảnh, nên trẻ chưa biết chữ vẫn học được.

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
| `content/lessons/<track>/`                | Bài học dạng JSON (`basic` = Học cơ bản, `advanced` = Học nâng cao) |
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

### Giọng đọc (Piper, chạy offline)

Audio được tạo sẵn trên máy dev rồi commit vào `public/audio/`; CI và Cloudflare Pages không chạy TTS. Hiện chỉ có script cài cho Windows.

```bash
npm run tts:setup
npm run tts -- --only basic-knight
npm run tts -- --prune
```

- `npm run tts:setup` tải Piper (MIT), giọng `vi_VN-vais1000-medium` và ffmpeg vào `.tools/` (không commit, không sửa PATH). Mỗi file được kiểm theo dung lượng, và theo sha256 khi nguồn có công bố.
- `npm run tts` chỉ tạo các câu chưa có file. Tên file là hash của nhà cung cấp, model, tốc độ đọc và câu đọc; đổi một trong các thứ đó thì câu được tạo lại.
- `--only <id,...>` dùng để thử vài bài mà vẫn giữ audio của các bài khác. `--prune` xóa file không còn dùng (không dùng chung với `--only`).
- Từ đọc sai: thêm `say` cho thuật ngữ đó trong `src/content/glossary.ts`.

## Giấy phép

GPL-3.0-or-later (xem `LICENSE`), vì dự án dùng [chessground](https://github.com/lichess-org/chessground) và [Stockfish](https://github.com/official-stockfish/Stockfish) (bản WASM của [stockfish.js](https://github.com/nmrugg/stockfish.js)), cả hai đều theo GPL-3.0. Quân cờ dùng bộ cburnett đi kèm chessground. Font Nunito theo giấy phép SIL OFL 1.1. Giọng đọc tạo bằng [Piper](https://github.com/rhasspy/piper) (MIT) với giọng `vi_VN-vais1000-medium` của [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices), huấn luyện từ bộ dữ liệu VAIS-1000 (IEEE DataPort, doi:10.21227/H2B887), giấy phép CC BY 4.0 theo model card.
