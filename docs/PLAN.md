# Kế hoạch thực thi

Kế hoạch đã được duyệt ngày 2026-10-23, sau khi tranh luận chéo với agy (Gemini) và đạt đồng thuận. Biên bản tranh luận nằm ở `docs/decisions/debates/` (không commit). File này dùng để đối chiếu và theo dõi tiến độ: làm xong bước nào thì cập nhật cột **Trạng thái**.

**Quy ước làm việc**

- Xong mỗi đợt thì dừng lại báo cáo, chờ duyệt rồi mới sang đợt sau.
- Subagent chạy với model **opus**, effort **low**.
- Các nhánh song song chỉ dựa vào interface đã chốt ở bước 3 và mỗi nhánh làm trong thư mục riêng.

Trạng thái: ⬜ chưa làm · 🟡 đang làm · ✅ xong · ⏸ chờ người dùng

## Kiến trúc đã chốt

| Hạng mục      | Quyết định                                                                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nền tảng      | Vite + React + TypeScript strict SPA, Cloudflare Pages free, GPL-3.0-or-later                                                                                                |
| An toàn       | Tự host 100% tài nguyên; CSP chặt trong `public/_headers`; không tài khoản/cookie/analytics; cổng phụ huynh trước link ngoài, cài đặt, xóa tiến độ, tải offline              |
| Bàn cờ        | chessground (chạm-chạm + kéo thả, `autoShapes`, overlay sticker), luật chess.js                                                                                              |
| Bài học       | JSON theo schema Zod; bước nguyên tử (1 câu + 1 clip + 1 hành động); `boardMode` sandbox/standard; assertions máy kiểm; cờ `reviewed`                                        |
| Kiểm nội dung | Validator kép trong CI: standard → chess.js, sandbox → hình học + BFS; câu Mầm ≤ 15 từ; thuật ngữ; audio đúng hash. Bài chưa duyệt và `/review` bị loại khi build production |
| TTS           | Azure Speech F0 (`vi-VN-HoaiMyNeural`) mặc định, Piper offline dự phòng; SSML chậm ~10%; -16 LUFS; sinh trên máy dev, tên file theo hash, commit MP3                         |
| Engine        | Cấp 1–4 bot TypeScript; cấp 5–10 Stockfish lite một luồng trong Worker; timeout = movetime + 2s, gửi `stop` trước khi terminate, hạ về bot cấp 4; script tự đấu hiệu chỉnh   |
| Gợi ý         | Dùng engine đang sẵn có (fallback bot nội bộ), mũi tên + mã lý do có audio                                                                                                   |
| Offline       | PWA: precache khung app + JSON đã duyệt + SFX; audio cache theo bài; nút tải offline sau cổng phụ huynh                                                                      |

## Các bước

### Đợt 0: Nền móng (tuần tự)

| #   | Bước                                                                                                              | Trạng thái | Ghi chú                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | Khởi tạo repo: Vite/React/TS strict, ESLint, Prettier, Vitest, Playwright, LICENSE, font và bộ quân cờ tự host    | ✅         |                                                                                                              |
| 2   | CI + deploy khung lên Cloudflare Pages + `_headers`; smoke test Worker + Stockfish dưới CSP trên iOS/Android thật | ⏸          | Đã có CI, `_headers`, trang `/smoke`, e2e. Chờ người dùng nối Cloudflare Pages và thử `/smoke` trên máy thật |
| 3   | Hợp đồng: schema bài học, bảng thuật ngữ, `storageService`, interface Board/Audio/Engine, 1 bài mẫu viết tay      | ✅         |                                                                                                              |

### Đợt 1: Bốn nhánh lõi (song song)

