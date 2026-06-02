import { uv } from 'three/tsl'
import { describe, expect, it } from 'vitest'

import { voronoi } from './voronoi.js'

describe('voronoi', () => {
  it('returns a TSL node when sampled at uv()', () => {
    expect(voronoi(uv())).toBeDefined()
  })
})
