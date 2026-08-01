import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeFileNoFollow } from './writeFileNoFollow.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'matter-nofollow-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('writeFileNoFollow', () => {
  it('writes a new file', async () => {
    const target = join(dir, 'fresh.ts');

    await writeFileNoFollow(target, 'contents\n');

    expect(await readFile(target, 'utf-8')).toBe('contents\n');
  });

  it('replaces an existing regular file, leaving no trailing bytes', async () => {
    const target = join(dir, 'existing.ts');

    await writeFile(target, 'a much longer previous version\n', 'utf-8');
    await writeFileNoFollow(target, 'short\n');

    expect(await readFile(target, 'utf-8')).toBe('short\n');
  });

  it('refuses a symlink target and writes nothing at the far end', async () => {
    const outside = join(dir, 'outside.ts');
    const link = join(dir, 'link.ts');

    await symlink(outside, link);

    await expect(writeFileNoFollow(link, 'payload\n')).rejects.toThrow(/symbolic link/i);
    await expect(readFile(outside, 'utf-8')).rejects.toThrow(/ENOENT/);
  });
});
