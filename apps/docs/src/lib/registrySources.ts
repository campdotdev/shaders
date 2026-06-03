import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { cache } from 'react'

const REGISTRY_DIR = resolve(process.cwd(), '..', '..', 'registry')

type RegistrySlug =
  | 'linear-gradient'
  | 'noise-field'
  | 'dot-field'
  | 'waves'
  | 'mesh-gradient'
  | 'aurora'

export const readRegistrySource = cache(async (slug: RegistrySlug): Promise<string> => {
  const path = resolve(REGISTRY_DIR, `${slug}.tsx`)

  if (!path.startsWith(REGISTRY_DIR + sep)) {
    throw new Error(`Registry path escapes registry dir: ${slug}`)
  }

  return readFile(path, 'utf8')
})
