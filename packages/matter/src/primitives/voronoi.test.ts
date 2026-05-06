import { describe, it, expect } from 'vitest'
import { uv } from 'three/tsl'
import { voronoi } from './voronoi.js'

describe('voronoi', () => {
  it('returns a TSL node when sampled at uv()', () => {
    expect(voronoi(uv())).toBeDefined()
  })
})
