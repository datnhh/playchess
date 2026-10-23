# Hướng dẫn viết bài học (lộ trình cơ bản)

Tài liệu này dùng làm đề bài cho người hoặc AI viết bài trong `content/lessons/basic/`. Bài mẫu đã theo hướng dẫn: `board.json`, `rook.json`, `knight.json`.

## 1. Người học

- Trẻ từ 3–4 tuổi, chưa biết đọc. Mọi hướng dẫn được đọc to bằng giọng TTS, trên màn hình không cần chữ.
- Bé hiểu bài nhờ hoạt cảnh trên bàn cờ (tô sáng, mũi tên, hình dán, quân di chuyển) và trả lời bằng cách chạm.
- Phụ huynh chỉ thấy `title` và `summary` trên bản đồ. Bé nhận ra bài qua `icon`.

## 2. Câu đọc (`say`, `praise`, `retry`)

- Tối đa 15 từ mỗi câu (validator đếm theo khoảng trắng). Một bước chỉ có một câu đọc.
- Từ ngữ đời thường, giọng ấm áp, gọi trẻ là "bé". Ví dụ: "Bé chạm vào ô có ngôi sao nhé."
- Không bắt bé đọc hay nhớ tọa độ: nói "ô có bông hoa", "hàng ngang đang sáng", không nói "ô e4".
- Chỉ dùng thuật ngữ trong `src/content/glossary.ts`: Vua, Hậu, Xe, Tượng, Mã, Tốt, bàn cờ, ô, hàng ngang, cột dọc, đường chéo, ăn quân, chiếu, chiếu hết, hòa pat, nhập thành, phong cấp, bắt tốt qua đường...
- Validator so khớp nguyên từ, không phân biệt hoa thường, nên các từ thường cũng bị bắt nhầm:
  - "thành" (trong "tạo thành", "trở thành") bị coi là tên gọi khác của Xe. Thay bằng "là", "gọi là".
  - "ngựa", "lính", "chốt", "tháp" cũng bị chặn ở mọi ngữ cảnh.
- Không dùng từ cấm (`BANNED_WORDS`): giết, chết, máu, đánh nhau, ngu, dốt.
- `praise`/`retry` không bắt buộc: thiếu thì player dùng câu khen/câu thử lại chung. Chỉ viết riêng khi có gợi ý hữu ích (ví dụ "Mã đi hai ô thẳng, rồi rẽ một ô nhé").

## 3. Nhịp bài

- `track: "basic"`, 8–12 bước, mỗi bước một ý.
- Sau tối đa 2–3 bước `watch` phải có một bước cho bé làm: `tapSquare`, `interactMove` hoặc `captureTargets`.
- Khung gợi ý cho bài về một quân cờ:
  1. Giới thiệu quân (watch, tô sáng quân).
  2. Cách đi (watch, mũi tên hoặc ô sáng + `highlightIsLegalMoves`).
  3. Hoạt cảnh một nước đi (watch, `move` + `pieceAt`).
  4. Câu hỏi chạm (tapSquare: một hình dán đúng, một hai hình dán sai).
  5. Điều đặc biệt / điều không được làm (watch, mũi tên `warn`).
  6. Bé tự đi (interactMove tới ô có hình dán).
  7. Mini-game ăn táo (captureTargets).
  8. Lời chào tạm biệt ngắn (watch).
- Bước cuối luôn là lời tạm biệt: "Bé đã học xong quân X. Hẹn gặp lại bé nhé!"

## 4. Bàn cờ phải minh họa đúng câu đọc

- Mỗi khẳng định trong câu đọc phải có thứ tương ứng trên bàn cờ:
  - `highlight` (tô sáng cả ô; `tone`: `info` vàng mặc định, `good` xanh lá, `warn` đỏ) cho ô/hàng/cột/đường đi.
  - `arrow` cho hướng đi; `tone: "warn"` cho nước không được đi.
  - `stickers` (`star`, `apple`, `flower`, `heart`) làm đích để bé chạm hoặc ăn.
  - `move` để quân di chuyển trước mắt bé.
- Hình vẽ và hình dán còn nguyên sang bước sau. Đầu mỗi bước dùng `{ "type": "clear", "target": "all" }` (hoặc `"shapes"`) để bé không bị rối.
- `highlight` cộng dồn vào hình đang có, không thay thế. Vì vậy với `highlightIsLegalMoves`, phải `clear` trước khi tô, nếu không validator báo thừa ô.
- Thêm `assert` ở mọi chỗ máy kiểm được:
  - `highlightIsLegalMoves` khi tô các ô quân đi được (tô đúng và đủ, không thừa không thiếu).
  - `pieceAt` sau một `move`, ví dụ `{ "type": "pieceAt", "square": "e6", "piece": "wN" }`.
  - `check`/`checkmate`/`stalemate` chỉ dùng cho bài `standard` (có đủ hai Vua).
- `tapSquare`: `answers` liệt kê mọi ô được tính là đúng (ví dụ cả 8 ô của hàng ngang đang sáng). Nên cho thêm hình dán sai để câu hỏi có nghĩa.

## 5. Quy tắc `setPosition`

- Bước sau một bước tương tác nên bắt đầu bằng `setPosition` (action đầu tiên) khi thế cờ quan trọng.
- Validator bắt buộc điều này sau `captureTargets` và sau `interactMove` có nhiều nước được chấp nhận.
- `interactMove` chỉ có một nước thì validator tự đi nước đó; bước sau có thể dùng tiếp thế cờ, nhưng đặt lại cho chắc vẫn tốt hơn.
- Bài `sandbox` dùng phần sắp xếp quân của FEN (ví dụ `8/8/8/8/3N4/8/8/8`); bài `standard` dùng FEN đầy đủ.

## 6. Mini-game `captureTargets`

- Mọi ô trong `targets` phải có hình dán ở bước đó (thường là `apple`).
- Không quá 8 mục tiêu; không trùng ô quân đang đứng.
- `maxMoves` công bằng: lấy số nước ít nhất (validator kiểm bằng BFS) cộng thêm 1–2 nước cho trẻ nhỏ. Hết `maxMoves` mà chưa ăn hết là thua lượt đó.
- Trong sandbox, quân bị quân khác chặn đường và ăn được quân khác màu, giống luật thật.

## 7. Trường bắt buộc khác

- `id` = `basic-<tên file>`; `order` không trùng trong track; `icon` lấy từ `lessonIconSchema`.
- `"reviewed": false`: người duyệt sẽ đổi sau khi nghe thử.
- `id` của bước: tiếng Anh, chữ thường, gạch ngang, không trùng trong bài.

## 8. Checklist trước khi nộp

- [ ] 8–12 bước, mỗi bước một ý, không quá 3 bước `watch` liền nhau.
- [ ] Mỗi câu ≤ 15 từ, gọi "bé", không tọa độ, không chữ cần đọc.
- [ ] Đúng thuật ngữ, không từ cấm, không vướng từ bị bắt nhầm ("thành", "ngựa"...).
- [ ] Mỗi câu có hình minh họa; đầu bước đã `clear` khi cần.
- [ ] Có `highlightIsLegalMoves` hoặc `pieceAt` ở những chỗ kiểm được.
- [ ] Bước sau tương tác bắt đầu bằng `setPosition` khi cần.
- [ ] `captureTargets`: đủ hình dán, `maxMoves` = tối thiểu + 1–2.
- [ ] Bước cuối là lời tạm biệt; `reviewed: false`; có `icon`.
- [ ] `npm run validate` báo 0 lỗi (cảnh báo thiếu audio được chấp nhận).
- [ ] `npx vitest run src/content` đều qua.
