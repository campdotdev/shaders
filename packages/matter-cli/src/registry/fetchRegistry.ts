import { readUrl } from './readUrl.js';

export interface RegistryEntry {
  file: string;
  description?: string;
  dependencies: string[];
  uses_primitives?: string[];
  tier: 1 | 2 | 3;
}

export interface Registry {
  version: string;
  components: Record<string, RegistryEntry>;
}

function joinUrl(base: string, file: string): string {
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;

  return `${trimmed}/${file}`;
}

export async function fetchRegistry(baseUrl: string): Promise<Registry> {
  const url = joinUrl(baseUrl, 'registry.json');
  const json = await readUrl(url);
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(
      `Registry at ${url} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!looksLikeRegistry(parsed)) {
    throw new Error(`Registry at ${url} is missing a "components" object`);
  }

  return parsed;
}

function looksLikeRegistry(x: unknown): x is Registry {
  if (typeof x !== 'object' || x === null || !('components' in x)) return false;
  const components = x.components;

  return typeof components === 'object' && components !== null && !Array.isArray(components);
}

/**
 * Fetch the raw source of a component file referenced by a registry entry.
 */
export async function fetchComponentSource(baseUrl: string, file: string): Promise<string> {
  return await readUrl(joinUrl(baseUrl, file));
}
