import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { readMatterConfig } from '../config/matterConfig.js'
import { fetchComponentSource, fetchRegistry, type Registry } from '../registry/fetchRegistry.js'
import { rewriteImports } from '../transforms/rewriteImports.js'

export interface AddOptions {
  registry?: string
  ref?: string
  force?: boolean
}

export interface AddIO {
  cwd: string
  log: (line: string) => void
}

export async function runAdd(
  components: string[],
  opts: AddOptions,
  io: AddIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  if (components.length === 0) {
    throw new Error('add: at least one component name is required')
  }

  const cfg = await readMatterConfig(io.cwd)
  const registryUrl = opts.registry ?? cfg.registryUrl
  const registry = await fetchRegistry(registryUrl)

  // Resolve every component up front so we fail fast on missing slugs
  // before any disk write.
  const resolved = components.map((slug) => resolveComponent(slug, registry, registryUrl))

  // Pre-flight overwrite check on every target.
  if (!opts.force) {
    for (const r of resolved) {
      const targetPath = join(io.cwd, cfg.componentsDir, r.entry.file)
      if (await fileExists(targetPath)) {
        throw new Error(`${targetPath} already exists. Pass --force to overwrite.`)
      }
    }
  }

  // Fetch + rewrite + write.
  const allDeps = new Set<string>()
  for (const r of resolved) {
    const targetPath = join(io.cwd, cfg.componentsDir, r.entry.file)
    const source = await fetchComponentSource(registryUrl, r.entry.file)
    const rewritten = rewriteImports(source, cfg.aliases)
    await mkdir(dirname(targetPath), { recursive: true })
    await writeFile(targetPath, rewritten, 'utf-8')
    io.log(`Wrote ${targetPath}`)
    for (const dep of r.entry.dependencies) allDeps.add(dep)
  }

  // Dedup + alphabetize install hint.
  const sortedDeps = [...allDeps].sort()
  io.log('')
  io.log(`This component requires: ${sortedDeps.join(', ')}`)
  io.log('Install with your package manager, e.g.:')
  io.log(`npm install ${sortedDeps.join(' ')}`)
}

function resolveComponent(
  slug: string,
  registry: Registry,
  registryUrl: string,
): { slug: string; entry: NonNullable<Registry['components'][string]> } {
  const entry = registry.components[slug]
  if (!entry) {
    throw new Error(
      `Component "${slug}" not found in registry at ${registryUrl}. Run \`matter-cli list\` to see available components.`,
    )
  }
  return { slug, entry }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw err
  }
}
