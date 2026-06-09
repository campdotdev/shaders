import { configExists, DEFAULT_MATTER_CONFIG, readMatterConfig } from '../config/matterConfig.js';
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
    const cfg = await readMatterConfig(io.cwd);

    baseUrl = cfg.registryUrl;
  } else {
    baseUrl = DEFAULT_MATTER_CONFIG.registryUrl;
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
