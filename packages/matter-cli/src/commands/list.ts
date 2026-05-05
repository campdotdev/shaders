import { fetchRegistry } from '../registry/fetchRegistry.js'

export interface ListOptions {
  registry?: string
  ref?: string
}

export interface ListIO {
  log: (line: string) => void
}

/**
 * `list` prints one line per component in the registry. The shape is
 * `<slug> · <description> · tier <N>`. If `--registry` is supplied, it's
 * used directly; otherwise the caller resolves the default URL from the
 * --ref / CLI version (Phase 2.7) and passes it in.
 */
export async function runList(opts: ListOptions, io: ListIO = { log: console.log }): Promise<void> {
  if (!opts.registry) {
    throw new Error(
      'list: --registry <url> is required at this phase (Phase 2.7 wires the default).',
    )
  }

  const registry = await fetchRegistry(opts.registry)
  const entries = Object.entries(registry.components).sort(([a], [b]) => a.localeCompare(b))

  if (entries.length === 0) {
    io.log('No components in registry.')
    return
  }

  for (const [slug, entry] of entries) {
    const description = entry.description ?? '(no description)'
    io.log(`${slug} · ${description} · tier ${entry.tier}`)
  }
}
