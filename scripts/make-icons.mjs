// Regenerates PWA icons, favicon.ico and Open Graph social preview from public/favicon.svg using Playwright Chromium.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
  { file: 'favicon-32x32.png', size: 32, scale: 1, opaque: false },
];

/** Wraps a 32x32 PNG buffer in a standard single-image ICO container. */
function buildIcoFromPng32(pngBuffer) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: 1 = ICO
  header.writeUInt16LE(1, 4); // Image count: 1
  header.writeUInt8(32, 6); // Width: 32px
  header.writeUInt8(32, 7); // Height: 32px
  header.writeUInt8(0, 8); // Color palette: 0
  header.writeUInt8(0, 9); // Reserved
  header.writeUInt16LE(1, 10); // Color planes
  header.writeUInt16LE(32, 12); // Bits per pixel
  header.writeUInt32LE(pngBuffer.length, 14); // Image data size
  header.writeUInt32LE(22, 18); // Offset to PNG data
  return Buffer.concat([header, pngBuffer]);
}

async function fontFaceRule(weight, subset) {
  const file = path.join(
    root,
    'node_modules',
    '@fontsource',
    'nunito',
    'files',
    `nunito-${subset}-${weight}-normal.woff2`,
  );
  const data = await readFile(file);
  return `@font-face{font-family:'Nunito';font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${data.toString('base64')}) format('woff2');}`;
}

const svg = await readFile(path.join(root, 'public', 'favicon.svg'), 'utf8');
const fontCss = (
  await Promise.all([
    fontFaceRule(700, 'vietnamese'),
    fontFaceRule(700, 'latin-ext'),
    fontFaceRule(700, 'latin'),
    fontFaceRule(800, 'vietnamese'),
    fontFaceRule(800, 'latin-ext'),
    fontFaceRule(800, 'latin'),
  ])
).join('\n');

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
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

  const png32 = await readFile(path.join(outDir, 'favicon-32x32.png'));
  await writeFile(path.join(root, 'public', 'favicon.ico'), buildIcoFromPng32(png32));
  console.log('wrote public/favicon.ico (32x32)');

  // Open Graph social preview (1200x630) for Facebook / Zalo / Twitter
  const ogPage = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await ogPage.setContent(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
    ${fontCss}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:1200px;height:630px;overflow:hidden;font-family:'Nunito',sans-serif;background:#fff8e7;color:#2b2b2b}
    .canvas{position:relative;width:1200px;height:630px;display:flex;align-items:center;justify-content:space-between;padding:56px 68px;background:radial-gradient(circle at 88% 18%, #ffe8a3 0%, rgba(255,232,163,0) 38%),linear-gradient(135deg,#fff8e7 0%,#f7edd4 100%)}
    .border-frame{position:absolute;inset:20px;border:4px solid #e6dcc3;border-radius:32px;pointer-events:none}
    .left{position:relative;z-index:2;max-width:675px;display:flex;flex-direction:column;gap:22px}
    .brand{display:inline-flex;align-items:center;gap:14px;background:#2f7d4f;color:#ffffff;padding:10px 22px;border-radius:999px;font-weight:800;font-size:24px;width:fit-content;box-shadow:0 5px 0 rgba(0,0,0,0.12)}
    .title{font-size:74px;font-weight:800;line-height:1.08;color:#1f5736;letter-spacing:-1px}
    .subtitle{font-size:28px;font-weight:700;line-height:1.4;color:#3d3d3d}
    .pills{display:flex;flex-wrap:nowrap;gap:12px;margin-top:6px}
    .pill{display:inline-flex;align-items:center;gap:8px;padding:12px 18px;border-radius:18px;color:#ffffff;font-weight:800;font-size:22px;box-shadow:0 6px 0 rgba(0,0,0,0.14);white-space:nowrap}
    .pill--basic{background:#2e7d32}
    .pill--advanced{background:#b85d00}
    .pill--play{background:#1f6feb}
    .footer-note{font-size:22px;font-weight:700;color:#5f5f5f;margin-top:4px}
    .right{position:relative;z-index:2;width:380px;height:380px;display:flex;align-items:center;justify-content:center}
    .board-card{position:relative;width:360px;height:360px;border-radius:36px;background:#2f7d4f;padding:22px;box-shadow:0 16px 0 rgba(0,0,0,0.14);transform:rotate(3deg);display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);overflow:hidden;border:6px solid #ffffff}
    .sq-light{background:#f0d9b5;border-radius:6px}
    .sq-dark{background:#b58863;border-radius:6px}
    .hero-badge{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
    .hero-badge svg{width:236px;height:236px;filter:drop-shadow(0 12px 16px rgba(0,0,0,0.28))}
  </style></head><body>
    <div class="canvas">
      <div class="border-frame"></div>
      <div class="left">
        <div class="brand">♟ Miễn phí • Không quảng cáo • Tiếng Việt</div>
        <h1 class="title">Bé học cờ vua</h1>
        <p class="subtitle">Bài học có giọng đọc và hoạt cảnh trực quan cho trẻ mới bắt đầu, chưa biết chữ vẫn tự học được.</p>
        <div class="pills">
          <span class="pill pill--basic">🌱 Học cơ bản</span>
          <span class="pill pill--advanced">⭐ Học nâng cao</span>
          <span class="pill pill--play">♞ Đấu máy 10 cấp</span>
        </div>
        <p class="footer-note">chess-dat.pages.dev • Chạy được cả khi không có mạng</p>
      </div>
      <div class="right">
        <div class="board-card">
          <div class="sq-light"></div><div class="sq-dark"></div><div class="sq-light"></div><div class="sq-dark"></div>
          <div class="sq-dark"></div><div class="sq-light"></div><div class="sq-dark"></div><div class="sq-light"></div>
          <div class="sq-light"></div><div class="sq-dark"></div><div class="sq-light"></div><div class="sq-dark"></div>
          <div class="sq-dark"></div><div class="sq-light"></div><div class="sq-dark"></div><div class="sq-light"></div>
          <div class="hero-badge">${svg}</div>
        </div>
      </div>
    </div>
  </body></html>`);
  await ogPage.evaluate(() => document.fonts.ready);
  await ogPage.screenshot({ path: path.join(root, 'public', 'og-image.png') });
  await ogPage.close();
  console.log('wrote public/og-image.png (1200x630)');
} finally {
  await browser.close();
}
