import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

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

const REGISTRY_DIR = resolve(process.cwd(), '..', '..', 'registry')

export type RegistrySlug =
  | 'linear-gradient'
  | 'noise-field'
  | 'dot-field'
  | 'waves'
  | 'mesh-gradient'
  | 'aurora'

export async function readRegistrySource(slug: RegistrySlug): Promise<string> {
  const path = resolve(REGISTRY_DIR, `${slug}.tsx`)
  return readFile(path, 'utf8')
}
