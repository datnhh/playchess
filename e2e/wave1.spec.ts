import { expect, test } from '@playwright/test';

test('review page is not shipped in production builds', async ({ page }) => {
  await page.goto('/review');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
});

test('sample lesson runs on the real board', async ({ page }) => {
  await page.goto('/dev/lesson');
  await page.getByRole('button', { name: '▶ Bắt đầu' }).click();
  await expect(page.locator('cg-board piece.rook.white')).toBeVisible();
  // Step 2 highlights the 14 squares the rook can reach.
  await page.getByRole('button', { name: 'Tiếp' }).click();
  await expect(page.locator('cg-board square[class*="board-hl"]')).not.toHaveCount(0);
});

test('Stockfish answers at level 10 and gives a hint', async ({ page }) => {
  await page.goto('/dev/engine');
  await page.getByRole('combobox').selectOption('10');
  await page.getByRole('button', { name: 'Máy đi' }).click();
  await expect(page.getByText(/Nước máy vừa đi: \S+ \(Stockfish\)/)).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Gợi ý' }).click();
  await expect(page.getByText(/Gợi ý: \S+ \(\w+\), lý do: \w+/)).toBeVisible({ timeout: 20_000 });
});
