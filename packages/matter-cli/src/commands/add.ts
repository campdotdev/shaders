import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { readMatterConfig, resolveRegistryUrl } from '../config/matterConfig.js';
import {
  fetchComponentSource,
  fetchRegistry,
  type Registry,
  type RegistryEntry,
} from '../registry/fetchRegistry.js';
import { resolveRef } from '../registry/ref.js';
import { rewriteImports } from '../transforms/rewriteImports.js';

export interface AddOptions {
  registry?: string;
  ref?: string;
  force?: boolean;
  cliVersion: string;
}

export interface AddIO {
  cwd: string;
  log: (line: string) => void;
}

export async function runAdd(
  components: string[],
  opts: AddOptions,
  io: AddIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  if (components.length === 0) {
    throw new Error('add: at least one component name is required');
  }

  const matterConfig = await readMatterConfig(io.cwd);
  const ref = resolveRef(opts.ref, opts.cliVersion);
  const registryUrl = resolveRegistryUrl(matterConfig, { registry: opts.registry, ref });
  const registry = await fetchRegistry(registryUrl);

  const resolved = components.map((slug) => resolveComponent(slug, registry, registryUrl));

  if (opts.force !== true) {
    for (const resolvedComponent of resolved) {
      const targetPath = join(io.cwd, matterConfig.componentsDir, resolvedComponent.entry.file);

      if (await fileExists(targetPath)) {
        throw new Error(`${targetPath} already exists. Pass --force to overwrite.`);
      }
    }
  }

  const fetched = await Promise.all(
    resolved.map(async (resolvedComponent) => {
      const source = await fetchComponentSource(registryUrl, resolvedComponent.entry.file);

      return { ...resolvedComponent, source };
    }),
  );

  const allDeps = new Set<string>();

  for (const fetchedComponent of fetched) {
    const targetPath = join(io.cwd, matterConfig.componentsDir, fetchedComponent.entry.file);
    const rewritten = rewriteImports(fetchedComponent.source, matterConfig.aliases);

    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, rewritten, 'utf-8');
    io.log(`Wrote ${targetPath}`);
    for (const dep of fetchedComponent.entry.dependencies) allDeps.add(dep);
  }

  const sortedDeps = [...allDeps].sort();

  io.log('');
  io.log(`This component requires: ${sortedDeps.join(', ')}`);
  io.log('Install with your package manager, e.g.:');
  io.log(`npm install ${sortedDeps.join(' ')}`);
}

function resolveComponent(
  slug: string,
  registry: Registry,
  registryUrl: string,
): { slug: string; entry: RegistryEntry } {
  const entry = registry.components[slug];

  if (!entry) {
    throw new Error(
      `Component "${slug}" not found in registry at ${registryUrl}. Run \`matter-cli list\` to see available components.`,
    );
  }

  return { slug, entry };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);

    return true;
  } catch (caughtError) {
    if (caughtError instanceof Error && 'code' in caughtError && caughtError.code === 'ENOENT')
      return false;
    throw caughtError;
  }
}
