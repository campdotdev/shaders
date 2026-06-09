import { mkdir, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';

import { bundlePoster } from '../poster/bundle.js';
import { launchAndScreenshot } from '../poster/playwright.js';
import { findProjectRoot } from '../poster/projectRoot.js';
import { createPosterServer } from '../poster/server.js';

export type PosterFormat = 'jpeg' | 'png';

export interface PosterOptions {
  from: string;
  out: string;
  exportName: string;
  timeSeconds: number;
  width: number;
  height: number;
  type?: string;
  quality?: number;
}

export interface PosterIO {
  cwd: string;
  log: (line: string) => void;
}

const READY_TIMEOUT_MS = 10_000;
const DEFAULT_JPEG_QUALITY = 80;

function normalizeType(t: string | undefined): PosterFormat {
  const v = t?.toLowerCase();

  if (v === undefined || v === 'jpg' || v === 'jpeg') return 'jpeg';
  if (v === 'png') return 'png';

  throw new Error(`--type must be 'png' or 'jpg' (got ${String(t)})`);
}

function extensionFor(format: PosterFormat): string {
  return format === 'png' ? '.png' : '.jpg';
}

export function resolveOutPath(out: string, format: PosterFormat): string {
  const ext = extname(out).toLowerCase();
  const expected = extensionFor(format);

  if (ext === expected) return out;
  if (format === 'jpeg' && ext === '.jpeg') return out;
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    throw new Error(
      `--out extension '${ext}' doesn't match --type '${format === 'jpeg' ? 'jpg' : 'png'}'`,
    );
  }

  return `${out}${expected}`;
}

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
  if (opts.quality !== undefined) {
    if (!Number.isInteger(opts.quality) || opts.quality < 1 || opts.quality > 100) {
      throw new Error(`--quality must be an integer 1–100 (got ${opts.quality})`);
    }
  }

  const format = normalizeType(opts.type);
  const resolvedOut = resolveOutPath(opts.out, format);

  if (format === 'png' && opts.quality !== undefined) {
    io.log(`warn: --quality is ignored for PNG output (lossless)`);
  }

  const quality = format === 'jpeg' ? (opts.quality ?? DEFAULT_JPEG_QUALITY) : undefined;

  const fromAbs = resolve(io.cwd, opts.from);
  const outAbs = resolve(io.cwd, resolvedOut);

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
      format,
      quality,
    });

    io.log(`Wrote poster: ${resolvedOut} (${opts.width}×${opts.height}, ${formatBytes(bytes)})`);
    io.log('');
    io.log(`Wire it up inside ${opts.from}:`);
    io.log('  <ShaderScene fallback={<img src="' + posterPublicSrc(resolvedOut) + '" alt="" />}>');
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
