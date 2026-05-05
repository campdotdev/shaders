import { readUrl } from './readUrl.js'

export interface RegistryEntry {
  file: string
  description?: string
  dependencies: string[]
  uses_primitives?: string[]
  tier: 1 | 2 | 3
}

export interface Registry {
  version: string
  components: Record<string, RegistryEntry>
}

/**
 * Join a base URL with a relative filename, normalizing the trailing slash.
 * `joinUrl("https://x/registry", "foo.tsx")` and `joinUrl("https://x/registry/", "foo.tsx")`
 * both return `https://x/registry/foo.tsx`.
 */
export function joinUrl(base: string, file: string): string {
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base
  return `${trimmed}/${file}`
}

/**
 * Fetch and parse `registry.json` from a base registry URL.
 * The base URL points at the directory containing registry.json
 * (e.g. `file:///.../registry/` or
 * `https://raw.githubusercontent.com/lovo/matter/main/registry`).
 */
export async function fetchRegistry(baseUrl: string): Promise<Registry> {
  const url = joinUrl(baseUrl, 'registry.json')
  const json = await readUrl(url)
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (err) {
    throw new Error(
      `Registry at ${url} is not valid JSON: ${(err as Error).message}`,
    )
  }
  if (typeof parsed !== 'object' || parsed === null || !('components' in parsed)) {
    throw new Error(`Registry at ${url} is missing a "components" object`)
  }
  const components = (parsed as { components: unknown }).components
  if (typeof components !== 'object' || components === null || Array.isArray(components)) {
    throw new Error(`Registry at ${url} is missing a "components" object`)
  }
  return parsed as Registry
}

/**
 * Fetch the raw source of a component file referenced by a registry entry.
 */
export async function fetchComponentSource(baseUrl: string, file: string): Promise<string> {
  return await readUrl(joinUrl(baseUrl, file))
}
