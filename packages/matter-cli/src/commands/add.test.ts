import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MATTER_CONFIG, writeMatterConfig } from '../config/matterConfig.js'
import { runAdd } from './add.js'

const FIXTURE_BASE = `file://${fileURLToPath(new URL('../test-fixtures/registry/', import.meta.url))}`

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'matter-add-test-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function seedConfig(overrides: Partial<typeof DEFAULT_MATTER_CONFIG> = {}) {
  await writeMatterConfig(dir, {
    ...DEFAULT_MATTER_CONFIG,
    registryUrl: FIXTURE_BASE,
    componentsDir: 'src/components/matter',
    ...overrides,
  })
}

describe('runAdd (single component, no aliases)', () => {
  it('writes the component source to componentsDir/<name>.tsx', async () => {
    await seedConfig()
    await runAdd(['synthetic-component'], {}, { cwd: dir, log: vi.fn() })
    const target = join(dir, 'src/components/matter/synthetic-component.tsx')
    const written = await readFile(target, 'utf-8')
    expect(written).toContain('SyntheticComponent')
    // No alias rewriting yet — the @matter-internal import comes through verbatim.
    expect(written).toContain('@matter-internal/lib')
  })

  it('creates componentsDir if it does not exist', async () => {
    await seedConfig({ componentsDir: 'app/very/nested/matter' })
    await runAdd(['synthetic-component'], {}, { cwd: dir, log: vi.fn() })
    const target = join(dir, 'app/very/nested/matter/synthetic-component.tsx')
    const written = await readFile(target, 'utf-8')
    expect(written).toContain('SyntheticComponent')
  })

  it('refuses to overwrite an existing file without --force', async () => {
    await seedConfig()
    await mkdir(join(dir, 'src/components/matter'), { recursive: true })
    await writeFile(join(dir, 'src/components/matter/synthetic-component.tsx'), 'existing', 'utf-8')
    await expect(
      runAdd(['synthetic-component'], {}, { cwd: dir, log: vi.fn() }),
    ).rejects.toThrow(/already exists/)
  })

  it('overwrites with --force', async () => {
    await seedConfig()
    await mkdir(join(dir, 'src/components/matter'), { recursive: true })
    await writeFile(join(dir, 'src/components/matter/synthetic-component.tsx'), 'old', 'utf-8')
    await runAdd(['synthetic-component'], { force: true }, { cwd: dir, log: vi.fn() })
    const written = await readFile(join(dir, 'src/components/matter/synthetic-component.tsx'), 'utf-8')
    expect(written).toContain('SyntheticComponent')
  })

  it('errors clearly when the requested component is not in the registry', async () => {
    await seedConfig()
    await expect(
      runAdd(['nope'], {}, { cwd: dir, log: vi.fn() }),
    ).rejects.toThrow(/nope.*not found/i)
  })

  it('prints a basic install hint with the component dependencies', async () => {
    await seedConfig()
    const log = vi.fn()
    await runAdd(['synthetic-component'], {}, { cwd: dir, log })
    const output = log.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toMatch(/npm install.*react/)
  })
})
