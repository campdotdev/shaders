import { mkdtemp, rm, stat } from 'node:fs/promises';
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
    outDir = await mkdtemp(join(tmpdir(), 'matter-poster-e2e-'));
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
});
