import { readdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/** Clicks the centre of a square on a white-oriented chessground board. */
async function clickSquare(page: Page, square: string) {
  const box = await page.locator('cg-board').boundingBox();
  if (!box) throw new Error('board not visible');
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number(square[1]);
  await page.mouse.click(
    box.x + ((file + 0.5) / 8) * box.width,
    box.y + ((8 - rank + 0.5) / 8) * box.height,
  );
}

// chessground stores each piece's square on the element as `cgKey`.
const blackPieceSquares = (page: Page) =>
  page.locator('cg-board piece.black').evaluateAll((pieces) =>
    pieces
      .map((piece) => (piece as unknown as { cgKey?: string }).cgKey ?? '')
      .sort()
      .join(','),
  );

// Reviewed lessons ship in production; the manifest tells which audio files they use.
const lessonFiles = readdirSync('content/lessons/basic');
const advancedLessonFiles = readdirSync('content/lessons/advanced');
const manifest = JSON.parse(readFileSync('content/audio/manifest.json', 'utf8')) as Record<
  string,
  { file: string }
>;

test('home tiles lead to the learning map with every reviewed lesson', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Học cơ bản/ }).click();
  await expect(page).toHaveURL(/\/learn\/basic$/);
  await expect(page.getByRole('heading', { name: 'Học cơ bản' })).toBeVisible();
  await expect(page.locator('a[href^="/lesson/basic-"]')).toHaveCount(lessonFiles.length);
  // Each lesson shows its name; a tap opens it straight away (the tap unlocks sound).
  const board = page.locator('a[href="/lesson/basic-board"]');
  await expect(board).toContainText('Làm quen bàn cờ');
  await board.click();
  await expect(page.locator('.lesson-caption')).toBeVisible();
  await expect(page.getByRole('button', { name: '▶ Bắt đầu' })).toHaveCount(0);
});

test('the advanced map lists every reviewed advanced lesson', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Học nâng cao/ }).click();
  await expect(page).toHaveURL(/\/learn\/advanced$/);
  await expect(page.locator('a[href^="/lesson/advanced-"]')).toHaveCount(
    advancedLessonFiles.length,
  );
  await page.locator('a[href="/lesson/advanced-center"]').click();
  await expect(page.locator('.lesson-caption')).toBeVisible();
});

test('a lesson opened from a link keeps its start screen', async ({ page }) => {
  await page.goto('/lesson/advanced-center');
  await expect(page.getByRole('button', { name: '▶ Bắt đầu' })).toBeVisible();
});

test('unknown tracks and lessons show the not-found pages', async ({ page }) => {
  await page.goto('/learn/khong-co');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
  await page.goto('/lesson/basic-khong-co');
  await expect(page.getByText('Không tìm thấy bài học này')).toBeVisible();
});

test('lesson audio is served as MP3', async ({ request }) => {
  // Basic lessons are reviewed; the build drops the audio of any unreviewed lesson.
  const files = [
    ...new Set(
      Object.entries(manifest)
        .filter(([key]) => key.startsWith('basic-'))
        .map(([, entry]) => entry.file),
    ),
  ];
  expect(files.length).toBeGreaterThan(0);
  for (const file of [files[0]!, files[files.length - 1]!]) {
    const response = await request.get(`/audio/${file}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('audio/mpeg');
  }
});

test('play page: pick level 1, move, and the computer answers', async ({ page }) => {
  await page.goto('/play');
  await expect(page.getByRole('button', { name: /^Cấp \d+:/ })).toHaveCount(10);
  await page.getByRole('button', { name: /^Cấp 1:/ }).click();
  await expect(page.locator('cg-board piece')).toHaveCount(32);

  const before = await blackPieceSquares(page);
  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await expect.poll(() => blackPieceSquares(page), { timeout: 15_000 }).not.toBe(before);
  await expect(page.getByRole('button', { name: 'Đi lại' })).toBeEnabled();
});

test('settings are behind the parental gate', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Dành cho phụ huynh' })).toBeVisible();
  const question = (await page.locator('.gate-question').textContent()) ?? '';
  const [a, b] = question.match(/\d+/g)!.map(Number);
  for (const digit of String(a! * b!)) {
    await page.locator('.gate-pad').getByRole('button', { name: digit, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByRole('heading', { name: 'Cài đặt' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Đang bật tiếng/ })).toBeVisible();
});

test('lesson caption is shown by default and can be hidden', async ({ page }) => {
  await page.goto('/dev/lesson');
  await page.getByRole('button', { name: '▶ Bắt đầu' }).click();
  const caption = page.getByText('Đây là quân Xe. Xe trông giống một lâu đài nhỏ.');
  await expect(caption).toBeVisible();
  await page.getByRole('button', { name: 'Ẩn chữ' }).click();
  await expect(caption).toHaveCount(0);
  await page.getByRole('button', { name: 'Hiện chữ' }).click();
  await expect(caption).toBeVisible();
});
