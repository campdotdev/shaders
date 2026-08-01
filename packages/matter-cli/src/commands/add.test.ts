import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MATTER_CONFIG, writeMatterConfig } from '../config/matterConfig.js';
import { runAdd } from './add.js';

const FIXTURE_BASE = `file://${fileURLToPath(
  new URL('../test-fixtures/registry/', import.meta.url),
)}`;
const VERSION = '0.0.0';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'matter-add-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function seedConfig(overrides: Partial<typeof DEFAULT_MATTER_CONFIG> = {}) {
  await writeMatterConfig(dir, {
    ...DEFAULT_MATTER_CONFIG,
    registryUrl: FIXTURE_BASE,
    componentsDir: 'src/components/matter',
    ...overrides,
  });
}

describe('runAdd (single component, no aliases)', () => {
  it('writes the component source to componentsDir/<name>.tsx', async () => {
    await seedConfig();
    await runAdd(['synthetic-component'], { cliVersion: VERSION }, { cwd: dir, log: vi.fn() });
    const target = join(dir, 'src/components/matter/synthetic-component.tsx');
    const written = await readFile(target, 'utf-8');

    expect(written).toContain('SyntheticComponent');
    expect(written).toContain('@matter-internal/lib');
  });

  it('creates componentsDir if it does not exist', async () => {
    await seedConfig({ componentsDir: 'app/very/nested/matter' });
    await runAdd(['synthetic-component'], { cliVersion: VERSION }, { cwd: dir, log: vi.fn() });
    const target = join(dir, 'app/very/nested/matter/synthetic-component.tsx');
    const written = await readFile(target, 'utf-8');

    expect(written).toContain('SyntheticComponent');
  });

  it('refuses to overwrite an existing file without --force', async () => {
    await seedConfig();
    await mkdir(join(dir, 'src/components/matter'), { recursive: true });
    await writeFile(
      join(dir, 'src/components/matter/synthetic-component.tsx'),
      'existing',
      'utf-8',
    );
    await expect(
      runAdd(['synthetic-component'], { cliVersion: VERSION }, { cwd: dir, log: vi.fn() }),
    ).rejects.toThrow(/already exists/);
  });

  it('overwrites with --force', async () => {
    await seedConfig();
    await mkdir(join(dir, 'src/components/matter'), { recursive: true });
    await writeFile(join(dir, 'src/components/matter/synthetic-component.tsx'), 'old', 'utf-8');
    await runAdd(
      ['synthetic-component'],
      { force: true, cliVersion: VERSION },
      { cwd: dir, log: vi.fn() },
    );
    const written = await readFile(
      join(dir, 'src/components/matter/synthetic-component.tsx'),
      'utf-8',
    );

    expect(written).toContain('SyntheticComponent');
  });

  it('errors clearly when the requested component is not in the registry', async () => {
    await seedConfig();
    await expect(
      runAdd(['nope'], { cliVersion: VERSION }, { cwd: dir, log: vi.fn() }),
    ).rejects.toThrow(/nope.*not found/i);
  });

  it('prints a "Wrote" line and an install hint with the component dependencies', async () => {
    await seedConfig();
    const log = vi.fn();

    await runAdd(['synthetic-component'], { cliVersion: VERSION }, { cwd: dir, log });
    const output = log.mock.calls.map((c) => c[0]).join('\n');

    expect(output).toMatch(/^Wrote .*synthetic-component\.tsx/m);
    expect(output).toContain('This component requires: react');
    expect(output).toMatch(/^npm install react/m);
  });
});

