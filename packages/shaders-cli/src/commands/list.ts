// `shaders-cli list`: prints the registry's component catalog (slug,
// description, tier). Unlike the other commands it works without a
// shaders.config.json — it falls back to the default registry URL so users
// can browse before running init.
import {
  configExists,
  DEFAULT_SHADERS_CONFIG,
  readShadersConfig,
} from '../config/shadersConfig.js';
import { fetchRegistry } from '../registry/fetchRegistry.js';
import { resolveRef } from '../registry/ref.js';

export interface ListOptions {
  registry?: string;
  ref?: string;
  cliVersion: string;
}

export interface ListIO {
  cwd: string;
  log: (line: string) => void;
}

export async function runList(
  opts: ListOptions,
  io: ListIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  let baseUrl: string;

  if (opts.registry !== undefined && opts.registry !== '') {
    baseUrl = opts.registry;
  } else if (await configExists(io.cwd)) {
    const shadersConfig = await readShadersConfig(io.cwd);

    baseUrl = shadersConfig.registryUrl;
  } else {
    baseUrl = DEFAULT_SHADERS_CONFIG.registryUrl;
  }

  const ref = resolveRef(opts.ref, opts.cliVersion);
  const url = baseUrl.replace('${ref}', ref);
  const registry = await fetchRegistry(url);
  const entries = Object.entries(registry.components).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    io.log('No components in registry.');

    return;
  }

  for (const [slug, entry] of entries) {
    const description = entry.description ?? '(no description)';

    io.log(`${slug} · ${description} · tier ${entry.tier}`);
  }
}
