import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fetchRegistry, fetchComponentSource } from './fetchRegistry.js'

const FIXTURE_BASE = `file://${fileURLToPath(new URL('../test-fixtures/registry/', import.meta.url))}`

describe('fetchRegistry', () => {
  it('parses registry.json from a base URL', async () => {
    const reg = await fetchRegistry(FIXTURE_BASE)
    expect(reg.components['synthetic-component']).toBeDefined()
    expect(reg.components['synthetic-component']?.file).toBe('synthetic-component.tsx')
  })

  it('throws when the registry JSON is malformed', async () => {
    // Pointing at a non-JSON file (the README) gives invalid JSON.
    const bad = `file://${fileURLToPath(new URL('../test-fixtures/', import.meta.url))}`
    await expect(fetchRegistry(bad)).rejects.toThrow()
  })

  it('joins base URL + filename without losing the trailing slash', async () => {
    // Whether the user supplies "…/registry" or "…/registry/", fetchRegistry
    // should both succeed at locating registry.json.
    const noTrailingSlash = FIXTURE_BASE.replace(/\/$/, '')
    const reg = await fetchRegistry(noTrailingSlash)
    expect(reg.components['synthetic-component']).toBeDefined()
  })

  it('rejects an array-shaped "components" field', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = await mkdtemp(join(tmpdir(), 'matter-registry-array-'))
    await writeFile(
      join(dir, 'registry.json'),
      JSON.stringify({ version: '0', components: [] }),
      'utf-8',
    )
    await expect(fetchRegistry(`file://${dir}/`)).rejects.toThrow(/components.*object/i)
    await rm(dir, { recursive: true, force: true })
  })
})

describe('fetchComponentSource', () => {
  it('reads the source file referenced by a registry entry', async () => {
    const src = await fetchComponentSource(FIXTURE_BASE, 'synthetic-component.tsx')
    expect(src).toContain('SyntheticComponent')
    expect(src).toContain('@matter-internal/lib')
  })
})
