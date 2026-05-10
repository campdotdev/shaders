import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_MATTER_CONFIG,
  readMatterConfig,
  writeMatterConfig,
  type MatterConfig,
} from './matterConfig.js'

describe('DEFAULT_MATTER_CONFIG.registryUrl', () => {
  it('points at the lovo-hq/matter org (NOT lovo/matter — that is a 404)', () => {
    expect(DEFAULT_MATTER_CONFIG.registryUrl).toContain('/lovo-hq/matter/')
    expect(DEFAULT_MATTER_CONFIG.registryUrl).not.toMatch(/\/lovo\/matter\//)
  })

  it('contains the ${ref} placeholder for resolveRef substitution', () => {
    expect(DEFAULT_MATTER_CONFIG.registryUrl).toContain('${ref}')
  })

  it('targets the registry/ subdirectory', () => {
    expect(DEFAULT_MATTER_CONFIG.registryUrl).toMatch(/\/registry$|\/registry\/$/)
  })
})

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'matter-config-test-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('matterConfig', () => {
  it('writes the default config when none exists', async () => {
    await writeMatterConfig(dir, DEFAULT_MATTER_CONFIG)
    const raw = await readFile(join(dir, 'matter.config.json'), 'utf-8')
    expect(JSON.parse(raw)).toEqual(DEFAULT_MATTER_CONFIG)
  })

  it('reads back what it wrote', async () => {
    const cfg: MatterConfig = {
      ...DEFAULT_MATTER_CONFIG,
      componentsDir: 'app/matter',
    }
    await writeMatterConfig(dir, cfg)
    const read = await readMatterConfig(dir)
    expect(read).toEqual(cfg)
  })

  it('throws a clear error when matter.config.json is missing', async () => {
    await expect(readMatterConfig(dir)).rejects.toThrow(/matter\.config\.json not found/)
  })

  it('throws a clear error when matter.config.json is malformed JSON', async () => {
    await writeFile(join(dir, 'matter.config.json'), '{ bad json }', 'utf-8')
    await expect(readMatterConfig(dir)).rejects.toThrow(/not valid JSON/)
  })

  it('throws when required fields are missing', async () => {
    await writeFile(join(dir, 'matter.config.json'), JSON.stringify({ tsx: true }), 'utf-8')
    await expect(readMatterConfig(dir)).rejects.toThrow(/componentsDir/)
  })
})
