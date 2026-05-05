import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readUrl } from './readUrl.js'

const FIXTURE_DIR = fileURLToPath(new URL('../test-fixtures/registry/', import.meta.url))

describe('readUrl', () => {
  it('reads a file:// URL and returns its contents as a string', async () => {
    const url = `file://${FIXTURE_DIR}registry.json`
    const contents = await readUrl(url)
    expect(contents).toContain('"synthetic-component"')
  })

  it('throws a clear error when a file:// URL points at a missing file', async () => {
    const url = `file://${FIXTURE_DIR}does-not-exist.json`
    await expect(readUrl(url)).rejects.toThrow(/does-not-exist\.json/)
  })

  it('rejects unsupported protocols (e.g. ftp://)', async () => {
    await expect(readUrl('ftp://example.com/registry.json')).rejects.toThrow(/protocol/i)
  })
})
