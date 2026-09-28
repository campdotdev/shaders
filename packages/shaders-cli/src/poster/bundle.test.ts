import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ancestorDirs, bundlePoster, resolveHarnessDir } from './bundle.js';

const FIXTURE_DIR = new URL('../test-fixtures/posters/', import.meta.url).pathname;

describe('bundlePoster', () => {
  it('produces an ESM bundle that references the resolved user module', async () => {
    const result = await bundlePoster({
      from: `${FIXTURE_DIR}trivial.tsx`,
      exportName: 'default',
      projectRoot: new URL('../../', import.meta.url).pathname, // shaders-cli's own root, has react installed
    });

    expect(result.js).toContain('hello');
    expect(result.js.length).toBeGreaterThan(1000);
  });

  it('surfaces esbuild errors as Error', async () => {
    await expect(
      bundlePoster({
        from: `${FIXTURE_DIR}__does_not_exist__.tsx`,
        exportName: 'default',
        projectRoot: new URL('../../', import.meta.url).pathname,
      }),
    ).rejects.toThrow();
  });
});

describe('bundlePoster — error messages', () => {
  it('surfaces a TS/JSX syntax error with the user file path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'shaders-bundle-err-'));

    await writeFile(join(dir, 'package.json'), '{}');
    const bad = join(dir, 'bad.tsx');

    await writeFile(bad, 'export default function Bad() { return <div></span> }');

    await expect(
      bundlePoster({ from: bad, exportName: 'default', projectRoot: dir }),
    ).rejects.toThrow(/bad\.tsx/);
  });
});

describe('ancestorDirs', () => {
  it('yields the start directory, then each parent up to the filesystem root', () => {
    expect([...ancestorDirs('/a/b/c')]).toEqual(['/a/b/c', '/a/b', '/a', '/']);
  });

  it('yields the root once when starting at the root', () => {
    expect([...ancestorDirs('/')]).toEqual(['/']);
  });
});

async function writeCliPackage(root: string): Promise<void> {
  await writeFile(join(root, 'package.json'), '{"name":"@camp-dev/shaders-cli"}');
}

async function writeHarness(root: string, candidate: string): Promise<void> {
  await mkdir(join(root, candidate), { recursive: true });
  await writeFile(join(root, candidate, 'index.html'), '<html></html>');
}

describe('resolveHarnessDir', () => {
  let dir: string;
  let moduleFile: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'shaders-harness-dir-'));
    await mkdir(join(dir, 'dist'));
    moduleFile = join(dir, 'dist', 'chunk-ABC123.js');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('prefers dist/harness over src/harness', async () => {
    await writeCliPackage(dir);
    await writeHarness(dir, 'dist/harness');
    await writeHarness(dir, 'src/harness');

    expect(await resolveHarnessDir(moduleFile)).toBe(join(dir, 'dist/harness'));
  });

  it('falls back to src/harness when dist/harness has no index.html', async () => {
    await writeCliPackage(dir);
    await mkdir(join(dir, 'dist', 'harness'));
    await writeHarness(dir, 'src/harness');

    expect(await resolveHarnessDir(moduleFile)).toBe(join(dir, 'src/harness'));
  });

  it('walks past package.json files that are unreadable or name another package', async () => {
    await writeCliPackage(dir);
    await writeHarness(dir, 'src/harness');
    await mkdir(join(dir, 'nested', 'deeper'), { recursive: true });
    await writeFile(join(dir, 'nested', 'package.json'), '{"name":"some-other-package"}');
    await writeFile(join(dir, 'nested', 'deeper', 'package.json'), 'not json');

    expect(await resolveHarnessDir(join(dir, 'nested', 'deeper', 'chunk.js'))).toBe(
      join(dir, 'src/harness'),
    );
  });

  it('throws without walking further when the package has no harness', async () => {
    await writeCliPackage(dir);

    await expect(resolveHarnessDir(moduleFile)).rejects.toThrow(
      `Found @camp-dev/shaders-cli at ${dir} but neither dist/harness nor src/harness contains index.html`,
    );
  });

  it('throws naming the start file when no ancestor is the CLI package', async () => {
    await expect(resolveHarnessDir(moduleFile)).rejects.toThrow(
      `Could not locate @camp-dev/shaders-cli package root from ${moduleFile}`,
    );
  });
});
