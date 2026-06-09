import { mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { bundlePoster } from '../poster/bundle.js';
import { launchAndScreenshot } from '../poster/playwright.js';
import { findProjectRoot } from '../poster/projectRoot.js';
import { createPosterServer } from '../poster/server.js';

export interface PosterOptions {
  from: string;
  out: string;
  exportName: string;
  timeSeconds: number;
  width: number;
  height: number;
}

export interface PosterIO {
  cwd: string;
  log: (line: string) => void;
}

const READY_TIMEOUT_MS = 10_000;

export async function runPoster(
  opts: PosterOptions,
  io: PosterIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  if (!Number.isInteger(opts.width) || opts.width <= 0 || opts.width > 4096) {
    throw new Error(`--width must be a positive integer ≤ 4096 (got ${opts.width})`);
  }
  if (!Number.isInteger(opts.height) || opts.height <= 0 || opts.height > 4096) {
    throw new Error(`--height must be a positive integer ≤ 4096 (got ${opts.height})`);
  }
  if (!Number.isFinite(opts.timeSeconds) || opts.timeSeconds < 0) {
    throw new Error(`--time must be ≥ 0 (got ${opts.timeSeconds})`);
  }

  const fromAbs = resolve(io.cwd, opts.from);
  const outAbs = resolve(io.cwd, opts.out);

  try {
    await stat(fromAbs);
  } catch {
    throw new Error(`--from ${opts.from}: file not found`);
  }

  const projectRoot = await findProjectRoot(fromAbs);
  const bundle = await bundlePoster({
    from: fromAbs,
    exportName: opts.exportName,
    projectRoot,
  });

  const server = await createPosterServer({
    bundle,
    config: { width: opts.width, height: opts.height },
  });

  try {
    await mkdir(dirname(outAbs), { recursive: true });
    const { bytes } = await launchAndScreenshot({
      url: server.url,
      width: opts.width,
      height: opts.height,
      timeSeconds: opts.timeSeconds,
      readyTimeoutMs: READY_TIMEOUT_MS,
      outPath: outAbs,
      projectRoot,
    });

    io.log(`Wrote poster: ${opts.out} (${opts.width}×${opts.height}, ${formatBytes(bytes)})`);
    io.log('');
    io.log(`Wire it up inside ${opts.from}:`);
    io.log('  <ShaderScene fallback={<img src="' + posterPublicSrc(opts.out) + '" alt="" />}>');
    io.log('    ...');
    io.log('  </ShaderScene>');
  } finally {
    await server.close();
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;

  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function posterPublicSrc(outPath: string): string {
  // Best-effort hint: if the path goes through `/public/`, suggest the served form.
  const idx = outPath.replace(/\\/g, '/').indexOf('/public/');

  if (idx >= 0) return outPath.replace(/\\/g, '/').slice(idx + '/public'.length);

  return outPath;
}
