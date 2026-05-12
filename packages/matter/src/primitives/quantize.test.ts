import { describe, it, expect } from 'vite-plus/test'
import { uv } from 'three/tsl'
import { quantize } from './quantize.js'

describe('quantize', () => {
  it('returns a TSL node for steps > 1', () => {
    const q = quantize(uv().x, 4)
    expect(q).toBeDefined()
  })

  it('handles steps=1 without throwing', () => {
    expect(() => quantize(uv().x, 1)).not.toThrow()
  })

  it('handles steps=2', () => {
    const q = quantize(uv().x, 2)
    expect(q).toBeDefined()
  })
})
