import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findProjectRoot } from './projectRoot.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'matter-projectroot-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('findProjectRoot', () => {
  it('returns the directory containing package.json', async () => {
    await writeFile(join(dir, 'package.json'), '{}');
    await mkdir(join(dir, 'src', 'components'), { recursive: true });
    const file = join(dir, 'src', 'components', 'Hero.tsx');

    await writeFile(file, '');
    expect(await findProjectRoot(file)).toBe(dir);
  });

  it('walks up across multiple levels', async () => {
    await writeFile(join(dir, 'package.json'), '{}');
    await mkdir(join(dir, 'a', 'b', 'c'), { recursive: true });
    const file = join(dir, 'a', 'b', 'c', 'Hero.tsx');

    await writeFile(file, '');
    expect(await findProjectRoot(file)).toBe(dir);
  });

  it('throws if no package.json is found', async () => {
    await mkdir(join(dir, 'lonely'));
    const file = join(dir, 'lonely', 'Hero.tsx');

    await writeFile(file, '');
    await expect(findProjectRoot(file)).rejects.toThrow(/package\.json/i);
  });
});