| #   | Bước                                                                          | Thư mục                        | Phụ thuộc | Trạng thái |
| --- | ----------------------------------------------------------------------------- | ------------------------------ | --------- | ---------- |
| 4   | A1: bàn cờ chessground + `AudioController`                                    | `src/board/`, `src/audio/`     | Bước 3    | ⬜         |
| 5   | A2: `LessonPlayer` (state machine), dùng bản giả lập Board/Audio              | `src/lesson/`                  | Bước 3    | ⬜         |
| 6   | B: validator nội dung, pipeline TTS, trang `/review` chỉ ở dev, lọc khi build | `tools/content/`, `tools/tts/` | Bước 3    | ⬜         |
| 7   | C: engine 10 cấp, gợi ý có mã lý do, script tự đấu                            | `src/engine/`, `tools/engine/` | Bước 3    | ⬜         |

### Đợt 2: Lắp ghép + nội dung Mầm (song song)

| #   | Bước                                                                                                          | Phụ thuộc | Trạng thái |
| --- | ------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| 8   | Trang đấu máy: chọn cấp bằng nhân vật có giọng đọc, gợi ý, đi lại, phong cấp bằng hình                        | 4, 7      | ⬜         |
| 9   | Nội dung Mầm: thí điểm 1–2 bài → chỉnh prompt → AI soạn đủ bộ → validate → TTS → người dùng duyệt ở `/review` | 5, 6      | ⬜         |
| 10  | Bản đồ lộ trình Mầm/Nhí, sao thưởng, cổng phụ huynh, trang ghi công                                           | 3, 4      | ⬜         |

### Đợt 3: Nội dung Nhí (tuần tự sau bước 9)

| #   | Bước                                                                                                                                                                           | Trạng thái |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 11  | Chiếu và 3 cách thoát chiếu, chiếu hết, hòa pat, nhập thành, phong cấp, bắt tốt qua đường, 3 nguyên tắc khai cuộc + khai cuộc mẫu, tàn cuộc (Đôi Xe, Vua+Hậu, Vua+Xe, Vua+Tốt) | ⬜         |

### Đợt 4: Hoàn thiện (tuần tự)

| #   | Bước                                                                                                                            | Trạng thái |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 12  | PWA offline                                                                                                                     | ⬜         |
| 13  | Kiểm thử: Vitest, Playwright 3 viewport, thử tay iOS Safari + Android Chrome, Lighthouse, số file/dung lượng `dist/`; phát hành | ⬜         |

## Việc người dùng cần làm

| Việc                                                                                  | Cần cho    | Trạng thái |
| ------------------------------------------------------------------------------------- | ---------- | ---------- |
| Nối repo GitHub với Cloudflare Pages (build `npm run build`, output `dist`)           | Bước 2     | ⬜         |
| Mở `/smoke` trên iPhone/iPad và Android sau khi deploy, báo kết quả                   | Bước 2     | ⬜         |
| Tạo Azure Speech free tier (F0), đặt khóa vào biến môi trường trên máy (không commit) | Bước 6, 9  | ⬜         |
| Nghe duyệt bài học ở `/review`                                                        | Bước 9, 11 | ⬜         |

## Giả định chưa kiểm chứng

| Giả định                                                                                                          | Kiểm ở                  |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Cloudflare Pages free: 20.000 file, 25 MiB/file; tự phục vụ `index.html` cho route SPA khi không có `404.html`    | Bước 2 (sau khi deploy) |
| Azure F0 có khoảng 0,5 triệu ký tự neural/tháng, giọng vi-VN, điều khoản cho phép dùng audio trong dự án miễn phí | Bước 6                  |
| Stockfish Skill Level thấp vẫn quá mạnh với trẻ 6–8 tuổi                                                          | Bước 7 (script tự đấu)  |

## Nhật ký

| Ngày       | Nội dung                                                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-23 | Duyệt kế hoạch. Làm Đợt 0.                                                                                                                                                                            |
| 2026-10-23 | Đợt 0 xong phần trên máy: lint, typecheck, 21 unit test, build, 12 e2e (desktop/tablet/mobile, Stockfish chạy dưới CSP) đều qua. Chờ nối Cloudflare Pages và thử `/smoke` trên máy thật. Chưa commit. |
