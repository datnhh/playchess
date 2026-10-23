# Kế hoạch thực thi

Kế hoạch đã được duyệt ngày 2026-10-23, sau khi tranh luận chéo với agy (Gemini) và đạt đồng thuận. Biên bản tranh luận nằm ở `docs/decisions/debates/` (không commit). File này dùng để đối chiếu và theo dõi tiến độ: làm xong bước nào thì cập nhật cột **Trạng thái**.

**Quy ước làm việc**

- Xong mỗi đợt thì dừng lại báo cáo, chờ duyệt rồi mới sang đợt sau.
- Subagent chạy với model **opus**, effort **low**.
- Các nhánh song song chỉ dựa vào interface đã chốt ở bước 3 và mỗi nhánh làm trong thư mục riêng.

Trạng thái: ⬜ chưa làm · 🟡 đang làm · ✅ xong · ⏸ chờ người dùng

## Lộ trình học

Từ 2026-10-23 không chia theo tuổi (Mầm/Nhí) nữa mà chia theo trình độ. Mọi bài vẫn có giọng đọc và hoạt cảnh, nên trẻ chưa biết chữ vẫn học được.

| Lộ trình         | Mã trong code | Mục tiêu                       | Nội dung                                                                                                                                                  |
| ---------------- | ------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Học cơ bản**   | `basic`       | Biết đủ luật để chơi một ván   | Làm quen bàn cờ; 6 quân và cách đi (kèm trò chơi nhỏ); ăn quân; chiếu và 3 cách thoát chiếu; chiếu hết; hòa pat; nhập thành; phong cấp; bắt tốt qua đường |
| **Học nâng cao** | `advanced`    | Chơi hay hơn sau khi biết luật | 3 nguyên tắc khai cuộc + khai cuộc mẫu; tàn cuộc cơ bản (Đôi Xe, Vua + Hậu, Vua + Xe, Vua + Tốt)                                                          |

Giới hạn độ dài câu đọc: cơ bản ≤ 15 từ, nâng cao ≤ 25 từ (giả định, chỉnh được trong validator).

## Kiến trúc đã chốt