describe('runAdd (multi-file components)', () => {
  it('writes every file the entry lists, not just the entry point', async () => {
    await seedConfig();
    await runAdd(['nested-component'], { cliVersion: VERSION }, { cwd: dir, log: vi.fn() });
    const base = join(dir, 'src/components/matter');

    expect(await readFile(join(base, 'nested-component/nested-component.tsx'), 'utf-8')).toContain(
      'NestedComponent',
    );
    expect(await readFile(join(base, 'nested-component/shader.tsx'), 'utf-8')).toContain(
      'NestedShader',
    );
    expect(await readFile(join(base, 'utils/color.ts'), 'utf-8')).toContain('ColorStop');
  });

  it('refuses the whole set when a non-entry file already exists, writing nothing', async () => {
    await seedConfig();
    const base = join(dir, 'src/components/matter');

    await mkdir(join(base, 'nested-component'), { recursive: true });
    await writeFile(join(base, 'nested-component/shader.tsx'), 'mine', 'utf-8');

    await expect(
      runAdd(['nested-component'], { cliVersion: VERSION }, { cwd: dir, log: vi.fn() }),
    ).rejects.toThrow(/shader\.tsx.*already exists/s);

    // The point of checking before writing: a refused set leaves no partial copy.
    await expect(
      readFile(join(base, 'nested-component/nested-component.tsx'), 'utf-8'),
    ).rejects.toThrow(/ENOENT/);
    expect(await readFile(join(base, 'nested-component/shader.tsx'), 'utf-8')).toBe('mine');
  });

  it('writes a file shared by two components in one invocation exactly once', async () => {
    await seedConfig();
    const log = vi.fn();

    await runAdd(
      ['nested-component', 'sibling-component'],
      { cliVersion: VERSION },
      {
        cwd: dir,
        log,
      },
    );

    // Logged paths use the OS separator, so build the expected tail the same way.
    const sharedFile = join('utils', 'color.ts');
    const written = log.mock.calls
      .map((call) => call[0] as string)
      .filter((line) => line.startsWith('Wrote ') && line.endsWith(sharedFile));

    expect(written).toHaveLength(1);
  });

  it('skips a file already on disk with identical content, so a later add succeeds', async () => {
    await seedConfig();
    const base = join(dir, 'src/components/matter');

    // Last week: add one component, which brings utils/color.ts with it.
    await runAdd(['nested-component'], { cliVersion: VERSION }, { cwd: dir, log: vi.fn() });

    // Today: add another that shares it. The shared file is already there and
    // unchanged, which is not a conflict.
    const log = vi.fn();

    await runAdd(['sibling-component'], { cliVersion: VERSION }, { cwd: dir, log });

    expect(await readFile(join(base, 'sibling-component/shader.tsx'), 'utf-8')).toContain(
      'SiblingShader',
    );

    const output = log.mock.calls.map((call) => call[0] as string).join('\n');

    expect(output).not.toContain(join('utils', 'color.ts'));
  });

  it('refuses when a file on disk has diverged from the registry copy', async () => {
    await seedConfig();
    const base = join(dir, 'src/components/matter');

    await runAdd(['nested-component'], { cliVersion: VERSION }, { cwd: dir, log: vi.fn() });
    await writeFile(join(base, 'utils/color.ts'), '// my own edits\n', 'utf-8');

    await expect(
      runAdd(['sibling-component'], { cliVersion: VERSION }, { cwd: dir, log: vi.fn() }),
    ).rejects.toThrow(/color\.ts already exists and differs.*--force/s);

    expect(await readFile(join(base, 'utils/color.ts'), 'utf-8')).toBe('// my own edits\n');
    await expect(
      readFile(join(base, 'sibling-component/sibling-component.tsx'), 'utf-8'),
    ).rejects.toThrow(/ENOENT/);
  });

  it('refuses a registry entry whose file escapes componentsDir', async () => {
    const inlineDir = await mkdtemp(join(tmpdir(), 'matter-escape-fixture-'));

    await writeFile(
      join(inlineDir, 'registry.json'),
      JSON.stringify({
        version: '0.0.0-test',
        components: {
          hostile: {
            file: 'hostile.tsx',
            files: ['../../../escaped.tsx'],
            dependencies: ['react'],
            tier: 1,
          },
        },
      }),
      'utf-8',
    );
    await writeFile(join(inlineDir, 'hostile.tsx'), 'export const hostile = 1\n', 'utf-8');

    await seedConfig({ registryUrl: `file://${inlineDir}/` });

    await expect(
      runAdd(['hostile'], { cliVersion: VERSION }, { cwd: dir, log: vi.fn() }),
    ).rejects.toThrow(/escaped\.tsx.*outside/s);

    await rm(inlineDir, { recursive: true, force: true });
  });

  it('overwrites a diverged file with --force', async () => {
    await seedConfig();
    const base = join(dir, 'src/components/matter');

    await runAdd(['nested-component'], { cliVersion: VERSION }, { cwd: dir, log: vi.fn() });
    await writeFile(join(base, 'utils/color.ts'), '// my own edits\n', 'utf-8');

    await runAdd(
      ['sibling-component'],
      { force: true, cliVersion: VERSION },
      { cwd: dir, log: vi.fn() },
    );

    expect(await readFile(join(base, 'utils/color.ts'), 'utf-8')).toContain('ColorStop');
  });
});

