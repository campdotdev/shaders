import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { cache } from 'react'

const REGISTRY_DIR = resolve(process.cwd(), '..', '..', 'registry')

type RegistrySlug =
  | 'linear-gradient'
  | 'simplex-noise'
  | 'dot-field'
  | 'waves'
  | 'mesh-gradient'
  | 'aurora'

const SLUG_FILES: Record<RegistrySlug, string> = {
  'linear-gradient': 'linear-gradient/linear-gradient.tsx',
  'simplex-noise': 'simplex-noise/simplex-noise.tsx',
  'dot-field': 'dot-field.tsx',
  waves: 'waves.tsx',
  'mesh-gradient': 'mesh-gradient/mesh-gradient.tsx',
  aurora: 'aurora/aurora.tsx',
}

export const readRegistrySource = cache(async (slug: RegistrySlug): Promise<string> => {
  const relPath = SLUG_FILES[slug]
  const path = resolve(REGISTRY_DIR, relPath)

  if (!path.startsWith(REGISTRY_DIR + sep)) {
    throw new Error(`Registry path escapes registry dir: ${slug}`)
  }

  return readFile(path, 'utf8')
})
