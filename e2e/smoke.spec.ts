import { expect, test } from '@playwright/test';

test('home page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bé học cờ vua' })).toBeVisible();
});

test('unknown route falls back to the SPA not-found page', async ({ page }) => {
  await page.goto('/khong-ton-tai');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
});

test('security headers are served', async ({ page }) => {
  const response = await page.goto('/');
  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("'wasm-unsafe-eval'");
  expect(response?.headers()['x-frame-options']).toBe('DENY');
});

test('Stockfish runs in a Web Worker under the production CSP', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/smoke');
  await expect(page.getByTestId('engine-status')).toHaveText('ok', { timeout: 30_000 });
  await expect(page.getByTestId('engine-log')).toContainText('bestmove');
  await expect(page.getByTestId('csp-violations')).toHaveText('không có');
  await expect(page.locator('[data-testid="smoke-board"] piece').first()).toBeVisible();
  expect(consoleErrors.filter((text) => /Content Security Policy/i.test(text))).toEqual([]);
});
