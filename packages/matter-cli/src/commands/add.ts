import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { readMatterConfig } from '../config/matterConfig.js'
import { fetchComponentSource, fetchRegistry } from '../registry/fetchRegistry.js'

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

  // Phase 2.5: handle exactly one component. Phase 2.6 generalizes to N.
  if (components.length > 1) {
    throw new Error(
      'add: multi-component support arrives in Phase 2.6. Pass exactly one slug for now.',
    )
  }
  const slug = components[0]!
  const entry = registry.components[slug]
  if (!entry) {
    throw new Error(
      `Component "${slug}" not found in registry at ${registryUrl}. Run \`matter-cli list\` to see available components.`,
    )
  }

  const targetPath = join(io.cwd, cfg.componentsDir, entry.file)
  if (!opts.force && (await fileExists(targetPath))) {
    throw new Error(`${targetPath} already exists. Pass --force to overwrite.`)
  }

  const source = await fetchComponentSource(registryUrl, entry.file)

  await mkdir(dirname(targetPath), { recursive: true })
  await writeFile(targetPath, source, 'utf-8')

  io.log(`Wrote ${targetPath}`)
  io.log('')
  io.log(`This component requires: ${entry.dependencies.join(', ')}`)
  io.log('Install with your package manager, e.g.:')
  io.log(`npm install ${entry.dependencies.join(' ')}`)
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
