import { describe, it, expect } from 'vitest'
import { uv, vec2 } from 'three/tsl'
import { cursorRipple } from './cursorRipple.js'

describe('cursorRipple', () => {
  it('returns a TSL node with default options', () => {
    expect(cursorRipple(uv(), vec2(0.5, 0.5))).toBeDefined()
  })

  it('respects custom options', () => {
    expect(
      cursorRipple(uv(), vec2(0.5, 0.5), {
        reach: 0.2,
        frequency: 50,
        speed: 3,
        amplitude: 0.3,
      }),
    ).toBeDefined()
  })
})
