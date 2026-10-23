// Regenerates PWA icons in public/icons/ from public/favicon.svg using Playwright Chromium.
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'icons');
const background = '#2f7d4f';

// scale: fraction of the canvas the SVG occupies; opaque: fill the whole canvas.
const targets = [
  { file: 'icon-192.png', size: 192, scale: 1, opaque: false },
  { file: 'icon-512.png', size: 512, scale: 1, opaque: false },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.8, opaque: true },
  { file: 'apple-touch-icon.png', size: 180, scale: 1, opaque: true },
];

const svg = await readFile(path.join(root, 'public', 'favicon.svg'), 'utf8');
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const { file, size, scale, opaque } of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const inner = Math.round(size * scale);
    await page.setContent(`<!doctype html><html><head><style>
      html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden;
        background:${opaque ? background : 'transparent'};
        display:flex;align-items:center;justify-content:center}
      svg{width:${inner}px;height:${inner}px;display:block}
    </style></head><body>${svg}</body></html>`);
    await page.screenshot({ path: path.join(outDir, file), omitBackground: !opaque });
    await page.close();
    console.log(`wrote public/icons/${file} (${size}x${size})`);
  }
} finally {
  await browser.close();
}
