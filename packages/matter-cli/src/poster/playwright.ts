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
}

export async function launchAndScreenshot(opts: ScreenshotOpts): Promise<{ bytes: number }> {
  const playwright = await resolvePlaywright(opts.projectRoot);
  const browser = await playwright.chromium.launch({ headless: true });

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
