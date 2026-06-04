import type { Dirent } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

import { readMatterConfig, resolveRegistryUrl } from '../config/matterConfig.js'
import { fetchRegistry, type Registry } from '../registry/fetchRegistry.js'
import { resolveRef } from '../registry/ref.js'

import { runAdd } from './add.js'

export interface UpdateOptions {
  registry?: string
  ref?: string
  force?: boolean
  cliVersion: string
}

export interface UpdateIO {
  cwd: string
  log: (line: string) => void
}

export async function runUpdate(
  components: string[],
  opts: UpdateOptions,
  io: UpdateIO = { cwd: process.cwd(), log: console.log },
): Promise<void> {
  const cfg = await readMatterConfig(io.cwd)
  const ref = resolveRef(opts.ref, opts.cliVersion)
  const registryUrl = resolveRegistryUrl(cfg, { registry: opts.registry, ref })

  const componentsDir = join(io.cwd, cfg.componentsDir)
  const localEntries = await safeReaddir(componentsDir)
  // Recognize both layouts: top-level `<slug>.tsx` AND subdir `<slug>/<slug>.tsx`
  // (the latter is how multi-file components like aurora and linear-gradient live).
  const localSlugs = localEntries.flatMap((entry) => {
    if (entry.isFile() && (extname(entry.name) === '.tsx' || extname(entry.name) === '.ts')) {
      return [entry.name.replace(/\.(tsx|ts)$/, '')]
    }
    if (entry.isDirectory()) return [entry.name]

    return []
  })

  const registry = await fetchRegistry(registryUrl)

  let toUpdate: string[]

  if (components.length === 0) {
    if (localSlugs.length === 0) {
      throw new Error(
        `No components found in ${componentsDir}. Run \`matter-cli add <name>\` first.`,
      )
    }
    toUpdate = localSlugs.filter((slug) => slugIsInRegistry(slug, registry))
    if (toUpdate.length === 0) {
      throw new Error(`No components in ${componentsDir} match any registry entry.`)
    }
  } else {
    for (const slug of components) {
      const file = registry.components[slug]?.file
      const present = file !== undefined && localSlugs.includes(slug)

      if (!present) {
        throw new Error(
          `Component "${slug}" is not present in ${componentsDir}. Use \`matter-cli add ${slug}\` instead.`,
        )
      }
    }
    toUpdate = components
  }

  io.log(`Updating ${toUpdate.length} component(s) from ${registryUrl}…`)

  await runAdd(
    toUpdate,
    {
      registry: registryUrl,
      ref: undefined,
      force: opts.force,
      cliVersion: opts.cliVersion,
    },
    io,
  )
}

async function safeReaddir(path: string): Promise<Dirent[]> {
  try {
    return await readdir(path, { withFileTypes: true })
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return []
    throw err
  }
}

function slugIsInRegistry(slug: string, registry: Registry): boolean {
  const entry = registry.components[slug]

  if (entry === undefined) return false

  // Registry `file` is either `<slug>.tsx` (flat) or `<slug>/<slug>.tsx` (subdir).
  // Match the basename without extension against the slug.
  return basename(entry.file).replace(/\.(tsx|ts)$/, '') === slug
}
