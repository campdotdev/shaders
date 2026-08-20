import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runPoster } from '../commands/poster.js';

const E2E_ENABLED = process.env.MATTER_E2E === '1';

const FIXTURES = new URL('../test-fixtures/posters/', import.meta.url).pathname;

const cases = [
  {
    name: 'single-linear-gradient',
    file: 'single-linear-gradient.tsx',
    type: 'png',
    extra: {},
  },
  {
    name: 'gradient-plus-grain',
    file: 'gradient-plus-grain.tsx',
    type: 'png',
    extra: {},
  },
  {
    name: 'aurora-with-time',
    file: 'aurora-with-time.tsx',
    type: 'png',
    extra: { timeSeconds: 2 },
  },
  {
    name: 'named-export',
    file: 'named-export.tsx',
    type: 'png',
    extra: { exportName: 'NamedExport' },
  },
  // Exercises the default JPEG path and verifies the magic-byte header.
  {
    name: 'jpeg-default',
    file: 'single-linear-gradient.tsx',
    type: 'jpg',
    extra: {},
  },
] as const;

describe.skipIf(!E2E_ENABLED)('runPoster — E2E (MATTER_E2E=1)', () => {
  let outDir: string;

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), 'shaders-poster-e2e-'));
  });

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  for (const c of cases) {
    it(`produces a ${c.type.toUpperCase()} for ${c.name}`, async () => {
      const out = join(outDir, `${c.name}.${c.type === 'jpg' ? 'jpg' : 'png'}`);

      await runPoster(
        {
          from: join(FIXTURES, c.file),
          out,
          type: c.type,
          exportName: 'default',
          timeSeconds: 0,
          width: 800,
          height: 600,
          deviceScaleFactor: 1,
          ...c.extra,
        },
        { cwd: process.cwd(), log: vi.fn() },
      );
      const s = await stat(out);

      expect(s.size).toBeGreaterThan(1024); // > 1 KB
      expect(s.size).toBeLessThan(5 * 1024 * 1024); // < 5 MB

      const { open } = await import('node:fs/promises');
      const fh = await open(out, 'r');

      try {
        const head = Buffer.alloc(4);

        await fh.read(head, 0, 4, 0);
        if (c.type === 'png') {
          expect(head[0]).toBe(0x89);
          expect(head[1]).toBe(0x50);
        } else {
          expect(head[0]).toBe(0xff);
          expect(head[1]).toBe(0xd8);
        }
      } finally {
        await fh.close();
      }
    }, 30_000);
  }

  it('captures a deterministic t=0 frame across runs', async () => {
    const outA = join(outDir, 'determinism-a.png');
    const outB = join(outDir, 'determinism-b.png');
    const base = {
      from: join(FIXTURES, 'gradient-plus-grain.tsx'),
      type: 'png' as const,
      exportName: 'default',
      timeSeconds: 0,
      width: 320,
      height: 240,
      deviceScaleFactor: 1,
    };

    await runPoster({ ...base, out: outA }, { cwd: process.cwd(), log: vi.fn() });
    await runPoster({ ...base, out: outB }, { cwd: process.cwd(), log: vi.fn() });

    const [bytesA, bytesB] = await Promise.all([readFile(outA), readFile(outB)]);

    // Determinism regression guard: the grain overlay animates with elapsedTime,
    // so if the harness ever stopped pinning the clock (paused -> scale 0), a run
    // that rode a different warmup time could shift the grain and diverge. This
    // asserts two runs stay byte-identical; it does not by itself prove the
    // paused clock is load-bearing (warmup may coincide), only that determinism
    // holds.
    expect(Buffer.compare(bytesA, bytesB)).toBe(0);
  }, 60_000);
});
