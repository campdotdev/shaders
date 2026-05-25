import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { cache } from 'react'
import { PRIMITIVES } from '@/data/primitives'

const REGISTRY_JSON = resolve(
  process.cwd(),
  '..',
  '..',
  'registry',
  'registry.json',
)

export interface CatalogRecord {
  url: string
  label: string
  description: string
  source: 'components' | 'primitives'
  order: number
  tags: string[]
}

interface RegistryComponent {
  description: string
  tier: number
  file?: string
  dependencies?: string[]
  uses_primitives?: string[]
}

interface RegistryFile {
  version: string
  components: Record<string, RegistryComponent>
}

function prettifySlug(slug: string): string {
  return slug
    .split('-')
    .map((s) => (s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s))
    .join(' ')
}

export const getComponentsCatalog = cache(
  async (): Promise<CatalogRecord[]> => {
    const raw = await readFile(REGISTRY_JSON, 'utf8')
    const data = JSON.parse(raw) as RegistryFile
    return Object.entries(data.components).map(([slug, info], i) => ({
      url: `/components/${slug}`,
      label: prettifySlug(slug),
      description: info.description,
      source: 'components' as const,
      order: i * 10,
      tags: [],
    }))
  },
)

export const getPrimitivesCatalog = cache(
  async (): Promise<CatalogRecord[]> => {
    return PRIMITIVES.map((p, i) => ({
      url: `/primitives/${p.slug}`,
      label: p.name,
      description: p.description,
      source: 'primitives' as const,
      order: i * 10,
      tags: [],
    }))
  },
)

export const getCatalogRecords = cache(
  async (source: 'components' | 'primitives'): Promise<CatalogRecord[]> => {
    if (source === 'components') return getComponentsCatalog()
    return getPrimitivesCatalog()
  },
)
