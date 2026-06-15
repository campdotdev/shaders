import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runInit } from './init.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'matter-init-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('runInit', () => {
  it('writes matter.config.json with defaults', async () => {
    await runInit({}, { cwd: dir, log: vi.fn() });
    const raw = await readFile(join(dir, 'matter.config.json'), 'utf-8');
    const matterConfig = JSON.parse(raw);

    expect(matterConfig.componentsDir).toBe('src/components/matter');
    expect(matterConfig.registryUrl).toContain('lovo-hq/matter');
  });

  it('refuses to overwrite an existing config without --force', async () => {
    await writeFile(join(dir, 'matter.config.json'), '{}', 'utf-8');
    await expect(runInit({}, { cwd: dir, log: vi.fn() })).rejects.toThrow(/already exists/);
  });

  it('overwrites with --force', async () => {
    await writeFile(join(dir, 'matter.config.json'), '{}', 'utf-8');
    await runInit({ force: true }, { cwd: dir, log: vi.fn() });
    const raw = await readFile(join(dir, 'matter.config.json'), 'utf-8');
    const matterConfig = JSON.parse(raw);

    expect(matterConfig.componentsDir).toBe('src/components/matter');
  });

  it('logs a confirmation message after writing', async () => {
    const log = vi.fn();

    await runInit({}, { cwd: dir, log });
    const output = log.mock.calls.map((c) => c[0]).join('\n');

    expect(output).toMatch(/created matter\.config\.json/i);
  });
});
