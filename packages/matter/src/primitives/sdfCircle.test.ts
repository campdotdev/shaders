import { describe, it, expect } from 'vitest'
import { uv, vec2 } from 'three/tsl'
import { sdfCircle } from './sdfCircle.js'

describe('sdfCircle', () => {
  it('returns a TSL node with a numeric radius', () => {
    const p = (uv() as unknown as { sub(v: unknown): unknown }).sub(vec2(0.5, 0.5))
    expect(sdfCircle(p as never, 0.25)).toBeDefined()
  })
})
