import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveOutPath, runPoster, validateDeviceScaleFactor } from './poster.js';

const { launchAndScreenshotMock } = vi.hoisted(() => ({
  launchAndScreenshotMock: vi.fn(async () => ({ bytes: 123 })),
}));

vi.mock('../poster/bundle.js', () => ({
  bundlePoster: vi.fn(async () => ({ html: '<html></html>', js: '' })),
}));
vi.mock('../poster/server.js', () => ({
  createPosterServer: vi.fn(async () => ({
    url: 'http://127.0.0.1:0/',
    close: vi.fn(async () => undefined),
  })),
}));
vi.mock('../poster/playwright.js', () => ({
  launchAndScreenshot: launchAndScreenshotMock,
}));

const base = {
  from: '/tmp/nope.tsx',
  out: '/tmp/poster.jpg',
  exportName: 'default',
  timeSeconds: 0,
  width: 1280,
  height: 720,
};

describe('runPoster — flag validation', () => {
  it('rejects width <= 0', async () => {
    await expect(runPoster({ ...base, width: 0 }, { cwd: '/tmp', log: vi.fn() })).rejects.toThrow(
      /--width.*must be a positive integer ≤ 4096/,
    );
  });

  it('rejects width > 4096', async () => {
    await expect(
      runPoster({ ...base, width: 5000 }, { cwd: '/tmp', log: vi.fn() }),
    ).rejects.toThrow(/--width.*must be a positive integer ≤ 4096/);
  });

  it('rejects height <= 0', async () => {
    await expect(runPoster({ ...base, height: -1 }, { cwd: '/tmp', log: vi.fn() })).rejects.toThrow(
      /--height.*must be a positive integer ≤ 4096/,
    );
  });

  it('rejects timeSeconds < 0', async () => {
    await expect(
      runPoster({ ...base, timeSeconds: -1 }, { cwd: '/tmp', log: vi.fn() }),
    ).rejects.toThrow(/--time.*must be ≥ 0/);
  });

  it('rejects --quality below 1', async () => {
    await expect(runPoster({ ...base, quality: 0 }, { cwd: '/tmp', log: vi.fn() })).rejects.toThrow(
      /--quality must be an integer 1–100/,
    );
  });

  it('rejects --quality above 100', async () => {
    await expect(
      runPoster({ ...base, quality: 150 }, { cwd: '/tmp', log: vi.fn() }),
    ).rejects.toThrow(/--quality must be an integer 1–100/);
  });

  it('rejects non-integer --quality', async () => {
    await expect(
      runPoster({ ...base, quality: 80.5 }, { cwd: '/tmp', log: vi.fn() }),
    ).rejects.toThrow(/--quality must be an integer 1–100/);
  });

  it('rejects invalid --type', async () => {
    await expect(
      runPoster({ ...base, type: 'webp' }, { cwd: '/tmp', log: vi.fn() }),
    ).rejects.toThrow(/--type must be 'png' or 'jpg'/);
  });
});

describe('runPoster — --from validation', () => {
  it('throws if --from file does not exist', async () => {
    await expect(
      runPoster(
        { ...base, from: '/tmp/__matter_test_missing__.tsx' },
        { cwd: '/tmp', log: vi.fn() },
      ),
    ).rejects.toThrow(/--from .* file not found/);
  });
});

describe('runPoster — PNG + --quality warning', () => {
  it('warns when --quality is set with PNG output', async () => {
    const log = vi.fn();

    await expect(
      runPoster(
        {
          ...base,
          from: '/tmp/__matter_test_missing__.tsx',
          out: '/tmp/poster',
          type: 'png',
          quality: 90,
        },
        { cwd: '/tmp', log },
      ),
    ).rejects.toThrow(/--from .* file not found/);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('--quality is ignored for PNG'));
  });

  it('does not warn when --quality is omitted with PNG output', async () => {
    const log = vi.fn();

    await expect(
      runPoster(
        { ...base, from: '/tmp/__matter_test_missing__.tsx', out: '/tmp/poster', type: 'png' },
        { cwd: '/tmp', log },
      ),
    ).rejects.toThrow(/--from .* file not found/);
    for (const call of log.mock.calls) {
      expect(String(call[0])).not.toMatch(/--quality is ignored/);
    }
  });
});

