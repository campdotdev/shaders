// `shaders-cli poster`: renders a user's shader component to a static image
// for use as a <ShaderPoster> stand-in. This file validates the flags and
// runs the four-stage pipeline, each stage its own module:
//   1. poster/bundle.ts     — esbuild the harness + user file, in memory
//   2. poster/server.ts     — serve the bundle on a throwaway local server
//   3. poster/playwright.ts — drive headless Chromium and screenshot
//   4. harness/             — the in-browser side that mounts the component
import { mkdir, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';

import type { BundlePosterResult } from '../poster/bundle.js';
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
  deviceScaleFactor?: number;
  background?: string;
}

export interface PosterIO {
  cwd: string;
  log: (line: string) => void;
}

const READY_TIMEOUT_MS = 10_000;
const DEFAULT_JPEG_QUALITY = 80;
const DEFAULT_DEVICE_SCALE_FACTOR = 2;
// Largest --width or --height accepted, in CSS pixels.
const MAX_DIMENSION_PX = 4096;

// ---------------------------------------------
// Flag validation
// ---------------------------------------------

export function validateDeviceScaleFactor(value: number): number {
  if (!(value > 0)) {
    throw new Error(`--device-scale-factor must be greater than 0, received: ${value}`);
  }

  return value;
}

function normalizeType(rawType: string | undefined): PosterFormat {
  const normalizedType = rawType?.toLowerCase();

  if (normalizedType === undefined || normalizedType === 'jpg' || normalizedType === 'jpeg')
    return 'jpeg';
  if (normalizedType === 'png') return 'png';

  throw new Error(`--format must be 'png' or 'jpg' (got ${String(rawType)})`);
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
      `--output extension '${ext}' doesn't match --format '${format === 'jpeg' ? 'jpg' : 'png'}'`,
    );
  }

  return `${out}${expected}`;
}

export function isIntegerInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

// The CLI entry parses the numeric flags before they get here, so a typo arrives as NaN and
// fails its check below. The first failing check throws.
function validateNumericFlags({ timeSeconds, width, height, quality }: PosterOptions): void {
  if (!isIntegerInRange(width, 1, MAX_DIMENSION_PX)) {
    throw new Error(`--width must be a positive integer ≤ ${MAX_DIMENSION_PX} (got ${width})`);
  }
  if (!isIntegerInRange(height, 1, MAX_DIMENSION_PX)) {
    throw new Error(`--height must be a positive integer ≤ ${MAX_DIMENSION_PX} (got ${height})`);
  }
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) {
    throw new Error(`--capture-delay must be ≥ 0 (got ${timeSeconds})`);
  }
  if (quality !== undefined && !isIntegerInRange(quality, 1, 100)) {
    throw new Error(`--quality must be an integer 1–100 (got ${quality})`);
  }
}

// PNG is lossless, so a --quality there does nothing. That earns a warning, not an error.
function resolveQuality(
  format: PosterFormat,
  requested: number | undefined,
  log: PosterIO['log'],
): number | undefined {
  if (format === 'jpeg') return requested ?? DEFAULT_JPEG_QUALITY;
  if (requested !== undefined) log(`warn: --quality is ignored for PNG output (lossless)`);

  return undefined;
}

// ---------------------------------------------
// Pipeline
// ---------------------------------------------

export async function runPoster(
  opts: PosterOptions,
  io: PosterIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  validateNumericFlags(opts);

  const format = normalizeType(opts.type);
  const resolvedOut = resolveOutPath(opts.out, format);
  const quality = resolveQuality(format, opts.quality, io.log);
  const fromAbs = resolve(io.cwd, opts.from);
  const outAbs = resolve(io.cwd, resolvedOut);

  const { projectRoot, bundle } = await bundleSource(opts.from, fromAbs, opts.exportName);
  const deviceScaleFactor = validateDeviceScaleFactor(
    opts.deviceScaleFactor ?? DEFAULT_DEVICE_SCALE_FACTOR,
  );
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
      deviceScaleFactor,
      background: opts.background,
    });

    logWiringHint(io.log, {
      from: opts.from,
      resolvedOut,
      width: opts.width,
      height: opts.height,
      bytes,
    });
  } finally {
    await server.close();
  }
}

// Stage 1. `from` is the flag as typed, kept for the error message, and `fromAbs` is the
// same file resolved against the working directory.
async function bundleSource(
  from: string,
  fromAbs: string,
  exportName: string,
): Promise<{ projectRoot: string; bundle: BundlePosterResult }> {
  try {
    await stat(fromAbs);
  } catch {
    throw new Error(`--source ${from}: file not found`);
  }

  const projectRoot = await findProjectRoot(fromAbs);
  const bundle = await bundlePoster({ from: fromAbs, exportName, projectRoot });

  return { projectRoot, bundle };
}

// ---------------------------------------------
// Success output
// ---------------------------------------------

// Reports the file written, then prints a <ShaderPoster> snippet the user can paste.
function logWiringHint(
  log: PosterIO['log'],
  {
    from,
    resolvedOut,
    width,
    height,
    bytes,
  }: { from: string; resolvedOut: string; width: number; height: number; bytes: number },
): void {
  log(`Wrote poster: ${resolvedOut} (${width}×${height}, ${formatBytes(bytes)})`);
  log('');
  log(`Wire it up inside ${from}:`);
  log(
    '  <ShaderPoster poster={<img src="' +
      posterPublicSrc(resolvedOut) +
      "\" alt=\"\" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}>",
  );
  log('    <ShaderScene>...</ShaderScene>');
  log('  </ShaderPoster>');
}

function formatBytes(byteCount: number): string {
  if (byteCount < 1024) return `${byteCount} B`;
  if (byteCount < 1024 * 1024) return `${(byteCount / 1024).toFixed(1)} KB`;

  return `${(byteCount / 1024 / 1024).toFixed(2)} MB`;
}

function posterPublicSrc(outPath: string): string {
  // Best-effort hint: if the path goes through `/public/`, suggest the served form.
  const publicSegmentIndex = outPath.replace(/\\/g, '/').indexOf('/public/');

  if (publicSegmentIndex >= 0)
    return outPath.replace(/\\/g, '/').slice(publicSegmentIndex + '/public'.length);

  return outPath;
}
