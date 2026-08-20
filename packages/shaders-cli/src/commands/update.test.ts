import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SHADERS_CONFIG, writeShadersConfig } from '../config/shadersConfig.js';
import { runUpdate } from './update.js';

const FIXTURE_BASE = `file://${fileURLToPath(new URL('../test-fixtures/registry/', import.meta.url))}`;

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'matter-update-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function seedConfigAndComponent() {
  await writeShadersConfig(dir, {
    ...DEFAULT_SHADERS_CONFIG,
    registryUrl: FIXTURE_BASE,
  });
  await mkdir(join(dir, 'src/components/matter'), { recursive: true });
  await writeFile(
    join(dir, 'src/components/matter/synthetic-component.tsx'),
    'export const STALE = true\n',
    'utf-8',
  );
}

describe('runUpdate', () => {
  it('refreshes a single named component, overwriting local edits', async () => {
    await seedConfigAndComponent();
    await runUpdate(
      ['synthetic-component'],
      { force: true, cliVersion: '0.0.0' },
      { cwd: dir, log: vi.fn() },
    );
    const written = await readFile(
      join(dir, 'src/components/matter/synthetic-component.tsx'),
      'utf-8',
    );

    expect(written).toContain('SyntheticComponent');
    expect(written).not.toContain('STALE');
  });

  it('refreshes every component in componentsDir when no names are given', async () => {
    await seedConfigAndComponent();
    await runUpdate([], { force: true, cliVersion: '0.0.0' }, { cwd: dir, log: vi.fn() });
    const written = await readFile(
      join(dir, 'src/components/matter/synthetic-component.tsx'),
      'utf-8',
    );

    expect(written).toContain('SyntheticComponent');
  });

  it('errors clearly when componentsDir is empty and no names are given', async () => {
    await writeShadersConfig(dir, {
      ...DEFAULT_SHADERS_CONFIG,
      registryUrl: FIXTURE_BASE,
    });
    await mkdir(join(dir, 'src/components/matter'), { recursive: true });
    await expect(
      runUpdate([], { force: true, cliVersion: '0.0.0' }, { cwd: dir, log: vi.fn() }),
    ).rejects.toThrow(/no components/i);
  });

  it('errors clearly when a named component is not present in componentsDir', async () => {
    await writeShadersConfig(dir, {
      ...DEFAULT_SHADERS_CONFIG,
      registryUrl: FIXTURE_BASE,
    });
    await mkdir(join(dir, 'src/components/matter'), { recursive: true });
    await expect(
      runUpdate(
        ['synthetic-component'],
        { force: true, cliVersion: '0.0.0' },
        { cwd: dir, log: vi.fn() },
      ),
    ).rejects.toThrow(/synthetic-component.*not present/i);
  });

  it('refuses to overwrite without --force', async () => {
    await seedConfigAndComponent();
    await expect(
      runUpdate(['synthetic-component'], { cliVersion: '0.0.0' }, { cwd: dir, log: vi.fn() }),
    ).rejects.toThrow(/already exists/);
  });
});
