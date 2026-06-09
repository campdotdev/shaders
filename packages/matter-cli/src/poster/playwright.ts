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

export async function resolvePlaywright(projectRoot: string): Promise<typeof Playwright> {
  const pwDir = await findPlaywrightDir(projectRoot);

  if (pwDir === null) {
    throw new Error(
      `Install playwright to use this command: pnpm add -D playwright && pnpm exec playwright install chromium`,
    );
  }
  // Prefer ESM entry; fall back to CJS with .default unwrap.
  for (const entry of ['index.mjs', 'index.js']) {
    const filePath = join(pwDir, entry);

    try {
      await access(filePath);

      type PlaywrightMod = Record<string, unknown> & { default?: Record<string, unknown> };

      const rawMod: unknown = await import(pathToFileURL(filePath).href);
      // Narrow unknown → PlaywrightMod; the type guard proves object shape,
      // the assertion below spans that same narrowed type — disable is intentional.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const mod = (typeof rawMod === 'object' && rawMod !== null ? rawMod : {}) as PlaywrightMod;
      // ESM (index.mjs): named exports are on `mod` directly.
      // CJS-via-ESM (index.js): exports may end up under `mod.default`.
      const nsRaw = 'chromium' in mod ? mod : (mod.default ?? mod);
      // Dynamic import of playwright; structure is validated below via chromium.launch check.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const ns = nsRaw as unknown as typeof Playwright;

      if (typeof ns.chromium.launch !== 'function') {
        throw new Error(`Resolved ${filePath} but it does not expose chromium.launch`);
      }

      return ns;
    } catch (err) {
      if (entry === 'index.js') throw err;
      // else: try the next entry
    }
  }
  throw new Error(`Unable to import playwright from ${pwDir}`);
}

export interface ScreenshotOpts {
  url: string;
  width: number;
  height: number;
  timeSeconds: number;
  readyTimeoutMs: number;
  outPath: string;
  projectRoot: string;
}

export async function launchAndScreenshot(opts: ScreenshotOpts): Promise<{ bytes: number }> {
  const pw = await resolvePlaywright(opts.projectRoot);
  const browser = await pw.chromium.launch({ headless: true });

  try {
    const ctx = await browser.newContext({
      viewport: { width: opts.width, height: opts.height },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const consoleErrors: string[] = [];

    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
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
        `no canvas content detected within ${opts.readyTimeoutMs / 1000}s; does your component render a ShaderScene with a visible base layer?`,
      );
    }
    if (opts.timeSeconds > 0) {
      await page.waitForTimeout(opts.timeSeconds * 1000);
    }
    const canvas = page.locator('canvas').first();
    const buf = await canvas.screenshot({ type: 'png' });

    await writeFile(opts.outPath, buf);

    return { bytes: buf.length };
  } finally {
    await browser.close();
  }
}