describe('resolveOutPath', () => {
  it('appends .jpg when --out has no extension and format is jpeg', () => {
    expect(resolveOutPath('/tmp/hero', 'jpeg')).toBe('/tmp/hero.jpg');
  });

  it('appends .png when --out has no extension and format is png', () => {
    expect(resolveOutPath('/tmp/hero', 'png')).toBe('/tmp/hero.png');
  });

  it('keeps a matching .jpg extension as-is', () => {
    expect(resolveOutPath('/tmp/hero.jpg', 'jpeg')).toBe('/tmp/hero.jpg');
  });

  it('keeps .jpeg as a valid JPEG extension', () => {
    expect(resolveOutPath('/tmp/hero.jpeg', 'jpeg')).toBe('/tmp/hero.jpeg');
  });

  it('keeps a matching .png extension as-is', () => {
    expect(resolveOutPath('/tmp/hero.png', 'png')).toBe('/tmp/hero.png');
  });

  it('is case-insensitive on extension matching', () => {
    expect(resolveOutPath('/tmp/hero.JPG', 'jpeg')).toBe('/tmp/hero.JPG');
    expect(resolveOutPath('/tmp/hero.PNG', 'png')).toBe('/tmp/hero.PNG');
  });

  it('errors when --out extension contradicts --type', () => {
    expect(() => resolveOutPath('/tmp/hero.png', 'jpeg')).toThrow(/doesn't match --type 'jpg'/);
    expect(() => resolveOutPath('/tmp/hero.jpg', 'png')).toThrow(/doesn't match --type 'png'/);
  });

  it('appends the format extension to non-image extensions', () => {
    expect(resolveOutPath('/tmp/hero.bak', 'jpeg')).toBe('/tmp/hero.bak.jpg');
  });
});

describe('runPoster — --background threading', () => {
  let sourceDir: string;
  let sourceFile: string;

  beforeEach(async () => {
    launchAndScreenshotMock.mockClear();
    sourceDir = await mkdtemp(join(tmpdir(), 'shaders-poster-test-'));
    sourceFile = join(sourceDir, 'scene.tsx');
    await writeFile(join(sourceDir, 'package.json'), '{"name":"shaders-poster-test-fixture"}');
    await writeFile(sourceFile, 'export default function Scene() { return null; }');
  });

  afterEach(async () => {
    await rm(sourceDir, { recursive: true, force: true });
  });

  it('passes --background through to launchAndScreenshot', async () => {
    await runPoster(
      { ...base, from: sourceFile, out: join(sourceDir, 'poster.jpg'), background: '#0b0f1a' },
      { cwd: sourceDir, log: vi.fn() },
    );

    expect(launchAndScreenshotMock).toHaveBeenCalledWith(
      expect.objectContaining({ background: '#0b0f1a' }),
    );
  });

  it('leaves background undefined when --background is omitted', async () => {
    await runPoster(
      { ...base, from: sourceFile, out: join(sourceDir, 'poster.jpg') },
      { cwd: sourceDir, log: vi.fn() },
    );

    expect(launchAndScreenshotMock).toHaveBeenCalledWith(
      expect.objectContaining({ background: undefined }),
    );
  });
});

describe('validateDeviceScaleFactor', () => {
  it('returns the value for any positive number, including fractional', () => {
    expect(validateDeviceScaleFactor(2)).toBe(2);
    expect(validateDeviceScaleFactor(1.5)).toBe(1.5);
  });

  it('throws on zero, negatives, and NaN', () => {
    expect(() => validateDeviceScaleFactor(0)).toThrow(/device-scale-factor/);
    expect(() => validateDeviceScaleFactor(-1)).toThrow(/device-scale-factor/);
    expect(() => validateDeviceScaleFactor(Number.NaN)).toThrow(/device-scale-factor/);
  });
});
