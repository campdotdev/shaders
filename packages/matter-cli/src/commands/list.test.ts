import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { runList } from './list.js'

const FIXTURE_BASE = `file://${fileURLToPath(new URL('../test-fixtures/registry/', import.meta.url))}`

describe('runList', () => {
  it('prints one line per component using a registry URL override', async () => {
    const log = vi.fn()
    await runList({ registry: FIXTURE_BASE, ref: 'main' }, { log })
    const output = log.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('synthetic-component')
    expect(output).toContain('A tiny synthetic component')
    expect(output).toContain('tier 1')
  })

  // Failure modes (unreachable registry, malformed JSON, missing components key)
  // are tested by fetchRegistry's own suite — runList doesn't add behavior there.
  it.todo('errors clearly when the registry has zero components')
})
