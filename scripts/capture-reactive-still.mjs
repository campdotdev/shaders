// Captures the Reactive feature card's still frame (SHA-216) from its live
// scene, arrow and all, into the image the card shows until the scene lays
// its smudge, without WebGPU, and under reduced motion. Rerun it whenever the
// still frame changes: the gradient, the J, the smudge, or the arrow.
//
//   pnpm dev:docs   # in another terminal
//   node scripts/capture-reactive-still.mjs
//
// It needs the docs dev server on http://localhost:3000, and a Mac, where
// Chromium draws WebGPU on the Metal adapter. SwiftShader's software WebGPU
// on Linux draws slightly different pixels.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
// Playwright is a dependency of the docs tests, not of the repo root.
const require = createRequire(`${root}apps/docs-tests/package.json`);
const { chromium } = require('@playwright/test');

const OUTPUT = `${root}apps/docs/public/features/reactive.png`;
// The mock's 312 by 309 window at 2x, the size the image it replaces had.
const WIDTH = 624;
const HEIGHT = 618;

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-gpu'],
});

try {
  // Measure the window at 2x, then capture at a density that gives at least
  // WIDTH pixels across it, so the image only ever scales down.
  const measure = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await measure.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  const cssWidth = await measure
    .locator('[data-scene]')
    .first()
    .evaluate((el) => el.clientWidth);

  await measure.close();

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: Math.max(2, WIDTH / cssWidth),
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  const illustration = page.locator('[data-scene]').first();

  await illustration.scrollIntoViewIfNeeded();
  await page.waitForSelector('[data-scene="laid"]', { timeout: 60_000 });
  // Let the frame after the smudge lands draw.
  await page.waitForTimeout(300);
  const capture = await illustration.screenshot();

  await sharp(capture).resize(WIDTH, HEIGHT, { fit: 'fill' }).png().toFile(OUTPUT);
  console.log(`Wrote ${OUTPUT}`);
} finally {
  await browser.close();
}
