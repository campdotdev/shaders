import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runPoster } from '../commands/poster.js'

const E2E_ENABLED = process.env.MATTER_E2E === '1'

const FIXTURES = new URL('../test-fixtures/posters/', import.meta.url).pathname

const cases = [
  { name: 'single-linear-gradient', file: 'single-linear-gradient.tsx', extra: {} },
  { name: 'gradient-plus-grain', file: 'gradient-plus-grain.tsx', extra: {} },
  { name: 'aurora-with-time', file: 'aurora-with-time.tsx', extra: { timeSeconds: 2 } },
  {
    name: 'named-export',
    file: 'named-export.tsx',
    extra: { exportName: 'NamedExport' },
  },
] as const

describe.skipIf(!E2E_ENABLED)('runPoster — E2E (MATTER_E2E=1)', () => {
  let outDir: string

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), 'matter-poster-e2e-'))
  })

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true })
  })

  for (const c of cases) {
    it(`produces a PNG for ${c.name}`, async () => {
      const out = join(outDir, `${c.name}.png`)
      await runPoster(
        {
          from: join(FIXTURES, c.file),
          out,
          exportName: 'default',
          timeSeconds: 0,
          width: 800,
          height: 600,
          ...c.extra,
        },
        { cwd: process.cwd(), log: vi.fn() },
      )
      const s = await stat(out)
      expect(s.size).toBeGreaterThan(1024) // > 1 KB
      expect(s.size).toBeLessThan(5 * 1024 * 1024) // < 5 MB
    }, 30_000)
  }
})
