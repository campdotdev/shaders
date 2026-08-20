// Poster pipeline stage 3: drive a headless Chromium to the local harness
// page, wait for the harness to flag its first stable frame (__matterReady,
// set by harness/frameReady.ts), then screenshot the canvas element.
// Playwright is deliberately NOT a dependency of this package — it's
// resolved from the USER's project at runtime so the CLI stays light and
// the browser build matches whatever the user already installed.
import { access } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type * as Playwright from 'playwright';

/**
 * Walk up the directory tree from `startDir` looking for a `playwright`
 * package directory. Avoids NODE_PATH leakage from the host process.
 */
async function findPlaywrightDir(startDir: string): Promise<string | null> {
  let dir = startDir;

  for (;;) {
    const candidate = join(dir, 'node_modules', 'playwright');

    try {
      await access(join(candidate, 'package.json'));

      return candidate;
    } catch {
      // not here; keep walking up
    }
    const parent = dirname(dir);

    if (parent === dir) return null;
    dir = parent;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPlaywrightNamespace(value: unknown): value is typeof Playwright {
  if (!isRecord(value)) return false;

  const chromium = value.chromium;

  if (!isRecord(chromium)) return false;

  return typeof chromium.launch === 'function';
}

function getDefaultExport(value: unknown): unknown {
  if (!isRecord(value)) return undefined;

  return value.default;
}

export async function resolvePlaywright(projectRoot: string): Promise<typeof Playwright> {
  const playwrightDir = await findPlaywrightDir(projectRoot);

  if (playwrightDir === null) {
    throw new Error(
      `Install playwright to use this command: pnpm add -D playwright && pnpm exec playwright install chromium`,
    );
  }
  // Prefer ESM entry; fall back to CJS with .default unwrap.
  for (const entryFilename of ['index.mjs', 'index.js']) {
    const filePath = join(playwrightDir, entryFilename);

    try {
      await access(filePath);

      const rawModule: unknown = await import(pathToFileURL(filePath).href);
      const playwrightNamespace = isPlaywrightNamespace(rawModule)
        ? rawModule
        : getDefaultExport(rawModule);

      if (!isPlaywrightNamespace(playwrightNamespace)) {
        throw new Error(`Resolved ${filePath} but it does not expose chromium.launch`);
      }

      return playwrightNamespace;
    } catch (caughtError) {
      if (entryFilename === 'index.js') throw caughtError;
      // else: try the next entry
    }
  }
  throw new Error(`Unable to import playwright from ${playwrightDir}`);
}

export interface ScreenshotOpts {
  url: string;
  width: number;
  height: number;
  timeSeconds: number;
  readyTimeoutMs: number;
  outPath: string;
  projectRoot: string;
  format: 'jpeg' | 'png';
  quality: number | undefined;
  deviceScaleFactor: number;
  background?: string;
}

export async function launchAndScreenshot(opts: ScreenshotOpts): Promise<{ bytes: number }> {
  const playwright = await resolvePlaywright(opts.projectRoot);

  // Real browsers render Matter on WebGPU, but headless Chromium silently
  // falls back to WebGL2 unless WebGPU is requested explicitly — and
  // hash-driven shaders (voronoi, blobs) lay out DIFFERENTLY per backend,
  // so a fallback capture produces a poster that never matches what the
  // live shader shows. On macOS the GPU path additionally needs ANGLE's
  // Metal backend. Where WebGPU still can't initialize, Chromium falls
  // back to WebGL2 exactly as before, so these flags are safe everywhere.
  const webgpuArgs = ['--enable-unsafe-webgpu', '--enable-features=WebGPU'];

  if (process.platform === 'darwin') webgpuArgs.push('--use-angle=metal');

  const browser = await playwright.chromium.launch({ headless: true, args: webgpuArgs });

  try {
    const browserContext = await browser.newContext({
      viewport: { width: opts.width, height: opts.height },
      deviceScaleFactor: opts.deviceScaleFactor,
    });
    const page = await browserContext.newPage();
    const consoleErrors: string[] = [];

    page.on('pageerror', (pageError) => consoleErrors.push(`pageerror: ${pageError.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
    });
    await page.goto(opts.url, { waitUntil: 'load' });
    try {
      await page.waitForFunction(() => Reflect.get(globalThis, '__matterReady') === true, {
        timeout: opts.readyTimeoutMs,
      });
    } catch {
      if (consoleErrors.length > 0) {
        throw new Error(
          `Poster render failed before producing a frame:\n  ${consoleErrors.join('\n  ')}`,
        );
      }
      throw new Error(
        `no canvas content detected within ${
          opts.readyTimeoutMs / 1000
        }s; does your component render a ShaderScene with a visible base layer?`,
      );
    }
    if (opts.timeSeconds > 0) {
      await page.waitForTimeout(opts.timeSeconds * 1000);
    }
    if (opts.background !== undefined) {
      // This callback is serialized and run in the browser page, which has no
      // DOM lib types in this Node-only package's tsconfig — go through
      // `globalThis` (as in the __matterReady check above) instead of
      // referencing `document` directly, and set the style property via
      // `Reflect.set` to avoid asserting a DOM element shape.
      await page.evaluate((bg: string) => {
        function applyBackground(element: unknown): void {
          if (typeof element !== 'object' || element === null) return;
          const style: unknown = Reflect.get(element, 'style');

          if (typeof style !== 'object' || style === null) return;
          Reflect.set(style, 'background', bg);
        }

        const browserDocument: unknown = Reflect.get(globalThis, 'document');

        if (typeof browserDocument !== 'object' || browserDocument === null) return;
        const querySelector: unknown = Reflect.get(browserDocument, 'querySelector');

        if (typeof querySelector !== 'function') return;
        // Set the background on the canvas element itself. A canvas element
        // screenshot composites the transparent WebGPU content over the
        // element's OWN CSS background, not the page body's, so targeting
        // body/documentElement has no effect on the captured pixels.
        applyBackground(Reflect.apply(querySelector, browserDocument, ['canvas']));
      }, opts.background);
    }
    const canvas = page.locator('canvas').first();

    const imageBuffer =
      opts.format === 'jpeg'
        ? await canvas.screenshot({ type: 'jpeg', quality: opts.quality })
        : await canvas.screenshot({ type: 'png' });

    await writeFile(opts.outPath, imageBuffer);

    return { bytes: imageBuffer.length };
  } finally {
    await browser.close();
  }
}
