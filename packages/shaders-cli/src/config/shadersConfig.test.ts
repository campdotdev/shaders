import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_SHADERS_CONFIG,
  readShadersConfig,
  type ShadersConfig,
  writeShadersConfig,
} from './shadersConfig.js';

describe('DEFAULT_SHADERS_CONFIG.registryUrl', () => {
  it('points at the campdotdev/shaders org', () => {
    expect(DEFAULT_SHADERS_CONFIG.registryUrl).toContain('/campdotdev/shaders/');
  });

  it('contains the ${ref} placeholder for resolveRef substitution', () => {
    expect(DEFAULT_SHADERS_CONFIG.registryUrl).toContain('${ref}');
  });

  it('targets the registry/ subdirectory', () => {
    expect(DEFAULT_SHADERS_CONFIG.registryUrl).toMatch(/\/registry$|\/registry\/$/);
  });
});

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'shaders-config-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('shadersConfig', () => {
  it('writes the default config when none exists', async () => {
    await writeShadersConfig(dir, DEFAULT_SHADERS_CONFIG);
    const raw = await readFile(join(dir, 'shaders.config.json'), 'utf-8');

    expect(JSON.parse(raw)).toEqual(DEFAULT_SHADERS_CONFIG);
  });

  it('reads back what it wrote', async () => {
    const shadersConfig: ShadersConfig = {
      ...DEFAULT_SHADERS_CONFIG,
      componentsDir: 'app/shaders',
    };

    await writeShadersConfig(dir, shadersConfig);
    const read = await readShadersConfig(dir);

    expect(read).toEqual(shadersConfig);
  });

  it('throws a clear error when shaders.config.json is missing', async () => {
    await expect(readShadersConfig(dir)).rejects.toThrow(/shaders\.config\.json not found/);
  });

  it('throws a clear error when shaders.config.json is malformed JSON', async () => {
    await writeFile(join(dir, 'shaders.config.json'), '{ bad json }', 'utf-8');
    await expect(readShadersConfig(dir)).rejects.toThrow(/not valid JSON/);
  });

  it('throws when required fields are missing', async () => {
    await writeFile(join(dir, 'shaders.config.json'), JSON.stringify({}), 'utf-8');
    await expect(readShadersConfig(dir)).rejects.toThrow(/componentsDir/);
  });
});
