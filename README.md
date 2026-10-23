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

## Chạy offline (PWA)

Bản production có service worker (`src/sw/sw.ts`, build thành `dist/sw.js` bởi `tools/vite/serviceWorkerPlugin.ts`):

- Khi cài, worker tải sẵn toàn bộ file của bản build (trang, code, engine) và các câu audio dùng chung. Tải lỗi một file thì không cache gì, trang vẫn chạy online như khi không có worker.
- Audio bài học không tải sẵn: câu nào đã nghe thì được lưu lại (cache-first, hỗ trợ Range). Muốn tải hết, phụ huynh dùng nút "Tải để học không cần mạng" trong Cài đặt.
- Điều hướng trang: lấy từ mạng trước, mất mạng hoặc chậm quá 3 giây thì dùng bản đã cache.
- Version của worker là hash nội dung các file cache sẵn: build lại mà file không đổi thì người dùng không phải tải lại gì.

**Bản mới được áp dụng khi nào:** worker mới chờ đến khi mọi tab/app của bản cũ đóng hết, mở lại thì dùng bản mới. Không ép tải lại vì bài học đang mở có thể còn cần các file code của bản cũ; tải lại giữa chừng sẽ làm bé mất bài.

Dev server (`npm run dev`) không đăng ký service worker (`src/offline/register.ts`). Kiểm tra trên máy:

```bash
npm run build && npx vite preview
```

Mở DevTools → Application → Service Workers (xem trạng thái, bản đang chờ) và Cache Storage (các cache tiền tố `playchess-`), rồi bật Offline và tải lại trang.

### Công tắc khẩn cấp (kill switch)

Nếu một bản service worker lỗi làm người dùng kẹt, deploy một `sw.js` tự gỡ:

```ts
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith('playchess-')).map((name) => caches.delete(name)),
      );
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      await Promise.all(clients.map((client) => client.navigate(client.url)));
    })(),
  );
});
```

1. Tạm thay nội dung `src/sw/sw.ts` bằng đoạn trên (plugin vẫn build ra `dist/sw.js`), hoặc tắt plugin và đặt bản JS của đoạn này vào `public/sw.js`.
2. Deploy. Vì `/sw.js` có `Cache-Control: no-cache`, trình duyệt sẽ nhận bản tự gỡ ở lần kiểm tra cập nhật kế tiếp.
3. Sau khi người dùng đã nhận (vài ngày đến vài tuần), khôi phục `src/sw/sw.ts` và deploy lại.

Cần thử tay trên iOS Safari và Android Chrome (cả khi Thêm vào màn hình chính); phần này chưa được kiểm tự động trên thiết bị thật.

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
