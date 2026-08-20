import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runList } from './list.js';

const FIXTURE_BASE = `file://${fileURLToPath(new URL('../test-fixtures/registry/', import.meta.url))}`;

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'shaders-list-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('runList', () => {
  it('prints one line per component using --registry override', async () => {
    const log = vi.fn();

    await runList({ registry: FIXTURE_BASE, cliVersion: '0.0.0' }, { cwd: dir, log });
    const output = log.mock.calls.map((c) => c[0]).join('\n');

    expect(output).toContain('synthetic-component');
    expect(output).toContain('tier 1');
  });

  it('reads shaders.config.json when --registry is not supplied', async () => {
    // Write a minimal config pointing at the fixture (with ${ref} placeholder).
    const { writeShadersConfig, DEFAULT_SHADERS_CONFIG } =
      await import('../config/shadersConfig.js');

    await writeShadersConfig(dir, {
      ...DEFAULT_SHADERS_CONFIG,
      registryUrl: FIXTURE_BASE, // no ${ref} — stays literal
    });
    const log = vi.fn();

    await runList({ cliVersion: '0.0.0' }, { cwd: dir, log });
    const output = log.mock.calls.map((c) => c[0]).join('\n');

    expect(output).toContain('synthetic-component');
  });

  it('propagates errors when shaders.config.json is malformed (does NOT silently fall back)', async () => {
    // Pre-fix, runList caught everything and fell back to DEFAULT_SHADERS_CONFIG
    // — silently masking malformed config. After the fix, the error propagates.
    const { writeFile } = await import('node:fs/promises');

    await writeFile(join(dir, 'shaders.config.json'), '{ this is not valid json', 'utf-8');
    await expect(runList({ cliVersion: '0.0.0' }, { cwd: dir, log: vi.fn() })).rejects.toThrow(
      /not valid JSON/,
    );
  });

  // Failure modes (unreachable registry, malformed JSON, missing components key)
  // are tested by fetchRegistry's own suite — runList doesn't add behavior there.
  it.todo('errors clearly when the registry has zero components');
});
