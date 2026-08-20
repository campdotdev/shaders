import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runInit } from './init.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'shaders-init-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('runInit', () => {
  it('writes shaders.config.json with defaults', async () => {
    await runInit({}, { cwd: dir, log: vi.fn() });
    const raw = await readFile(join(dir, 'shaders.config.json'), 'utf-8');
    const shadersConfig = JSON.parse(raw);

    expect(shadersConfig.componentsDir).toBe('src/components/shaders');
    expect(shadersConfig.registryUrl).toContain('mattermix/shaders');
  });

  it('refuses to overwrite an existing config without --force', async () => {
    await writeFile(join(dir, 'shaders.config.json'), '{}', 'utf-8');
    await expect(runInit({}, { cwd: dir, log: vi.fn() })).rejects.toThrow(/already exists/);
  });

  it('overwrites with --force', async () => {
    await writeFile(join(dir, 'shaders.config.json'), '{}', 'utf-8');
    await runInit({ force: true }, { cwd: dir, log: vi.fn() });
    const raw = await readFile(join(dir, 'shaders.config.json'), 'utf-8');
    const shadersConfig = JSON.parse(raw);

    expect(shadersConfig.componentsDir).toBe('src/components/shaders');
  });

  it('logs a confirmation message after writing', async () => {
    const log = vi.fn();

    await runInit({}, { cwd: dir, log });
    const output = log.mock.calls.map((c) => c[0]).join('\n');

    expect(output).toMatch(/created shaders\.config\.json/i);
  });
});
