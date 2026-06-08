import { describe, expect, it, vi } from 'vitest'

import { runPoster } from './poster.js'

const base = {
  from: '/tmp/nope.tsx',
  out: '/tmp/poster.png',
  exportName: 'default',
  timeSeconds: 0,
  width: 1280,
  height: 720,
}

describe('runPoster — flag validation', () => {
  it('rejects width <= 0', async () => {
    await expect(runPoster({ ...base, width: 0 }, { cwd: '/tmp', log: vi.fn() })).rejects.toThrow(
      /--width.*must be a positive integer ≤ 4096/,
    )
  })

  it('rejects width > 4096', async () => {
    await expect(
      runPoster({ ...base, width: 5000 }, { cwd: '/tmp', log: vi.fn() }),
    ).rejects.toThrow(/--width.*must be a positive integer ≤ 4096/)
  })

  it('rejects height <= 0', async () => {
    await expect(runPoster({ ...base, height: -1 }, { cwd: '/tmp', log: vi.fn() })).rejects.toThrow(
      /--height.*must be a positive integer ≤ 4096/,
    )
  })

  it('rejects timeSeconds < 0', async () => {
    await expect(
      runPoster({ ...base, timeSeconds: -1 }, { cwd: '/tmp', log: vi.fn() }),
    ).rejects.toThrow(/--time.*must be ≥ 0/)
  })
})

describe('runPoster — --from validation', () => {
  it('throws if --from file does not exist', async () => {
    await expect(
      runPoster(
        { ...base, from: '/tmp/__matter_test_missing__.tsx' },
        { cwd: '/tmp', log: vi.fn() },
      ),
    ).rejects.toThrow(/--from .* file not found/)
  })
})
