import { describe, it, expect } from 'vitest'
import { uv } from 'three/tsl'
import { noise } from './noise.js'

describe('noise', () => {
  it('returns a TSL node when called with uv()', () => {
    const n = noise(uv())
    expect(n).toBeDefined()
    expect(n).not.toBeNull()
  })
})
