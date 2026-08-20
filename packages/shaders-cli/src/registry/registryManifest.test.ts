// Guards the contract `add` depends on: a registry entry must declare every
// source its component needs. The CLI copies exactly the files an entry lists,
// and leaves relative import specifiers alone, so any `./shader` or
// `../utils/color` a component imports has to appear in that entry's file set
// or the user's install won't compile.
//
// This reads the real registry/ at the repo root rather than a fixture — the
// point is to catch a component added later that forgets to list its shader.
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { Registry } from './fetchRegistry.js';

const REGISTRY_ROOT = fileURLToPath(new URL('../../../../registry/', import.meta.url));

/**
 * Every relative specifier in a source file, e.g. `./shader`, `../utils/color`.
 * Both quote styles and `import(...)` are matched: Prettier keeps the registry
 * on single quotes today, but this test is the guard, and a guard that quietly
 * skips a file it doesn't recognise is worse than no guard.
 */
function relativeImports(source: string): string[] {
  const patterns = [/from\s+['"](\.[^'"]*)['"]/g, /import\(\s*['"](\.[^'"]*)['"]\s*\)/g];

  return patterns.flatMap((pattern) =>
    [...source.matchAll(pattern)].flatMap((match) => match[1] ?? []),
  );
}

/** Drop the extension so `./shader` and `shader.tsx` compare equal. */
function withoutExtension(filePath: string): string {
  return filePath.replace(/\.[cm]?[jt]sx?$/, '');
}

const registry = JSON.parse(
  await readFile(join(REGISTRY_ROOT, 'registry.json'), 'utf-8'),
) as Registry;

const entries = Object.entries(registry.components);

describe('registry.json declares every file its components import', () => {
  it.each(entries)('%s lists all of its relative imports', async (slug, entry) => {
    const declared = [entry.file, ...(entry.files ?? [])];
    const declaredKeys = new Set(declared.map(withoutExtension));
    const missing: string[] = [];

    for (const file of declared) {
      const source = await readFile(join(REGISTRY_ROOT, file), 'utf-8');

      for (const specifier of relativeImports(source)) {
        // Resolve against the importing file's directory, then back to a
        // registry-root-relative key so it can be matched against `declared`.
        const target = resolve(dirname(join(REGISTRY_ROOT, file)), specifier);
        // registry.json spells paths with forward slashes; resolve() hands back
        // the OS separator, so normalise before comparing.
        const key = withoutExtension(target.slice(REGISTRY_ROOT.length).split(sep).join('/'));

        if (!declaredKeys.has(key)) missing.push(`${file} imports ${specifier}`);
      }
    }

    expect(missing, `${slug} is missing files from its registry entry`).toEqual([]);
  });

  it.each(entries)('%s only lists files that exist', async (_slug, entry) => {
    for (const file of [entry.file, ...(entry.files ?? [])]) {
      await expect(readFile(join(REGISTRY_ROOT, file), 'utf-8')).resolves.toBeTypeOf('string');
    }
  });

  it('has no two paths that collide on a case-insensitive filesystem', () => {
    // macOS and Windows fold case, so `utils/color.ts` and `utils/Color.ts`
    // would be one file on disk. `add` dedupes by path string and cannot tell,
    // so the second write would silently replace the first and ship a
    // component missing a source. Catch it here, where the paths are authored,
    // rather than making the CLI guess at the user's filesystem semantics.
    const byFoldedPath = new Map<string, string>();
    const collisions: string[] = [];

    for (const entry of Object.values(registry.components)) {
      for (const file of [entry.file, ...(entry.files ?? [])]) {
        const folded = file.toLowerCase();
        const seen = byFoldedPath.get(folded);

        if (seen !== undefined && seen !== file) collisions.push(`${seen} vs ${file}`);
        byFoldedPath.set(folded, file);
      }
    }

    expect(collisions).toEqual([]);
  });

  it('points $schema at a file that exists', async () => {
    const schemaRef = (registry as { $schema?: string }).$schema;

    expect(schemaRef).toBeTypeOf('string');

    const schema = JSON.parse(await readFile(join(REGISTRY_ROOT, schemaRef!), 'utf-8')) as {
      $defs: { entry: { properties: Record<string, unknown> } };
    };

    // The schema has to know about `files`, or it would reject the manifest it
    // is meant to describe.
    expect(Object.keys(schema.$defs.entry.properties)).toContain('files');
  });
});