describe('runAdd (multi-component + dedup + alias rewriting)', () => {
  it('writes multiple components in one invocation against a custom registry', async () => {
    const inlineDir = await mkdtemp(join(tmpdir(), 'matter-multi-fixture-'));

    await writeFile(
      join(inlineDir, 'registry.json'),
      JSON.stringify({
        version: '0.0.0-test',
        components: {
          alpha: { file: 'alpha.tsx', dependencies: ['react'], tier: 1 },
          beta: { file: 'beta.tsx', dependencies: ['react', 'three'], tier: 1 },
        },
      }),
      'utf-8',
    );
    await writeFile(join(inlineDir, 'alpha.tsx'), 'export const alpha = 1\n', 'utf-8');
    await writeFile(join(inlineDir, 'beta.tsx'), 'export const beta = 2\n', 'utf-8');

    await seedConfig({ registryUrl: `file://${inlineDir}/` });
    const log = vi.fn();

    await runAdd(['alpha', 'beta'], { cliVersion: VERSION }, { cwd: dir, log });

    const a = await readFile(join(dir, 'src/components/matter/alpha.tsx'), 'utf-8');
    const b = await readFile(join(dir, 'src/components/matter/beta.tsx'), 'utf-8');

    expect(a).toContain('alpha = 1');
    expect(b).toContain('beta = 2');

    const output = log.mock.calls.map((c) => c[0]).join('\n');
    const installLine = output.split('\n').find((l) => l.startsWith('npm install '))!;
    const args = installLine.replace('npm install ', '').trim().split(/\s+/).sort();

    expect(args).toEqual(['react', 'three']);

    await rm(inlineDir, { recursive: true, force: true });
  });

  it('rewrites @matter-internal imports per matter.config.json aliases', async () => {
    await seedConfig({ aliases: { '@matter-internal/': '@/lib/matter/' } });
    await runAdd(['synthetic-component'], { cliVersion: VERSION }, { cwd: dir, log: vi.fn() });
    const target = join(dir, 'src/components/matter/synthetic-component.tsx');
    const written = await readFile(target, 'utf-8');

    expect(written).toContain(`from '@/lib/matter/lib'`);
    expect(written).not.toContain('@matter-internal/lib');
  });
});

describe('runAdd (--ref handling)', () => {
  it('substitutes ${ref} into the registry URL when present', async () => {
    const inlineDir = await mkdtemp(join(tmpdir(), 'matter-ref-fixture-'));

    await mkdir(join(inlineDir, 'main'), { recursive: true });
    await writeFile(
      join(inlineDir, 'main/registry.json'),
      JSON.stringify({
        version: '0.0.0-test',
        components: {
          'synthetic-component': {
            file: 'synthetic-component.tsx',
            description: 'fixture',
            dependencies: ['react'],
            tier: 1,
          },
        },
      }),
      'utf-8',
    );
    await writeFile(
      join(inlineDir, 'main/synthetic-component.tsx'),
      `export function X(){ return null }\n`,
      'utf-8',
    );

    await seedConfig({ registryUrl: `file://${inlineDir}/\${ref}` });
    await runAdd(
      ['synthetic-component'],
      { ref: 'main', cliVersion: VERSION },
      { cwd: dir, log: vi.fn() },
    );
    const target = join(dir, 'src/components/matter/synthetic-component.tsx');
    const written = await readFile(target, 'utf-8');

    expect(written).toContain('function X');

    await rm(inlineDir, { recursive: true, force: true });
  });
});
