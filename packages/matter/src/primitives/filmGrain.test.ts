import { uv } from 'three/tsl'
import { describe, expect, it } from 'vitest'

import { filmGrain } from './filmGrain.js'

describe('filmGrain', () => {
  it('returns a TSL node with a number intensity (static grain)', () => {
    const n = filmGrain(uv(), 0.1)

    expect(n).toBeDefined()
  })

  it('accepts a node intensity (for animated intensity)', () => {
    const n = filmGrain(uv(), uv().x)

    expect(n).toBeDefined()
  })

  it('accepts an optional time-offset node (for twinkling grain)', () => {
    const n = filmGrain(uv(), 0.1, uv().x)

    expect(n).toBeDefined()
  })
})