| Hạng mục      | Quyết định                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nền tảng      | Vite + React + TypeScript strict SPA, Cloudflare Pages free (https://chess-dat.pages.dev/), GPL-3.0-or-later                                                                                                                                                                                                                                    |
| An toàn       | Tự host 100% tài nguyên; CSP chặt trong `public/_headers`; không tài khoản/cookie/analytics; cổng phụ huynh trước link ngoài, cài đặt, xóa tiến độ, tải offline                                                                                                                                                                                 |
| Bàn cờ        | chessground (chạm-chạm + kéo thả, `autoShapes`, overlay sticker), luật chess.js                                                                                                                                                                                                                                                                 |
| Bài học       | JSON theo schema Zod; bước nguyên tử (1 câu + 1 clip + 1 hành động); `boardMode` sandbox/standard; assertions máy kiểm; cờ `reviewed`                                                                                                                                                                                                           |
| Kiểm nội dung | Validator kép trong CI: standard → chess.js, sandbox → hình học + BFS; giới hạn số từ theo lộ trình; thuật ngữ; audio đúng hash. Bài chưa duyệt và `/review` bị loại khi build production                                                                                                                                                       |
| TTS           | Piper offline, giọng `vi_VN-vais1000-medium` (CC BY 4.0 theo model card), `length_scale` 1.1, nghỉ câu 0,25 giây; -16 LUFS; sinh trên máy dev bằng công cụ trong `.tools/` (`npm run tts:setup`), tên file theo hash (nhà cung cấp + model + tốc độ + câu đọc). Code Azure giữ lại, không dùng (đổi 2026-10-23 vì không có subscription Azure). |
| Engine        | Cấp 1–4 bot TypeScript; cấp 5–10 Stockfish lite một luồng trong Worker; timeout = movetime + 2s, gửi `stop` trước khi terminate, hạ về bot cấp 4; script tự đấu hiệu chỉnh                                                                                                                                                                      |
| Gợi ý         | Dùng engine đang sẵn có (fallback bot nội bộ), mũi tên + mã lý do có audio                                                                                                                                                                                                                                                                      |
| Offline       | PWA: precache khung app + JSON đã duyệt + SFX; audio cache theo bài; nút tải offline sau cổng phụ huynh                                                                                                                                                                                                                                         |

## Các bước

### Đợt 0: Nền móng (tuần tự)

| #   | Bước                                                                                                              | Trạng thái | Ghi chú                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Khởi tạo repo: Vite/React/TS strict, ESLint, Prettier, Vitest, Playwright, LICENSE, font và bộ quân cờ tự host    | ✅         |                                                                                                                |
| 2   | CI + deploy khung lên Cloudflare Pages + `_headers`; smoke test Worker + Stockfish dưới CSP trên iOS/Android thật | ⏸          | Đã deploy; header, SPA fallback, `/smoke` chạy đúng trên Chrome desktop. Còn chờ thử `/smoke` trên iOS/Android |
| 3   | Hợp đồng: schema bài học, bảng thuật ngữ, `storageService`, interface Board/Audio/Engine, 1 bài mẫu viết tay      | ✅         |                                                                                                                |

### Đợt 1: Bốn nhánh lõi (song song)

| #   | Bước                                                                                                    | Thư mục                        | Phụ thuộc | Trạng thái |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------ | --------- | ---------- |
| 4   | A1: bàn cờ chessground + `AudioController`                                                              | `src/board/`, `src/audio/`     | Bước 3    | ✅         |
| 5   | A2: `LessonPlayer` (state machine), dùng bản giả lập Board/Audio                                        | `src/lesson/`                  | Bước 3    | ✅         |
| 6   | B: validator nội dung, pipeline TTS, trang `/review` chỉ ở dev, lọc khi build                           | `tools/content/`, `tools/tts/` | Bước 3    | ✅         |
| 7   | C: engine 10 cấp, gợi ý có mã lý do, script tự đấu                                                      | `src/engine/`, `tools/engine/` | Bước 3    | ✅         |
| 7b  | Đổi lộ trình Mầm/Nhí → Cơ bản/Nâng cao trong code (schema, thư mục bài, validator, trang chủ, tài liệu) | nhiều file                     | 4–7       | ✅         |

### Đợt 2: Lắp ghép + nội dung cơ bản (song song)

| #   | Bước                                                                                                                     | Phụ thuộc | Trạng thái |
| --- | ------------------------------------------------------------------------------------------------------------------------ | --------- | ---------- |
| 8   | Trang đấu máy: chọn cấp bằng nhân vật có giọng đọc, gợi ý, đi lại, phong cấp bằng hình                                   | 4, 7      | ✅         |
| 9   | Nội dung **Học cơ bản**: thí điểm 1–2 bài → chỉnh prompt → AI soạn đủ bộ → validate → TTS → người dùng duyệt ở `/review` | 5, 6, 7b  | ✅         |
| 10  | Bản đồ lộ trình Cơ bản / Nâng cao, sao thưởng, cổng phụ huynh, trang ghi công                                            | 3, 4, 7b  | ✅         |

### Đợt 3: Nội dung nâng cao (tuần tự sau bước 9)

| #   | Bước                                                                                                  | Trạng thái |
| --- | ----------------------------------------------------------------------------------------------------- | ---------- |
| 11  | **Học nâng cao**: 3 nguyên tắc khai cuộc + khai cuộc mẫu; tàn cuộc (Đôi Xe, Vua+Hậu, Vua+Xe, Vua+Tốt) | ⬜         |

### Đợt 4: Hoàn thiện (tuần tự)

| #   | Bước                                                                                                                            | Trạng thái |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 12  | PWA offline                                                                                                                     | ⬜         |
| 13  | Kiểm thử: Vitest, Playwright 3 viewport, thử tay iOS Safari + Android Chrome, Lighthouse, số file/dung lượng `dist/`; phát hành | ⬜         |

## Việc người dùng cần làm

| Việc                                                                        | Cần cho    | Trạng thái |
| --------------------------------------------------------------------------- | ---------- | ---------- |
| Nối repo GitHub với Cloudflare Pages (build `npm run build`, output `dist`) | Bước 2     | ✅         |
| Mở `/smoke` trên iPhone/iPad và Android sau khi deploy, báo kết quả         | Bước 2     | ⬜         |
| Duyệt các bước đổi lộ trình (7b)                                            | Bước 7b    | ✅         |
| ~~Tạo Azure Speech F0~~: bỏ, chuyển sang Piper offline                      | Bước 6, 9  | ✅         |
| Nghe duyệt bài học ở `/review`                                              | Bước 9, 11 | ⬜         |

## Giả định chưa kiểm chứng

| Giả định                                                                                                          | Kiểm ở                 |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Cloudflare Pages free: 20.000 file, 25 MiB/file (SPA fallback đã xác nhận đúng trên chess-dat.pages.dev)          | Khi số file audio tăng |
| Azure F0 có khoảng 0,5 triệu ký tự neural/tháng, giọng vi-VN, điều khoản cho phép dùng audio trong dự án miễn phí | Bước 6                 |
| Stockfish Skill Level thấp vẫn quá mạnh với trẻ mới học                                                           | Bước 7 (script tự đấu) |
| Giới hạn câu: cơ bản ≤ 15 từ, nâng cao ≤ 25 từ là hợp lý                                                          | Bước 9, 11             |

## Nhật ký

| Ngày       | Nội dung                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-23 | Duyệt kế hoạch. Làm Đợt 0.                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-23 | Đợt 0 xong: lint, typecheck, 21 unit test, build, 12 e2e đều qua. Commit `196a99f`. Đã deploy lên chess-dat.pages.dev.                                                                                                                                                                                                                                                                                                                 |
| 2026-10-23 | Bắt đầu Đợt 1: thêm module dùng chung (`59635d6`), giao 4 nhánh song song.                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-23 | Đổi yêu cầu: bỏ chia Mầm/Nhí theo tuổi, thay bằng **Học cơ bản** / **Học nâng cao** theo trình độ. Cập nhật lộ trình, bước 9–11; thêm bước 7b sửa code, chờ duyệt.                                                                                                                                                                                                                                                                     |
| 2026-10-23 | Đợt 1 xong (chưa commit): 4 nhánh + ghép nối (route `/dev/*`, quân trượt về khi đi sai, mở khóa âm thanh bằng `/media/silence.wav`, hash audio gồm nhà cung cấp + cách đọc, `setPosition` sau bước tương tác là lỗi cứng). Lint, typecheck, 109 unit test, validate (0 lỗi), build, 21 e2e đều qua. Chạy tay trong trình duyệt: bài Xe từ đầu đến cuối, Stockfish cấp 10 + gợi ý.                                                      |
| 2026-10-23 | Commit Đợt 1 (`667af14`). Làm 7b: track `basic` / `advanced`, bài mẫu chuyển sang `content/lessons/basic/rook.json` (id `basic-rook`), trang chủ hiện "Học cơ bản" / "Học nâng cao". 109 unit test, validate, 21 e2e qua.                                                                                                                                                                                                              |
| 2026-10-23 | Push Đợt 1 + 7b, kiểm tra /dev trên Pages. Commit hợp đồng Đợt 2 (`5b451c1`: route, icon bài, nhân vật 10 cấp, thống kê ván).                                                                                                                                                                                                                                                                                                          |
| 2026-10-23 | Đợt 2 ghép xong : trang đấu máy (8), bản đồ + sao + cổng phụ huynh + ghi công (10), 2 bài thí điểm Làm quen bàn cờ, Quân Mã (9a). Người dùng duyệt giọng văn và nhịp bài thí điểm.                                                                                                                                                                                                                                                     |
| 2026-10-23 | Sửa trình phát bài theo chạy thử: ▶ chỉ bỏ qua bước xem (bước tương tác phải làm; chống bấm trễ nhảy bước), nhận chạm ngay khi đang đọc lời và khi đang nghe câu thử lại, ô sáng tô kín cả ô, hình dán trên quân thu nhỏ vào góc, phụ đề chữ ẩn/hiện (nút Aa) cho người lớn.                                                                                                                                                           |
| 2026-10-23 | 9b: soạn đủ 16 bài cơ bản (thêm Tượng, Hậu, Vua, Tốt, Ăn quân, Xếp quân, Chiếu, Chiếu hết, Hòa pat, Nhập thành, Phong cấp, Bắt tốt qua đường, Thắng thua hòa), tất cả `reviewed: false`. Lint, typecheck, 144 unit test, validate 0 lỗi, build, 36 e2e qua. Commit `f5eaa51`, đã deploy.                                                                                                                                               |
| 2026-10-23 | Không tạo được Azure (tài khoản không có subscription). Tranh luận chéo với agy, đồng thuận chuyển sang Piper offline (biên bản trong `docs/decisions/debates/`, không commit).                                                                                                                                                                                                                                                        |
| 2026-10-23 | Người dùng duyệt nội dung 16 bài ở `/review`, bật `reviewed: true`. Pipeline Piper: cấu hình theo nhà cung cấp, hash gồm model + `ls`/`ss`, `npm run tts:setup` tải Piper/giọng/ffmpeg vào `.tools/` (kiểm dung lượng + sha256), cờ `--only`. Thử 6 bài, người dùng nghe duyệt; sinh đủ 250 câu (245 file, 4,2 MB). Lint, typecheck, 174 unit test, validate 0 lỗi 0 cảnh báo, build, 39 e2e qua. Chờ người dùng nghe lướt rồi commit. |
