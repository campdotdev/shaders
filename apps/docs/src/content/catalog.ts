import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { cache } from 'react'

import { PRIMITIVES } from '@/data/primitives'

import { parseRegistry } from './schema'

const REGISTRY_JSON = resolve(process.cwd(), '..', '..', 'registry', 'registry.json')

interface CatalogRecord {
  url: string
  label: string
  description: string
  source: 'components' | 'primitives'
  order: number
  tags: string[]
}

function prettifySlug(slug: string): string {
  return slug
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
}

export const getComponentsCatalog = cache(async (): Promise<CatalogRecord[]> => {
  const raw = await readFile(REGISTRY_JSON, 'utf8')
  const data = parseRegistry(JSON.parse(raw), REGISTRY_JSON)

  return Object.entries(data.components).map(([slug, info], i) => ({
    url: `/components/${slug}`,
    label: prettifySlug(slug),
    description: info.description,
    source: 'components' as const,
    order: i * 10,
    tags: [],
  }))
})

// eslint-disable-next-line @typescript-eslint/require-await -- kept async for parity with getComponentsCatalog and to allow future async additions
export const getPrimitivesCatalog = cache(async (): Promise<CatalogRecord[]> => {
  return PRIMITIVES.map((p, i) => ({
    url: `/primitives/${p.slug}`,
    label: p.name,
    description: p.description,
    source: 'primitives' as const,
    order: i * 10,
    tags: [],
  }))
})

export const getCatalogRecords = cache(
  async (source: 'components' | 'primitives'): Promise<CatalogRecord[]> => {
    if (source === 'components') return getComponentsCatalog()

    return getPrimitivesCatalog()
  },
)
