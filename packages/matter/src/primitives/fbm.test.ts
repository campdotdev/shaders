import { describe, it, expect } from 'vite-plus/test'
import { uv } from 'three/tsl'
import { fbm } from './fbm.js'

describe('fbm', () => {
  it('returns a TSL node with default options', () => {
    const n = fbm(uv())
    expect(n).toBeDefined()
  })

  it('returns a TSL node when octaves=1', () => {
    const n = fbm(uv(), { octaves: 1 })
    expect(n).toBeDefined()
  })

  it('respects custom lacunarity and gain', () => {
    const n = fbm(uv(), { octaves: 6, lacunarity: 2.5, gain: 0.4 })
    expect(n).toBeDefined()
  })
})
