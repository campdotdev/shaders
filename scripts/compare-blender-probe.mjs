// Captures the Blender probe's TSL canvas and measures how far it sits from
// Blender's reference render, pixel by pixel. Needs the docs dev server.
//
//   node scripts/compare-blender-probe.mjs green-marble --port 3000
//
// It writes <name>.tsl.png, the capture, and <name>.diff.png, the per-pixel
// error brightened 16 times, beside the export in apps/docs/public/blender-probe/,
// then prints the error statistics. The browser runs WebGPU on the Mac's GPU
// (Metal), the way docs/agents/tsl.md describes for GPU timing. --webgl runs
// Playwright's headless shell instead, where WebGPU fails to start and three
// falls back to WebGL2.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import sharp from 'sharp';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    port: { type: 'string', default: '3000' },
    // A node output to compare instead of the Base Color, as in
    // export_material.py's --tap.
    tap: { type: 'string' },
    webgl: { type: 'boolean', default: false },
  },
});
const name = positionals[0] ?? 'green-marble';
const exportDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../apps/docs/public/blender-probe',
);

// ----------------------------------------------------------------------------
// Capture
// ----------------------------------------------------------------------------

const browser = await chromium.launch(
  values.webgl
    ? {}
    : {
        channel: 'chromium',
        args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-gpu'],
      },
);
const page = await browser.newPage({
  viewport: { width: 1200, height: 1200 },
  deviceScaleFactor: 1,
});

page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning')
    console.log(`[page] ${message.text()}`);
});

const started = Date.now();

const tapQuery = values.tap ? `&tap=${encodeURIComponent(values.tap)}` : '';

await page.goto(
  `http://localhost:${values.port}/dev/blender-probe?material=${name}&view=tsl${tapQuery}`,
);
// The first frame compiles the whole graph, which can take a while.
await page.waitForSelector('[data-probe-ready]', { timeout: 600_000 });

const backend = await page.evaluate(() => document.documentElement.dataset.probeBackend);
const capture = await page.locator('[data-probe-canvas] canvas').screenshot();

await browser.close();
console.log(`Captured on ${backend} in ${((Date.now() - started) / 1000).toFixed(1)}s`);

// ----------------------------------------------------------------------------
// Compare
// ----------------------------------------------------------------------------

async function decodeRgb(input) {
  const { data, info } = await sharp(input)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height };
}

const tsl = await decodeRgb(capture);
// export_material.py's slug for a tap, as graph/tap.ts's tapSlug makes it.
const stem = values.tap
  ? `${name}@${values.tap
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()}`
  : name;
const reference = await decodeRgb(join(exportDir, `${stem}.reference.png`));

if (tsl.width !== reference.width || tsl.height !== reference.height) {
  throw new Error(
    `Capture is ${tsl.width}x${tsl.height}, reference ${reference.width}x${reference.height}`,
  );
}

const pixelCount = tsl.width * tsl.height;
const diff = Buffer.alloc(pixelCount * 3);
// Pixels by their worst channel's error, in 8-bit levels.
const histogram = new Map();
let sumError = 0;
let maxError = 0;

for (let pixel = 0; pixel < pixelCount; pixel += 1) {
  let worst = 0;

  for (let channel = 0; channel < 3; channel += 1) {
    const index = pixel * 3 + channel;
    const error = Math.abs(tsl.data[index] - reference.data[index]);

    sumError += error;
    worst = Math.max(worst, error);
    diff[index] = Math.min(255, error * 16);
  }
  maxError = Math.max(maxError, worst);
  histogram.set(worst, (histogram.get(worst) ?? 0) + 1);
}

await sharp(capture).toFile(join(exportDir, `${stem}.tsl.png`));
await sharp(diff, { raw: { width: tsl.width, height: tsl.height, channels: 3 } })
  .png()
  .toFile(join(exportDir, `${stem}.diff.png`));

const share = (test) => {
  let count = 0;

  for (const [error, pixels] of histogram) if (test(error)) count += pixels;

  return `${((count / pixelCount) * 100).toFixed(3)}%`;
};

console.log(`Mean error: ${(sumError / (pixelCount * 3)).toFixed(4)} levels of 255`);
console.log(`Max error: ${maxError} levels`);
console.log(`Pixels within 1 level: ${share((e) => e <= 1)}`);
console.log(`Pixels within 2 levels: ${share((e) => e <= 2)}`);
console.log(`Pixels off by more than 8: ${share((e) => e > 8)}`);
console.log(`Pixels off by more than 32: ${share((e) => e > 32)}`);
