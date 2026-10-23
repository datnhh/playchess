import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// Production build: the service worker precaches the app, then serves it without network.
const manifest = JSON.parse(readFileSync('content/audio/manifest.json', 'utf8')) as Record<
  string,
  { file: string }
>;
const clip = `/audio/${manifest['basic-board/meet-board/say']!.file}`;

async function waitForServiceWorker(page: Page) {
  await page.goto('/');
  // e2e is type-checked without the DOM lib; the CSP forbids string expressions.
  await page.waitForFunction(
    () =>
      (navigator as unknown as { serviceWorker: { controller: unknown } }).serviceWorker
        .controller !== null,
    undefined,
    { timeout: 30_000 },
  );
}

test('the app, a heard clip and the engine work offline', async ({ page, context }) => {
  await waitForServiceWorker(page);
  // A clip heard once (fetched through the worker) is kept for later.
  const status = await page.evaluate(async (url) => (await fetch(url)).status, clip);
  expect(status).toBe(200);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('link', { name: /Học cơ bản/ })).toBeVisible();

  // Safari plays media through Range requests: the cached clip answers with 206.
  const range = await page.evaluate(async (url) => {
    const response = await fetch(url, { headers: { Range: 'bytes=0-1' } });
    return { status: response.status, size: (await response.arrayBuffer()).byteLength };
  }, clip);
  expect(range).toEqual({ status: 206, size: 2 });

  await page.getByRole('link', { name: /Học cơ bản/ }).click();
  await page.locator('a[href="/lesson/basic-board"]').click();
  await expect(page.locator('.lesson-caption')).toBeVisible();

  await page.goto('/play');
  await page.getByRole('button', { name: /^Cấp 1:/ }).click();
  await expect(page.locator('cg-board piece')).toHaveCount(32);
});
