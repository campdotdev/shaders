import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { cache } from 'react'

// Server-only — reads a registry component source file at build/request
// time. CodeBlock uses this to display registry sources verbatim.
//
// Why not `?raw`? Next.js 15's flight-loader rejects webpack `asset/source`
// modules in the Server Component graph ("Unexpected module type
// asset/source"). And `createRequire(import.meta.url)` doesn't survive the
// webpack bundle (`import.meta.url` becomes a numeric module ID). The
// cleanest workaround is a `process.cwd()`-anchored path read at request
// time. `pnpm --filter @matter/docs build` and `next dev` both run with
// `cwd === apps/docs`, so the registry sits at `../../registry`.
//
// `react.cache()` dedupes within a single render — when 4.2.b's six pages
// each call this on the same render (e.g., during static generation), each
// distinct slug reads disk once.

const REGISTRY_DIR = resolve(process.cwd(), '..', '..', 'registry')

export type RegistrySlug =
  | 'linear-gradient'
  | 'noise-field'
  | 'dot-field'
  | 'waves'
  | 'mesh-gradient'
  | 'aurora'

export const readRegistrySource = cache(async (slug: RegistrySlug): Promise<string> => {
  const path = resolve(REGISTRY_DIR, `${slug}.tsx`)
  // Defense in depth: even though `RegistrySlug` is a closed union, a future
  // caller might widen the type with `as RegistrySlug`. Refuse any path that
  // escapes the registry dir.
  if (!path.startsWith(REGISTRY_DIR + sep)) {
    throw new Error(`Registry path escapes registry dir: ${slug}`)
  }
  return readFile(path, 'utf8')
})
